import { Response , NextFunction} from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";
import {
  calculateZScore,
  calculatePercentile,
  calculatePunchPower,
} from "../services/calculation.service";
import {
  snapshot_type,
  competitive_level,
  weight_class,
  enrollment_status,
} from "@prisma/client";
import { Prisma } from "@prisma/client";

/* بسم الله الرحمن الرحيم 
مبدأيا كده في حاجات ف الكود يعني حااسس انها ناقصه زي الجزء دا اظن لازم اسال كريم فيه 
زي مثلا ال levels اللي عندي ف البرنامج 
علشان انا خنا ضايف 2 levels 
const validLevels = ["amateur", "professional"]وهما ال 
*/

// ==========================================
// Helper Functions for CR-14 & CR-15
// ==========================================

const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const getAgeGroupId = (dateOfBirth: Date | null | undefined): number => {
  // Guard Clause: حماية في حالة عدم إرسال تاريخ الميلاد أو إرساله بشكل خاطئ
  if (
    !dateOfBirth ||
    !(dateOfBirth instanceof Date) ||
    isNaN(dateOfBirth.getTime())
  ) {
    console.warn(
      "Invalid or missing dateOfBirth. Defaulting to Age Group 2 (18-35).",
    );
    return 2; 
  }

  const age = new Date().getFullYear() - dateOfBirth.getFullYear(); // modified function
  if (age < 18) return 1; // Under 18
  if (age <= 35) return 2; // 18-35
  return 3; // 35+
};


// Modification 1: Use exact weight class names from DB and define as Enum
const getAdjacentWeightClasses = (
  weightClass: weight_class,
): weight_class[] => {
  
  if (!weightClass) return [];

  const classes: weight_class[] = [
    "flyweight",
    "bantamweight",
    "featherweight",
    "lightweight",
    "light_welterweight",
    "welterweight",
    "light_middleweight",
    "middleweight",
    "super_middleweight",
    "light_heavyweight",
    "cruiserweight",
    "heavyweight",
  ];
  const idx = classes.indexOf(weightClass);
  if (idx === -1) return [];
  const adjacent: weight_class[] = [];
  if (idx > 0) adjacent.push(classes[idx - 1]);
  if (idx < classes.length - 1) adjacent.push(classes[idx + 1]);
  return adjacent;
};

/**
 * 5-level fallback cascade: with robust Error Handling //
 */
// Modification 2: Replace string with competitive_level and weight_class
const getPercentileWithFallback = async (
  testId: number,
  rawValue: number,
  higherIsBetter: boolean,
  userLevel: competitive_level,
  userWeight: weight_class,
  userAgeGroupId: number,
): Promise<{ percentile: number; fallbackLevel: number }> => {
  const getAbsoluteFallback = (val: number) =>
    Math.min(99, Math.max(1, Math.floor(val / 2)));

  try {
    const fallbackSteps: any[] = [
      { weight: userWeight, level: userLevel, ageGroup: userAgeGroupId },
      { weight: userWeight, level: userLevel, ageGroup: undefined },
      {
        weight: { in: getAdjacentWeightClasses(userWeight) },
        level: userLevel,
        ageGroup: undefined,
      },
      { weight: undefined, level: userLevel, ageGroup: undefined },
      { weight: undefined, level: undefined, ageGroup: undefined },
    ];

    for (let step = 0; step < fallbackSteps.length; step++) {
      const criteria = fallbackSteps[step];

      // محاط بـ try/catch داخلي لضمان استمرار اللوب حتى لو خطوة واحدة فشلت في الـ Query
      try {
        const norm = await prisma.normative_data.findFirst({
          where: {
            attribute_test_id: testId,
            ...(criteria.weight && { weight_class: criteria.weight }),
            ...(criteria.level && { level: criteria.level }),
            ...(criteria.ageGroup && { age_group_id: criteria.ageGroup }),
          },
        });

        if (norm) {
          const mean = Number(norm.mean_value);
          const stdDev = Number(norm.std_dev);

          // حماية هامة جداً: منع الـ Division by Zero لو الـ standard deviation بصفر في قاعدة البيانات
          if (stdDev === 0) {
            console.warn(
              `Standard deviation is 0 for testId: ${testId} in fallback step ${step}. Skipping to next fallback.`,
            );
            continue;
          }

          const z = calculateZScore(rawValue, mean, stdDev, higherIsBetter);


          if (isNaN(z) || !isFinite(z)) {
            console.warn(
              `Invalid Z-Score calculated: ${z} for testId: ${testId}.`,
            );
            continue;
          }

          const percentile = calculatePercentile(z);
          return { percentile, fallbackLevel: step };
        }
      } catch (stepError) {
        console.error(
          `Database error during fallback step ${step} for testId ${testId}:`,
          stepError,
        );
        // بنعمل continue عشان نجرب الخطوة الأسهل اللي بعدها بدل ما نوقع السيرفر
        continue;
      }
    }


    return { percentile: getAbsoluteFallback(rawValue), fallbackLevel: 4 };
  } catch (globalError) {
    // حماية عليا لو الكود الخارجي حصل فيه أي مشكلة غير متوقعة
    console.error(
      `Global error in getPercentileWithFallback for testId ${testId}:`,
      globalError,
    );
    return { percentile: getAbsoluteFallback(rawValue), fallbackLevel: 4 };
  }
};

const getTestName = async (testId: number): Promise<string> => {
  try {
    if (!testId || isNaN(testId)) return "Unknown";

    const test = await prisma.attribute_tests.findUnique({
      where: { id: testId },
      select: { test_name: true },
    });
    return test?.test_name || "Unknown";
  } catch (error) {
    console.error(`Error fetching test name for ID ${testId}:`, error);
    return "Unknown"; // بنرجع اسم افتراضي عشان الـ Response يكمل وميضربش 500
  }
};
// ==========================================
// 3.1 & 3.2: Sport Profiles
// ==========================================
// Validates
export const createSportProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const { sport_id, level, weight_class, is_primary } = req.body;
    const parsedSportId = Number(sport_id);

    const sportExists = await prisma.sports.findUnique({
      where: { id: parsedSportId }
    });

    if (!sportExists) {
      res.status(404).json({
        success: false,
        error: "Sport not found."
      });
      return;
    }

    const existingProfile = await prisma.user_sport_profiles.findFirst({
      where: { 
        user_id: userId, 
        sport_id: parsedSportId 
      },
    });

    if (existingProfile) {
      res.status(409).json({
        success: false,
        error: "Conflict — sport profile already exists. Use PATCH to update.",
      });
      return;
    }


    const newProfile = await prisma.user_sport_profiles.create({
      data: {
        user_id: userId,
        sport_id: parsedSportId,
        level: level.toLowerCase().trim(),
        weight_class: weight_class.toLowerCase().trim(),
        is_primary: is_primary !== undefined ? Boolean(is_primary) : true,
      },
    });

    res.status(201).json(newProfile);
  } catch (error: any) {
    console.error("Create Sport Profile Error:", error);
    next(error); 
  }
};
// validated
export const updateSportProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const { level, weight_class } = req.body;

    
    const existingProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, is_primary: true },
    });

    
    if (!existingProfile) {
      res.status(404).json({
        success: false,
        error: "Not found — create profile first.",
      });
      return;
    }

    
    const updateData: any = {};
    if (level) updateData.level = level.toLowerCase().trim();
    if (weight_class) updateData.weight_class = weight_class.toLowerCase().trim();


    await prisma.user_sport_profiles.update({
      where: { id: existingProfile.id },
      data: updateData,
    });

    
    let successMessage = "Both fields updated.";
    if (level && !weight_class) {
      successMessage = "Level updated. weight_class unchanged.";
    } else if (!level && weight_class) {
      successMessage = "Weight class updated. level unchanged.";
    }

    
    res.status(200).json({
      success: true,
      message: successMessage
    });

  } catch (error: any) {
    console.error("Update Sport Profile Error:", error);
    next(error); 
  }
};

// validated

export const createSnapshot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const { sport_id, snapshot_type, program_enrollment_id, notes, test_values } = req.body;
    const parsedSportId = Number(sport_id);

    
    const finalResult = await prisma.$transaction(async (tx) => {
      
      const rawTestIds: number[] = test_values.map((t: any) => Number(t.attribute_test_id));
      const uniqueTestIds = [...new Set(rawTestIds)];

      const testsInfo = await tx.attribute_tests.findMany({
        where: { id: { in: uniqueTestIds } },
      });

      
      if (testsInfo.length !== uniqueTestIds.length) {
        throw new Error("INVALID_TEST_IDS");
      }


      const snapshot = await tx.physical_snapshots.create({
        data: {
          user_id: userId,
          sport_id: parsedSportId,
          snapshot_type,
          program_enrollment_id: program_enrollment_id ? String(program_enrollment_id) : null,
          notes,
        },
      });


      const dataToInsert = test_values.map((test: any) => {
        const info = testsInfo.find((ti) => ti.id === Number(test.attribute_test_id));
        return {
          snapshot_id: snapshot.id,
          attribute_test_id: Number(test.attribute_test_id),
          value: new Prisma.Decimal(test.value),
          unit: info?.unit || "unknown",
        };
      });

      await tx.snapshot_test_values.createMany({ data: dataToInsert });

      const resolvedTestValues = test_values.map((test: any) => {
        const info = testsInfo.find((ti) => ti.id === Number(test.attribute_test_id));
        return {
          attribute_test_id: Number(test.attribute_test_id),
          test_name: info?.test_name || "unknown", 
          value: Number(test.value),
          unit: info?.unit || "unknown"
        };
      });

      return {
        id: snapshot.id,
        user_id: snapshot.user_id,
        sport_id: snapshot.sport_id,
        snapshot_type: snapshot.snapshot_type,
        created_at: snapshot.created_at,
        test_values: resolvedTestValues
      };
    });

     res.status(201).json(finalResult);

  } catch (error: any) {
    console.error("Create Snapshot Error:", error);

     if (error.message === "INVALID_TEST_IDS") {
      res.status(404).json({
        success: false,
        error: "One or more provided attribute_test_ids do not exist."
      });
      return;
    }

    next(error); 
  }
};

// IN Progress
export const getSnapshots = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    //
    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized. User context missing." });
      return;
    }

    let limit = parseInt(req.query.limit as string);
    if (isNaN(limit) || limit <= 0) {
      limit = 20; 
    } else if (limit > 100) {
      limit = 100; 
    }

    let offset = parseInt(req.query.offset as string);
    if (isNaN(offset) || offset < 0) {
      offset = 0; 
    }

    // Force TypeScript to accept Query type code kareem el2adeeem
    // const type = req.query.type as unknown as snapshot_type | undefined;

    // const whereClause: any = { user_id: userId };
    // if (type) whereClause.snapshot_type = type;

    const typeStr = req.query.type as string | undefined;
    const validSnapshotTypes = [
      "manual_update",
      "program_baseline",
      "program_posttest",
    ];

    if (typeStr && !validSnapshotTypes.includes(typeStr)) {
      res.status(400).json({
        success: false,
        error: `Invalid snapshot type. Allowed values are: ${validSnapshotTypes.join(", ")}`,
      });
      return;
    }

    const type = typeStr as snapshot_type | undefined;

    // بناء الـ Filter بشكل ديناميكي وآمن
    const whereClause: any = { user_id: userId };
    if (type) whereClause.snapshot_type = type;

    // Separated to prevent TypeScript issues
    const totalCount = await prisma.physical_snapshots.count({
      where: whereClause,
    });
    const snapshots = await prisma.physical_snapshots.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          include: { attribute_tests: { select: { test_name: true } } },
        },
      },
    });

    const formattedSnapshots = snapshots.map((snap) => ({
      id: snap.id,
      snapshot_type: snap.snapshot_type,
      created_at: snap.created_at,
      notes: snap.notes,
      test_values: snap.snapshot_test_values.map((tv) => ({
        attribute_test_id: tv.attribute_test_id,
        test_name: tv.attribute_tests?.test_name,
        value: tv.value,
        unit: tv.unit,
      })),
    }));

    res.status(200).json({
      success: true,
      data: formattedSnapshots,
      meta: { total: totalCount, limit, offset },
    });
  } catch (error: any) {
    console.error("Get Snapshots Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch snapshots." });
  }
};

// ==========================================
// 3.5: Unified Radar & Punch Power Data (CR-14 & CR-15 fixed)
// ==========================================

export const getRadarData = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized. User context missing." });
      return;
    }

    const levelStr = req.query.cohort_level as string | undefined;
    const weightStr = req.query.cohort_weight as string | undefined;

    const validLevels = ["amateur", "professional","novice"]; 
    const validWeights = [
      "flyweight",
      "bantamweight",
      "featherweight",
      "lightweight",
      "light_welterweight",
      "welterweight",
      "light_middleweight",
      "middleweight",
      "super_middleweight",
      "light_heavyweight",
      "cruiserweight",
      "heavyweight",
    ];

    if (levelStr && !validLevels.includes(levelStr.toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: `Invalid cohort_level. Allowed values: ${validLevels.join(", ")}`,
      });
      return;
    }

    if (weightStr && !validWeights.includes(weightStr.toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: `Invalid cohort_weight. Allowed values: ${validWeights.join(", ")}`,
      });
      return;
    }

    const cohortLevel = levelStr as competitive_level | undefined;
    const cohortWeight = weightStr as weight_class | undefined;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        date_of_birth: true,
        user_sport_profiles: { where: { is_primary: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    const profile = user.user_sport_profiles[0];
    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found." });
      return;
    }

    const ageGroupId = getAgeGroupId(user.date_of_birth);
    const targetLevel = cohortLevel || profile.level;
    const targetWeight = cohortWeight || profile.weight_class;

    const latestSnapshot = await prisma.physical_snapshots.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          include: {
            attribute_tests: {
              include: { sport_attributes: true }, // Fixed typo here
            },
          },
        },
      },
    });

    // if (!latestSnapshot) {
    //   res.status(404).json({ success: false, error: "No snapshot found." });
    //   return;
    // }

    if (!latestSnapshot || latestSnapshot.snapshot_test_values.length === 0) {
      res.status(404).json({
        success: false,
        error: "No physical snapshot data found for this athlete.",
      });
      return;
    }

    const attributeMap = new Map<
      number,
      { name: string; tests: any[]; totalWeight: number }
    >();
    for (const testVal of latestSnapshot.snapshot_test_values) {
      const attr = testVal.attribute_tests?.sport_attributes;
      if (!attr) continue;
      const attrId = attr.id;
      if (!attributeMap.has(attrId)) {
        attributeMap.set(attrId, {
          name: attr.name,
          tests: [],
          totalWeight: 0,
        });
      }
      const entry = attributeMap.get(attrId)!;

      // Modification: Read weight directly from the table
      const weight = Number(testVal.attribute_tests?.weight || 1);

      entry.tests.push({
        testId: testVal.attribute_test_id,
        rawValue: Number(testVal.value),
        higherIsBetter: testVal.attribute_tests?.higher_is_better ?? true,
        weight: weight,
        unit: testVal.unit,
      });
      entry.totalWeight += weight;
    }
    //✅
    const radar_axes: any[] = [];
    let foundationPct = 0,
      acceleratorPct = 0,
      transferPct = 0;

    //✅
    for (const [attrId, attrData] of attributeMap.entries()) {
      let weightedPercentileSum = 0;
      let highestFallback = 0;

      const processedTests = await Promise.all(
        attrData.tests.map(async (test) => {
          const percentileData = await getPercentileWithFallback(
            test.testId,
            test.rawValue,
            test.higherIsBetter,
            targetLevel,
            targetWeight,
            ageGroupId,
          );
          const testName = await getTestName(test.testId);

          // بنرجع كائن جديد مدمج فيه البيانات القديمة والجديدة
          return { ...test, ...percentileData, testName };
        }),
      );
      for (const test of processedTests) {
        // حساب المجموع الموزون للـ Percentiles
        weightedPercentileSum += test.percentile * test.weight;

        // تحديد أعلى مستوى fallback وصلنا له في الـ Attribute ده
        if (test.fallbackLevel > highestFallback) {
          highestFallback = test.fallbackLevel;
        }

        // تجميع الـ Percentiles الخاصة بحسابات الـ Punch Power
        if (test.testName === "Trap Bar Deadlift") {
          foundationPct = test.percentile;
        }
        if (
          test.testName === "Power Clean" ||
          test.testName === "Box Jump Height"
        ) {
          acceleratorPct = test.percentile;
        }
        if (test.testName === "Medicine Ball Rotational Throw") {
          transferPct = test.percentile;
        }
      }

      // ✅
      const finalPercentile =
        attrData.totalWeight > 0
          ? weightedPercentileSum / attrData.totalWeight
          : 0;

      //✅
      radar_axes.push({
        attribute_name: attrData.name,
        percentile: Math.round(finalPercentile),
        fallback_level: highestFallback,
      });
    }
    //✅
    const punch_power = {
      score: calculatePunchPower(foundationPct, acceleratorPct, transferPct),
      foundation: { percentile: foundationPct },
      accelerator: { percentile: acceleratorPct },
      transfer: { percentile: transferPct },
    };

    res.status(200).json({
      success: true,
      data: {
        radar_axes,
        punch_power,
        cohort_used: {
          weight_class: targetWeight,
          level: targetLevel,
          age_group:
            ageGroupId === 2 ? "18-35" : ageGroupId === 1 ? "Under 18" : "35+",
        },
        snapshot_date: latestSnapshot.created_at,
      },
    });
  } catch (error: any) {
    console.error("Get Radar Data Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to generate radar data" });
  }
};

// ==========================================
// 3.6: Progress Tracking (CR-16 fixed)
// ==========================================

export const getProgress = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized. User context missing." });
      return;
    }

    const attributeTestId = parseInt(req.params.attributeTestId as string);

    // if (isNaN(attributeTestId)) {
    //   res.status(400).json({ success: false, error: "Invalid test ID." });
    //   return;
    // }
    if (isNaN(attributeTestId) || attributeTestId <= 0) {
      res.status(400).json({
        success: false,
        error: "Invalid test ID. It must be a positive number.",
      });
      return;
    }

    const [testInfo, user, profile] = await Promise.all([
      prisma.attribute_tests.findUnique({ where: { id: attributeTestId } }),
      prisma.users.findUnique({
        where: { id: userId },
        select: { date_of_birth: true },
      }),
      prisma.user_sport_profiles.findFirst({
        where: { user_id: userId, is_primary: true },
      }),
    ]);

    // if (!testInfo || !profile || !user) {
    //   res.status(404).json({ success: false, error: "Data not found." });
    //   return;
    // }

    // one by one
    if (!testInfo) {
      res.status(404).json({
        success: false,
        error: `Attribute test with ID ${attributeTestId} not found.`,
      });
      return;
    }

    if (!user) {
      res.status(404).json({ success: false, error: "User record not found." });
      return;
    }

    if (!profile) {
      res.status(404).json({
        success: false,
        error:
          "Sport profile not found. Please create a primary profile first.",
      });
      return;
    }

    const ageGroupId = getAgeGroupId(user.date_of_birth);
    const userLevel = profile.level;
    const userWeight = profile.weight_class;

    // Modification: Handled null by adding a default value
    const higherIsBetter = testInfo.higher_is_better ?? true;

    const history = await prisma.physical_snapshots.findMany({
      where: {
        user_id: userId,
        snapshot_test_values: { some: { attribute_test_id: attributeTestId } },
      },
      orderBy: { created_at: "asc" },
      include: {
        snapshot_test_values: {
          where: { attribute_test_id: attributeTestId },
          take: 1,
        },
      },
    });

    // لو مفيش أي تاريخ مسجل للاختبار ده
    if (history.length === 0) {
      res.status(200).json({
        success: true,
        message: "No progress history found for this test yet.",
        data: {
          test_name: testInfo.test_name,
          unit: testInfo.unit,
          higher_is_better: higherIsBetter,
          data_points: [],
        },
      });
      return;
    }

    const data_points = await Promise.all(
      history.map(async (snap) => {
        const testValueRecord = snap.snapshot_test_values[0];
        // const rawValue = Number(snap.snapshot_test_values[0]?.value || 0);
        // حماية ضد السجلات المشوهة في قاعدة البيانات
        const rawValue = testValueRecord ? Number(testValueRecord.value) : 0;
        const { percentile } = await getPercentileWithFallback(
          attributeTestId,
          rawValue,
          higherIsBetter,
          userLevel,
          userWeight,
          ageGroupId,
        );
        return {
          date: snap.created_at,
          raw_value: rawValue,
          snapshot_type: snap.snapshot_type,
          percentile: Math.round(percentile),
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: {
        test_name: testInfo.test_name,
        unit: testInfo.unit,
        higher_is_better: higherIsBetter,
        data_points,
      },
    });
  } catch (error: any) {
    console.error("Get Progress Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch progress." });
  }
};

// ==========================================
// 3.7: Enrollments
// ==========================================

export const getMyEnrollments = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // 1. حماية: التأكد من وجود الـ User Context
    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized. User context missing." });
      return;
    }
    // //
    // const status = req.query.status as enrollment_status | undefined;
    // //
    // const whereClause: any = { user_id: userId };
    // if (status) whereClause.status = status;

    // 2. تأمين الـ Query Params لمنع كراش الـ Enum في قاعدة البيانات
    const statusStr = req.query.status as string | undefined;
    const validStatuses = ["active", "completed", "dropped"]; // ضيف الـ Enums الفعلية من الـ DB عندك

    if (statusStr && !validStatuses.includes(statusStr.toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Allowed values are: ${validStatuses.join(", ")}`,
      });
      return;
    }

    const status = statusStr as enrollment_status | undefined;

    // بناء الـ Filter بشكل ديناميكي بدون استخدام any
    const whereClause: { user_id: string; status?: enrollment_status } = {
      user_id: userId,
    };
    if (status) {
      whereClause.status = status;
    }

    const enrollments = await prisma.enrollments.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      include: {
        programs: {
          select: {
            title: true,
            goal_primary: true,
            duration_weeks: true,
            cover_image: true,
            users: { select: { username: true } }, // Coach Name
          },
        },
      },
    });

    // لو اللاعب مش مشترك في أي برنامج حالياً
    if (enrollments.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const formatted = enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      start_date: e.start_date,
      completed_date: e.completed_date,
      program: e.programs
        ? {
            title: e.programs.title,
            goal: e.programs.goal_primary,
            duration: e.programs.duration_weeks,
            cover: e.programs.cover_image,
            coach: e.programs.users?.username || "Unknown Coach",
          }
        : null, // حماية لو البرنامج ممسوح من السيستم
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    console.error("Get Enrollments Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch enrollments due to an internal server error.",
    });
  }
};


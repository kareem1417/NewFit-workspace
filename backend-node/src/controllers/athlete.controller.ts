import { Response, NextFunction } from "express";
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
  user_goal_enum,
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
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const { sport_id, level, weight_class, is_primary } = req.body;
    const parsedSportId = Number(sport_id);

    const sportExists = await prisma.sports.findUnique({
      where: { id: parsedSportId },
    });

    if (!sportExists) {
      res.status(404).json({
        success: false,
        error: "Sport not found.",
      });
      return;
    }

    const existingProfile = await prisma.user_sport_profiles.findFirst({
      where: {
        user_id: userId,
        sport_id: parsedSportId,
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
  next: NextFunction,
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
    if (weight_class)
      updateData.weight_class = weight_class.toLowerCase().trim();

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
      message: successMessage,
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
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const {
      sport_id,
      snapshot_type,
      program_enrollment_id,
      notes,
      test_values,
    } = req.body;
    const parsedSportId = Number(sport_id);

    const finalResult = await prisma.$transaction(async (tx) => {
      const rawTestIds: number[] = test_values.map((t: any) =>
        Number(t.attribute_test_id),
      );
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
          program_enrollment_id: program_enrollment_id
            ? String(program_enrollment_id)
            : null,
          notes,
        },
      });

      const dataToInsert = test_values.map((test: any) => {
        const info = testsInfo.find(
          (ti) => ti.id === Number(test.attribute_test_id),
        );
        return {
          snapshot_id: snapshot.id,
          attribute_test_id: Number(test.attribute_test_id),
          value: new Prisma.Decimal(test.value),
          unit: info?.unit || "unknown",
        };
      });

      await tx.snapshot_test_values.createMany({ data: dataToInsert });

      const resolvedTestValues = test_values.map((test: any) => {
        const info = testsInfo.find(
          (ti) => ti.id === Number(test.attribute_test_id),
        );
        return {
          attribute_test_id: Number(test.attribute_test_id),
          test_name: info?.test_name || "unknown",
          value: Number(test.value),
          unit: info?.unit || "unknown",
        };
      });

      return {
        id: snapshot.id,
        user_id: snapshot.user_id,
        sport_id: snapshot.sport_id,
        snapshot_type: snapshot.snapshot_type,
        created_at: snapshot.created_at,
        test_values: resolvedTestValues,
      };
    });

    res.status(201).json(finalResult);
  } catch (error: any) {
    console.error("Create Snapshot Error:", error);

    if (error.message === "INVALID_TEST_IDS") {
      res.status(404).json({
        success: false,
        error: "One or more provided attribute_test_ids do not exist.",
      });
      return;
    }

    next(error);
  }
};

// done

export const getSnapshots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // استدعاء البيانات النظيفة من الـ Validator
    const { limit, offset, typeStr } = res.locals.cleanQuery;

    // بناء الـ Where Clause بشكل ديناميكي وآمن للـ Prisma
    const whereClause: any = { user_id: userId };
    if (typeStr) {
      whereClause.snapshot_type = typeStr;
    }

    // سحب البيانات مرتبة تنازلياً بالأحدث (DESC)
    const snapshots = await prisma.physical_snapshots.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          include: {
            attribute_tests: {
              select: { test_name: true },
            },
          },
        },
      },
    });

    // لو مفيش snapshots أو الـ offset مبروح لبعيد، هيرجع Array فاضية [] أوتوماتيك مع status 200
    if (!snapshots || snapshots.length === 0) {
      res.status(200).json([]);
      return;
    }

    // عمل Format وتجميع الـ test_values لكل snapshot بالملي زي طلب الـ Sheet
    const formattedSnapshots = snapshots.map((snap) => ({
      id: snap.id,
      user_id: snap.user_id,
      sport_id: snap.sport_id,
      snapshot_type: snap.snapshot_type,
      created_at: snap.created_at,
      notes: snap.notes || null,
      test_values: snap.snapshot_test_values.map((tv) => ({
        attribute_test_id: tv.attribute_test_id,
        test_name: tv.attribute_tests?.test_name || "unknown",
        value: Number(tv.value), // تحويل الـ Decimal لـ number صريح لراحة الـ JSON
        unit: tv.unit,
      })),
    }));

    // إرجاع الـ Array مباشرة لمطابقة الـ Assertion بالملي
    res.status(200).json(formattedSnapshots);
  } catch (error: any) {
    console.error("Get Snapshots Error:", error);
    next(error); // التمرير للـ Global Error Handler
  }
};

// ==========================================
// 3.5: Unified Radar & Punch Power Data (CR-14 & CR-15 fixed)
// ==========================================

// Validated

export const getRadarData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // 1. جلب بيانات المستخدم والـ Sport Profile الأساسي له
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
    // 🎯 مصيدة: لو الـ Athlete ملوش بروفايل رياضي مسجل (يرد 404 حسب الـ Sheet)
    if (!profile) {
      res.status(404).json({
        success: false,
        error: "Sport profile not found.",
      });
      return;
    }

    // تحديد الـ Cohort المستخدم (إما المبعوث كـ Override أو الأساسي من البروفايل)
    const ageGroupId = getAgeGroupId(user.date_of_birth);
    const targetLevel = res.locals.overrideLevel || profile.level;
    const targetWeight = res.locals.overrideWeight || profile.weight_class;

    // 2. جلب أحدث Snapshot في السيستم للاعب
    const latestSnapshot = await prisma.physical_snapshots.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          include: {
            attribute_tests: {
              include: { sport_attributes: true },
            },
          },
        },
      },
    });

    // 🎯 مصيدة: لو مفيش أي Snapshots متسجلة للاعب (يرد 404 حسب الـ Sheet)
    if (!latestSnapshot || latestSnapshot.snapshot_test_values.length === 0) {
      res.status(404).json({
        success: false,
        error: "No snapshot data found.",
      });
      return;
    }

    // تجميع وترتيب الـ Test Values على الـ Attributes المرجعية لها
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

    const radar_axes: any[] = [];
    let foundationPct = 0,
      acceleratorPct = 0,
      transferPct = 0;

    // الحسابات الموزونة والـ Percentiles لكل Attribute والـ Fallbacks بتاعته
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
          return { ...test, ...percentileData, testName };
        }),
      );

      for (const test of processedTests) {
        weightedPercentileSum += test.percentile * test.weight;

        if (test.fallbackLevel > highestFallback) {
          highestFallback = test.fallbackLevel;
        }

        // عزل الاختبارات المطلوبة لحساب الـ Punch Power
        if (test.testName === "Trap Bar Deadlift")
          foundationPct = test.percentile;
        if (
          test.testName === "Power Clean" ||
          test.testName === "Box Jump Height"
        )
          acceleratorPct = test.percentile;
        if (test.testName === "Medicine Ball Rotational Throw")
          transferPct = test.percentile;
      }

      const finalPercentile =
        attrData.totalWeight > 0
          ? weightedPercentileSum / attrData.totalWeight
          : 0;

      radar_axes.push({
        attribute_name: attrData.name,
        percentile: Math.round(finalPercentile),
        fallback_level: highestFallback,
      });
    }

    const punch_power = {
      score: calculatePunchPower(foundationPct, acceleratorPct, transferPct),
      foundation: { percentile: foundationPct },
      accelerator: { percentile: acceleratorPct },
      transfer: { percentile: transferPct },
    };

    // 🎯 الـ Response النهائي: طالع من غير زحمة الـ success والـ data لمطابقة الـ Assertion بالملي!
    res.status(200).json({
      radar_axes,
      punch_power,
      cohort_used: {
        weight_class: targetWeight,
        level: targetLevel,
        age_group:
          ageGroupId === 2 ? "18-35" : ageGroupId === 1 ? "Under 18" : "35+",
      },
      snapshot_date: latestSnapshot.created_at,
    });
  } catch (error: any) {
    console.error("Get Radar Data Error:", error);
    next(error); // التمرير للـ Global Error Handler
  }
};

// ==========================================
// 3.6: Progress Tracking (CR-16 fixed)
// ==========================================
//validated
export const getProgress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const attributeTestId = res.locals.attributeTestId;

    // 1. جلب بيانات الاختبار والـ User والـ Profile بالتوازي لسرعة الأداء
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

    // 🎯 حالة الـ Sad Path: الاختبار مش موجود في الداتا بيز (ترد 404)
    if (!testInfo) {
      res.status(404).json({
        success: false,
        error: "attribute_test not found.", // مطابقة للـ Assertion في الـ Sheet
      });
      return;
    }

    if (!user || !profile) {
      res.status(404).json({
        success: false,
        error: "Sport profile or user record not found.",
      });
      return;
    }

    const ageGroupId = getAgeGroupId(user.date_of_birth);
    const userLevel = profile.level;
    const userWeight = profile.weight_class;
    const higherIsBetter = testInfo.higher_is_better ?? true;

    // 2. جلب جميع الـ Snapshots اللي فيها الـ Test ده للاعب (مرتبة تصاعدياً بالأقدم ASC)
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

    // 🎯 حالة الـ Sad Path: الاختبار موجود بس اللاعب منزلوش أي داتا (ترد 200 مع Array فاضية)
    if (history.length === 0) {
      res.status(200).json({
        test_name: testInfo.test_name,
        unit: testInfo.unit,
        higher_is_better: higherIsBetter,
        data_points: [], // الـ Sheet طالبة يرجع الـ Object صريح وجواه مصفوفة فاضية
      });
      return;
    }

    // 3. بناء الـ Data Points وحساب الـ Percentiles بشكل ديناميكي لكل سجل
    const data_points = await Promise.all(
      history.map(async (snap) => {
        const testValueRecord = snap.snapshot_test_values[0];
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
          percentile: Math.round(percentile),
          snapshot_type: snap.snapshot_type,
        };
      }),
    );

    // 🎯 الـ Response النهائي: الـ Object في الـ Root مباشرة لمطابقة الـ Assertion بالملي!
    res.status(200).json({
      test_name: testInfo.test_name,
      unit: testInfo.unit,
      higher_is_better: higherIsBetter,
      data_points,
    });
  } catch (error: any) {
    console.error("Get Progress Error:", error);
    next(error); // التمرير للـ Global Error Handler المركزي
  }
};

// ==========================================
// 3.7: Enrollments
// ==========================================

export const getMyEnrollments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const statusFilter = res.locals.statusFilter as
      | enrollment_status
      | undefined;

    // بناء الـ Filter بشكل ديناميكي وآمن
    const whereClause: any = { user_id: userId };
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    // جلب الاشتراكات مع بيانات البرنامج والمدرب
    const enrollments = await prisma.enrollments.findMany({
      where: whereClause,
      orderBy: { created_at: "desc" },
      include: {
        programs: {
          select: {
            title: true,
            duration_weeks: true,
            cover_image: true,
            users: { select: { username: true } }, // الـ Coach
          },
        },
      },
    });

    // 🎯 حالة الـ No enrollments yet: ترجع Array فاضية صريحة [] مع status 200
    if (!enrollments || enrollments.length === 0) {
      res.status(200).json([]);
      return;
    }

    // 🎯 عمل Mapping للمصفوفة لتكون Flat (مفرودة) تماماً زي طلب الـ Sheet بالملي
    const formattedEnrollments = enrollments.map((e) => ({
      enrollment_id: e.id,
      status: e.status,
      start_date: e.start_date,
      completed_date: e.completed_date || null, // بتظهر لو الحالة completed
      program_title: e.programs?.title || "Unknown Program",
      coach_name: e.programs?.users?.username || "Unknown Coach",
      cover_image: e.programs?.cover_image || null,
      duration_weeks: e.programs?.duration_weeks || 0,
      baseline_snapshot_id: e.baseline_snapshot_id || null, // مطلوبة في الـ Sheet
    }));

    // 🎯 إرجاع الـ Array مباشرة في الـ Root بدون غلاف الـ data
    res.status(200).json(formattedEnrollments);
  } catch (error: any) {
    console.error("Get Enrollments Error:", error);
    next(error); // التمرير الفوري للـ Global Error Handler المركزي
  }
};

export const upsertUserMetrics = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const {
      height_cm,
      weight_kg,
      goal,
      training_days_per_week,
      years_training,
      has_injury_history,
      endurance_score,
      strength_score,
      speed_score,
      flexibility_score,
      explosiveness_score,
      recovery_score,
    } = req.body;

    // Validation أساسي للحقول الإجبارية
    if (
      !height_cm ||
      !weight_kg ||
      !goal ||
      training_days_per_week === undefined ||
      years_training === undefined
    ) {
      res.status(400).json({
        success: false,
        error:
          "Missing required fields: height_cm, weight_kg, goal, training_days_per_week, and years_training are required.",
      });
      return;
    }

    // التأكد إن الهدف المبعوت موجود في الـ Enum
    const validGoals = Object.keys(user_goal_enum);
    if (!validGoals.includes(goal)) {
      res.status(400).json({
        success: false,
        error: `Invalid goal. Allowed values are: ${validGoals.join(", ")}`,
      });
      return;
    }

    // تجهيز الداتا عشان نستخدمها في الـ Create والـ Update
    const metricsData = {
      height_cm: Number(height_cm),
      weight_kg: Number(weight_kg),
      goal: goal as user_goal_enum,
      training_days_per_week: Number(training_days_per_week),
      years_training: Number(years_training),
      has_injury_history: has_injury_history ?? false,
      // التقييمات لو مبعتتش هنحط الديفولت بتاعها 5 زي الداتا بيز
      endurance_score: endurance_score ? Number(endurance_score) : 5,
      strength_score: strength_score ? Number(strength_score) : 5,
      speed_score: speed_score ? Number(speed_score) : 5,
      flexibility_score: flexibility_score ? Number(flexibility_score) : 5,
      explosiveness_score: explosiveness_score
        ? Number(explosiveness_score)
        : 5,
      recovery_score: recovery_score ? Number(recovery_score) : 5,
    };

    const metrics = await prisma.user_metrics.upsert({
      where: { user_id: userId },
      update: metricsData,
      create: {
        user_id: userId,
        ...metricsData,
      },
    });

    res.status(200).json({
      success: true,
      message: "User metrics saved successfully!",
      data: metrics,
    });
  } catch (error: any) {
    console.error("Upsert User Metrics Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to save user metrics." });
  }
};

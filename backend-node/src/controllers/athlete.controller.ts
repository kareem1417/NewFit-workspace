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
  player_category,
  enrollment_status,
  user_goal_enum,
} from "@prisma/client";
import { AppError } from "../utils/AppError";

// 📌 استيراد الدوال من الـ Service الجديدة
import {
  getCategoriesBySportId,
  formatCategoryLabel,
  getCategoryType,
} from "../services/sportCategory.service";

// ==========================================
// Helper Functions
// ==========================================
const getAgeGroupId = (dateOfBirth: Date): number => {
  const age = new Date().getFullYear() - dateOfBirth.getFullYear();
  if (age < 18) return 1;
  if (age <= 35) return 2;
  return 3;
};

const getAdjacentCategories = (
  category: player_category,
): player_category[] => {
  const weightClasses: player_category[] = [
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

  const idx = weightClasses.indexOf(category);
  if (idx === -1) return [];

  const adjacent: player_category[] = [];
  if (idx > 0) adjacent.push(weightClasses[idx - 1]);
  if (idx < weightClasses.length - 1) adjacent.push(weightClasses[idx + 1]);
  return adjacent;
};

const getPercentileWithFallback = async (
  testId: number,
  rawValue: number,
  higherIsBetter: boolean,
  userLevel: competitive_level,
  userCategory: player_category,
  userAgeGroupId: number,
): Promise<{ percentile: number; fallbackLevel: number }> => {
  const fallbackSteps: any[] = [
    { category: userCategory, level: userLevel, ageGroup: userAgeGroupId },
    { category: userCategory, level: userLevel, ageGroup: undefined },
    {
      category: { in: getAdjacentCategories(userCategory) },
      level: userLevel,
      ageGroup: undefined,
    },
    { category: undefined, level: userLevel, ageGroup: undefined },
    { category: undefined, level: undefined, ageGroup: undefined },
  ];

  for (let step = 0; step < fallbackSteps.length; step++) {
    const criteria = fallbackSteps[step];
    const norm = await prisma.normative_data.findFirst({
      where: {
        attribute_test_id: testId,
        ...(criteria.category && { player_category: criteria.category }),
        ...(criteria.level && { level: criteria.level }),
        ...(criteria.ageGroup && { age_group_id: criteria.ageGroup }),
      },
    });
    if (norm) {
      const z = calculateZScore(
        rawValue,
        Number(norm.mean_value),
        Number(norm.std_dev),
        higherIsBetter,
      );
      const percentile = calculatePercentile(z);
      return { percentile, fallbackLevel: step };
    }
  }
  const fallbackPercentile = Math.min(
    99,
    Math.max(1, Math.floor(rawValue / 2)),
  );
  return { percentile: fallbackPercentile, fallbackLevel: 4 };
};

const getTestName = async (testId: number): Promise<string> => {
  const test = await prisma.attribute_tests.findUnique({
    where: { id: testId },
    select: { test_name: true },
  });
  return test?.test_name || "Unknown";
};

// ==========================================
// Controllers
// ==========================================

export const createSportProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const {
      sport_id = 1,
      level,
      player_category,
      is_primary = true,
    } = req.body;

    const existingProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, sport_id: Number(sport_id) },
    });

    if (existingProfile) {
      return next(
        new AppError(
          "Conflict — sport profile already exists. Use PATCH to update.",
          409,
        ),
      );
    }
    const sportExists = await prisma.sports.findUnique({
      where: { id: Number(sport_id) },
    });

    if (!sportExists) {
      return next(
        new AppError("Sport not found. Please provide a valid sport_id.", 404),
      );
    }

    // 📌 ضفنا Validation إن الـ category مناسبة للرياضة
    const validCategories = getCategoriesBySportId(Number(sport_id));
    if (!validCategories.includes(player_category)) {
      return next(
        new AppError(
          `Invalid player category (${player_category}) for sport ID ${sport_id}.`,
          400,
        ),
      );
    }

    const newProfile = await prisma.user_sport_profiles.create({
      data: {
        user_id: userId,
        sport_id: Number(sport_id),
        level,
        player_category,
        is_primary,
      },
    });

    res.status(201).json({
      success: true,
      message: "Sport profile created successfully!",
      data: newProfile,
    });
  } catch (error: any) {
    console.error("Create Sport Profile Error:", error);
    return next(new AppError("Failed to create sport profile.", 500));
  }
};

export const upsertUserMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // 📌 شيلنا كل الـ Scores من هنا
    const {
      height_cm,
      weight_kg,
      goal,
      training_days_per_week,
      years_training,
      has_injury_history,
    } = req.body;

    if (
      !height_cm ||
      !weight_kg ||
      !goal ||
      training_days_per_week === undefined ||
      years_training === undefined
    ) {
      return next(
        new AppError(
          "Missing required fields: height_cm, weight_kg, goal, training_days_per_week, and years_training are required.",
          400,
        ),
      );
    }

    const validGoals = Object.keys(user_goal_enum);
    if (!validGoals.includes(goal)) {
      return next(
        new AppError(
          `Invalid goal. Allowed values are: ${validGoals.join(", ")}`,
          400,
        ),
      );
    }

    // 📌 خلينا الـ Object نضيف وبياخد الحاجات الأساسية بس
    const metricsData = {
      height_cm: Number(height_cm),
      weight_kg: Number(weight_kg),
      goal: goal as user_goal_enum,
      training_days_per_week: Number(training_days_per_week),
      years_training: Number(years_training),
      has_injury_history: has_injury_history ?? false,
    };

    const metrics = await prisma.user_metrics.upsert({
      where: { user_id: userId },
      update: metricsData,
      create: { user_id: userId, ...metricsData },
    });

    res.status(200).json({
      success: true,
      message: "User metrics saved successfully!",
      data: metrics,
    });
  } catch (error: any) {
    console.error("Upsert User Metrics Error:", error);
    return next(new AppError("Failed to save user metrics.", 500));
  }
};

export const getUserMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const metrics = await prisma.user_metrics.findUnique({
      where: { user_id: userId },
    });

    if (!metrics) {
      return next(
        new AppError(
          "User metrics not found. Please complete onboarding.",
          404,
        ),
      );
    }

    res.status(200).json({ success: true, data: metrics });
  } catch (error: any) {
    console.error("Get User Metrics Error:", error);
    return next(new AppError("Failed to fetch user metrics.", 500));
  }
};
export const updateSportProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const { level, player_category } = req.body;

    const existingProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, is_primary: true },
      include: { sports: true }, // بنجيب الرياضة عشان الـ validation
    });

    if (!existingProfile) {
      return next(
        new AppError("Sport profile not found. Please create one first.", 404),
      );
    }

    // 📌 ضفنا Validation إن الـ category مناسبة للرياضة في الـ Update كمان
    if (player_category) {
      const validCategories = getCategoriesBySportId(existingProfile.sport_id);
      if (!validCategories.includes(player_category)) {
        return next(
          new AppError(
            `Invalid player category (${player_category}) for sport ID ${existingProfile.sport_id}.`,
            400,
          ),
        );
      }
    }

    const updatedProfile = await prisma.user_sport_profiles.update({
      where: { id: existingProfile.id },
      data: {
        ...(level && { level }),
        ...(player_category && { player_category }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Sport profile updated successfully!",
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error("Update Sport Profile Error:", error);
    return next(new AppError("Failed to update sport profile.", 500));
  }
};

export const getSportBaselineTests = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { sport_id } = req.params;

    const attributes = await prisma.sport_attributes.findMany({
      where: { sport_id: Number(sport_id) },
      include: {
        attribute_tests: true,
      },
      orderBy: { display_order: "asc" },
    });

    res.status(200).json({ success: true, data: attributes });
  } catch (error: any) {
    return next(new AppError("Failed to fetch baseline tests.", 500));
  }
};

export const createSnapshot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const {
      sport_id = 1,
      snapshot_type = "manual_update",
      program_enrollment_id,
      notes,
      test_values,
    } = req.body;

    const sportExists = await prisma.sports.findUnique({
      where: { id: Number(sport_id) },
    });

    if (!sportExists) {
      return next(
        new AppError("Sport not found. Please provide a valid sport_id.", 404),
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.physical_snapshots.create({
        data: {
          user_id: userId,
          sport_id: Number(sport_id),
          snapshot_type,
          program_enrollment_id,
          notes,
        },
      });

      const testIds = test_values.map((t: any) => t.attribute_test_id);
      const testsInfo = await tx.attribute_tests.findMany({
        where: { id: { in: testIds } },
      });

      const dataToInsert = test_values.map((test: any) => {
        const info = testsInfo.find((ti) => ti.id === test.attribute_test_id);
        return {
          snapshot_id: snapshot.id,
          attribute_test_id: test.attribute_test_id,
          value: test.value,
          unit: info?.unit || "unknown",
        };
      });

      await tx.snapshot_test_values.createMany({ data: dataToInsert });

      if (program_enrollment_id) {
        if (snapshot_type === "program_baseline") {
          await tx.enrollments.update({
            where: { id: program_enrollment_id },
            data: { baseline_snapshot_id: snapshot.id },
          });
        } else if (snapshot_type === "program_posttest") {
          await tx.enrollments.update({
            where: { id: program_enrollment_id },
            data: { posttest_snapshot_id: snapshot.id },
          });
        }
      }

      return snapshot;
    });

    res.status(201).json({
      success: true,
      message: "Snapshot saved!",
      snapshot_id: result.id,
    });
  } catch (error: any) {
    console.error("Create Snapshot Error:", error);
    if (error.code) {
      return next(error);
    }
    return next(new AppError("Failed to save snapshot", 500));
  }
};

export const getSnapshots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as unknown as snapshot_type | undefined;

    const whereClause: any = { user_id: userId };
    if (type) whereClause.snapshot_type = type;

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
    return next(new AppError("Failed to fetch snapshots.", 500));
  }
};

export const getLatestSnapshot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const latestSnapshot = await prisma.physical_snapshots.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          include: {
            attribute_tests: {
              include: {
                sport_attributes: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!latestSnapshot) {
      return next(new AppError("No snapshots found for this user.", 404));
    }

    const formattedSnapshot = {
      id: latestSnapshot.id,
      snapshot_type: latestSnapshot.snapshot_type,
      created_at: latestSnapshot.created_at,
      notes: latestSnapshot.notes,
      test_values: latestSnapshot.snapshot_test_values.map((tv) => ({
        attribute_test_id: tv.attribute_test_id,
        attribute_name: tv.attribute_tests?.sport_attributes?.name,
        test_name: tv.attribute_tests?.test_name,
        value: Number(tv.value),
        unit: tv.unit,
      })),
    };

    res.status(200).json({ success: true, data: formattedSnapshot });
  } catch (error: any) {
    console.error("Get Latest Snapshot Error:", error);
    return next(new AppError("Failed to fetch the latest snapshot.", 500));
  }
};

export const getRadarData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const cohortLevel = req.query.level as unknown as
      competitive_level | undefined;
    const cohortCategory = req.query.player_category as unknown as
      player_category | undefined;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        date_of_birth: true,
        user_sport_profiles: { where: { is_primary: true } },
      },
    });
    const profile = user?.user_sport_profiles[0];

    if (!profile) {
      return next(new AppError("Profile not found.", 404));
    }

    const ageGroupId = getAgeGroupId(user!.date_of_birth);
    const targetLevel = cohortLevel || profile.level;
    const targetCategory = cohortCategory || profile.player_category;

    const latestSnapshot = await prisma.physical_snapshots.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          include: { attribute_tests: { include: { sport_attributes: true } } },
        },
      },
    });

    if (!latestSnapshot) {
      return next(new AppError("No snapshot data found.", 404));
    }

    const attributeMap = new Map<
      number,
      { name: string; tests: any[]; totalWeight: number }
    >();
    for (const testVal of latestSnapshot.snapshot_test_values) {
      const attr = testVal.attribute_tests?.sport_attributes;
      if (!attr) continue;
      const attrId = attr.id;
      if (!attributeMap.has(attrId))
        attributeMap.set(attrId, {
          name: attr.name,
          tests: [],
          totalWeight: 0,
        });

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

    for (const [attrId, attrData] of attributeMap.entries()) {
      let weightedPercentileSum = 0;
      let highestFallback = 0;

      for (const test of attrData.tests) {
        const { percentile, fallbackLevel } = await getPercentileWithFallback(
          test.testId,
          test.rawValue,
          test.higherIsBetter,
          targetLevel,
          targetCategory,
          ageGroupId,
        );
        weightedPercentileSum += percentile * test.weight;
        if (fallbackLevel > highestFallback) highestFallback = fallbackLevel;

        const testName = await getTestName(test.testId);
        if (testName === "Trap Bar Deadlift") foundationPct = percentile;
        if (testName === "Power Clean" || testName === "Box Jump Height")
          acceleratorPct = percentile;
        if (testName === "Medicine Ball Rotational Throw")
          transferPct = percentile;
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

    res.status(200).json({
      success: true,
      data: {
        radar_axes,
        punch_power,
        cohort_used: {
          player_category: targetCategory,
          level: targetLevel,
          age_group:
            ageGroupId === 2 ? "18-35" : ageGroupId === 1 ? "Under 18" : "35+",
        },
        snapshot_date: latestSnapshot.created_at,
      },
    });
  } catch (error: any) {
    console.error("Get Radar Data Error:", error);
    return next(new AppError("Failed to generate radar data", 500));
  }
};

export const getProgress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const attributeTestId = parseInt(req.query.attribute_test_id as string);
    if (isNaN(attributeTestId)) {
      return next(new AppError("Invalid test ID.", 400));
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

    if (!testInfo || !profile || !user) {
      return next(new AppError("Data not found.", 404));
    }

    const ageGroupId = getAgeGroupId(user.date_of_birth);
    const userLevel = profile.level;
    const userCategory = profile.player_category;
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

    const data_points = await Promise.all(
      history.map(async (snap) => {
        const rawValue = Number(snap.snapshot_test_values[0]?.value || 0);
        const { percentile } = await getPercentileWithFallback(
          attributeTestId,
          rawValue,
          higherIsBetter,
          userLevel,
          userCategory,
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
    return next(new AppError("Failed to fetch progress.", 500));
  }
};

export const getMyEnrollments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const status = req.query.status as enrollment_status | undefined;

    const whereClause: any = { user_id: userId };
    if (status) whereClause.status = status;

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
            users: { select: { username: true } },
          },
        },
      },
    });

    const formatted = enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      start_date: e.start_date,
      completed_date: e.completed_date,
      program: {
        title: e.programs.title,
        goal: e.programs.goal_primary,
        duration: e.programs.duration_weeks,
        cover: e.programs.cover_image,
        coach: e.programs.users.username,
      },
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    console.error("Get Enrollments Error:", error);
    return next(new AppError("Failed to fetch enrollments.", 500));
  }
};

export const getSportProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const profiles = await prisma.user_sport_profiles.findMany({
      where: { user_id: userId },
      orderBy: { is_primary: "desc" },
      include: { sports: { select: { name: true } } },
    });

    res.status(200).json({ success: true, data: profiles });
  } catch (error: any) {
    console.error("Get Sport Profile Error:", error);
    return next(new AppError("Failed to fetch sport profiles.", 500));
  }
};

export const deleteSportProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const profileId = req.params.id;

    const profile = await prisma.user_sport_profiles.findUnique({
      where: { id: profileId as any },
    });

    if (!profile) return next(new AppError("Sport profile not found.", 404));
    if (profile.user_id !== userId)
      return next(
        new AppError("Forbidden — You can only delete your own profile.", 403),
      );

    await prisma.user_sport_profiles.delete({
      where: { id: profileId as any },
    });

    res
      .status(200)
      .json({ success: true, message: "Sport profile deleted successfully." });
  } catch (error: any) {
    console.error("Delete Sport Profile Error:", error);
    return next(new AppError("Failed to delete sport profile.", 500));
  }
};

export const deleteUserMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const metrics = await prisma.user_metrics.findUnique({
      where: { user_id: userId },
    });
    if (!metrics) return next(new AppError("User metrics not found.", 404));

    await prisma.user_metrics.delete({ where: { user_id: userId } });

    res
      .status(200)
      .json({ success: true, message: "User metrics deleted successfully." });
  } catch (error: any) {
    console.error("Delete User Metrics Error:", error);
    return next(new AppError("Failed to delete user metrics.", 500));
  }
};

export const deleteSnapshot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const snapshotId = req.params.id;

    const snapshot = await prisma.physical_snapshots.findUnique({
      where: { id: snapshotId as any },
    });

    if (!snapshot) return next(new AppError("Snapshot not found.", 404));
    if (snapshot.user_id !== userId)
      return next(
        new AppError("Forbidden — You can only delete your own snapshot.", 403),
      );

    await prisma.physical_snapshots.delete({
      where: { id: snapshotId as any },
    });

    res
      .status(200)
      .json({ success: true, message: "Snapshot deleted successfully." });
  } catch (error: any) {
    console.error("Delete Snapshot Error:", error);
    return next(new AppError("Failed to delete snapshot.", 500));
  }
};

// 📌 ضفنا التعديل هنا عشان نرجع الـ category_type
export const getSportsList = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sports = await prisma.sports.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        sport_attributes: {
          select: {
            id: true,
            attribute_tests: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedSports = sports.map((sport) => ({
      id: sport.id,
      name: sport.name,
      description: sport.description,
      icon: sport.icon,
      category_type: getCategoryType(sport.id),
      has_categories: getCategoryType(sport.id) !== "none",
      total_attributes: sport.sport_attributes.length,
      total_tests: sport.sport_attributes.reduce(
        (acc, attr) => acc + attr.attribute_tests.length,
        0,
      ),
    }));

    res.status(200).json({ success: true, data: formattedSports });
  } catch (error: any) {
    console.error("Get Sports List Error:", error);
    return next(new AppError("Failed to fetch sports list.", 500));
  }
};

// 📌 الدالة الجديدة لجلب الأوزان/المراكز المتاحة لكل رياضة
export const getSportCategories = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const sport_id = parseInt(req.params.sport_id as any);

    const sport = await prisma.sports.findUnique({
      where: { id: sport_id },
      select: { id: true, name: true },
    });

    if (!sport) {
      return next(new AppError("Sport not found.", 404));
    }

    const categoriesEnum = getCategoriesBySportId(sport.id);

    // تحويل كل Enum إلى Label مقروء
    const formattedCategories = categoriesEnum.map((cat) => ({
      label: formatCategoryLabel(cat),
      value: cat,
    }));

    res.status(200).json({
      success: true,
      data: {
        sport_id: sport.id,
        sport_name: sport.name,
        categories: formattedCategories,
      },
    });
  } catch (error: any) {
    console.error("Get Sport Categories Error:", error);
    return next(new AppError("Failed to fetch sport categories.", 500));
  }
};

export const completeOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const { sport_id, level, player_category, test_values } = req.body;

    const existingProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, is_primary: true },
    });
    if (existingProfile) {
      return next(
        new AppError(
          "Onboarding already completed. Use settings to update profile.",
          409,
        ),
      );
    }

    if (!sport_id || !level || !player_category || !test_values) {
      return next(
        new AppError(
          "Missing required fields: sport_id, level, player_category, and test_values are required.",
          400,
        ),
      );
    }

    if (!Array.isArray(test_values) || test_values.length === 0) {
      return next(new AppError("test_values must be a non-empty array.", 400));
    }

    const sport = await prisma.sports.findUnique({
      where: { id: Number(sport_id) },
      include: {
        sport_attributes: {
          include: {
            attribute_tests: true,
          },
        },
      },
    });

    if (!sport) {
      return next(new AppError("Sport not found.", 404));
    }

    // 📌 ضفنا Validation إن الـ category مسموح بيها للرياضة دي
    const validCategories = getCategoriesBySportId(sport.id);
    if (!validCategories.includes(player_category)) {
      return next(
        new AppError(
          `Invalid player category (${player_category}) for ${sport.name}.`,
          400,
        ),
      );
    }

    const allTestIds = sport.sport_attributes.flatMap((attr) =>
      attr.attribute_tests.map((test) => test.id),
    );

    for (const test of test_values) {
      if (!allTestIds.includes(test.attribute_test_id)) {
        return next(
          new AppError(
            `Invalid test_id: ${test.attribute_test_id} does not belong to this sport.`,
            400,
          ),
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const sportProfile = await tx.user_sport_profiles.create({
        data: {
          user_id: userId,
          sport_id: Number(sport_id),
          level,
          player_category,
          is_primary: true,
        },
      });

      const snapshot = await tx.physical_snapshots.create({
        data: {
          user_id: userId,
          sport_id: Number(sport_id),
          snapshot_type: "initial_onboarding",
          notes: `Initial onboarding baseline assessment for ${sport.name}`,
        },
      });

      const testValuesData = test_values.map((test: any) => ({
        snapshot_id: snapshot.id,
        attribute_test_id: test.attribute_test_id,
        value: test.value,
        unit: test.unit || "unknown",
      }));

      await tx.snapshot_test_values.createMany({
        data: testValuesData,
      });

      return {
        sportProfile,
        snapshot,
        testCount: testValuesData.length,
      };
    });

    res.status(201).json({
      success: true,
      message: "Onboarding completed successfully!",
      data: {
        sport_profile_id: result.sportProfile.id,
        baseline_snapshot_id: result.snapshot.id,
        tests_logged: result.testCount,
        sport_name: sport.name,
        level,
        player_category,
      },
    });
  } catch (error: any) {
    console.error("Complete Onboarding Error:", error);
    return next(
      new AppError(error.message || "Failed to complete onboarding.", 500),
    );
  }
};

export const getOnboardingStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const sportProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, is_primary: true },
      include: {
        sports: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    const metrics = await prisma.user_metrics.findUnique({
      where: { user_id: userId },
    });

    const latestSnapshot = await prisma.physical_snapshots.findFirst({
      where: {
        user_id: userId,
        snapshot_type: "initial_onboarding",
      },
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          take: 1,
        },
      },
    });

    const hasSportProfile = !!sportProfile;
    const hasMetrics = !!metrics;
    const hasBaselineSnapshot =
      !!latestSnapshot && latestSnapshot.snapshot_test_values.length > 0;

    const isComplete = hasSportProfile && hasMetrics && hasBaselineSnapshot;

    let missingSteps: string[] = [];
    if (!hasSportProfile) missingSteps.push("sport_profile");
    if (!hasMetrics) missingSteps.push("user_metrics");
    if (!hasBaselineSnapshot) missingSteps.push("baseline_snapshot");

    let progressPercentage = 0;
    if (hasSportProfile) progressPercentage += 33;
    if (hasMetrics) progressPercentage += 33;
    if (hasBaselineSnapshot) progressPercentage += 34;

    res.status(200).json({
      success: true,
      data: {
        is_complete: isComplete,
        progress_percentage: progressPercentage,
        missing_steps: missingSteps,
        sport_profile: sportProfile
          ? {
              id: sportProfile.id,
              sport_id: sportProfile.sport_id,
              sport_name: sportProfile.sports?.name,
              level: sportProfile.level,
              player_category: sportProfile.player_category,
            }
          : null,
        has_metrics: hasMetrics,
        has_baseline: hasBaselineSnapshot,
        baseline_snapshot_id: latestSnapshot?.id || null,
      },
    });
  } catch (error: any) {
    console.error("Get Onboarding Status Error:", error);
    return next(new AppError("Failed to get onboarding status.", 500));
  }
};

export const requireOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const [sportProfile, metrics, snapshot] = await Promise.all([
      prisma.user_sport_profiles.findFirst({
        where: { user_id: userId, is_primary: true },
      }),
      prisma.user_metrics.findUnique({
        where: { user_id: userId },
      }),
      prisma.physical_snapshots.findFirst({
        where: {
          user_id: userId,
          snapshot_type: "initial_onboarding",
        },
      }),
    ]);

    if (!sportProfile || !metrics || !snapshot) {
      return next(
        new AppError(
          "Onboarding incomplete. Please complete your athlete profile first.",
          403,
        ),
      );
    }

    req.onboarding = {
      sportProfile,
      metrics,
      snapshot,
    };

    next();
  } catch (error: any) {
    console.error("Require Onboarding Middleware Error:", error);
    return next(new AppError("Failed to verify onboarding status.", 500));
  }
};

// ==========================================
// Athlete Dashboard - Unified Endpoint
// ==========================================
export const getAthleteDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_sport_profiles: {
          where: { is_primary: true },
          include: {
            sports: true,
          },
        },
      },
    });

    if (!user) {
      return next(new AppError("User not found.", 404));
    }

    const profile = user.user_sport_profiles[0];

    if (!profile) {
      return next(new AppError("Sport profile not found.", 404));
    }

    const { password_hash, ...safeUser } = user;

    const ageGroupId = getAgeGroupId(user.date_of_birth);

    const [metrics, latestSnapshot] = await Promise.all([
      prisma.user_metrics.findUnique({
        where: {
          user_id: userId,
        },
      }),

      prisma.physical_snapshots.findFirst({
        where: {
          user_id: userId,
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          sports: true,
          snapshot_test_values: {
            include: {
              attribute_tests: {
                include: {
                  sport_attributes: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // 📌 RADAR DATA - من أحدث Snapshot (قيم فعلية، مش Percentiles)
    let radarData: any[] = [];
    let punchPower = null;

    if (latestSnapshot) {
      // 📌 نبني Map لتجميع القيم حسب الـ attribute
      const attributeMap = new Map<
        string,
        {
          name: string;
          values: number[];
          count: number;
        }
      >();

      for (const test of latestSnapshot.snapshot_test_values) {
        const attr = test.attribute_tests.sport_attributes;
        const attrName = attr.name;

        if (!attributeMap.has(attrName)) {
          attributeMap.set(attrName, {
            name: attrName,
            values: [],
            count: 0,
          });
        }

        const entry = attributeMap.get(attrName)!;
        entry.values.push(Number(test.value));
        entry.count++;
      }

      // 📌 حساب المتوسط لكل Attribute
      radarData = Array.from(attributeMap.entries()).map(
        ([attribute_name, item]) => ({
          attribute_name,
          value: Math.round(
            item.values.reduce((a, b) => a + b, 0) / item.count,
          ),
        }),
      );

      // 📌 Punch Power - بنحسبه من الـ Percentiles عادي (زي ما هو)
      // بنحتاج الـ Percentiles عشان نحسب Punch Power
      const attributeMapForPercentiles = new Map<
        number,
        {
          name: string;
          tests: any[];
          totalWeight: number;
        }
      >();

      for (const test of latestSnapshot.snapshot_test_values) {
        const attr = test.attribute_tests.sport_attributes;

        if (!attributeMapForPercentiles.has(attr.id)) {
          attributeMapForPercentiles.set(attr.id, {
            name: attr.name,
            tests: [],
            totalWeight: 0,
          });
        }

        const entry = attributeMapForPercentiles.get(attr.id)!;
        const weight = Number(test.attribute_tests.weight ?? 1);

        entry.tests.push({
          id: test.attribute_test_id,
          raw: Number(test.value),
          weight,
          higherIsBetter: test.attribute_tests.higher_is_better ?? true,
        });

        entry.totalWeight += weight;
      }

      let foundation = 0;
      let accelerator = 0;
      let transfer = 0;

      for (const [, attribute] of attributeMapForPercentiles.entries()) {
        for (const test of attribute.tests) {
          const result = await getPercentileWithFallback(
            test.id,
            test.raw,
            test.higherIsBetter,
            profile.level,
            profile.player_category,
            ageGroupId,
          );

          const testName = await getTestName(test.id);

          if (testName === "Trap Bar Deadlift") {
            foundation = result.percentile;
          }

          if (testName === "Power Clean" || testName === "Box Jump Height") {
            accelerator = result.percentile;
          }

          if (testName === "Medicine Ball Rotational Throw") {
            transfer = result.percentile;
          }
        }
      }

      punchPower = {
        score: calculatePunchPower(foundation, accelerator, transfer),
        foundation,
        accelerator,
        transfer,
      };
    }

    const cleanedProfiles = user.user_sport_profiles.map(
      ({ user_id, ...rest }: any) => rest,
    );

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...safeUser,
          sport_profiles: cleanedProfiles,
        },

        metrics,

        // 📌 الرادار دلوقتي بقيم فعلية (مش Percentiles)
        radar: radarData,

        punch_power: punchPower,

        latest_snapshot: latestSnapshot
          ? {
              id: latestSnapshot.id,
              snapshot_type: latestSnapshot.snapshot_type,
              sport_name: latestSnapshot.sports.name,
              created_at: latestSnapshot.created_at,
              notes: latestSnapshot.notes,

              test_values: latestSnapshot.snapshot_test_values.map((tv) => ({
                attribute_test_id: tv.attribute_test_id,
                attribute_name: tv.attribute_tests.sport_attributes.name,
                test_name: tv.attribute_tests.test_name,
                value: Number(tv.value),
                unit: tv.unit,
              })),
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("Get Athlete Dashboard Error:", error);

    return next(new AppError("Failed to fetch athlete dashboard.", 500));
  }
};

// import { Response } from "express";
// import { AuthRequest } from "../middlewares/auth.middleware";
// import { prisma } from "../config/prisma";
// import {
//   calculateZScore,
//   calculatePercentile,
// } from "../services/calculation.service";
// import { competitive_level, weight_class } from "@prisma/client"; // Import Enums

// // HANDDELED
// // ==========================================
// // Helper Functions
// // ==========================================

// const getAgeGroupId = (
//   dateOfBirth: Date | string | null | undefined,
// ): number => {
//   if (!dateOfBirth) {
//     return 2;
//   }

//   const dob = new Date(dateOfBirth);
//   if (isNaN(dob.getTime())) {
//     return 2; // Fallback لو التاريخ مبعوت بفورمات غلط ومش عارفين نقراه
//   }

//   const today = new Date();
//   let age = today.getFullYear() - dob.getFullYear();
//   const monthDiff = today.getMonth() - dob.getMonth();

//   // حسبة لعمر اللاعب بناء على اليوم والشهر مش السنين وبس
//   if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
//     age--;
//   }

//   if (age < 18) return 1;
//   if (age <= 35) return 2;
//   return 3;
// };

// // Modification 1: Use weight_class Enum
// const getAdjacentWeightClasses = (
//   weightClass: weight_class,
// ): weight_class[] => {
//   if (!weightClass) return [];

//   const classes: weight_class[] = [
//     "flyweight",
//     "bantamweight",
//     "featherweight",
//     "lightweight",
//     "light_welterweight",
//     "welterweight",
//     "light_middleweight",
//     "middleweight",
//     "super_middleweight",
//     "light_heavyweight",
//     "cruiserweight",
//     "heavyweight",
//   ];
//   const idx = classes.indexOf(weightClass);
//   if (idx === -1) return [];
//   const adjacent: weight_class[] = [];
//   if (idx > 0) adjacent.push(classes[idx - 1]);
//   if (idx < classes.length - 1) adjacent.push(classes[idx + 1]);
//   return adjacent;
// };

// /**
//  * 5-level fallback cascade
//  */
// // Modification 2: Use Enums here instead of string
// const getPercentileForTest = async (
//   testId: number,
//   rawValue: number,
//   higherIsBetter: boolean,
//   userLevel: competitive_level | undefined | null,
//   userWeight: weight_class | undefined | null,
//   userAgeGroupId: number,
// ): Promise<number> => {
//   // Modification 3: Force type as any to match Prisma filter conditions
//   const safeRawValue = Math.max(0, rawValue);

//   const fallbackSteps: any[] = [
//     {
//       weight: userWeight || undefined,
//       level: userLevel || undefined,
//       ageGroup: userAgeGroupId,
//     },
//     {
//       weight: userWeight || undefined,
//       level: userLevel || undefined,
//       ageGroup: undefined,
//     },
//     {
//       weight: userWeight
//         ? { in: getAdjacentWeightClasses(userWeight) }
//         : undefined,
//       level: userLevel || undefined,
//       ageGroup: undefined,
//     },
//     { weight: undefined, level: userLevel || undefined, ageGroup: undefined },
//     { weight: undefined, level: undefined, ageGroup: undefined },
//   ];

//   try {
//     for (const step of fallbackSteps) {
//       const norm = await prisma.normative_data.findFirst({
//         where: {
//           attribute_test_id: testId,
//           ...(step.weight && { weight_class: step.weight }),
//           ...(step.level && { level: step.level }),
//           ...(step.ageGroup && { age_group_id: step.ageGroup }),
//         },
//       });
//       if (norm) {
//         const stdDev = Number(norm.std_dev);
//         const meanValue = Number(norm.mean_value);
//         // Avoid  Division by Zero
//         if (stdDev === 0) {
//           return safeRawValue >= meanValue
//             ? higherIsBetter
//               ? 99
//               : 1
//             : higherIsBetter
//               ? 1
//               : 99;
//         }

//         const z = calculateZScore(
//           rawValue,
//           Number(norm.mean_value),
//           Number(norm.std_dev),
//           higherIsBetter,
//         );
//         return calculatePercentile(z);
//       }
//     }
//   } catch (error) {
//     console.error(`Error in getPercentileForTest for testId ${testId}:`, error);
//   }
//   return Math.min(99, Math.max(1, Math.floor(safeRawValue / 2)));
// };

// /**
//  * Fetch the latest snapshot for a user and compute composite score.
//  */
// const getUserCompositeScore = async (
//   userId: string,
//   testIds: number[],
//   userLevel: competitive_level | undefined | null,
//   userWeight: weight_class | undefined | null,
//   userAgeGroupId: number,
// ): Promise<number> => {
//   try {
//     const latestSnapshot = await prisma.physical_snapshots.findFirst({
//       where: { user_id: userId },
//       orderBy: { created_at: "desc" },
//       include: {
//         snapshot_test_values: {
//           where: { attribute_test_id: { in: testIds } },
//           include: { attribute_tests: { select: { higher_is_better: true } } },
//         },
//       },
//     });
//     if (
//       !latestSnapshot ||
//       !latestSnapshot.snapshot_test_values ||
//       latestSnapshot.snapshot_test_values.length === 0
//     ) {
//       return 0;
//     }

//     let totalPercentile = 0;
//     let validTestsCount = 0;
//     for (const testVal of latestSnapshot.snapshot_test_values) {
//       if (testVal.value === null || testVal.value === undefined) continue; // تخطي القيم الـ Null داخل السناب شوت

//       const percentile = await getPercentileForTest(
//         testVal.attribute_test_id,
//         Number(testVal.value),
//         testVal.attribute_tests?.higher_is_better ?? true,
//         userLevel,
//         userWeight,
//         userAgeGroupId,
//       );

//       totalPercentile += percentile;
//       validTestsCount++;
//     }
//     return validTestsCount === 0 ? 0 : totalPercentile / validTestsCount;
//   } catch (error) {
//     console.error(
//       `Error calculating composite score for user ${userId}:`,
//       error,
//     );
//     return 0;
//   }
// };

// // ==========================================
// // 7.1 Get Leaderboard (Fully corrected)
// // ==========================================

// const VALID_WEIGHT_CLASSES: weight_class[] = [
//   "flyweight",
//   "bantamweight",
//   "featherweight",
//   "lightweight",
//   "light_welterweight",
//   "welterweight",
//   "light_middleweight",
//   "middleweight",
//   "super_middleweight",
//   "light_heavyweight",
//   "cruiserweight",
//   "heavyweight",
// ];

// const VALID_COMPETITIVE_LEVELS: competitive_level[] = [
//   "amateur",
//   "professional",
//   "novice",
// ]; // عدلها حسب الـ Enums عندك
// const VALID_LEADERBOARD_TYPES = [
//   "punch_power",
//   "strength",
//   "endurance",
//   "most_improved",
// ];

// export const getLeaderboard = async (
//   req: AuthRequest,
//   res: Response,
// ): Promise<void> => {
//   try {
//     const userId = req.user?.sub ? String(req.user.sub) : null;
//     if (!userId) {
//       res
//         .status(401)
//         .json({ success: false, error: "Unauthorized: Missing user payload." });
//       return;
//     }

//     const type = req.params.type as string;

//     if (!VALID_LEADERBOARD_TYPES.includes(type)) {
//       res
//         .status(400)
//         .json({
//           success: false,
//           error: `Invalid leaderboard type: ${type}. Allowed types: ${VALID_LEADERBOARD_TYPES.join(", ")}`,
//         });
//       return;
//     }

//     const currentUserProfile = await prisma.user_sport_profiles.findFirst({
//       where: { user_id: userId, is_primary: true },
//     });
//     if (!currentUserProfile) {
//       res
//         .status(404)
//         .json({ success: false, error: "User sport profile not found." });
//       return;
//     }

//     // Modification 4: Use as weight_class and as competitive_level
//     const queryWeight = req.query.weight_class as string;
//     const queryLevel = req.query.level as string;

//     if (
//       queryWeight &&
//       !VALID_WEIGHT_CLASSES.includes(queryWeight as weight_class)
//     ) {
//       res
//         .status(400)
//         .json({ success: false, error: `Invalid weight_class parameter.` });
//       return;
//     }
//     if (
//       queryLevel &&
//       !VALID_COMPETITIVE_LEVELS.includes(queryLevel as competitive_level)
//     ) {
//       res
//         .status(400)
//         .json({ success: false, error: `Invalid level parameter.` });
//       return;
//     }

//     const weightClass: weight_class =
//       (queryWeight as weight_class) || currentUserProfile.weight_class;
//     const level: competitive_level =
//       (queryLevel as competitive_level) || currentUserProfile.level;

//     const cohortUsers = await prisma.user_sport_profiles.findMany({
//       where: {
//         weight_class: weightClass,
//         level: level,
//         is_primary: true,
//       },
//       select: { user_id: true },
//     });
//     const cohortUserIds = cohortUsers.map((p) => p.user_id);
//     if (cohortUserIds.length === 0) {
//       res
//         .status(200)
//         .json({
//           success: true,
//           cohort: { weight_class: weightClass, level },
//           data: [],
//         });
//       return;
//     }

//     const usersWithDob = await prisma.users.findMany({
//       where: { id: { in: cohortUserIds } },
//       select: {
//         id: true,
//         date_of_birth: true,
//         username: true,
//         profile_photo: true,
//       },
//     });
//     const userAgeGroupMap = new Map<string, number>();
//     for (const u of usersWithDob) {
//       userAgeGroupMap.set(u.id, getAgeGroupId(u.date_of_birth));
//     }

//     const punchPowerTestIds = [1, 2, 4];
//     const strengthTestIds = [1, 5, 6];
//     const enduranceTestIds = [7, 8, 9];

//     let leaderboardData: any[] = [];
//     let selectedTestIds: number[] = [];

//     switch (type) {
//       case "punch_power":
//         selectedTestIds = punchPowerTestIds;
//         break;
//       case "strength":
//         selectedTestIds = strengthTestIds;
//         break;
//       case "endurance":
//         selectedTestIds = enduranceTestIds;
//         break;
//       case "most_improved":
//         break;
//       // default:
//       //     res.status(400).json({ success: false, error: `Invalid leaderboard type: ${type}` });
//       //     return;
//     }

//     if (type === "most_improved") {
//       const thirtyDaysAgo = new Date();
//       thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

//       const rawImprovedResults: any[] = await prisma.$queryRaw`
//                 WITH cohort_users AS (
//                     SELECT user_id FROM user_sport_profiles
//                     WHERE is_primary = true AND weight_class::text = ${weightClass} AND level::text = ${level}
//                 ),
//                 snapshots_in_range AS (
//                     SELECT id, user_id, created_at
//                     FROM physical_snapshots
//                     WHERE user_id IN (SELECT user_id FROM cohort_users)
//                       AND sport_id = 1
//                       AND created_at >= ${thirtyDaysAgo}
//                 ),
//                 first_snap AS (
//                     SELECT DISTINCT ON (user_id) id AS snapshot_id, user_id
//                     FROM snapshots_in_range
//                     ORDER BY user_id, created_at ASC
//                 ),
//                 last_snap AS (
//                     SELECT DISTINCT ON (user_id) id AS snapshot_id, user_id
//                     FROM snapshots_in_range
//                     ORDER BY user_id, created_at DESC
//                 )
//                 SELECT
//                     u.id, u.username, u.profile_photo,
//                     fs.snapshot_id AS first_snapshot_id,
//                     ls.snapshot_id AS last_snapshot_id
//                 FROM users u
//                 JOIN first_snap fs ON fs.user_id = u.id
//                 JOIN last_snap ls ON ls.user_id = u.id
//                 WHERE fs.snapshot_id != ls.snapshot_id
//             `;

//       if (rawImprovedResults && rawImprovedResults.length > 0) {
//         const improvementData = await Promise.all(
//           rawImprovedResults.map(async (ath) => {
//             const ageGroup = userAgeGroupMap.get(ath.id) || 2;
//             const firstScore = await getCompositeScoreFromSnapshot(
//               ath.first_snapshot_id,
//               punchPowerTestIds,
//               level,
//               weightClass,
//               ageGroup,
//             );
//             const lastScore = await getCompositeScoreFromSnapshot(
//               ath.last_snapshot_id,
//               punchPowerTestIds,
//               level,
//               weightClass,
//               ageGroup,
//             );
//             const improvement = lastScore - firstScore;

//             return {
//               id: ath.id,
//               username: ath.username || "Unknown",
//               profile_photo: ath.profile_photo || null,
//               score: Number(improvement.toFixed(2)), // تقريب الأرقام العشرية المنطقية
//               current_power: lastScore,
//               first_score: firstScore,
//               last_score: lastScore,
//               is_current_user: ath.id === userId,
//             };
//           }),
//         );
//         leaderboardData = improvementData.filter((d) => d.score !== 0);
//         leaderboardData.sort((a, b) => b.score - a.score);
//         leaderboardData = leaderboardData.map((item, idx) => ({
//           ...item,
//           rank: idx + 1,
//         }));
//       }
//     } else {
//       const scores = await Promise.all(
//         cohortUserIds.map(async (uid) => {
//           const ageGroup = userAgeGroupMap.get(uid) || 2;
//           const compositeScore = await getUserCompositeScore(
//             uid,
//             selectedTestIds,
//             level,
//             weightClass,
//             ageGroup,
//           );
//           if (compositeScore === 0) return null;
//           const userInfo = usersWithDob.find((u) => u.id === uid);
//           return {
//             id: uid,
//             username: userInfo?.username || "Unknown",
//             profile_photo: userInfo?.profile_photo || null,
//             score: compositeScore,
//             is_current_user: uid === userId,
//           };
//         }),
//       );
//       leaderboardData = scores.filter((s) => s !== null) as any[];
//       leaderboardData.sort((a, b) => b.score - a.score);
//       leaderboardData = leaderboardData.map((item, idx) => ({
//         ...item,
//         rank: idx + 1,
//       }));
//     }

//     const top50 = leaderboardData.slice(0, 50);
//     const currentUserEntry = leaderboardData.find((a) => a.is_current_user);
//     if (currentUserEntry && currentUserEntry.rank > 50) {
//       top50.push(currentUserEntry);
//     }

//     res
//       .status(200)
//       .json({
//         success: true,
//         cohort: { weight_class: weightClass, level: level },
//         data: top50,
//       });
//   } catch (error: any) {
//     console.error("Leaderboard Error:", error);
//     res
//       .status(500)
//       .json({
//         success: false,
//         error: "Internal server error occurred while fetching leaderboard.",
//       });
//   }
// };

// // Helper function
// async function getCompositeScoreFromSnapshot(
//   snapshotId: string,
//   testIds: number[],
//   level: competitive_level,
//   weightClass: weight_class,
//   ageGroupId: number,
// ): Promise<number> {
//   try {
//     const snapshot = await prisma.physical_snapshots.findUnique({
//       where: { id: snapshotId },
//       include: {
//         snapshot_test_values: {
//           where: { attribute_test_id: { in: testIds } },
//           include: { attribute_tests: { select: { higher_is_better: true } } },
//         },
//       },
//     });
//     if (
//       !snapshot ||
//       !snapshot.snapshot_test_values ||
//       snapshot.snapshot_test_values.length === 0
//     )
//       return 0;

//     let totalPercentile = 0;
//     let validTestsCount = 0;

//     for (const tv of snapshot.snapshot_test_values) {
//       if (tv.value === null || tv.value === undefined) continue;

//       const pct = await getPercentileForTest(
//         tv.attribute_test_id,
//         Number(tv.value),
//         tv.attribute_tests?.higher_is_better ?? true,
//         level,
//         weightClass,
//         ageGroupId,
//       );
//       totalPercentile += pct;
//       validTestsCount++;
//     }
//     return validTestsCount === 0
//       ? 0
//       : Number((totalPercentile / validTestsCount).toFixed(2));
//   } catch (error) {
//     console.error(
//       `Error in getCompositeScoreFromSnapshot for snapshot ${snapshotId}:`,
//       error,
//     );
//     return 0;
//   }
// }

import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";
import { competitive_level, weight_class } from "@prisma/client";
import {
  calculateZScore,
  calculatePercentile,
} from "../services/calculation.service";

// ==========================================
// 🛠️ Helper Functions (Analytics Engine)
// ==========================================

const getAgeGroupId = (
  dateOfBirth: Date | string | null | undefined,
): number => {
  if (!dateOfBirth) return 2;

  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 2; // Fallback

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (age < 18) return 1;
  if (age <= 35) return 2;
  return 3;
};

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

const getPercentileForTest = async (
  testId: number,
  rawValue: number,
  higherIsBetter: boolean,
  userLevel: competitive_level | undefined | null,
  userWeight: weight_class | undefined | null,
  userAgeGroupId: number,
): Promise<number> => {
  const safeRawValue = Math.max(0, rawValue);

  const fallbackSteps: any[] = [
    {
      weight: userWeight || undefined,
      level: userLevel || undefined,
      ageGroup: userAgeGroupId,
    },
    {
      weight: userWeight || undefined,
      level: userLevel || undefined,
      ageGroup: undefined,
    },
    {
      weight: userWeight
        ? { in: getAdjacentWeightClasses(userWeight) }
        : undefined,
      level: userLevel || undefined,
      ageGroup: undefined,
    },
    { weight: undefined, level: userLevel || undefined, ageGroup: undefined },
    { weight: undefined, level: undefined, ageGroup: undefined },
  ];

  try {
    for (const step of fallbackSteps) {
      const norm = await prisma.normative_data.findFirst({
        where: {
          attribute_test_id: testId,
          ...(step.weight && { weight_class: step.weight }),
          ...(step.level && { level: step.level }),
          ...(step.ageGroup && { age_group_id: step.ageGroup }),
        },
      });
      if (norm) {
        const stdDev = Number(norm.std_dev);
        const meanValue = Number(norm.mean_value);
        if (stdDev === 0) {
          return safeRawValue >= meanValue
            ? higherIsBetter
              ? 99
              : 1
            : higherIsBetter
              ? 1
              : 99;
        }

        const z = calculateZScore(rawValue, meanValue, stdDev, higherIsBetter);
        return calculatePercentile(z);
      }
    }
  } catch (error) {
    console.error(`Error in getPercentileForTest for testId ${testId}:`, error);
  }
  return Math.min(99, Math.max(1, Math.floor(safeRawValue / 2)));
};

const getUserCompositeScore = async (
  userId: string,
  testIds: number[],
  userLevel: competitive_level | undefined | null,
  userWeight: weight_class | undefined | null,
  userAgeGroupId: number,
): Promise<number> => {
  try {
    const latestSnapshot = await prisma.physical_snapshots.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        snapshot_test_values: {
          where: { attribute_test_id: { in: testIds } },
          include: { attribute_tests: { select: { higher_is_better: true } } },
        },
      },
    });
    if (
      !latestSnapshot ||
      !latestSnapshot.snapshot_test_values ||
      latestSnapshot.snapshot_test_values.length === 0
    ) {
      return 0;
    }

    let totalPercentile = 0;
    let validTestsCount = 0;
    for (const testVal of latestSnapshot.snapshot_test_values) {
      if (testVal.value === null || testVal.value === undefined) continue;

      const percentile = await getPercentileForTest(
        testVal.attribute_test_id,
        Number(testVal.value),
        testVal.attribute_tests?.higher_is_better ?? true,
        userLevel,
        userWeight,
        userAgeGroupId,
      );

      totalPercentile += percentile;
      validTestsCount++;
    }
    return validTestsCount === 0 ? 0 : totalPercentile / validTestsCount;
  } catch (error) {
    console.error(
      `Error calculating composite score for user ${userId}:`,
      error,
    );
    return 0;
  }
};

async function getCompositeScoreFromSnapshot(
  snapshotId: string,
  testIds: number[],
  level: competitive_level,
  weightClass: weight_class,
  ageGroupId: number,
): Promise<number> {
  try {
    const snapshot = await prisma.physical_snapshots.findUnique({
      where: { id: snapshotId },
      include: {
        snapshot_test_values: {
          where: { attribute_test_id: { in: testIds } },
          include: { attribute_tests: { select: { higher_is_better: true } } },
        },
      },
    });
    if (
      !snapshot ||
      !snapshot.snapshot_test_values ||
      snapshot.snapshot_test_values.length === 0
    )
      return 0;

    let totalPercentile = 0;
    let validTestsCount = 0;

    for (const tv of snapshot.snapshot_test_values) {
      if (tv.value === null || tv.value === undefined) continue;

      const pct = await getPercentileForTest(
        tv.attribute_test_id,
        Number(tv.value),
        tv.attribute_tests?.higher_is_better ?? true,
        level,
        weightClass,
        ageGroupId,
      );
      totalPercentile += pct;
      validTestsCount++;
    }
    return validTestsCount === 0
      ? 0
      : Number((totalPercentile / validTestsCount).toFixed(2));
  } catch (error) {
    console.error(
      `Error in getCompositeScoreFromSnapshot for snapshot ${snapshotId}:`,
      error,
    );
    return 0;
  }
}

// ==========================================
// 🏆 1. Category Ranked Leaderboard Controller
// ==========================================
export const getLeaderboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized: Missing user payload." });
      return;
    }

    const type = req.query.type as string;

    const currentUserProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, is_primary: true },
    });

    // 🚨 Sad Path: لو مفيش بروفايل رياضي يرجع 400 حسب الشيت
    if (!currentUserProfile) {
      res.status(400).json({
        success: false,
        error: "Cannot determine cohort — create sport profile first.",
      });
      return;
    }

    const weightClass: weight_class =
      (req.query.weight_class as weight_class) ||
      currentUserProfile.weight_class;
    const level: competitive_level =
      (req.query.level as competitive_level) || currentUserProfile.level;

    const cohortUsers = await prisma.user_sport_profiles.findMany({
      where: { weight_class: weightClass, level: level, is_primary: true },
      select: { user_id: true },
    });
    const cohortUserIds = cohortUsers.map((p) => p.user_id);

    // 🚨 Edge Case: لو الكوهورت فاضي يرجع لستة فاضية مباشرة
    if (cohortUserIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const usersWithDob = await prisma.users.findMany({
      where: { id: { in: cohortUserIds } },
      select: {
        id: true,
        date_of_birth: true,
        username: true,
        profile_photo: true,
      },
    });

    const userAgeGroupMap = new Map<string, number>();
    for (const u of usersWithDob) {
      userAgeGroupMap.set(u.id, getAgeGroupId(u.date_of_birth));
    }

    const selectedTestIds =
      type === "punch_power"
        ? [1, 2, 4]
        : type === "strength"
          ? [1, 5, 6]
          : [7, 8, 9]; // endurance

    const scores = await Promise.all(
      cohortUserIds.map(async (uid) => {
        const ageGroup = userAgeGroupMap.get(uid) || 2;
        const compositeScore = await getUserCompositeScore(
          uid,
          selectedTestIds,
          level,
          weightClass,
          ageGroup,
        );

        if (compositeScore === 0) return null;

        const userInfo = usersWithDob.find((u) => u.id === uid);

        return {
          user_id: uid,
          username: userInfo?.username || "Unknown",
          profile_photo: userInfo?.profile_photo || null,
          [`${type}_score`]: Number(compositeScore.toFixed(2)),
          weight_class: weightClass,
          level: level,
          is_current_user: uid === userId,
          score: compositeScore,
        };
      }),
    );

    let leaderboardData = scores.filter((s) => s !== null) as any[];
    leaderboardData.sort((a, b) => b.score - a.score);

    leaderboardData = leaderboardData.map((item, idx) => {
      const { score, ...cleanItem } = item;
      return { rank: idx + 1, ...cleanItem };
    });

    const top50 = leaderboardData.slice(0, 50);
    const currentUserEntry = leaderboardData.find((a) => a.is_current_user);
    if (currentUserEntry && !top50.some((a) => a.user_id === userId)) {
      top50.push(currentUserEntry);
    }

    // 🎯 الـ Happy Path المفرود تماماً
    res.status(200).json(top50);
  } catch (error: any) {
    console.error("Leaderboard Error:", error);
    next(error); // الترحيل للـ Global Error Handler
  }
};

// ==========================================
// ⚡ 2. Most Improved Leaderboard Controller
// ==========================================
export const getMostImproved = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized: Missing user payload." });
      return;
    }

    const currentUserProfile = await prisma.user_sport_profiles.findFirst({
      where: { user_id: userId, is_primary: true },
    });

    if (!currentUserProfile) {
      res
        .status(400)
        .json({ success: false, error: "Cannot determine cohort." });
      return;
    }

    const weightClass: weight_class =
      (req.query.weight_class as weight_class) ||
      currentUserProfile.weight_class;
    const level: competitive_level =
      (req.query.level as competitive_level) || currentUserProfile.level;

    const cohortUsers = await prisma.user_sport_profiles.findMany({
      where: { weight_class: weightClass, level: level, is_primary: true },
      select: { user_id: true },
    });
    const cohortUserIds = cohortUsers.map((p) => p.user_id);

    if (cohortUserIds.length === 0) {
      res.status(200).json([]);
      return;
    }

    const usersWithDob = await prisma.users.findMany({
      where: { id: { in: cohortUserIds } },
      select: { id: true, date_of_birth: true },
    });
    const userAgeGroupMap = new Map<string, number>();
    for (const u of usersWithDob) {
      userAgeGroupMap.set(u.id, getAgeGroupId(u.date_of_birth));
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rawImprovedResults: any[] = await prisma.$queryRaw`
      WITH cohort_users AS (
          SELECT user_id FROM user_sport_profiles
          WHERE is_primary = true AND weight_class::text = ${weightClass} AND level::text = ${level}
      ),
      snapshots_in_range AS (
          SELECT id, user_id, created_at
          FROM physical_snapshots
          WHERE user_id IN (SELECT user_id FROM cohort_users)
            AND sport_id = 1
            AND created_at >= ${thirtyDaysAgo}
      ),
      first_snap AS (
          SELECT DISTINCT ON (user_id) id AS snapshot_id, user_id
          FROM snapshots_in_range
          ORDER BY user_id, created_at ASC
      ),
      last_snap AS (
          SELECT DISTINCT ON (user_id) id AS snapshot_id, user_id
          FROM snapshots_in_range
          ORDER BY user_id, created_at DESC
      )
      SELECT
          u.id, u.username, u.profile_photo,
          fs.snapshot_id AS first_snapshot_id,
          ls.snapshot_id AS last_snapshot_id
      FROM users u
      JOIN first_snap fs ON fs.user_id = u.id
      JOIN last_snap ls ON ls.user_id = u.id
      WHERE fs.snapshot_id != ls.snapshot_id
    `;

    let leaderboardData: any[] = [];

    if (rawImprovedResults && rawImprovedResults.length > 0) {
      const punchPowerTestIds = [1, 2, 4];

      const improvementData = await Promise.all(
        rawImprovedResults.map(async (ath) => {
          const ageGroup = userAgeGroupMap.get(ath.id) || 2;
          const firstScore = await getCompositeScoreFromSnapshot(
            ath.first_snapshot_id,
            punchPowerTestIds,
            level,
            weightClass,
            ageGroup,
          );
          const lastScore = await getCompositeScoreFromSnapshot(
            ath.last_snapshot_id,
            punchPowerTestIds,
            level,
            weightClass,
            ageGroup,
          );
          const improvement = lastScore - firstScore;

          return {
            rank: 0, // هيتعدل ديناميكياً بعد الترتيب
            username: ath.username || "Unknown",
            profile_photo: ath.profile_photo || null,
            punch_power_delta: Number(improvement.toFixed(2)),
            start_score: firstScore,
            end_score: lastScore,
            period_days: 30,
            is_current_user: ath.id === userId,
            id: ath.id, // للتحقق من الـ Top 50
          };
        }),
      );

      leaderboardData = improvementData.filter(
        (d) => d.punch_power_delta !== 0,
      );
      leaderboardData.sort((a, b) => b.punch_power_delta - a.punch_power_delta);
      leaderboardData = leaderboardData.map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));
    }

    const top50 = leaderboardData.slice(0, 50);
    const currentUserEntry = leaderboardData.find((a) => a.is_current_user);
    if (currentUserEntry && !top50.some((a) => a.id === userId)) {
      top50.push(currentUserEntry);
    }

    // تنظيف الـ ID الداخلي قبل الإرجاع النهائي
    const cleanTop50 = top50.map(({ id, ...rest }) => rest);

    res.status(200).json(cleanTop50);
  } catch (error: any) {
    console.error("Most Improved Error:", error);
    next(error); // الترحيل للـ Global Error Handler
  }
};

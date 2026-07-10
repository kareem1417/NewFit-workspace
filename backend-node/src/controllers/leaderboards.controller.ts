import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";
import { competitive_level, player_category } from "@prisma/client";
import {
  calculateZScore,
  calculatePercentile,
} from "../services/calculation.service";
import { AppError } from "../utils/AppError";

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
  category: player_category,
): player_category[] => {
  if (!category) return [];
  const classes: player_category[] = [
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
  const idx = classes.indexOf(category);
  if (idx === -1) return [];
  const adjacent: player_category[] = [];
  if (idx > 0) adjacent.push(classes[idx - 1]);
  if (idx < classes.length - 1) adjacent.push(classes[idx + 1]);
  return adjacent;
};

const getPercentileForTest = async (
  testId: number,
  rawValue: number,
  higherIsBetter: boolean,
  userLevel: competitive_level | undefined | null,
  userCategory: player_category | undefined | null,
  userAgeGroupId: number,
): Promise<number> => {
  const safeRawValue = Math.max(0, rawValue);

  const fallbackSteps: any[] = [
    {
      category: userCategory || undefined,
      level: userLevel || undefined,
      ageGroup: userAgeGroupId,
    },
    {
      category: userCategory || undefined,
      level: userLevel || undefined,
      ageGroup: undefined,
    },
    {
      category: userCategory
        ? { in: getAdjacentWeightClasses(userCategory) }
        : undefined,
      level: userLevel || undefined,
      ageGroup: undefined,
    },
    { category: undefined, level: userLevel || undefined, ageGroup: undefined },
    { category: undefined, level: undefined, ageGroup: undefined },
  ];

  try {
    for (const step of fallbackSteps) {
      const norm = await prisma.normative_data.findFirst({
        where: {
          attribute_test_id: testId,
          ...(step.category && { player_category: step.category }),
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
  userCategory: player_category | undefined | null,
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
        userCategory,
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
  category: player_category,
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
        category,
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
      return next(new AppError("Unauthorized: Missing user payload.", 401));
    }

    const type = (req.query.type as string) || "punch_power";
    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    const currentUserProfile =
      (await prisma.user_sport_profiles.findFirst({
        where: {
          user_id: userId,
          is_primary: true,
        },
      })) ??
      (await prisma.user_sport_profiles.findFirst({
        where: {
          user_id: userId,
        },
      }));

    if (!currentUserProfile) {
      return next(
        new AppError(
          "Cannot determine cohort — create sport profile first.",
          400,
        ),
      );
    }

    const category: player_category =
      (req.query.player_category as player_category) ||
      currentUserProfile.player_category;

    const level: competitive_level =
      (req.query.level as competitive_level) || currentUserProfile.level;

    const cohortUsers = await prisma.user_sport_profiles.findMany({
      where: {
        sport_id: currentUserProfile.sport_id,
        player_category: category,
        level,
      },
      select: {
        user_id: true,
      },
    });

    const cohortUserIds = cohortUsers.map((p) => p.user_id);

    if (cohortUserIds.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          cohort: {
            type,
            sport_id: currentUserProfile.sport_id,
            level,
            player_category: category,
            athlete_count: 0,
          },
          leaderboard: [],
          current_user: null,
        },
      });
      return;
    }

    const usersWithDob = await prisma.users.findMany({
      where: {
        id: {
          in: cohortUserIds,
        },
      },
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

    // Dynamically resolve test IDs based on sport attribute names
    const attributeNamesByType: Record<string, string[]> = {
      punch_power: ["Punch Power", "Hand Speed"],
      strength: ["Punch Power", "Footwork & Agility", "Defense & Reflexes"],
      endurance: ["Footwork & Agility", "Defense & Reflexes", "Hand Speed"],
    };

    const targetAttributeNames = attributeNamesByType[type] || attributeNamesByType["punch_power"];

    const matchingAttributes = await prisma.sport_attributes.findMany({
      where: {
        sport_id: currentUserProfile.sport_id,
        name: { in: targetAttributeNames },
      },
      select: { id: true },
    });

    const matchingAttributeIds = matchingAttributes.map((a) => a.id);

    const matchingTests = await prisma.attribute_tests.findMany({
      where: {
        sport_attribute_id: { in: matchingAttributeIds },
      },
      select: { id: true },
    });

    const selectedTestIds = matchingTests.map((t) => t.id);

    const scores = await Promise.all(
      cohortUserIds.map(async (uid) => {
        const ageGroup = userAgeGroupMap.get(uid) || 2;

        const compositeScore = await getUserCompositeScore(
          uid,
          selectedTestIds,
          level,
          category,
          ageGroup,
        );

        if (compositeScore === 0) return null;

        const userInfo = usersWithDob.find((u) => u.id === uid);

        return {
          user_id: uid,
          username: userInfo?.username || "Unknown",
          profile_photo: userInfo?.profile_photo || null,
          percentile_score: Number(compositeScore.toFixed(0)),
          delta_trend: "+0",
          trend_status: "up",
          player_category: category,
          level,
          is_current_user: uid === userId,
          score: compositeScore,
        };
      }),
    );

    let leaderboardData = scores.filter((s) => s !== null) as any[];

    leaderboardData.sort((a, b) => b.score - a.score);

    leaderboardData = leaderboardData.map((item, idx) => {
      const { score, ...cleanItem } = item;

      return {
        rank: idx + 1,
        ...cleanItem,
      };
    });

    const paginatedData = leaderboardData.slice(offset, offset + limit);

    const currentUserEntry = leaderboardData.find((a) => a.is_current_user);

    if (
      currentUserEntry &&
      !paginatedData.some((a) => a.user_id === userId)
    ) {
      paginatedData.push(currentUserEntry);
    }

    res.status(200).json({
      success: true,
      data: {
        cohort: {
          type,
          sport_id: currentUserProfile.sport_id,
          level,
          player_category: category,
          athlete_count: leaderboardData.length,
        },
        leaderboard: paginatedData,
        current_user: currentUserEntry || null,
      },
    });
  } catch (error: any) {
    console.error("Leaderboard Error:", error);
    next(error);
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
      return next(new AppError("Unauthorized: Missing user payload.", 401));
    }

    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    const currentUserProfile =
      (await prisma.user_sport_profiles.findFirst({
        where: {
          user_id: userId,
          is_primary: true,
        },
      })) ??
      (await prisma.user_sport_profiles.findFirst({
        where: {
          user_id: userId,
        },
      }));

    if (!currentUserProfile) {
      return next(new AppError("Cannot determine cohort.", 400));
    }

    const category: player_category =
      (req.query.player_category as player_category) ||
      currentUserProfile.player_category;
    const level: competitive_level =
      (req.query.level as competitive_level) || currentUserProfile.level;

    const cohortUsers = await prisma.user_sport_profiles.findMany({
      where: {
        sport_id: currentUserProfile.sport_id,
        player_category: category,
        level: level
      },
      select: { user_id: true },
    });

    const cohortUserIds = cohortUsers.map((p) => p.user_id);

    if (cohortUserIds.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          cohort: {
            type: "most_improved",
            sport_id: currentUserProfile.sport_id,
            level,
            player_category: category,
            athlete_count: 0,
          },
          leaderboard: [],
          current_user: null,
        },
      });
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
          WHERE player_category::text = ${category}
            AND level::text = ${level}
            AND sport_id = ${currentUserProfile.sport_id}
      ),
      snapshots_in_range AS (
          SELECT id, user_id, created_at
          FROM physical_snapshots
          WHERE user_id IN (SELECT user_id FROM cohort_users)
            AND sport_id = ${currentUserProfile.sport_id}
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
      // Dynamically resolve test IDs for punch power
      const punchPowerAttributes = await prisma.sport_attributes.findMany({
        where: {
          sport_id: currentUserProfile.sport_id,
          name: { in: ["Punch Power", "Hand Speed"] },
        },
        select: { id: true },
      });
      const punchPowerAttrIds = punchPowerAttributes.map((a) => a.id);
      const punchPowerTests = await prisma.attribute_tests.findMany({
        where: { sport_attribute_id: { in: punchPowerAttrIds } },
        select: { id: true },
      });
      const punchPowerTestIds = punchPowerTests.map((t) => t.id);

      const improvementData = await Promise.all(
        rawImprovedResults.map(async (ath) => {
          const ageGroup = userAgeGroupMap.get(ath.id) || 2;
          const firstScore = await getCompositeScoreFromSnapshot(
            ath.first_snapshot_id,
            punchPowerTestIds,
            level,
            category,
            ageGroup,
          );
          const lastScore = await getCompositeScoreFromSnapshot(
            ath.last_snapshot_id,
            punchPowerTestIds,
            level,
            category,
            ageGroup,
          );
          const improvement = lastScore - firstScore;

          return {
            rank: 0,
            username: ath.username || "Unknown",
            profile_photo: ath.profile_photo || null,
            punch_power_delta: Number(improvement.toFixed(2)),
            start_score: firstScore,
            end_score: lastScore,
            period_days: 30,
            is_current_user: ath.id === userId,
            id: ath.id,
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

    const paginatedData = leaderboardData.slice(offset, offset + limit);

    const currentUserEntry = leaderboardData.find((a) => a.is_current_user);
    if (currentUserEntry && !paginatedData.some((a) => a.id === userId)) {
      paginatedData.push(currentUserEntry);
    }

    const finalData = paginatedData.map(({ id, ...rest }) => ({
      user_id: id,
      ...rest,
    }));

    // توحيد الـ Response عشان يطابق GetLeaderboard
    res.status(200).json({
      success: true,
      data: {
        cohort: {
          type: "most_improved",
          sport_id: currentUserProfile.sport_id,
          level,
          player_category: category,
          athlete_count: leaderboardData.length,
        },
        leaderboard: finalData,
        current_user: currentUserEntry ? { user_id: currentUserEntry.id, ...currentUserEntry } : null,
      },
    });
  } catch (error: any) {
    console.error("Most Improved Error:", error);
    next(error);
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMostImproved = exports.getLeaderboard = void 0;
const prisma_1 = require("../config/prisma");
const calculation_service_1 = require("../services/calculation.service");
const AppError_1 = require("../utils/AppError");
// ==========================================
// 🛠️ Helper Functions (Analytics Engine)
// ==========================================
const getAgeGroupId = (dateOfBirth) => {
    if (!dateOfBirth)
        return 2;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()))
        return 2; // Fallback
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    if (age < 18)
        return 1;
    if (age <= 35)
        return 2;
    return 3;
};
const getAdjacentWeightClasses = (category) => {
    if (!category)
        return [];
    const classes = [
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
    if (idx === -1)
        return [];
    const adjacent = [];
    if (idx > 0)
        adjacent.push(classes[idx - 1]);
    if (idx < classes.length - 1)
        adjacent.push(classes[idx + 1]);
    return adjacent;
};
const getPercentileForTest = async (testId, rawValue, higherIsBetter, userLevel, userCategory, userAgeGroupId) => {
    const safeRawValue = Math.max(0, rawValue);
    const fallbackSteps = [
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
            const norm = await prisma_1.prisma.normative_data.findFirst({
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
                const z = (0, calculation_service_1.calculateZScore)(rawValue, meanValue, stdDev, higherIsBetter);
                return (0, calculation_service_1.calculatePercentile)(z);
            }
        }
    }
    catch (error) {
        console.error(`Error in getPercentileForTest for testId ${testId}:`, error);
    }
    return Math.min(99, Math.max(1, Math.floor(safeRawValue / 2)));
};
const getUserCompositeScore = async (userId, testIds, userLevel, userCategory, userAgeGroupId) => {
    try {
        const latestSnapshot = await prisma_1.prisma.physical_snapshots.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            include: {
                snapshot_test_values: {
                    where: { attribute_test_id: { in: testIds } },
                    include: { attribute_tests: { select: { higher_is_better: true } } },
                },
            },
        });
        if (!latestSnapshot ||
            !latestSnapshot.snapshot_test_values ||
            latestSnapshot.snapshot_test_values.length === 0) {
            return 0;
        }
        let totalPercentile = 0;
        let validTestsCount = 0;
        for (const testVal of latestSnapshot.snapshot_test_values) {
            if (testVal.value === null || testVal.value === undefined)
                continue;
            const percentile = await getPercentileForTest(testVal.attribute_test_id, Number(testVal.value), testVal.attribute_tests?.higher_is_better ?? true, userLevel, userCategory, userAgeGroupId);
            totalPercentile += percentile;
            validTestsCount++;
        }
        return validTestsCount === 0 ? 0 : totalPercentile / validTestsCount;
    }
    catch (error) {
        console.error(`Error calculating composite score for user ${userId}:`, error);
        return 0;
    }
};
async function getCompositeScoreFromSnapshot(snapshotId, testIds, level, category, ageGroupId) {
    try {
        const snapshot = await prisma_1.prisma.physical_snapshots.findUnique({
            where: { id: snapshotId },
            include: {
                snapshot_test_values: {
                    where: { attribute_test_id: { in: testIds } },
                    include: { attribute_tests: { select: { higher_is_better: true } } },
                },
            },
        });
        if (!snapshot ||
            !snapshot.snapshot_test_values ||
            snapshot.snapshot_test_values.length === 0)
            return 0;
        let totalPercentile = 0;
        let validTestsCount = 0;
        for (const tv of snapshot.snapshot_test_values) {
            if (tv.value === null || tv.value === undefined)
                continue;
            const pct = await getPercentileForTest(tv.attribute_test_id, Number(tv.value), tv.attribute_tests?.higher_is_better ?? true, level, category, ageGroupId);
            totalPercentile += pct;
            validTestsCount++;
        }
        return validTestsCount === 0
            ? 0
            : Number((totalPercentile / validTestsCount).toFixed(2));
    }
    catch (error) {
        console.error(`Error in getCompositeScoreFromSnapshot for snapshot ${snapshotId}:`, error);
        return 0;
    }
}
// ==========================================
// 🏆 1. Category Ranked Leaderboard Controller
// ==========================================
const getLeaderboard = async (req, res, next) => {
    try {
        const userId = req.user?.sub ? String(req.user.sub) : null;
        if (!userId) {
            return next(new AppError_1.AppError("Unauthorized: Missing user payload.", 401));
        }
        const type = req.query.type;
        const limit = Math.max(1, parseInt(req.query.limit) || 50);
        const offset = Math.max(0, parseInt(req.query.offset) || 0);
        const currentUserProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true },
        });
        if (!currentUserProfile) {
            return next(new AppError_1.AppError("Cannot determine cohort — create sport profile first.", 400));
        }
        const category = req.query.player_category ||
            currentUserProfile.player_category;
        const level = req.query.level || currentUserProfile.level;
        const cohortUsers = await prisma_1.prisma.user_sport_profiles.findMany({
            where: { player_category: category, level: level, is_primary: true },
            select: { user_id: true },
        });
        const cohortUserIds = cohortUsers.map((p) => p.user_id);
        if (cohortUserIds.length === 0) {
            res.status(200).json([]);
            return;
        }
        const usersWithDob = await prisma_1.prisma.users.findMany({
            where: { id: { in: cohortUserIds } },
            select: {
                id: true,
                date_of_birth: true,
                username: true,
                profile_photo: true,
            },
        });
        const userAgeGroupMap = new Map();
        for (const u of usersWithDob) {
            userAgeGroupMap.set(u.id, getAgeGroupId(u.date_of_birth));
        }
        const selectedTestIds = type === "punch_power"
            ? [1, 2, 4]
            : type === "strength"
                ? [1, 5, 6]
                : [7, 8, 9]; // endurance
        const scores = await Promise.all(cohortUserIds.map(async (uid) => {
            const ageGroup = userAgeGroupMap.get(uid) || 2;
            const compositeScore = await getUserCompositeScore(uid, selectedTestIds, level, category, ageGroup);
            if (compositeScore === 0)
                return null;
            const userInfo = usersWithDob.find((u) => u.id === uid);
            return {
                user_id: uid,
                username: userInfo?.username || "Unknown",
                profile_photo: userInfo?.profile_photo || null,
                [`${type}_score`]: Number(compositeScore.toFixed(2)),
                player_category: category,
                level: level,
                is_current_user: uid === userId,
                score: compositeScore,
            };
        }));
        let leaderboardData = scores.filter((s) => s !== null);
        leaderboardData.sort((a, b) => b.score - a.score);
        leaderboardData = leaderboardData.map((item, idx) => {
            const { score, ...cleanItem } = item;
            return { rank: idx + 1, ...cleanItem };
        });
        // تطبيق الـ Pagination
        const paginatedData = leaderboardData.slice(offset, offset + limit);
        // التأكد إن اللاعب الحالي موجود في الرد، حتى لو مش في الصفحة الحالية
        const currentUserEntry = leaderboardData.find((a) => a.is_current_user);
        if (currentUserEntry && !paginatedData.some((a) => a.user_id === userId)) {
            paginatedData.push(currentUserEntry);
        }
        res.status(200).json(paginatedData);
    }
    catch (error) {
        console.error("Leaderboard Error:", error);
        next(error);
    }
};
exports.getLeaderboard = getLeaderboard;
// ==========================================
// ⚡ 2. Most Improved Leaderboard Controller
// ==========================================
const getMostImproved = async (req, res, next) => {
    try {
        const userId = req.user?.sub ? String(req.user.sub) : null;
        if (!userId) {
            return next(new AppError_1.AppError("Unauthorized: Missing user payload.", 401));
        }
        const limit = Math.max(1, parseInt(req.query.limit) || 50);
        const offset = Math.max(0, parseInt(req.query.offset) || 0);
        const currentUserProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true },
        });
        if (!currentUserProfile) {
            return next(new AppError_1.AppError("Cannot determine cohort.", 400));
        }
        const category = req.query.player_category ||
            currentUserProfile.player_category;
        const level = req.query.level || currentUserProfile.level;
        const cohortUsers = await prisma_1.prisma.user_sport_profiles.findMany({
            where: { player_category: category, level: level, is_primary: true },
            select: { user_id: true },
        });
        const cohortUserIds = cohortUsers.map((p) => p.user_id);
        if (cohortUserIds.length === 0) {
            res.status(200).json([]);
            return;
        }
        const usersWithDob = await prisma_1.prisma.users.findMany({
            where: { id: { in: cohortUserIds } },
            select: { id: true, date_of_birth: true },
        });
        const userAgeGroupMap = new Map();
        for (const u of usersWithDob) {
            userAgeGroupMap.set(u.id, getAgeGroupId(u.date_of_birth));
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const rawImprovedResults = await prisma_1.prisma.$queryRaw `
      WITH cohort_users AS (
          SELECT user_id FROM user_sport_profiles
          WHERE is_primary = true AND player_category::text = ${category} AND level::text = ${level}
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
        let leaderboardData = [];
        if (rawImprovedResults && rawImprovedResults.length > 0) {
            const punchPowerTestIds = [1, 2, 4];
            const improvementData = await Promise.all(rawImprovedResults.map(async (ath) => {
                const ageGroup = userAgeGroupMap.get(ath.id) || 2;
                const firstScore = await getCompositeScoreFromSnapshot(ath.first_snapshot_id, punchPowerTestIds, level, category, ageGroup);
                const lastScore = await getCompositeScoreFromSnapshot(ath.last_snapshot_id, punchPowerTestIds, level, category, ageGroup);
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
            }));
            leaderboardData = improvementData.filter((d) => d.punch_power_delta !== 0);
            leaderboardData.sort((a, b) => b.punch_power_delta - a.punch_power_delta);
            leaderboardData = leaderboardData.map((item, idx) => ({
                ...item,
                rank: idx + 1,
            }));
        }
        // تطبيق الـ Pagination
        const paginatedData = leaderboardData.slice(offset, offset + limit);
        // التأكد من وجود اللاعب الحالي
        const currentUserEntry = leaderboardData.find((a) => a.is_current_user);
        if (currentUserEntry && !paginatedData.some((a) => a.id === userId)) {
            paginatedData.push(currentUserEntry);
        }
        // تنظيف الـ ID الداخلي وتحويله لـ user_id قبل الإرجاع النهائي
        const finalData = paginatedData.map(({ id, ...rest }) => ({
            user_id: id,
            ...rest,
        }));
        res.status(200).json(finalData);
    }
    catch (error) {
        console.error("Most Improved Error:", error);
        next(error);
    }
};
exports.getMostImproved = getMostImproved;

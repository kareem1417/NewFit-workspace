import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';
import { calculateZScore, calculatePercentile } from '../services/calculation.service';
import { competitive_level, weight_class } from '@prisma/client'; // Import Enums

// ==========================================
// Helper Functions
// ==========================================

const getAgeGroupId = (dateOfBirth: Date): number => {
    const age = new Date().getFullYear() - dateOfBirth.getFullYear();
    if (age < 18) return 1;
    if (age <= 35) return 2;
    return 3;
};

// Modification 1: Use weight_class Enum
const getAdjacentWeightClasses = (weightClass: weight_class): weight_class[] => {
    const classes: weight_class[] = [
        'flyweight', 'bantamweight', 'featherweight', 'lightweight',
        'light_welterweight', 'welterweight', 'light_middleweight', 'middleweight',
        'super_middleweight', 'light_heavyweight', 'cruiserweight', 'heavyweight'
    ];
    const idx = classes.indexOf(weightClass);
    if (idx === -1) return [];
    const adjacent: weight_class[] = [];
    if (idx > 0) adjacent.push(classes[idx - 1]);
    if (idx < classes.length - 1) adjacent.push(classes[idx + 1]);
    return adjacent;
};

/**
 * 5-level fallback cascade
 */
// Modification 2: Use Enums here instead of string
const getPercentileForTest = async (
    testId: number,
    rawValue: number,
    higherIsBetter: boolean,
    userLevel: competitive_level,
    userWeight: weight_class,
    userAgeGroupId: number
): Promise<number> => {
    // Modification 3: Force type as any to match Prisma filter conditions
    const fallbackSteps: any[] = [
        { weight: userWeight, level: userLevel, ageGroup: userAgeGroupId },
        { weight: userWeight, level: userLevel, ageGroup: undefined },
        { weight: { in: getAdjacentWeightClasses(userWeight) }, level: userLevel, ageGroup: undefined },
        { weight: undefined, level: userLevel, ageGroup: undefined },
        { weight: undefined, level: undefined, ageGroup: undefined }
    ];

    for (const step of fallbackSteps) {
        const norm = await prisma.normative_data.findFirst({
            where: {
                attribute_test_id: testId,
                ...(step.weight && { weight_class: step.weight }),
                ...(step.level && { level: step.level }),
                ...(step.ageGroup && { age_group_id: step.ageGroup })
            }
        });
        if (norm) {
            const z = calculateZScore(rawValue, Number(norm.mean_value), Number(norm.std_dev), higherIsBetter);
            return calculatePercentile(z);
        }
    }
    return Math.min(99, Math.max(1, Math.floor(rawValue / 2)));
};

/**
 * Fetch the latest snapshot for a user and compute composite score.
 */
const getUserCompositeScore = async (
    userId: string,
    testIds: number[],
    userLevel: competitive_level,
    userWeight: weight_class,
    userAgeGroupId: number
): Promise<number> => {
    const latestSnapshot = await prisma.physical_snapshots.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        include: {
            snapshot_test_values: {
                where: { attribute_test_id: { in: testIds } },
                include: { attribute_tests: { select: { higher_is_better: true } } }
            }
        }
    });
    if (!latestSnapshot || latestSnapshot.snapshot_test_values.length === 0) {
        return 0;
    }

    let totalPercentile = 0;
    for (const testVal of latestSnapshot.snapshot_test_values) {
        const percentile = await getPercentileForTest(
            testVal.attribute_test_id,
            Number(testVal.value),
            testVal.attribute_tests?.higher_is_better ?? true,
            userLevel,
            userWeight,
            userAgeGroupId
        );
        totalPercentile += percentile;
    }
    return totalPercentile / latestSnapshot.snapshot_test_values.length;
};

// ==========================================
// 7.1 Get Leaderboard (Fully corrected)
// ==========================================

export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const type = req.params.type as string;

        const currentUserProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true }
        });
        if (!currentUserProfile) {
            res.status(404).json({ success: false, error: "User sport profile not found." });
            return;
        }

        // Modification 4: Use as weight_class and as competitive_level
        const weightClass = (req.query.weight_class as weight_class) || currentUserProfile.weight_class;
        const level = (req.query.level as competitive_level) || currentUserProfile.level;

        const cohortUsers = await prisma.user_sport_profiles.findMany({
            where: {
                weight_class: weightClass,
                level: level,
                is_primary: true
            },
            select: { user_id: true }
        });
        const cohortUserIds = cohortUsers.map(p => p.user_id);
        if (cohortUserIds.length === 0) {
            res.status(200).json({ success: true, cohort: { weight_class: weightClass, level }, data: [] });
            return;
        }

        const usersWithDob = await prisma.users.findMany({
            where: { id: { in: cohortUserIds } },
            select: { id: true, date_of_birth: true, username: true, profile_photo: true }
        });
        const userAgeGroupMap = new Map<string, number>();
        for (const u of usersWithDob) {
            userAgeGroupMap.set(u.id, getAgeGroupId(u.date_of_birth));
        }

        const punchPowerTestIds = [1, 2, 4];
        const strengthTestIds = [1, 5, 6];
        const enduranceTestIds = [7, 8, 9];

        let selectedTestIds: number[] = [];
        switch (type) {
            case 'punch_power': selectedTestIds = punchPowerTestIds; break;
            case 'strength': selectedTestIds = strengthTestIds; break;
            case 'endurance': selectedTestIds = enduranceTestIds; break;
            case 'most_improved': break;
            default:
                res.status(400).json({ success: false, error: `Invalid leaderboard type: ${type}` });
                return;
        }

        let leaderboardData: any[] = [];

        if (type === 'most_improved') {
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

            const improvementData = await Promise.all(rawImprovedResults.map(async (ath) => {
                const ageGroup = userAgeGroupMap.get(ath.id) || 2;
                const firstScore = await getCompositeScoreFromSnapshot(ath.first_snapshot_id, punchPowerTestIds, level, weightClass, ageGroup);
                const lastScore = await getCompositeScoreFromSnapshot(ath.last_snapshot_id, punchPowerTestIds, level, weightClass, ageGroup);
                const improvement = lastScore - firstScore;
                return {
                    id: ath.id, username: ath.username, profile_photo: ath.profile_photo,
                    score: improvement, current_power: lastScore, first_score: firstScore,
                    last_score: lastScore, is_current_user: ath.id === userId
                };
            }));

            leaderboardData = improvementData.filter(d => d.score !== 0);
            leaderboardData.sort((a, b) => b.score - a.score);
            leaderboardData = leaderboardData.map((item, idx) => ({ ...item, rank: idx + 1 }));
        }
        else {
            const scores = await Promise.all(
                cohortUserIds.map(async (uid) => {
                    const ageGroup = userAgeGroupMap.get(uid) || 2;
                    const compositeScore = await getUserCompositeScore(uid, selectedTestIds, level, weightClass, ageGroup);
                    if (compositeScore === 0) return null;
                    const userInfo = usersWithDob.find(u => u.id === uid);
                    return {
                        id: uid, username: userInfo?.username || 'Unknown', profile_photo: userInfo?.profile_photo || null,
                        score: compositeScore, is_current_user: uid === userId
                    };
                })
            );
            leaderboardData = scores.filter(s => s !== null) as any[];
            leaderboardData.sort((a, b) => b.score - a.score);
            leaderboardData = leaderboardData.map((item, idx) => ({ ...item, rank: idx + 1 }));
        }

        const top50 = leaderboardData.slice(0, 50);
        const currentUserEntry = leaderboardData.find(a => a.is_current_user);
        if (currentUserEntry && currentUserEntry.rank > 50) {
            top50.push(currentUserEntry);
        }

        res.status(200).json({ success: true, cohort: { weight_class: weightClass, level: level }, data: top50 });
    } catch (error: any) {
        console.error("Leaderboard Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch leaderboard." });
    }
};

// Helper function
async function getCompositeScoreFromSnapshot(
    snapshotId: string,
    testIds: number[],
    level: competitive_level,
    weightClass: weight_class,
    ageGroupId: number
): Promise<number> {
    const snapshot = await prisma.physical_snapshots.findUnique({
        where: { id: snapshotId },
        include: {
            snapshot_test_values: {
                where: { attribute_test_id: { in: testIds } },
                include: { attribute_tests: { select: { higher_is_better: true } } }
            }
        }
    });
    if (!snapshot || snapshot.snapshot_test_values.length === 0) return 0;

    let totalPercentile = 0;
    for (const tv of snapshot.snapshot_test_values) {
        const pct = await getPercentileForTest(
            tv.attribute_test_id,
            Number(tv.value),
            tv.attribute_tests?.higher_is_better ?? true,
            level,
            weightClass,
            ageGroupId
        );
        totalPercentile += pct;
    }
    return totalPercentile / snapshot.snapshot_test_values.length;
}
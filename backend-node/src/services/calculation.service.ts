import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
/**
 * 1. Calculate Z-Score (how far user's score is from mean)
 */
export const calculateZScore = (value: number, mean: number, stdDev: number, higherIsBetter: boolean = true): number => {
    if (stdDev === 0) return 0;
    // If higher is better (e.g. weight lifted), subtract mean from value
    // If lower is better (e.g. running time), reverse the calculation
    return higherIsBetter ? (value - mean) / stdDev : (mean - value) / stdDev;
};

/**
 * 2. Convert Z-Score to Percentile (0 to 100)
 */
export const calculatePercentile = (zScore: number): number => {
    const sign = zScore < 0 ? -1 : 1;
    const x = Math.abs(zScore) / Math.sqrt(2);
    const t = 1.0 / (1.0 + 0.3275911 * x);
    const erf = sign * (1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));

    const percentile = 0.5 * (1 + erf) * 100;
    return Math.round(percentile);
};

/**
 * 3. Calculate Punch Power based on exercise percentiles
 */
export const calculatePunchPower = (foundation: number, accelerator: number, transfer: number): number => {
    // 30% Foundation, 40% Accelerator, 30% Transfer
    const score = (foundation * 0.30) + (accelerator * 0.40) + (transfer * 0.30);
    return Number(score.toFixed(2));
};



/*
 // Normal CDF approximation (Abramowitz & Stegun)
 
function normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
    const p =
        d *
        t *
        (0.31938153 +
            t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
}*/

/**
 * Determine age group id from date of birth.
 */
export function getAgeGroupId(dateOfBirth: Date): number {
    const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
    if (age < 18) return 1;
    if (age <= 35) return 2;
    return 3;
}

export interface Cohort {
    weight_class: string;
    level: string;
    age_group_id: number;
}

/**
 * Fetch the most recent value for a specific attribute_test_id,
 * across all snapshots of a user in a given sport.
 */

// Used for getProgress also(No, Should return date also)
export async function getLatestTestValue(
    userId: string,
    sportId: number,
    attributeTestId: number,
): Promise<number | null> {
    const row = await prisma.snapshot_test_values.findFirst({
        where: {
            attribute_test_id: attributeTestId,
            physical_snapshots: {
                user_id: userId,
                sport_id: sportId,
            },
        },
        orderBy: {
            physical_snapshots: { created_at: 'desc' },
        },
        select: {
            value: true,
        },
    });

    // If a row is found, return an object; otherwise, return null
    return row
        ? Number(row.value)
        : null;
}

/**
 * Compute a single attribute score using the latest test values.
 */
// Use the same function for radar scoring and leaderboard scoring against cross-cohort.
// add optional rawValue parameter to call the function directly wherever the user do an update
/* kda b2a nfs el function bs aktr mn use case 
1-radar (the cohort & user)
2-leaderboard (pass only the cohort)
3-update test values (send snapshotId and testId and rawValue to update the value for a specific test in a snapshot)
4 getProgress (All snapshots --> send raw value per snapshot)
*/

export async function computeAttributeScore(
    attributeId: number,
    userId: string,
    sportId: number,
    cohort: { weight_class: string; level: string; age_group_id: number },
): Promise<number | null> {
    const tests = await prisma.attribute_tests.findMany({
        where: { sport_attribute_id: attributeId },
    });

    const userSex = await prisma.users.findFirst({
        where: { id: userId },
        select: { sex: true },
    });

    if (tests.length === 0) return null;

    let totalWeightedPercentile = 0;
    let totalWeight = 0;

    for (const test of tests) {
        const result = await getLatestTestValue(userId, sportId, test.id);

        if (result === null) continue;

        const norm = await prisma.normative_data.findFirst({
            where: {
                sport_id: sportId,
                attribute_test_id: test.id,
                weight_class: cohort.weight_class as any,
                level: cohort.level as any,
                age_group_id: cohort.age_group_id,
                sex: userSex?.sex || 'male',
            },
        });
        if (!norm) continue;

        const mean = Number(norm.mean_value);
        const stdDev = Number(norm.std_dev);
        const higherIsBetter = test.higher_is_better ?? true;

        const zScore = calculateZScore(result, mean, stdDev, higherIsBetter);

        const percentile = calculatePercentile(zScore);

        totalWeightedPercentile += Number(test.weight) * percentile;
        totalWeight += Number(test.weight);
    }

    if (totalWeight === 0) return null;
    return Math.round(totalWeightedPercentile / totalWeight);
}

export async function computeAttributeScoreRaw(
    attributeId: number,
    cohort: { weight_class: string; level: string; age_group_id: number },
    userSex: string,
    rawValue: number
): Promise<number | null> {

    // If one physical attribute have multiple tests
    const tests = await prisma.attribute_tests.findMany({
        where: { sport_attribute_id: attributeId },
    });


    if (tests.length === 0) return null;

    let totalWeightedPercentile = 0;
    let totalWeight = 0;

    for (const test of tests) {

        const norm = await prisma.normative_data.findFirst({
            where: {
                //sport_id: sportId,
                attribute_test_id: test.id,
                weight_class: cohort.weight_class as any,
                level: cohort.level as any,
                age_group_id: cohort.age_group_id,
                sex: userSex
            },
        });
        if (!norm) continue;

        const mean = Number(norm.mean_value);
        const stdDev = Number(norm.std_dev);
        const higherIsBetter = test.higher_is_better ?? true;

        const zScore = calculateZScore(rawValue, mean, stdDev, higherIsBetter);

        const percentile = calculatePercentile(zScore);

        totalWeightedPercentile += Number(test.weight) * percentile;
        totalWeight += Number(test.weight);
    }

    if (totalWeight === 0) return null;
    return Math.round(totalWeightedPercentile / totalWeight);
}

export async function computeAndSavePhysicalScores(
    userId: string,
    sportId: number = 1,
): Promise<Record<string, number | null>> {
    // profile and age group lookup (unchanged)
    const profile = await prisma.user_sport_profiles.findFirst({
        where: { user_id: userId, sport_id: sportId, is_primary: true },
    });
    if (!profile) throw new Error('User sport profile not found');

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user?.date_of_birth) throw new Error('User date_of_birth missing');

    const ageGroupId = getAgeGroupId(new Date(user.date_of_birth));
    const cohort = {
        weight_class: profile.weight_class,
        level: profile.level,
        age_group_id: ageGroupId,
    };


    // Now compute each attribute using the latest test values across all snapshots
    const strength = await computeAttributeScore(1, userId, sportId, cohort);
    const explosiveness = await computeAttributeScore(2, userId, sportId, cohort);
    const aerobic = await computeAttributeScore(3, userId, sportId, cohort);
    const muscularEndurance = await computeAttributeScore(4, userId, sportId, cohort);
    const anaerobic = await computeAttributeScore(5, userId, sportId, cohort);

    const existingMetrics = await prisma.user_metrics.findUnique({
        where: { user_id: userId },
    });

    await prisma.user_metrics.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            height_cm: existingMetrics?.height_cm ?? 175,
            weight_kg: existingMetrics?.weight_kg ?? 75,
            goal: existingMetrics?.goal ?? 'Strength',
            training_days_per_week: existingMetrics?.training_days_per_week ?? 5,
            years_training: existingMetrics?.years_training ?? 3,
            has_injury_history: existingMetrics?.has_injury_history ?? false,
            strength_score: strength ?? 50,
            explosiveness_score: explosiveness ?? 50,
            aerobic_score: aerobic ?? 50,
            endurance_score: muscularEndurance ?? 50,
            anaerobic_score: anaerobic ?? 50,
            punch_power_score: existingMetrics?.punch_power_score ?? null,
            hand_speed_score: existingMetrics?.hand_speed_score ?? null,
            clinch_control_score: existingMetrics?.clinch_control_score ?? null,
            shooting_power_score: existingMetrics?.shooting_power_score ?? null,
            agility_score: existingMetrics?.agility_score ?? null,
            jump_height_score: existingMetrics?.jump_height_score ?? null,
            speed_score: existingMetrics?.speed_score ?? null,
        },
        update: {
            strength_score: strength ?? 50,
            explosiveness_score: explosiveness ?? 50,
            aerobic_score: aerobic ?? 50,
            endurance_score: muscularEndurance ?? 50,
            anaerobic_score: anaerobic ?? 50,
        },
    });

    return { strength, explosiveness, aerobic, muscularEndurance, anaerobic };
}

// services/leaderboard.service.ts

interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    profilePhoto: string | null;
    score: number;
    isCurrentUser: boolean;
}

export async function getLeaderboardWithUser(
    sportId: number,
    attributeOrGoal: number | 'punch_power',
    targetCohort: { weight_class: string; level: string; age_group_id: number },
    currentUserId?: string,                       // optional – only needed for cross‑cohort
    limit: number = 20,
): Promise<LeaderboardEntry[]> {
    // 1. Fetch all athletes that belong to the target cohort
    const profiles = await prisma.user_sport_profiles.findMany({
        where: {
            sport_id: sportId,
            weight_class: targetCohort.weight_class as any,
            level: targetCohort.level as any,
        },
        include: { users: { select: { id: true, username: true, profile_photo: true, date_of_birth: true } } },
    });

    // Filter by age group
    // Not all users have date_of_birth filled.
    const filtered = profiles.filter(p => {
        if (!p.users.date_of_birth) return false;
        return getAgeGroupId(new Date(p.users.date_of_birth)) === targetCohort.age_group_id;
    });

    // 2. Score each athlete using the target cohort norms
    const scored: Omit<LeaderboardEntry, 'rank'>[] = [];

    for (const prof of filtered) {
        let score: number | null = null;
        /*if (attributeOrGoal === 'punch_power') {
          score = await computePunchPowerForCohort(prof.user.id, sportId, targetCohort);
        } else {*/
        score = await computeAttributeScore(attributeOrGoal as number, prof.users.id, sportId, targetCohort);
        //}
        if (score !== null) {
            scored.push({
                userId: prof.users.id,
                username: prof.users.username,
                profilePhoto: prof.users.profile_photo,
                score,
                isCurrentUser: prof.users.id === currentUserId,
            });
        }
    }

    // 3. If currentUserId is not in the target cohort, add them manually
    // El some bt3ml eh
    if (currentUserId && !scored.some(entry => entry.userId === currentUserId)) {
        const userScore = await computeAttributeScore(attributeOrGoal as number, currentUserId, sportId, targetCohort);

        if (userScore !== null) {
            const user = await prisma.users.findUnique({
                where: { id: currentUserId },
                select: { username: true, profile_photo: true },
            });
            scored.push({
                userId: currentUserId,
                username: user?.username || 'You',
                profilePhoto: user?.profile_photo || null,
                score: userScore,
                isCurrentUser: true,
            });
        }
    }

    // 4. Sort and assign ranks
    scored.sort((a, b) => b.score - a.score);

    let rank = 1;
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < scored.length; i++) {
        if (i > 0 && scored[i].score < scored[i - 1].score) rank = i + 1;
        leaderboard.push({ ...scored[i], rank });
        if (leaderboard.length >= limit) break;
    }

    return leaderboard;
}

export const ATTRIBUTE_SCORE_COLUMN: Record<string, keyof UserMetricsUpdatePayload> = {
    'Strength': 'strength_score',
    'Explosiveness': 'explosiveness_score',
    'Aerobic Endurance': 'aerobic_score',
    'Muscular Endurance': 'endurance_score',
    'Anaerobic Capacity': 'anaerobic_score',
};

type UserMetricsUpdatePayload = {
    strength_score: number | null;
    explosiveness_score: number | null;
    aerobic_score: number | null;
    endurance_score: number | null;
    anaerobic_score: number | null;
};


export async function computeAndSavePhysicalScoresRaw(
    userId: string,
    sportId: number = 1,
    // attribute id --> test value
    testValues: Record<number, number> = {}
): Promise<void> {

    // profile and age group lookup (unchanged)
    const profile = await prisma.user_sport_profiles.findFirst({
        where: { user_id: userId, sport_id: sportId, is_primary: true },
    });
    if (!profile) throw new Error('User sport profile not found');

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user?.date_of_birth) throw new Error('User date_of_birth missing');

    const ageGroupId = getAgeGroupId(new Date(user.date_of_birth));
    const cohort = {
        weight_class: profile.weight_class,
        level: profile.level,
        age_group_id: ageGroupId,
    };


    // Now compute each attribute using the latest test values across all snapshots
    // hardcoded
    const strength = await computeAttributeScore(testValues[1], userId, sportId, cohort);
    const explosiveness = await computeAttributeScore(testValues[2], userId, sportId, cohort);
    const aerobic = await computeAttributeScore(testValues[3], userId, sportId, cohort);
    const muscularEndurance = await computeAttributeScore(testValues[4], userId, sportId, cohort);
    const anaerobic = await computeAttributeScore(testValues[5], userId, sportId, cohort);

    const existingMetrics = await prisma.user_metrics.findUnique({
        where: { user_id: userId },
    });

    await prisma.user_metrics.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            height_cm: existingMetrics?.height_cm ?? 175,
            weight_kg: existingMetrics?.weight_kg ?? 75,
            goal: existingMetrics?.goal ?? 'Strength',
            training_days_per_week: existingMetrics?.training_days_per_week ?? 5,
            years_training: existingMetrics?.years_training ?? 3,
            has_injury_history: existingMetrics?.has_injury_history ?? false,
            strength_score: strength ?? 50,
            explosiveness_score: explosiveness ?? 50,
            aerobic_score: aerobic ?? 50,
            endurance_score: muscularEndurance ?? 50,
            anaerobic_score: anaerobic ?? 50,
            punch_power_score: existingMetrics?.punch_power_score ?? null,
            hand_speed_score: existingMetrics?.hand_speed_score ?? null,
            clinch_control_score: existingMetrics?.clinch_control_score ?? null,
            shooting_power_score: existingMetrics?.shooting_power_score ?? null,
            agility_score: existingMetrics?.agility_score ?? null,
            jump_height_score: existingMetrics?.jump_height_score ?? null,
            speed_score: existingMetrics?.speed_score ?? null,
        },
        update: {
            strength_score: strength ?? 50,
            explosiveness_score: explosiveness ?? 50,
            aerobic_score: aerobic ?? 50,
            endurance_score: muscularEndurance ?? 50,
            anaerobic_score: anaerobic ?? 50,
        },
    });

    return;
}

// Add to calculation.service.ts

export async function computeAndSaveScoresFromSnapshot(
    userId: string,
    sportId: number,
    testValues: Array<{ attribute_test_id: number; value: number }>,
): Promise<void> {

    // Build a lookup map once — O(1) access inside the loops below.
    const valueMap = new Map<number, number>(
        testValues.map(({ attribute_test_id, value }) => [attribute_test_id, value])
    );

    const [profile, user] = await Promise.all([
        prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, sport_id: sportId, is_primary: true },
        }),
        prisma.users.findUnique({
            where: { id: userId },
            select: { date_of_birth: true, sex: true },
        }),
    ]);

    if (!profile) throw new Error(`No primary sport profile for user=${userId} sport=${sportId}`);
    if (!user?.date_of_birth) throw new Error(`date_of_birth missing for user=${userId}`);

    const cohort = {
        weight_class: profile.weight_class,
        level: profile.level,
        age_group_id: getAgeGroupId(new Date(user.date_of_birth)),
    };
    const userSex = user.sex ?? 'male';

    const attributes = await prisma.sport_attributes.findMany({
        where: { sport_id: sportId },
        include: { attribute_tests: true },
    });

    const scores: Partial<UserMetricsUpdatePayload> = {};

    for (const attr of attributes) {
        const column = ATTRIBUTE_SCORE_COLUMN[attr.name];
        if (!column) {
            console.warn(`[computeScoresFromSnapshot] No column mapping for attribute "${attr.name}" — skipping`);
            continue;
        }

        let totalWeightedPercentile = 0;
        let totalWeight = 0;

        for (const test of attr.attribute_tests) {
            // Use the submitted value — no DB round-trip per test.
            const rawValue = valueMap.get(test.id);
            if (rawValue === undefined) continue; // not submitted, skip

            const norm = await prisma.normative_data.findFirst({
                where: {
                    sport_id: sportId,
                    attribute_test_id: test.id,
                    weight_class: cohort.weight_class as any,
                    level: cohort.level as any,
                    age_group_id: cohort.age_group_id,
                    sex: userSex,
                },
            });
            if (!norm) continue;

            const z = calculateZScore(rawValue, Number(norm.mean_value), Number(norm.std_dev), test.higher_is_better ?? true);
            totalWeightedPercentile += Number(test.weight) * calculatePercentile(z);
            totalWeight += Number(test.weight);
        }

        // Only record attributes where at least one test was submitted.
        if (totalWeight > 0) {
            scores[column] = Math.round(totalWeightedPercentile / totalWeight);
        }
    }

    // Nothing computed (e.g. all submitted test IDs belonged to a different sport) — bail early.
    if (Object.keys(scores).length === 0) return;

    await prisma.user_metrics.upsert({
        where: { user_id: userId },
        create: {
            user_id: userId,
            strength_score: scores.strength_score ?? 50,
            explosiveness_score: scores.explosiveness_score ?? 50,
            aerobic_score: scores.aerobic_score ?? 50,
            endurance_score: scores.endurance_score ?? 50,
            anaerobic_score: scores.anaerobic_score ?? 50,
            // Non-score fields: pull from existing row or fall back to safe defaults.
            ...(await getMetricsDefaults(userId)),
        },
        update: {
            // Spread only the columns we actually computed — Prisma ignores undefined,
            // so un-submitted attributes are left exactly as they were in the DB.
            ...scores,
        } as any,
    });
}

// Extracted to keep the upsert readable — fetches non-score fields for the create branch.
async function getMetricsDefaults(userId: string) {
    const existing = await prisma.user_metrics.findUnique({ where: { user_id: userId } });
    return {
        height_cm: existing?.height_cm ?? 175,
        weight_kg: existing?.weight_kg ?? 75,
        goal: existing?.goal ?? 'Strength',
        training_days_per_week: existing?.training_days_per_week ?? 5,
        years_training: existing?.years_training ?? 3,
        has_injury_history: existing?.has_injury_history ?? false,
    };
}
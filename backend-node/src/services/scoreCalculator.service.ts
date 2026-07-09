// services/scoreCalculation.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Normal CDF approximation (Abramowitz & Stegun)
 */
function normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
    const p =
        d *
        t *
        (0.31938153 +
            t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
}

/**
 * Determine age group id from date of birth.
 */
function getAgeGroupId(dateOfBirth: Date): number {
    const age = new Date().getFullYear() - new Date(dateOfBirth).getFullYear();
    if (age < 18) return 1;
    if (age <= 35) return 2;
    return 3;
}

interface Cohort {
    weight_class: string;
    level: string;
    age_group_id: number;
}

/**
 * Fetch the most recent value for a specific attribute_test_id,
 * across all snapshots of a user in a given sport.
 */
async function getLatestTestValue(
    userId: string,
    sportId: number,
    attributeTestId: number,
): Promise<{ value: number; unit: string } | null> {
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
            unit: true // ← Added this to fetch the unit from the DB
        },
    });

    // If a row is found, return an object; otherwise, return null
    return row
        ? { value: Number(row.value), unit: row.unit }
        : null;
}

/**
 * Compute a single attribute score using the latest test values.
 */
async function computeAttributeScore(
    attributeId: number,
    userId: string,
    sportId: number,
    cohort: { weight_class: string; level: string; age_group_id: number },
): Promise<number | null> {
    const tests = await prisma.attribute_tests.findMany({
        where: { sport_attribute_id: attributeId },
    });

    if (tests.length === 0) return null;

    let totalWeightedPercentile = 0;
    let totalWeight = 0;

    for (const test of tests) {
        const result = await getLatestTestValue(userId, sportId, test.id);

        if (result === null) continue;

        // 2. Safely extract only the value
        const valueOnly = result.value;

        const norm = await prisma.normative_data.findFirst({
            where: {
                sport_id: sportId,
                attribute_test_id: test.id,
                weight_class: cohort.weight_class as any,
                level: cohort.level as any,
                age_group_id: cohort.age_group_id,
            },
        });
        if (!norm) continue;

        const mean = Number(norm.mean_value);
        const stdDev = Number(norm.std_dev);
        const higherIsBetter = test.higher_is_better ?? true;

        const z = higherIsBetter
            ? (valueOnly - mean) / stdDev
            : (mean - valueOnly) / stdDev;

        const percentile = normalCDF(z) * 100;

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
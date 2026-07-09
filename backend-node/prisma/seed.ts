import {
    PrismaClient,
    Prisma,
    competitive_level,
    weight_class,
    user_goal_enum,
    program_goal,
    snapshot_type,
    enrollment_status,
    ComponentType,
    chat_role,
    user_role,
} from '@prisma/client';

const prisma = new PrismaClient();

// Helper: approximate normal CDF (percentile from z-score)
function normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
}

function zScore(val: number, mean: number, stdDev: number, higherIsBetter: boolean): number {
    return higherIsBetter ? (val - mean) / stdDev : (mean - val) / stdDev;
}

async function main() {
    console.log('🌱 Seeding Ringside database (updated schema)...');

    // ============================================================================
    // 1. AGE GROUPS
    // ============================================================================
    const ageGroups = await Promise.all([
        prisma.age_groups.create({ data: { id: 1, name: 'Under-18', min_age: 13, max_age: 17 } }),
        prisma.age_groups.create({ data: { id: 2, name: '18-35', min_age: 18, max_age: 35 } }),
        prisma.age_groups.create({ data: { id: 3, name: 'Over-35', min_age: 36, max_age: 99 } }),
    ]);
    console.log('✅ Age groups created');

    // ============================================================================
    // 2. SPORT
    // ============================================================================
    const boxing = await prisma.sports.create({
        data: {
            id: 1,
            name: 'Boxing',
            description: 'The Sweet Science — Olympic and professional boxing',
            icon: 'boxing_glove',
        },
    });
    console.log('✅ Boxing sport created');

    // ============================================================================
    // 3. SPORT ATTRIBUTES (physical only, as per current schema)
    // ============================================================================
    const attributes = await Promise.all([
        prisma.sport_attributes.create({ data: { id: 1, sport_id: 1, name: 'Strength', display_order: 1, description: 'Maximal force production capability' } }),
        prisma.sport_attributes.create({ data: { id: 2, sport_id: 1, name: 'Explosiveness', display_order: 2, description: 'Rate of force development and power output' } }),
        prisma.sport_attributes.create({ data: { id: 3, sport_id: 1, name: 'Aerobic Endurance', display_order: 3, description: 'Sustained oxygen-dependent energy production' } }),
        prisma.sport_attributes.create({ data: { id: 4, sport_id: 1, name: 'Muscular Endurance', display_order: 4, description: 'Repeated submaximal force production' } }),
        prisma.sport_attributes.create({ data: { id: 5, sport_id: 1, name: 'Anaerobic Capacity', display_order: 5, description: 'High-intensity work capacity and lactate tolerance' } }),
    ]);
    console.log('✅ Sport attributes created');

    // ============================================================================
    // 4. ATTRIBUTE TESTS (mapped to physical attributes)
    // ============================================================================
    const tests = await Promise.all([
        prisma.attribute_tests.create({ data: { id: 1, sport_attribute_id: 1, test_name: 'Trap Bar Deadlift', weight: 1.0, unit: 'kg', higher_is_better: true, description: 'Max single-rep deadlift' } }),
        prisma.attribute_tests.create({ data: { id: 2, sport_attribute_id: 2, test_name: 'Power Clean', weight: 0.5, unit: 'kg', higher_is_better: true, description: 'Max power clean' } }),
        prisma.attribute_tests.create({ data: { id: 3, sport_attribute_id: 2, test_name: 'Box Jump Height', weight: 0.5, unit: 'cm', higher_is_better: true, description: 'Max box jump height' } }),
        prisma.attribute_tests.create({ data: { id: 4, sport_attribute_id: 3, test_name: '1 Mile Run Time', weight: 1.0, unit: 'seconds', higher_is_better: false, description: 'Timed 1-mile run' } }),
        prisma.attribute_tests.create({ data: { id: 5, sport_attribute_id: 4, test_name: 'Burpee Max Reps (3 min)', weight: 1.0, unit: 'reps', higher_is_better: true, description: 'Burpees in 3 min' } }),
        prisma.attribute_tests.create({ data: { id: 6, sport_attribute_id: 5, test_name: 'Burpee Max Reps (3 min)', weight: 0.5, unit: 'reps', higher_is_better: true, description: 'Shared with Muscular Endurance' } }),
        prisma.attribute_tests.create({ data: { id: 7, sport_attribute_id: 5, test_name: 'Medicine Ball Rotational Throw', weight: 0.5, unit: 'meters', higher_is_better: true, description: 'Rotational power transfer' } }),
    ]);
    console.log('✅ Attribute tests created');

    // ============================================================================
    // 5. NORMATIVE DATA
    // ============================================================================
    const normData: Prisma.normative_dataUncheckedCreateInput[] = [
        // Amateur Middleweight 18-35
        { sport_id: 1, attribute_test_id: 1, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 120, std_dev: 18 },
        { sport_id: 1, attribute_test_id: 2, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 80, std_dev: 12 },
        { sport_id: 1, attribute_test_id: 3, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 55, std_dev: 8 },
        { sport_id: 1, attribute_test_id: 4, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 420, std_dev: 45 },
        { sport_id: 1, attribute_test_id: 5, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 55, std_dev: 10 },
        { sport_id: 1, attribute_test_id: 6, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 55, std_dev: 10 },
        { sport_id: 1, attribute_test_id: 7, weight_class: 'middleweight', level: 'amateur', age_group_id: 2, mean_value: 8.0, std_dev: 1.2 },
        // Amateur Heavyweight 18-35
        { sport_id: 1, attribute_test_id: 1, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 160, std_dev: 20 },
        { sport_id: 1, attribute_test_id: 2, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 100, std_dev: 15 },
        { sport_id: 1, attribute_test_id: 3, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 45, std_dev: 6 },
        { sport_id: 1, attribute_test_id: 4, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 480, std_dev: 50 },
        { sport_id: 1, attribute_test_id: 5, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 45, std_dev: 9 },
        { sport_id: 1, attribute_test_id: 6, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 45, std_dev: 9 },
        { sport_id: 1, attribute_test_id: 7, weight_class: 'heavyweight', level: 'amateur', age_group_id: 2, mean_value: 10.0, std_dev: 1.5 },
        // Pro Middleweight 18-35
        { sport_id: 1, attribute_test_id: 1, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 160, std_dev: 15 },
        { sport_id: 1, attribute_test_id: 2, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 110, std_dev: 12 },
        { sport_id: 1, attribute_test_id: 3, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 65, std_dev: 7 },
        { sport_id: 1, attribute_test_id: 4, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 360, std_dev: 30 },
        { sport_id: 1, attribute_test_id: 5, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 70, std_dev: 8 },
        { sport_id: 1, attribute_test_id: 6, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 70, std_dev: 8 },
        { sport_id: 1, attribute_test_id: 7, weight_class: 'middleweight', level: 'professional', age_group_id: 2, mean_value: 10.5, std_dev: 1.0 },
        // Under-18 Novice Lightweight
        { sport_id: 1, attribute_test_id: 1, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 70, std_dev: 15 },
        { sport_id: 1, attribute_test_id: 2, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 50, std_dev: 10 },
        { sport_id: 1, attribute_test_id: 3, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 40, std_dev: 7 },
        { sport_id: 1, attribute_test_id: 4, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 480, std_dev: 50 },
        { sport_id: 1, attribute_test_id: 5, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 40, std_dev: 10 },
        { sport_id: 1, attribute_test_id: 6, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 40, std_dev: 10 },
        { sport_id: 1, attribute_test_id: 7, weight_class: 'lightweight', level: 'novice', age_group_id: 1, mean_value: 5.0, std_dev: 1.0 },
    ];
    for (const n of normData) {
        await prisma.normative_data.create({ data: n });
    }
    console.log('✅ Normative data seeded');

    // ============================================================================
    // 6. USERS (Athletes + Coaches)
    // ============================================================================
    const users = await Promise.all([
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000001', username: 'alex_the_amateur', sex: 'male', email: 'alex@example.com', password_hash: '$2b$10$dummy', role: 'athlete', date_of_birth: new Date('2001-05-15'), role_models: ['Mike Tyson', 'Vasyl Lomachenko'] } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000002', username: 'jamal_junior', sex: 'male', email: 'jamal@example.com', password_hash: '$2b$10$dummy', role: 'athlete', date_of_birth: new Date('2009-02-20'), role_models: ['Gervonta Davis'] } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000003', username: 'heavy_hitter', sex: 'male', email: 'heavy@example.com', password_hash: '$2b$10$dummy', role: 'athlete', date_of_birth: new Date('1998-11-01'), role_models: ['George Foreman'] } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000004', username: 'endurance_queen', sex: 'female', email: 'endurance@example.com', password_hash: '$2b$10$dummy', role: 'athlete', date_of_birth: new Date('2000-08-10'), role_models: ['Laila Ali'] } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000005', username: 'prospect_p', sex: 'male', email: 'prospect@example.com', password_hash: '$2b$10$dummy', role: 'athlete', date_of_birth: new Date('1996-03-25'), role_models: ['Canelo Alvarez'] } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000006', username: 'coach_dana', sex: 'female', email: 'dana@example.com', password_hash: '$2b$10$dummy', role: 'coach', date_of_birth: new Date('1980-07-15') } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000007', username: 'coach_g', sex: 'male', email: 'coachg@example.com', password_hash: '$2b$10$dummy', role: 'coach', date_of_birth: new Date('1985-01-20') } }),
        prisma.users.create({ data: { id: 'a1000000-0000-0000-0000-000000000008', username: 'sarah_flyweight', sex: 'female', email: 'sarah@example.com', password_hash: '$2b$10$dummy', role: 'athlete', date_of_birth: new Date('2002-06-30'), role_models: ['Nicola Adams'] } }),
    ]);
    console.log('✅ Users created');

    // ============================================================================
    // 7. USER SPORT PROFILES
    // ============================================================================
    const profiles = await Promise.all([
        prisma.user_sport_profiles.create({ data: { id: 'b1000000-0000-0000-0000-000000000001', user_id: users[0].id, sport_id: 1, level: 'amateur', weight_class: 'middleweight', is_primary: true } }), // Alex
        prisma.user_sport_profiles.create({ data: { id: 'b1000000-0000-0000-0000-000000000002', user_id: users[1].id, sport_id: 1, level: 'novice', weight_class: 'lightweight', is_primary: true } }),    // Jamal
        prisma.user_sport_profiles.create({ data: { id: 'b1000000-0000-0000-0000-000000000003', user_id: users[2].id, sport_id: 1, level: 'amateur', weight_class: 'heavyweight', is_primary: true } }),   // Heavy
        prisma.user_sport_profiles.create({ data: { id: 'b1000000-0000-0000-0000-000000000004', user_id: users[3].id, sport_id: 1, level: 'amateur', weight_class: 'middleweight', is_primary: true } }),  // Endurance Queen
        prisma.user_sport_profiles.create({ data: { id: 'b1000000-0000-0000-0000-000000000005', user_id: users[4].id, sport_id: 1, level: 'professional', weight_class: 'middleweight', is_primary: true } }), // Prospect
        prisma.user_sport_profiles.create({ data: { id: 'b1000000-0000-0000-0000-000000000006', user_id: users[7].id, sport_id: 1, level: 'amateur', weight_class: 'flyweight', is_primary: true } }),     // Sarah
    ]);
    console.log('✅ User sport profiles linked');

    // ============================================================================
    // Helper: create snapshot with test values
    // ============================================================================
    async function createSnapshot(
        userId: string,
        sportId: number,
        type: snapshot_type,
        testValues: { testId: number; value: number }[],
        enrollmentId?: string,
    ) {
        const snapshot = await prisma.physical_snapshots.create({
            data: {
                user_id: userId,
                sport_id: sportId,
                snapshot_type: type as any,
                program_enrollment_id: enrollmentId ?? null,
                created_at: new Date(),
            },
        });
        for (const tv of testValues) {
            const test = await prisma.attribute_tests.findUnique({ where: { id: tv.testId } });
            await prisma.snapshot_test_values.create({
                data: {
                    snapshot_id: snapshot.id,
                    attribute_test_id: tv.testId,
                    value: tv.value,
                    unit: test!.unit,
                },
            });
        }
        return snapshot;
    }

    // ============================================================================
    // 8. SNAPSHOTS FOR EACH ATHLETE
    // ============================================================================
    // Alex (amateur middleweight)
    const alexSnapshot = await createSnapshot(users[0].id, 1, snapshot_type.manual_update, [
        { testId: 1, value: 148 }, { testId: 2, value: 88 }, { testId: 3, value: 60 },
        { testId: 4, value: 370 }, { testId: 5, value: 65 }, { testId: 7, value: 9.0 },
    ]);
    // Jamal (novice lightweight under-18)
    const jamalSnapshot = await createSnapshot(users[1].id, 1, snapshot_type.initial_onboarding, [
        { testId: 1, value: 80 }, { testId: 2, value: 55 }, { testId: 3, value: 45 },
        { testId: 4, value: 460 }, { testId: 5, value: 45 }, { testId: 7, value: 5.5 },
    ]);
    // Heavy Hitter (amateur heavyweight)
    const heavySnapshot = await createSnapshot(users[2].id, 1, snapshot_type.initial_onboarding, [
        { testId: 1, value: 200 }, { testId: 2, value: 110 }, { testId: 3, value: 50 },
        { testId: 4, value: 500 }, { testId: 5, value: 40 }, { testId: 7, value: 11.0 },
    ]);
    // Endurance Queen (amateur middleweight)
    const enduranceSnapshot = await createSnapshot(users[3].id, 1, snapshot_type.initial_onboarding, [
        { testId: 1, value: 110 }, { testId: 2, value: 70 }, { testId: 3, value: 52 },
        { testId: 4, value: 340 }, { testId: 5, value: 72 }, { testId: 7, value: 7.5 },
    ]);
    // Prospect Pro (pro middleweight)
    const prospectSnapshot = await createSnapshot(users[4].id, 1, snapshot_type.initial_onboarding, [
        { testId: 1, value: 170 }, { testId: 2, value: 115 }, { testId: 3, value: 68 },
        { testId: 4, value: 350 }, { testId: 5, value: 75 }, { testId: 7, value: 10.8 },
    ]);
    // Sarah flyweight (need flyweight normative)
    await Promise.all([
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 1, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 80, std_dev: 12 } }),
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 2, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 55, std_dev: 10 } }),
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 3, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 40, std_dev: 6 } }),
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 4, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 420, std_dev: 40 } }),
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 5, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 50, std_dev: 10 } }),
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 6, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 50, std_dev: 10 } }),
        prisma.normative_data.create({ data: { sport_id: 1, attribute_test_id: 7, weight_class: 'flyweight', level: 'amateur', age_group_id: 2, mean_value: 6.0, std_dev: 1.0 } }),
    ]);
    const sarahSnapshot = await createSnapshot(users[7].id, 1, snapshot_type.initial_onboarding, [
        { testId: 1, value: 90 }, { testId: 2, value: 60 }, { testId: 3, value: 48 },
        { testId: 4, value: 380 }, { testId: 5, value: 58 }, { testId: 7, value: 6.2 },
    ]);
    console.log('✅ Snapshots created');

    // ============================================================================
    // 9. COMPUTE PHYSICAL ATTRIBUTE SCORES & FILL user_metrics
    // ============================================================================
    async function computeAttributeScore(
        attributeId: number,
        userId: string,
        sportProfile: { level: string; weight_class: string; age_group_id: number },
        latestSnapshotId: string,
    ) {
        const testsForAttr = await prisma.attribute_tests.findMany({
            where: { sport_attribute_id: attributeId },
        });
        if (testsForAttr.length === 0) return null;

        let totalWeightedPercentile = 0;
        let totalWeight = 0;

        for (const test of testsForAttr) {
            const stv = await prisma.snapshot_test_values.findFirst({
                where: { snapshot_id: latestSnapshotId, attribute_test_id: test.id },
            });
            if (!stv) continue;

            const norm = await prisma.normative_data.findFirst({
                where: {
                    attribute_test_id: test.id,
                    weight_class: sportProfile.weight_class as any,
                    level: sportProfile.level as any,
                    age_group_id: sportProfile.age_group_id,
                    sport_id: 1,
                },
            });
            if (!norm) continue;

            const z = zScore(Number(stv.value), Number(norm.mean_value), Number(norm.std_dev), test.higher_is_better ?? true);
            const percentile = normalCDF(z) * 100;

            totalWeightedPercentile += Number(test.weight) * percentile;
            totalWeight += Number(test.weight);
        }

        if (totalWeight === 0) return null;
        return Math.round(totalWeightedPercentile / totalWeight);
    }

    async function getAgeGroup(dateOfBirth: Date): Promise<number> {
        const age = new Date().getFullYear() - dateOfBirth.getFullYear();
        if (age < 18) return 1;
        if (age <= 35) return 2;
        return 3;
    }

    async function createMetricsForAthlete(
        user: typeof users[0],
        profile: {
            level: competitive_level;
            weight_class: weight_class;
            profileId: string;
        },
        snapshotId: string,
        goal: user_goal_enum, // user_goal_enum value
        goalScores: Pick<
            Prisma.user_metricsCreateInput,
            | "punch_power_score"
            | "hand_speed_score"
            | "clinch_control_score"
            | "shooting_power_score"
            | "agility_score"
            | "jump_height_score"
            | "speed_score"
        >
    ) {
        const ageGroupId = await getAgeGroup(user.date_of_birth!);
        const strength = await computeAttributeScore(1, user.id, { ...profile, age_group_id: ageGroupId }, snapshotId);
        const explosiveness = await computeAttributeScore(2, user.id, { ...profile, age_group_id: ageGroupId }, snapshotId);
        const aerobic = await computeAttributeScore(3, user.id, { ...profile, age_group_id: ageGroupId }, snapshotId);
        const muscularEnd = await computeAttributeScore(4, user.id, { ...profile, age_group_id: ageGroupId }, snapshotId);
        const anaerobic = await computeAttributeScore(5, user.id, { ...profile, age_group_id: ageGroupId }, snapshotId);

        await prisma.user_metrics.create({
            data: {
                user_id: user.id,
                height_cm: 175,
                weight_kg: 75,
                goal: goal as any,
                training_days_per_week: 5,
                years_training: 3,
                has_injury_history: false,
                strength_score: strength ?? 50,
                explosiveness_score: explosiveness ?? 50,
                aerobic_score: aerobic ?? 50,
                endurance_score: muscularEnd ?? 50,
                anaerobic_score: anaerobic ?? 50,
                ...goalScores,
            },
        });

        // Seed sport_performance_clusters for this profile's goal
        await seedGoalClusters(profile.profileId, goal as string);
    }

    // Predefined component breakdowns for each goal (based on Punch Power model, etc.)
    async function seedGoalClusters(profileId: string, goal: string) {
        const clusters: { component_type: ComponentType; component_name: string; why_it_matters: string; recommended_exercise: string }[] = [];
        switch (goal) {
            case 'Punch_Power':
                clusters.push(
                    { component_type: ComponentType.Foundation, component_name: 'Leg Drive (Trap Bar Deadlift)', why_it_matters: 'Power starts from the ground. Stronger posterior chain anchors rotation.', recommended_exercise: 'Trap Bar Deadlift 3x5 @80% 1RM' },
                    { component_type: ComponentType.Accelerator, component_name: 'Rate of Force (Power Clean)', why_it_matters: 'How fast you can recruit strength. The snap in your punch.', recommended_exercise: 'Power Clean 4x3 @75% 1RM' },
                    { component_type: ComponentType.Transfer, component_name: 'Rotational Power (Med Ball Throw)', why_it_matters: 'Transferring force from legs to fist through the core.', recommended_exercise: 'Med Ball Rotational Throw 3x8 each side' },
                );
                break;
            case 'Aerobic_Endurance':
                clusters.push(
                    { component_type: ComponentType.Foundation, component_name: 'Aerobic Base (1 Mile Run)', why_it_matters: 'A strong aerobic engine sustains output over rounds.', recommended_exercise: '1 Mile Run at steady pace' },
                    { component_type: ComponentType.Accelerator, component_name: 'Interval Conditioning', why_it_matters: 'Improves recovery between high-intensity bursts.', recommended_exercise: '400m repeats x6' },
                    { component_type: ComponentType.Transfer, component_name: 'Sustained Punch Output', why_it_matters: 'Sport-specific stamina for volume punching.', recommended_exercise: '3-minute bag rounds at high pace' },
                );
                break;
            case 'Strength':
                clusters.push(
                    { component_type: ComponentType.Foundation, component_name: 'Max Force (Trap Bar Deadlift)', why_it_matters: 'Overall force production capability.', recommended_exercise: 'Deadlift 3x5' },
                    { component_type: ComponentType.Accelerator, component_name: 'Explosive Strength (Box Jumps)', why_it_matters: 'Converting strength into explosive power.', recommended_exercise: 'Box Jumps 4x6' },
                    { component_type: ComponentType.Transfer, component_name: 'Rotational Strength', why_it_matters: 'Applying force in boxing-specific motions.', recommended_exercise: 'Landmine Rotations 3x10' },
                );
                break;
        }
        for (const c of clusters) {
            await prisma.sport_performance_clusters.create({
                data: {
                    user_sport_profiles_id: profileId,
                    goal_cluster: goal as any,
                    component_type: c.component_type,
                    component_name: c.component_name,
                    why_it_matters: c.why_it_matters,
                    recommended_exercise: c.recommended_exercise,
                },
            });
        }
    }

    // Athlete 1: Alex – goal Punch_Power, self-assessed high power, decent speed
    await createMetricsForAthlete(users[0], { level: 'amateur', weight_class: 'middleweight', profileId: profiles[0].id }, alexSnapshot.id, 'Punch_Power', {
        punch_power_score: 85, hand_speed_score: 72, clinch_control_score: 68, shooting_power_score: 80, agility_score: 65, jump_height_score: 70, speed_score: 70,
    });

    // Athlete 2: Jamal – goal Agility (Speed), good speed/agility, lower power
    await createMetricsForAthlete(users[1], { level: 'novice', weight_class: 'lightweight', profileId: profiles[1].id }, jamalSnapshot.id, 'Agility', {
        punch_power_score: 60, hand_speed_score: 78, clinch_control_score: 55, shooting_power_score: 50, agility_score: 75, jump_height_score: 80, speed_score: 80,
    });

    // Athlete 3: Heavy – goal Strength (Punch_Power could be, but heavy relies on strength)
    await createMetricsForAthlete(users[2], { level: 'amateur', weight_class: 'heavyweight', profileId: profiles[2].id }, heavySnapshot.id, 'Strength', {
        punch_power_score: 95, hand_speed_score: 40, clinch_control_score: 85, shooting_power_score: 92, agility_score: 30, jump_height_score: 35, speed_score: 35,
    });

    // Athlete 4: Endurance Queen – goal Aerobic_Endurance
    await createMetricsForAthlete(users[3], { level: 'amateur', weight_class: 'middleweight', profileId: profiles[3].id }, enduranceSnapshot.id, 'Aerobic_Endurance', {
        punch_power_score: 62, hand_speed_score: 65, clinch_control_score: 70, shooting_power_score: 60, agility_score: 68, jump_height_score: 60, speed_score: 67,
    });

    // Athlete 5: Prospect Pro – goal Punch_Power
    await createMetricsForAthlete(users[4], { level: 'professional', weight_class: 'middleweight', profileId: profiles[4].id }, prospectSnapshot.id, 'Punch_Power', {
        punch_power_score: 92, hand_speed_score: 88, clinch_control_score: 90, shooting_power_score: 85, agility_score: 82, jump_height_score: 85, speed_score: 87,
    });

    // Athlete 6: Sarah – goal Speed (Hand_speed)
    await createMetricsForAthlete(users[7], { level: 'amateur', weight_class: 'flyweight', profileId: profiles[5].id }, sarahSnapshot.id, 'Hand_speed', {
        punch_power_score: 58, hand_speed_score: 90, clinch_control_score: 50, shooting_power_score: 55, agility_score: 95, jump_height_score: 88, speed_score: 92,
    });

    console.log('✅ User metrics and performance clusters seeded');

    // ============================================================================
    // 10. PROGRAMS & ENROLLMENTS (using updated program_goal enum)
    // ============================================================================
    const program1 = await prisma.programs.create({
        data: {
            id: 'a1000000-0000-0000-0000-000000000010',
            coach_id: users[5].id,
            sport_id: 1,
            title: 'Knockout Power 8-Week',
            description: 'Develop devastating punch power.',
            goal_primary: program_goal.Punch_Power,
            level_target: 'amateur',
            duration_weeks: 8,
            sessions_per_week: 3,
            is_published: true,
        },
    });
    const block1 = await prisma.program_blocks.create({ data: { program_id: program1.id, name: 'Accumulation', order_index: 1, week_start: 1, week_end: 4 } });
    const session1 = await prisma.program_sessions.create({ data: { block_id: block1.id, name: 'Lower Body Power', day_offset: 0, estimated_duration_minutes: 60 } });
    const ex1 = await prisma.session_exercises.create({ data: { session_id: session1.id, exercise_name: 'Trap Bar Deadlift', sets: 3, reps: '5', rest_seconds: 120, order_index: 1 } });
    const ex2 = await prisma.session_exercises.create({ data: { session_id: session1.id, exercise_name: 'Box Jumps', sets: 4, reps: '6', rest_seconds: 90, order_index: 2 } });

    const enrollment1 = await prisma.enrollments.create({
        data: {
            user_id: users[0].id,
            program_id: program1.id,
            start_date: new Date('2026-04-01'),
            preferred_days: ['Monday', 'Wednesday', 'Friday'],
            status: enrollment_status.completed,
            completed_date: new Date('2026-05-27'),
            baseline_snapshot_id: alexSnapshot.id,
            posttest_snapshot_id: alexSnapshot.id,
        },
    });
    const cs1 = await prisma.completed_sessions.create({
        data: {
            user_id: users[0].id,
            enrollment_id: enrollment1.id,
            program_session_id: session1.id,
            rpe: 7,
            duration_minutes: 55,
            created_at: new Date('2026-04-03'),
        },
    });
    await prisma.completed_exercises.create({
        data: {
            completed_session_id: cs1.id,
            session_exercise_id: ex1.id,
            sets_data: [{ set: 1, reps: 5, weight: 120 }, { set: 2, reps: 5, weight: 120 }, { set: 3, reps: 5, weight: 120 }],
        },
    });
    await prisma.completed_exercises.create({
        data: {
            completed_session_id: cs1.id,
            session_exercise_id: ex2.id,
            sets_data: [{ set: 1, reps: 6, height: 55 }, { set: 2, reps: 6, height: 55 }],
        },
    });

    const enrollment2 = await prisma.enrollments.create({
        data: {
            user_id: users[2].id,
            program_id: program1.id,
            start_date: new Date('2026-04-15'),
            preferred_days: ['Tuesday', 'Thursday', 'Saturday'],
            status: enrollment_status.completed,
            completed_date: new Date('2026-06-10'),
            baseline_snapshot_id: heavySnapshot.id,
            posttest_snapshot_id: heavySnapshot.id,
        },
    });
    const cs2 = await prisma.completed_sessions.create({
        data: {
            user_id: users[2].id,
            enrollment_id: enrollment2.id,
            program_session_id: session1.id,
            rpe: 8,
            duration_minutes: 60,
            created_at: new Date('2026-04-17'),
        },
    });
    await prisma.completed_exercises.create({
        data: {
            completed_session_id: cs2.id,
            session_exercise_id: ex1.id,
            sets_data: [{ set: 1, reps: 5, weight: 160 }, { set: 2, reps: 5, weight: 160 }, { set: 3, reps: 5, weight: 160 }],
        },
    });

    const program2 = await prisma.programs.create({
        data: {
            id: 'a1000000-0000-0000-0000-000000000011',
            coach_id: users[6].id,
            sport_id: 1,
            title: 'Fight Shape 6-Week',
            description: 'Boost aerobic and muscular endurance.',
            goal_primary: 'Aerobic_Endurance',
            level_target: 'amateur',
            duration_weeks: 6,
            sessions_per_week: 3,
            is_published: true,
        },
    });
    const block2 = await prisma.program_blocks.create({ data: { program_id: program2.id, name: 'Endurance Base', order_index: 1, week_start: 1, week_end: 6 } });
    const session2 = await prisma.program_sessions.create({ data: { block_id: block2.id, name: 'Interval Conditioning', day_offset: 0, estimated_duration_minutes: 45 } });
    const ex3 = await prisma.session_exercises.create({ data: { session_id: session2.id, exercise_name: 'Burpee Intervals', sets: 3, reps: 'Max in 3 min', rest_seconds: 180, order_index: 1 } });

    const enrollment3 = await prisma.enrollments.create({
        data: {
            user_id: users[3].id,
            program_id: program2.id,
            start_date: new Date('2026-04-20'),
            preferred_days: ['Monday', 'Wednesday', 'Friday'],
            status: enrollment_status.completed,
            completed_date: new Date('2026-06-01'),
            baseline_snapshot_id: enduranceSnapshot.id,
            posttest_snapshot_id: enduranceSnapshot.id,
        },
    });
    const cs3 = await prisma.completed_sessions.create({
        data: {
            user_id: users[3].id,
            enrollment_id: enrollment3.id,
            program_session_id: session2.id,
            rpe: 6,
            duration_minutes: 40,
            created_at: new Date('2026-04-22'),
        },
    });
    await prisma.completed_exercises.create({
        data: {
            completed_session_id: cs3.id,
            session_exercise_id: ex3.id,
            sets_data: [{ set: 1, reps: 60, burpees: 60 }, { set: 2, reps: 58, burpees: 58 }],
        },
    });
    console.log('✅ Programs, enrollments, sessions seeded');

    // ============================================================================
    // 11. SOCIAL
    // ============================================================================
    await prisma.follows.create({ data: { follower_id: users[0].id, followee_id: users[5].id } });
    await prisma.follows.create({ data: { follower_id: users[0].id, followee_id: users[2].id } });
    await prisma.posts.create({ data: { user_id: users[0].id, content: 'Just finished a great power session!', is_system_generated: false } });
    await prisma.posts.create({ data: { user_id: users[5].id, content: 'New program available: Knockout Power!', is_system_generated: false } });
    console.log('✅ Social data seeded');

    // ============================================================================
    // 12. KNOWLEDGE CHUNKS
    // ============================================================================
    const chunks = [
        'Punching power is generated from the ground up: leg drive, core rotation, arm delivery.',
        'Aerobic endurance is crucial for boxing. Roadwork and intervals improve VO2 max.',
        'The kinetic chain in boxing: foot plant → hip rotation → core torque → shoulder whip → fist impact.',
        'Rate of force development (explosiveness) determines punch acceleration. Power cleans and plyometrics target this.',
        'Muscular endurance allows repeated punching without velocity loss. High-rep bodyweight circuits build this.',
        'Anaerobic capacity lets you sustain flurries and recover between exchanges.',
        'Periodization for boxing: GPP → SPP → Competition/Taper. Adjust volume and intensity accordingly.',
        'Common injuries: hand fractures, shoulder impingement, low back strains.',
        'Clinch strength relies on isometric core and grip strength.',
        'Agility and footwork are key for defense. Ladder drills, reactive step exercises, and plyometrics enhance agility.',
    ];
    for (const text of chunks) {
        await prisma.knowledge_chunks.create({
            data: {
                content: text,
                sport: 'Boxing',
                topic: 'General',
            },
        });
    }
    console.log('✅ Knowledge chunks seeded');

    console.log('🌱 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
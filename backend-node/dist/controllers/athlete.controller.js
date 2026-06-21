"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyEnrollments = exports.getProgress = exports.getRadarData = exports.getSnapshots = exports.createSnapshot = exports.updateSportProfile = exports.createSportProfile = void 0;
const prisma_1 = require("../config/prisma");
const calculation_service_1 = require("../services/calculation.service");
// ==========================================
// Helper Functions for CR-14 & CR-15
// ==========================================
const getAgeGroupId = (dateOfBirth) => {
    const age = new Date().getFullYear() - dateOfBirth.getFullYear();
    if (age < 18)
        return 1; // Under 18
    if (age <= 35)
        return 2; // 18-35
    return 3; // 35+
};
// Modification 1: Use exact weight class names from DB and define as Enum
const getAdjacentWeightClasses = (weightClass) => {
    const classes = [
        'flyweight', 'bantamweight', 'featherweight', 'lightweight',
        'light_welterweight', 'welterweight', 'light_middleweight', 'middleweight',
        'super_middleweight', 'light_heavyweight', 'cruiserweight', 'heavyweight'
    ];
    const idx = classes.indexOf(weightClass);
    if (idx === -1)
        return [];
    const adjacent = [];
    if (idx > 0)
        adjacent.push(classes[idx - 1]);
    if (idx < classes.length - 1)
        adjacent.push(classes[idx + 1]);
    return adjacent;
};
/**
 * 5-level fallback cascade:
 */
// Modification 2: Replace string with competitive_level and weight_class
const getPercentileWithFallback = async (testId, rawValue, higherIsBetter, userLevel, userWeight, userAgeGroupId) => {
    // Modification 3: Force TypeScript to accept this structure as DB Filters
    const fallbackSteps = [
        { weight: userWeight, level: userLevel, ageGroup: userAgeGroupId },
        { weight: userWeight, level: userLevel, ageGroup: undefined },
        { weight: { in: getAdjacentWeightClasses(userWeight) }, level: userLevel, ageGroup: undefined },
        { weight: undefined, level: userLevel, ageGroup: undefined },
        { weight: undefined, level: undefined, ageGroup: undefined }
    ];
    for (let step = 0; step < fallbackSteps.length; step++) {
        const criteria = fallbackSteps[step];
        const norm = await prisma_1.prisma.normative_data.findFirst({
            where: {
                attribute_test_id: testId,
                ...(criteria.weight && { weight_class: criteria.weight }),
                ...(criteria.level && { level: criteria.level }),
                ...(criteria.ageGroup && { age_group_id: criteria.ageGroup })
            }
        });
        if (norm) {
            const z = (0, calculation_service_1.calculateZScore)(rawValue, Number(norm.mean_value), Number(norm.std_dev), higherIsBetter);
            const percentile = (0, calculation_service_1.calculatePercentile)(z);
            return { percentile, fallbackLevel: step };
        }
    }
    const fallbackPercentile = Math.min(99, Math.max(1, Math.floor(rawValue / 2)));
    return { percentile: fallbackPercentile, fallbackLevel: 4 };
};
const getTestName = async (testId) => {
    const test = await prisma_1.prisma.attribute_tests.findUnique({
        where: { id: testId },
        select: { test_name: true }
    });
    return test?.test_name || 'Unknown';
};
// ==========================================
// 3.1 & 3.2: Sport Profiles
// ==========================================
const createSportProfile = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { sport_id = 1, level, weight_class, is_primary = true } = req.body;
        if (!level || !weight_class) {
            res.status(400).json({ success: false, error: "Level and weight class are required." });
            return;
        }
        const existingProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, sport_id: Number(sport_id) }
        });
        if (existingProfile) {
            res.status(409).json({ success: false, error: "Sport profile already exists for this sport. Use PATCH to update." });
            return;
        }
        const newProfile = await prisma_1.prisma.user_sport_profiles.create({
            data: { user_id: userId, sport_id: Number(sport_id), level, weight_class, is_primary }
        });
        res.status(201).json({ success: true, message: "Sport profile created successfully!", data: newProfile });
    }
    catch (error) {
        console.error("Create Sport Profile Error:", error);
        res.status(500).json({ success: false, error: "Failed to create sport profile." });
    }
};
exports.createSportProfile = createSportProfile;
const updateSportProfile = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { level, weight_class } = req.body;
        const existingProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true }
        });
        if (!existingProfile) {
            res.status(404).json({ success: false, error: "Sport profile not found. Please create one first." });
            return;
        }
        const updatedProfile = await prisma_1.prisma.user_sport_profiles.update({
            where: { id: existingProfile.id },
            data: { ...(level && { level }), ...(weight_class && { weight_class }) }
        });
        res.status(200).json({ success: true, message: "Sport profile updated successfully!", data: updatedProfile });
    }
    catch (error) {
        console.error("Update Sport Profile Error:", error);
        res.status(500).json({ success: false, error: "Failed to update sport profile." });
    }
};
exports.updateSportProfile = updateSportProfile;
// ==========================================
// 3.3 & 3.4: Snapshots
// ==========================================
const createSnapshot = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const { sport_id = 1, snapshot_type = 'manual_update', program_enrollment_id, notes, test_values } = req.body;
        if (!test_values || !Array.isArray(test_values) || test_values.length === 0) {
            res.status(400).json({ success: false, error: "test_values array is required" });
            return;
        }
        if ((snapshot_type === 'program_baseline' || snapshot_type === 'program_posttest') && !program_enrollment_id) {
            res.status(400).json({ success: false, error: "program_enrollment_id is required for this snapshot type." });
            return;
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const snapshot = await tx.physical_snapshots.create({
                data: {
                    user_id: userId,
                    sport_id: Number(sport_id),
                    snapshot_type,
                    program_enrollment_id,
                    notes
                }
            });
            const testIds = test_values.map((t) => t.attribute_test_id);
            const testsInfo = await tx.attribute_tests.findMany({ where: { id: { in: testIds } } });
            const dataToInsert = test_values.map((test) => {
                const info = testsInfo.find(ti => ti.id === test.attribute_test_id);
                return {
                    snapshot_id: snapshot.id,
                    attribute_test_id: test.attribute_test_id,
                    value: test.value,
                    unit: info?.unit || 'unknown'
                };
            });
            await tx.snapshot_test_values.createMany({ data: dataToInsert });
            return snapshot;
        });
        res.status(201).json({ success: true, message: "Snapshot saved!", snapshot_id: result.id });
    }
    catch (error) {
        console.error("Create Snapshot Error:", error);
        res.status(500).json({ success: false, error: "Failed to save snapshot" });
    }
};
exports.createSnapshot = createSnapshot;
const getSnapshots = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Force TypeScript to accept Query type
        const type = req.query.type;
        const whereClause = { user_id: userId };
        if (type)
            whereClause.snapshot_type = type;
        // Separated to prevent TypeScript issues
        const totalCount = await prisma_1.prisma.physical_snapshots.count({ where: whereClause });
        const snapshots = await prisma_1.prisma.physical_snapshots.findMany({
            where: whereClause,
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
                snapshot_test_values: { include: { attribute_tests: { select: { test_name: true } } } }
            }
        });
        const formattedSnapshots = snapshots.map(snap => ({
            id: snap.id,
            snapshot_type: snap.snapshot_type,
            created_at: snap.created_at,
            notes: snap.notes,
            test_values: snap.snapshot_test_values.map(tv => ({
                attribute_test_id: tv.attribute_test_id,
                test_name: tv.attribute_tests?.test_name,
                value: tv.value,
                unit: tv.unit
            }))
        }));
        res.status(200).json({ success: true, data: formattedSnapshots, meta: { total: totalCount, limit, offset } });
    }
    catch (error) {
        console.error("Get Snapshots Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch snapshots." });
    }
};
exports.getSnapshots = getSnapshots;
// ==========================================
// 3.5: Unified Radar & Punch Power Data (CR-14 & CR-15 fixed)
// ==========================================
const getRadarData = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const cohortLevel = req.query.cohort_level;
        const cohortWeight = req.query.cohort_weight;
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: userId },
            select: {
                date_of_birth: true,
                user_sport_profiles: { where: { is_primary: true } }
            }
        });
        const profile = user?.user_sport_profiles[0];
        if (!profile) {
            res.status(404).json({ success: false, error: "Profile not found." });
            return;
        }
        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const targetLevel = cohortLevel || profile.level;
        const targetWeight = cohortWeight || profile.weight_class;
        const latestSnapshot = await prisma_1.prisma.physical_snapshots.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: {
                snapshot_test_values: {
                    include: {
                        attribute_tests: {
                            include: { sport_attributes: true } // Fixed typo here
                        }
                    }
                }
            }
        });
        if (!latestSnapshot) {
            res.status(404).json({ success: false, error: "No snapshot found." });
            return;
        }
        const attributeMap = new Map();
        for (const testVal of latestSnapshot.snapshot_test_values) {
            const attr = testVal.attribute_tests?.sport_attributes;
            if (!attr)
                continue;
            const attrId = attr.id;
            if (!attributeMap.has(attrId)) {
                attributeMap.set(attrId, { name: attr.name, tests: [], totalWeight: 0 });
            }
            const entry = attributeMap.get(attrId);
            // Modification: Read weight directly from the table
            const weight = Number(testVal.attribute_tests?.weight || 1);
            entry.tests.push({
                testId: testVal.attribute_test_id,
                rawValue: Number(testVal.value),
                higherIsBetter: testVal.attribute_tests?.higher_is_better ?? true,
                weight: weight,
                unit: testVal.unit
            });
            entry.totalWeight += weight;
        }
        const radar_axes = [];
        let foundationPct = 0, acceleratorPct = 0, transferPct = 0;
        for (const [attrId, attrData] of attributeMap.entries()) {
            let weightedPercentileSum = 0;
            let highestFallback = 0;
            for (const test of attrData.tests) {
                const { percentile, fallbackLevel } = await getPercentileWithFallback(test.testId, test.rawValue, test.higherIsBetter, targetLevel, targetWeight, ageGroupId);
                weightedPercentileSum += percentile * test.weight;
                if (fallbackLevel > highestFallback)
                    highestFallback = fallbackLevel;
                const testName = await getTestName(test.testId);
                if (testName === 'Trap Bar Deadlift')
                    foundationPct = percentile;
                if (testName === 'Power Clean' || testName === 'Box Jump Height')
                    acceleratorPct = percentile;
                if (testName === 'Medicine Ball Rotational Throw')
                    transferPct = percentile;
            }
            const finalPercentile = attrData.totalWeight > 0 ? weightedPercentileSum / attrData.totalWeight : 0;
            radar_axes.push({ attribute_name: attrData.name, percentile: Math.round(finalPercentile), fallback_level: highestFallback });
        }
        const punch_power = {
            score: (0, calculation_service_1.calculatePunchPower)(foundationPct, acceleratorPct, transferPct),
            foundation: { percentile: foundationPct },
            accelerator: { percentile: acceleratorPct },
            transfer: { percentile: transferPct }
        };
        res.status(200).json({
            success: true,
            data: {
                radar_axes, punch_power,
                cohort_used: { weight_class: targetWeight, level: targetLevel, age_group: ageGroupId === 2 ? '18-35' : (ageGroupId === 1 ? 'Under 18' : '35+') },
                snapshot_date: latestSnapshot.created_at
            }
        });
    }
    catch (error) {
        console.error("Get Radar Data Error:", error);
        res.status(500).json({ success: false, error: "Failed to generate radar data" });
    }
};
exports.getRadarData = getRadarData;
// ==========================================
// 3.6: Progress Tracking (CR-16 fixed)
// ==========================================
const getProgress = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const attributeTestId = parseInt(req.params.attributeTestId);
        if (isNaN(attributeTestId)) {
            res.status(400).json({ success: false, error: "Invalid test ID." });
            return;
        }
        const [testInfo, user, profile] = await Promise.all([
            prisma_1.prisma.attribute_tests.findUnique({ where: { id: attributeTestId } }),
            prisma_1.prisma.users.findUnique({ where: { id: userId }, select: { date_of_birth: true } }),
            prisma_1.prisma.user_sport_profiles.findFirst({ where: { user_id: userId, is_primary: true } })
        ]);
        if (!testInfo || !profile || !user) {
            res.status(404).json({ success: false, error: "Data not found." });
            return;
        }
        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const userLevel = profile.level;
        const userWeight = profile.weight_class;
        // Modification: Handled null by adding a default value
        const higherIsBetter = testInfo.higher_is_better ?? true;
        const history = await prisma_1.prisma.physical_snapshots.findMany({
            where: {
                user_id: userId,
                snapshot_test_values: { some: { attribute_test_id: attributeTestId } }
            },
            orderBy: { created_at: 'asc' },
            include: {
                snapshot_test_values: {
                    where: { attribute_test_id: attributeTestId },
                    take: 1
                }
            }
        });
        const data_points = await Promise.all(history.map(async (snap) => {
            const rawValue = Number(snap.snapshot_test_values[0]?.value || 0);
            const { percentile } = await getPercentileWithFallback(attributeTestId, rawValue, higherIsBetter, userLevel, userWeight, ageGroupId);
            return {
                date: snap.created_at,
                raw_value: rawValue,
                snapshot_type: snap.snapshot_type,
                percentile: Math.round(percentile)
            };
        }));
        res.status(200).json({
            success: true,
            data: { test_name: testInfo.test_name, unit: testInfo.unit, higher_is_better: higherIsBetter, data_points }
        });
    }
    catch (error) {
        console.error("Get Progress Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch progress." });
    }
};
exports.getProgress = getProgress;
// ==========================================
// 3.7: Enrollments
// ==========================================
const getMyEnrollments = async (req, res) => {
    try {
        const userId = req.user?.sub;
        const status = req.query.status;
        const whereClause = { user_id: userId };
        if (status)
            whereClause.status = status;
        const enrollments = await prisma_1.prisma.enrollments.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            include: {
                programs: {
                    select: {
                        title: true, goal_primary: true, duration_weeks: true, cover_image: true,
                        users: { select: { username: true } } // Coach Name
                    }
                }
            }
        });
        const formatted = enrollments.map(e => ({
            id: e.id,
            status: e.status,
            start_date: e.start_date,
            completed_date: e.completed_date,
            program: {
                title: e.programs.title,
                goal: e.programs.goal_primary,
                duration: e.programs.duration_weeks,
                cover: e.programs.cover_image,
                coach: e.programs.users.username
            }
        }));
        res.status(200).json({ success: true, data: formatted });
    }
    catch (error) {
        console.error("Get Enrollments Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch enrollments." });
    }
};
exports.getMyEnrollments = getMyEnrollments;

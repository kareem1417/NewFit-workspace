"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAthleteDashboard = exports.requireOnboarding = exports.getOnboardingStatus = exports.completeOnboarding = exports.getSportCategories = exports.getSportsList = exports.deleteSnapshot = exports.deleteUserMetrics = exports.deleteSportProfile = exports.getSportProfile = exports.getMyEnrollments = exports.getProgress = exports.getRadarData = exports.getLatestSnapshot = exports.getSnapshots = exports.createSnapshot = exports.getSportBaselineTests = exports.updateSportProfile = exports.getUserMetrics = exports.upsertUserMetrics = exports.createSportProfile = void 0;
const prisma_1 = require("../config/prisma");
const calculation_service_1 = require("../services/calculation.service");
const client_1 = require("@prisma/client");
const AppError_1 = require("../utils/AppError");
// 📌 استيراد الدوال من الـ Service الجديدة
const sportCategory_service_1 = require("../services/sportCategory.service");
// ==========================================
// Helper Functions
// ==========================================
const getAgeGroupId = (dateOfBirth) => {
    const age = new Date().getFullYear() - dateOfBirth.getFullYear();
    if (age < 18)
        return 1;
    if (age <= 35)
        return 2;
    return 3;
};
const getAdjacentCategories = (category) => {
    const weightClasses = [
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
    if (idx === -1)
        return [];
    const adjacent = [];
    if (idx > 0)
        adjacent.push(weightClasses[idx - 1]);
    if (idx < weightClasses.length - 1)
        adjacent.push(weightClasses[idx + 1]);
    return adjacent;
};
const getPercentileWithFallback = async (testId, rawValue, higherIsBetter, userLevel, userCategory, userAgeGroupId) => {
    const fallbackSteps = [
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
        const norm = await prisma_1.prisma.normative_data.findFirst({
            where: {
                attribute_test_id: testId,
                ...(criteria.category && { player_category: criteria.category }),
                ...(criteria.level && { level: criteria.level }),
                ...(criteria.ageGroup && { age_group_id: criteria.ageGroup }),
            },
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
        select: { test_name: true },
    });
    return test?.test_name || "Unknown";
};
// ==========================================
// Controllers
// ==========================================
const createSportProfile = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const { sport_id = 1, level, player_category, is_primary = true, } = req.body;
        const existingProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, sport_id: Number(sport_id) },
        });
        if (existingProfile) {
            return next(new AppError_1.AppError("Conflict — sport profile already exists. Use PATCH to update.", 409));
        }
        const sportExists = await prisma_1.prisma.sports.findUnique({
            where: { id: Number(sport_id) },
        });
        if (!sportExists) {
            return next(new AppError_1.AppError("Sport not found. Please provide a valid sport_id.", 404));
        }
        // 📌 ضفنا Validation إن الـ category مناسبة للرياضة
        const validCategories = (0, sportCategory_service_1.getCategoriesBySportId)(Number(sport_id));
        if (!validCategories.includes(player_category)) {
            return next(new AppError_1.AppError(`Invalid player category (${player_category}) for sport ID ${sport_id}.`, 400));
        }
        const newProfile = await prisma_1.prisma.user_sport_profiles.create({
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
    }
    catch (error) {
        console.error("Create Sport Profile Error:", error);
        return next(new AppError_1.AppError("Failed to create sport profile.", 500));
    }
};
exports.createSportProfile = createSportProfile;
const upsertUserMetrics = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        // 📌 شيلنا كل الـ Scores من هنا
        const { height_cm, weight_kg, goal, training_days_per_week, years_training, has_injury_history, } = req.body;
        if (!height_cm ||
            !weight_kg ||
            !goal ||
            training_days_per_week === undefined ||
            years_training === undefined) {
            return next(new AppError_1.AppError("Missing required fields: height_cm, weight_kg, goal, training_days_per_week, and years_training are required.", 400));
        }
        const validGoals = Object.keys(client_1.user_goal_enum);
        if (!validGoals.includes(goal)) {
            return next(new AppError_1.AppError(`Invalid goal. Allowed values are: ${validGoals.join(", ")}`, 400));
        }
        // 📌 خلينا الـ Object نضيف وبياخد الحاجات الأساسية بس
        const metricsData = {
            height_cm: Number(height_cm),
            weight_kg: Number(weight_kg),
            goal: goal,
            training_days_per_week: Number(training_days_per_week),
            years_training: Number(years_training),
            has_injury_history: has_injury_history ?? false,
        };
        const metrics = await prisma_1.prisma.user_metrics.upsert({
            where: { user_id: userId },
            update: metricsData,
            create: { user_id: userId, ...metricsData },
        });
        res.status(200).json({
            success: true,
            message: "User metrics saved successfully!",
            data: metrics,
        });
    }
    catch (error) {
        console.error("Upsert User Metrics Error:", error);
        return next(new AppError_1.AppError("Failed to save user metrics.", 500));
    }
};
exports.upsertUserMetrics = upsertUserMetrics;
const getUserMetrics = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const metrics = await prisma_1.prisma.user_metrics.findUnique({
            where: { user_id: userId },
        });
        if (!metrics) {
            return next(new AppError_1.AppError("User metrics not found. Please complete onboarding.", 404));
        }
        res.status(200).json({ success: true, data: metrics });
    }
    catch (error) {
        console.error("Get User Metrics Error:", error);
        return next(new AppError_1.AppError("Failed to fetch user metrics.", 500));
    }
};
exports.getUserMetrics = getUserMetrics;
const updateSportProfile = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const { level, player_category } = req.body;
        const existingProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true },
            include: { sports: true }, // بنجيب الرياضة عشان الـ validation
        });
        if (!existingProfile) {
            return next(new AppError_1.AppError("Sport profile not found. Please create one first.", 404));
        }
        // 📌 ضفنا Validation إن الـ category مناسبة للرياضة في الـ Update كمان
        if (player_category) {
            const validCategories = (0, sportCategory_service_1.getCategoriesBySportId)(existingProfile.sport_id);
            if (!validCategories.includes(player_category)) {
                return next(new AppError_1.AppError(`Invalid player category (${player_category}) for sport ID ${existingProfile.sport_id}.`, 400));
            }
        }
        const updatedProfile = await prisma_1.prisma.user_sport_profiles.update({
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
    }
    catch (error) {
        console.error("Update Sport Profile Error:", error);
        return next(new AppError_1.AppError("Failed to update sport profile.", 500));
    }
};
exports.updateSportProfile = updateSportProfile;
const getSportBaselineTests = async (req, res, next) => {
    try {
        const { sport_id } = req.params;
        const attributes = await prisma_1.prisma.sport_attributes.findMany({
            where: { sport_id: Number(sport_id) },
            include: {
                attribute_tests: true,
            },
            orderBy: { display_order: "asc" },
        });
        res.status(200).json({ success: true, data: attributes });
    }
    catch (error) {
        return next(new AppError_1.AppError("Failed to fetch baseline tests.", 500));
    }
};
exports.getSportBaselineTests = getSportBaselineTests;
const createSnapshot = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const { sport_id = 1, snapshot_type = "manual_update", program_enrollment_id, notes, test_values, } = req.body;
        const sportExists = await prisma_1.prisma.sports.findUnique({
            where: { id: Number(sport_id) },
        });
        if (!sportExists) {
            return next(new AppError_1.AppError("Sport not found. Please provide a valid sport_id.", 404));
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const snapshot = await tx.physical_snapshots.create({
                data: {
                    user_id: userId,
                    sport_id: Number(sport_id),
                    snapshot_type,
                    program_enrollment_id,
                    notes,
                },
            });
            const testIds = test_values.map((t) => t.attribute_test_id);
            const testsInfo = await tx.attribute_tests.findMany({
                where: { id: { in: testIds } },
            });
            const dataToInsert = test_values.map((test) => {
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
                }
                else if (snapshot_type === "program_posttest") {
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
    }
    catch (error) {
        console.error("Create Snapshot Error:", error);
        if (error.code) {
            return next(error);
        }
        return next(new AppError_1.AppError("Failed to save snapshot", 500));
    }
};
exports.createSnapshot = createSnapshot;
const getSnapshots = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type;
        const whereClause = { user_id: userId };
        if (type)
            whereClause.snapshot_type = type;
        const totalCount = await prisma_1.prisma.physical_snapshots.count({
            where: whereClause,
        });
        const snapshots = await prisma_1.prisma.physical_snapshots.findMany({
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
    }
    catch (error) {
        console.error("Get Snapshots Error:", error);
        return next(new AppError_1.AppError("Failed to fetch snapshots.", 500));
    }
};
exports.getSnapshots = getSnapshots;
const getLatestSnapshot = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const latestSnapshot = await prisma_1.prisma.physical_snapshots.findFirst({
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
            return next(new AppError_1.AppError("No snapshots found for this user.", 404));
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
    }
    catch (error) {
        console.error("Get Latest Snapshot Error:", error);
        return next(new AppError_1.AppError("Failed to fetch the latest snapshot.", 500));
    }
};
exports.getLatestSnapshot = getLatestSnapshot;
const getRadarData = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const cohortLevel = req.query.level;
        const cohortCategory = req.query.player_category;
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: userId },
            select: {
                date_of_birth: true,
                user_sport_profiles: { where: { is_primary: true } },
            },
        });
        const profile = user?.user_sport_profiles[0];
        if (!profile) {
            return next(new AppError_1.AppError("Profile not found.", 404));
        }
        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const targetLevel = cohortLevel || profile.level;
        const targetCategory = cohortCategory || profile.player_category;
        const latestSnapshot = await prisma_1.prisma.physical_snapshots.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            include: {
                snapshot_test_values: {
                    include: { attribute_tests: { include: { sport_attributes: true } } },
                },
            },
        });
        if (!latestSnapshot) {
            return next(new AppError_1.AppError("No snapshot data found.", 404));
        }
        const attributeMap = new Map();
        for (const testVal of latestSnapshot.snapshot_test_values) {
            const attr = testVal.attribute_tests?.sport_attributes;
            if (!attr)
                continue;
            const attrId = attr.id;
            if (!attributeMap.has(attrId))
                attributeMap.set(attrId, {
                    name: attr.name,
                    tests: [],
                    totalWeight: 0,
                });
            const entry = attributeMap.get(attrId);
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
        const radar_axes = [];
        let foundationPct = 0, acceleratorPct = 0, transferPct = 0;
        for (const [attrId, attrData] of attributeMap.entries()) {
            let weightedPercentileSum = 0;
            let highestFallback = 0;
            for (const test of attrData.tests) {
                const { percentile, fallbackLevel } = await getPercentileWithFallback(test.testId, test.rawValue, test.higherIsBetter, targetLevel, targetCategory, ageGroupId);
                weightedPercentileSum += percentile * test.weight;
                if (fallbackLevel > highestFallback)
                    highestFallback = fallbackLevel;
                const testName = await getTestName(test.testId);
                if (testName === "Trap Bar Deadlift")
                    foundationPct = percentile;
                if (testName === "Power Clean" || testName === "Box Jump Height")
                    acceleratorPct = percentile;
                if (testName === "Medicine Ball Rotational Throw")
                    transferPct = percentile;
            }
            const finalPercentile = attrData.totalWeight > 0
                ? weightedPercentileSum / attrData.totalWeight
                : 0;
            radar_axes.push({
                attribute_name: attrData.name,
                percentile: Math.round(finalPercentile),
                fallback_level: highestFallback,
            });
        }
        const punch_power = {
            score: (0, calculation_service_1.calculatePunchPower)(foundationPct, acceleratorPct, transferPct),
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
                    age_group: ageGroupId === 2 ? "18-35" : ageGroupId === 1 ? "Under 18" : "35+",
                },
                snapshot_date: latestSnapshot.created_at,
            },
        });
    }
    catch (error) {
        console.error("Get Radar Data Error:", error);
        return next(new AppError_1.AppError("Failed to generate radar data", 500));
    }
};
exports.getRadarData = getRadarData;
const getProgress = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const attributeTestId = parseInt(req.query.attribute_test_id);
        if (isNaN(attributeTestId)) {
            return next(new AppError_1.AppError("Invalid test ID.", 400));
        }
        const [testInfo, user, profile] = await Promise.all([
            prisma_1.prisma.attribute_tests.findUnique({ where: { id: attributeTestId } }),
            prisma_1.prisma.users.findUnique({
                where: { id: userId },
                select: { date_of_birth: true },
            }),
            prisma_1.prisma.user_sport_profiles.findFirst({
                where: { user_id: userId, is_primary: true },
            }),
        ]);
        if (!testInfo || !profile || !user) {
            return next(new AppError_1.AppError("Data not found.", 404));
        }
        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const userLevel = profile.level;
        const userCategory = profile.player_category;
        const higherIsBetter = testInfo.higher_is_better ?? true;
        const history = await prisma_1.prisma.physical_snapshots.findMany({
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
        const data_points = await Promise.all(history.map(async (snap) => {
            const rawValue = Number(snap.snapshot_test_values[0]?.value || 0);
            const { percentile } = await getPercentileWithFallback(attributeTestId, rawValue, higherIsBetter, userLevel, userCategory, ageGroupId);
            return {
                date: snap.created_at,
                raw_value: rawValue,
                snapshot_type: snap.snapshot_type,
                percentile: Math.round(percentile),
            };
        }));
        res.status(200).json({
            success: true,
            data: {
                test_name: testInfo.test_name,
                unit: testInfo.unit,
                higher_is_better: higherIsBetter,
                data_points,
            },
        });
    }
    catch (error) {
        console.error("Get Progress Error:", error);
        return next(new AppError_1.AppError("Failed to fetch progress.", 500));
    }
};
exports.getProgress = getProgress;
const getMyEnrollments = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const status = req.query.status;
        const whereClause = { user_id: userId };
        if (status)
            whereClause.status = status;
        const enrollments = await prisma_1.prisma.enrollments.findMany({
            where: whereClause,
            orderBy: { created_at: "desc" },
            include: {
                programs: {
                    select: {
                        id: true,
                        title: true,
                        goal_primary: true,
                        duration_weeks: true,
                        cover_image: true,
                        users: { select: { username: true } },
                    },
                },
                // 🎯 جلب الـ Baseline Snapshot مع الـ Test Values والأسماء عشان الـ Final Assessment
                physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots: {
                    include: {
                        snapshot_test_values: {
                            include: {
                                attribute_tests: {
                                    select: {
                                        test_name: true,
                                        unit: true,
                                        higher_is_better: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        const formatted = enrollments.map((e) => {
            // استخراج الـ Baseline Tests لكل Enrollment
            const baselineSnapshot = e.physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots;
            const baseline_tests = baselineSnapshot?.snapshot_test_values?.map((tv) => ({
                attribute_test_id: tv.attribute_test_id,
                test_name: tv.attribute_tests?.test_name || "Unknown Test",
                value: Number(tv.value),
                unit: tv.attribute_tests?.unit || tv.unit,
                higher_is_better: tv.attribute_tests?.higher_is_better ?? true,
            })) || [];
            return {
                id: e.id,
                status: e.status,
                start_date: e.start_date,
                completed_date: e.completed_date,
                baseline_tests, // 🎯 الـ Tests المطلوبة للـ Final Assessment
                program: {
                    id: e.programs.id,
                    title: e.programs.title,
                    goal: e.programs.goal_primary,
                    duration: e.programs.duration_weeks,
                    cover: e.programs.cover_image,
                    coach: e.programs.users.username,
                },
            };
        });
        res.status(200).json({ success: true, data: formatted });
    }
    catch (error) {
        console.error("Get Enrollments Error:", error);
        return next(new AppError_1.AppError("Failed to fetch enrollments.", 500));
    }
};
exports.getMyEnrollments = getMyEnrollments;
const getSportProfile = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const profiles = await prisma_1.prisma.user_sport_profiles.findMany({
            where: { user_id: userId },
            orderBy: { is_primary: "desc" },
            include: { sports: { select: { name: true } } },
        });
        res.status(200).json({ success: true, data: profiles });
    }
    catch (error) {
        console.error("Get Sport Profile Error:", error);
        return next(new AppError_1.AppError("Failed to fetch sport profiles.", 500));
    }
};
exports.getSportProfile = getSportProfile;
const deleteSportProfile = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const profileId = req.params.id;
        const profile = await prisma_1.prisma.user_sport_profiles.findUnique({
            where: { id: profileId },
        });
        if (!profile)
            return next(new AppError_1.AppError("Sport profile not found.", 404));
        if (profile.user_id !== userId)
            return next(new AppError_1.AppError("Forbidden — You can only delete your own profile.", 403));
        await prisma_1.prisma.user_sport_profiles.delete({
            where: { id: profileId },
        });
        res
            .status(200)
            .json({ success: true, message: "Sport profile deleted successfully." });
    }
    catch (error) {
        console.error("Delete Sport Profile Error:", error);
        return next(new AppError_1.AppError("Failed to delete sport profile.", 500));
    }
};
exports.deleteSportProfile = deleteSportProfile;
const deleteUserMetrics = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const metrics = await prisma_1.prisma.user_metrics.findUnique({
            where: { user_id: userId },
        });
        if (!metrics)
            return next(new AppError_1.AppError("User metrics not found.", 404));
        await prisma_1.prisma.user_metrics.delete({ where: { user_id: userId } });
        res
            .status(200)
            .json({ success: true, message: "User metrics deleted successfully." });
    }
    catch (error) {
        console.error("Delete User Metrics Error:", error);
        return next(new AppError_1.AppError("Failed to delete user metrics.", 500));
    }
};
exports.deleteUserMetrics = deleteUserMetrics;
const deleteSnapshot = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const snapshotId = req.params.id;
        const snapshot = await prisma_1.prisma.physical_snapshots.findUnique({
            where: { id: snapshotId },
        });
        if (!snapshot)
            return next(new AppError_1.AppError("Snapshot not found.", 404));
        if (snapshot.user_id !== userId)
            return next(new AppError_1.AppError("Forbidden — You can only delete your own snapshot.", 403));
        await prisma_1.prisma.physical_snapshots.delete({
            where: { id: snapshotId },
        });
        res
            .status(200)
            .json({ success: true, message: "Snapshot deleted successfully." });
    }
    catch (error) {
        console.error("Delete Snapshot Error:", error);
        return next(new AppError_1.AppError("Failed to delete snapshot.", 500));
    }
};
exports.deleteSnapshot = deleteSnapshot;
// 📌 ضفنا التعديل هنا عشان نرجع الـ category_type
const getSportsList = async (req, res, next) => {
    try {
        const sports = await prisma_1.prisma.sports.findMany({
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
            category_type: (0, sportCategory_service_1.getCategoryType)(sport.id),
            has_categories: (0, sportCategory_service_1.getCategoryType)(sport.id) !== "none",
            total_attributes: sport.sport_attributes.length,
            total_tests: sport.sport_attributes.reduce((acc, attr) => acc + attr.attribute_tests.length, 0),
        }));
        res.status(200).json({ success: true, data: formattedSports });
    }
    catch (error) {
        console.error("Get Sports List Error:", error);
        return next(new AppError_1.AppError("Failed to fetch sports list.", 500));
    }
};
exports.getSportsList = getSportsList;
// 📌 الدالة الجديدة لجلب الأوزان/المراكز المتاحة لكل رياضة
const getSportCategories = async (req, res, next) => {
    try {
        const sport_id = parseInt(req.params.sport_id);
        const sport = await prisma_1.prisma.sports.findUnique({
            where: { id: sport_id },
            select: { id: true, name: true },
        });
        if (!sport) {
            return next(new AppError_1.AppError("Sport not found.", 404));
        }
        const categoriesEnum = (0, sportCategory_service_1.getCategoriesBySportId)(sport.id);
        // تحويل كل Enum إلى Label مقروء
        const formattedCategories = categoriesEnum.map((cat) => ({
            label: (0, sportCategory_service_1.formatCategoryLabel)(cat),
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
    }
    catch (error) {
        console.error("Get Sport Categories Error:", error);
        return next(new AppError_1.AppError("Failed to fetch sport categories.", 500));
    }
};
exports.getSportCategories = getSportCategories;
const completeOnboarding = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const { sport_id, level, player_category, test_values } = req.body;
        const existingProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true },
        });
        if (existingProfile) {
            return next(new AppError_1.AppError("Onboarding already completed. Use settings to update profile.", 409));
        }
        if (!sport_id || !level || !player_category || !test_values) {
            return next(new AppError_1.AppError("Missing required fields: sport_id, level, player_category, and test_values are required.", 400));
        }
        if (!Array.isArray(test_values) || test_values.length === 0) {
            return next(new AppError_1.AppError("test_values must be a non-empty array.", 400));
        }
        const sport = await prisma_1.prisma.sports.findUnique({
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
            return next(new AppError_1.AppError("Sport not found.", 404));
        }
        // 📌 ضفنا Validation إن الـ category مسموح بيها للرياضة دي
        const validCategories = (0, sportCategory_service_1.getCategoriesBySportId)(sport.id);
        if (!validCategories.includes(player_category)) {
            return next(new AppError_1.AppError(`Invalid player category (${player_category}) for ${sport.name}.`, 400));
        }
        const allTestIds = sport.sport_attributes.flatMap((attr) => attr.attribute_tests.map((test) => test.id));
        for (const test of test_values) {
            if (!allTestIds.includes(test.attribute_test_id)) {
                return next(new AppError_1.AppError(`Invalid test_id: ${test.attribute_test_id} does not belong to this sport.`, 400));
            }
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
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
            const testValuesData = test_values.map((test) => ({
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
    }
    catch (error) {
        console.error("Complete Onboarding Error:", error);
        return next(new AppError_1.AppError(error.message || "Failed to complete onboarding.", 500));
    }
};
exports.completeOnboarding = completeOnboarding;
const getOnboardingStatus = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const sportProfile = await prisma_1.prisma.user_sport_profiles.findFirst({
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
        const metrics = await prisma_1.prisma.user_metrics.findUnique({
            where: { user_id: userId },
        });
        const latestSnapshot = await prisma_1.prisma.physical_snapshots.findFirst({
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
        const hasBaselineSnapshot = !!latestSnapshot && latestSnapshot.snapshot_test_values.length > 0;
        const isComplete = hasSportProfile && hasMetrics && hasBaselineSnapshot;
        let missingSteps = [];
        if (!hasSportProfile)
            missingSteps.push("sport_profile");
        if (!hasMetrics)
            missingSteps.push("user_metrics");
        if (!hasBaselineSnapshot)
            missingSteps.push("baseline_snapshot");
        let progressPercentage = 0;
        if (hasSportProfile)
            progressPercentage += 33;
        if (hasMetrics)
            progressPercentage += 33;
        if (hasBaselineSnapshot)
            progressPercentage += 34;
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
    }
    catch (error) {
        console.error("Get Onboarding Status Error:", error);
        return next(new AppError_1.AppError("Failed to get onboarding status.", 500));
    }
};
exports.getOnboardingStatus = getOnboardingStatus;
const requireOnboarding = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const [sportProfile, metrics, snapshot] = await Promise.all([
            prisma_1.prisma.user_sport_profiles.findFirst({
                where: { user_id: userId, is_primary: true },
            }),
            prisma_1.prisma.user_metrics.findUnique({
                where: { user_id: userId },
            }),
            prisma_1.prisma.physical_snapshots.findFirst({
                where: {
                    user_id: userId,
                    snapshot_type: "initial_onboarding",
                },
            }),
        ]);
        if (!sportProfile || !metrics || !snapshot) {
            return next(new AppError_1.AppError("Onboarding incomplete. Please complete your athlete profile first.", 403));
        }
        req.onboarding = {
            sportProfile,
            metrics,
            snapshot,
        };
        next();
    }
    catch (error) {
        console.error("Require Onboarding Middleware Error:", error);
        return next(new AppError_1.AppError("Failed to verify onboarding status.", 500));
    }
};
exports.requireOnboarding = requireOnboarding;
// ==========================================
// Athlete Dashboard - Unified Endpoint
// ==========================================
const getAthleteDashboard = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const user = await prisma_1.prisma.users.findUnique({
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
            return next(new AppError_1.AppError("User not found.", 404));
        }
        const profile = user.user_sport_profiles[0];
        if (!profile) {
            return next(new AppError_1.AppError("Sport profile not found.", 404));
        }
        const { password_hash, ...safeUser } = user;
        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const [metrics, latestSnapshot] = await Promise.all([
            prisma_1.prisma.user_metrics.findUnique({
                where: {
                    user_id: userId,
                },
            }),
            prisma_1.prisma.physical_snapshots.findFirst({
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
        let radarData = [];
        let punchPower = null;
        if (latestSnapshot) {
            // 📌 نبني Map لتجميع القيم حسب الـ attribute
            const attributeMap = new Map();
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
                const entry = attributeMap.get(attrName);
                entry.values.push(Number(test.value));
                entry.count++;
            }
            // 📌 حساب المتوسط لكل Attribute
            radarData = Array.from(attributeMap.entries()).map(([attribute_name, item]) => ({
                attribute_name,
                value: Math.round(item.values.reduce((a, b) => a + b, 0) / item.count),
            }));
            // 📌 Punch Power - بنحسبه من الـ Percentiles عادي (زي ما هو)
            // بنحتاج الـ Percentiles عشان نحسب Punch Power
            const attributeMapForPercentiles = new Map();
            for (const test of latestSnapshot.snapshot_test_values) {
                const attr = test.attribute_tests.sport_attributes;
                if (!attributeMapForPercentiles.has(attr.id)) {
                    attributeMapForPercentiles.set(attr.id, {
                        name: attr.name,
                        tests: [],
                        totalWeight: 0,
                    });
                }
                const entry = attributeMapForPercentiles.get(attr.id);
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
                    const result = await getPercentileWithFallback(test.id, test.raw, test.higherIsBetter, profile.level, profile.player_category, ageGroupId);
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
                score: (0, calculation_service_1.calculatePunchPower)(foundation, accelerator, transfer),
                foundation,
                accelerator,
                transfer,
            };
        }
        const cleanedProfiles = user.user_sport_profiles.map(({ user_id, ...rest }) => rest);
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
    }
    catch (error) {
        console.error("Get Athlete Dashboard Error:", error);
        return next(new AppError_1.AppError("Failed to fetch athlete dashboard.", 500));
    }
};
exports.getAthleteDashboard = getAthleteDashboard;

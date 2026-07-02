import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';
import { calculateZScore, calculatePercentile, calculatePunchPower } from '../services/calculation.service';
import { snapshot_type, competitive_level, weight_class, enrollment_status, user_goal_enum } from '@prisma/client';
import { AppError } from '../utils/AppError'; // 🎯 تأكد من المسار

// ==========================================
// Helper Functions
// ==========================================
const getAgeGroupId = (dateOfBirth: Date): number => {
    const age = new Date().getFullYear() - dateOfBirth.getFullYear();
    if (age < 18) return 1;
    if (age <= 35) return 2;
    return 3;
};

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

const getPercentileWithFallback = async (
    testId: number, rawValue: number, higherIsBetter: boolean,
    userLevel: competitive_level, userWeight: weight_class, userAgeGroupId: number
): Promise<{ percentile: number; fallbackLevel: number }> => {
    const fallbackSteps: any[] = [
        { weight: userWeight, level: userLevel, ageGroup: userAgeGroupId },
        { weight: userWeight, level: userLevel, ageGroup: undefined },
        { weight: { in: getAdjacentWeightClasses(userWeight) }, level: userLevel, ageGroup: undefined },
        { weight: undefined, level: userLevel, ageGroup: undefined },
        { weight: undefined, level: undefined, ageGroup: undefined }
    ];

    for (let step = 0; step < fallbackSteps.length; step++) {
        const criteria = fallbackSteps[step];
        const norm = await prisma.normative_data.findFirst({
            where: {
                attribute_test_id: testId,
                ...(criteria.weight && { weight_class: criteria.weight }),
                ...(criteria.level && { level: criteria.level }),
                ...(criteria.ageGroup && { age_group_id: criteria.ageGroup })
            }
        });
        if (norm) {
            const z = calculateZScore(rawValue, Number(norm.mean_value), Number(norm.std_dev), higherIsBetter);
            const percentile = calculatePercentile(z);
            return { percentile, fallbackLevel: step };
        }
    }
    const fallbackPercentile = Math.min(99, Math.max(1, Math.floor(rawValue / 2)));
    return { percentile: fallbackPercentile, fallbackLevel: 4 };
};

const getTestName = async (testId: number): Promise<string> => {
    const test = await prisma.attribute_tests.findUnique({
        where: { id: testId },
        select: { test_name: true }
    });
    return test?.test_name || 'Unknown';
};

// ==========================================
// Controllers
// ==========================================

export const createSportProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { sport_id = 1, level, weight_class, is_primary = true } = req.body;

        const existingProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, sport_id: Number(sport_id) }
        });

        if (existingProfile) {
            return next(new AppError("Conflict — sport profile already exists. Use PATCH to update.", 409));
        }
        const sportExists = await prisma.sports.findUnique({
            where: { id: Number(sport_id) }
        });

        if (!sportExists) {
            return next(new AppError("Sport not found. Please provide a valid sport_id.", 404));
        }
        const newProfile = await prisma.user_sport_profiles.create({
            data: { user_id: userId, sport_id: Number(sport_id), level, weight_class, is_primary }
        });

        res.status(201).json({ success: true, message: "Sport profile created successfully!", data: newProfile });
    } catch (error: any) {
        console.error("Create Sport Profile Error:", error);
        return next(new AppError("Failed to create sport profile.", 500));
    }
};

export const upsertUserMetrics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { height_cm, weight_kg, goal, training_days_per_week, years_training, has_injury_history, endurance_score, strength_score, speed_score, flexibility_score, explosiveness_score, recovery_score } = req.body;

        if (!height_cm || !weight_kg || !goal || training_days_per_week === undefined || years_training === undefined) {
            return next(new AppError("Missing required fields: height_cm, weight_kg, goal, training_days_per_week, and years_training are required.", 400));
        }

        const validGoals = Object.keys(user_goal_enum);
        if (!validGoals.includes(goal)) {
            return next(new AppError(`Invalid goal. Allowed values are: ${validGoals.join(', ')}`, 400));
        }

        const metricsData = {
            height_cm: Number(height_cm),
            weight_kg: Number(weight_kg),
            goal: goal as user_goal_enum,
            training_days_per_week: Number(training_days_per_week),
            years_training: Number(years_training),
            has_injury_history: has_injury_history ?? false,
            endurance_score: endurance_score ? Number(endurance_score) : 5,
            strength_score: strength_score ? Number(strength_score) : 5,
            speed_score: speed_score ? Number(speed_score) : 5,
            flexibility_score: flexibility_score ? Number(flexibility_score) : 5,
            explosiveness_score: explosiveness_score ? Number(explosiveness_score) : 5,
            recovery_score: recovery_score ? Number(recovery_score) : 5,
        };

        const metrics = await prisma.user_metrics.upsert({
            where: { user_id: userId },
            update: metricsData,
            create: { user_id: userId, ...metricsData }
        });

        res.status(200).json({ success: true, message: "User metrics saved successfully!", data: metrics });
    } catch (error: any) {
        console.error("Upsert User Metrics Error:", error);
        return next(new AppError("Failed to save user metrics.", 500));
    }
};
export const getUserMetrics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;

        const metrics = await prisma.user_metrics.findUnique({
            where: { user_id: userId }
        });

        if (!metrics) {
            // لو مفيش Metrics، بنرجع 404 عشان الفرونت إند يعرف إنه لازم يوديه لشاشة الـ Onboarding
            return next(new AppError("User metrics not found. Please complete onboarding.", 404));
        }

        res.status(200).json({ success: true, data: metrics });
    } catch (error: any) {
        console.error("Get User Metrics Error:", error);
        return next(new AppError("Failed to fetch user metrics.", 500));
    }
};
export const updateSportProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { level, weight_class } = req.body;

        const existingProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true }
        });

        if (!existingProfile) {
            return next(new AppError("Sport profile not found. Please create one first.", 404));
        }

        const updatedProfile = await prisma.user_sport_profiles.update({
            where: { id: existingProfile.id },
            data: { ...(level && { level }), ...(weight_class && { weight_class }) }
        });

        res.status(200).json({ success: true, message: "Sport profile updated successfully!", data: updatedProfile });
    } catch (error: any) {
        console.error("Update Sport Profile Error:", error);
        return next(new AppError("Failed to update sport profile.", 500));
    }
};

export const createSnapshot = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { sport_id = 1, snapshot_type = 'manual_update', program_enrollment_id, notes, test_values } = req.body;

        // 🎯 التعديل الأول: التأكد من إن الـ Sport موجود عشان نعدي تيستاية الـ 404
        const sportExists = await prisma.sports.findUnique({
            where: { id: Number(sport_id) }
        });

        if (!sportExists) {
            return next(new AppError("Sport not found. Please provide a valid sport_id.", 404));
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. إنشاء الـ Snapshot الأساسية
            const snapshot = await tx.physical_snapshots.create({
                data: { user_id: userId, sport_id: Number(sport_id), snapshot_type, program_enrollment_id, notes }
            });

            // 2. تجهيز معلومات الـ Tests عشان نجيب الـ Unit
            const testIds = test_values.map((t: any) => t.attribute_test_id);
            const testsInfo = await tx.attribute_tests.findMany({ where: { id: { in: testIds } } });

            const dataToInsert = test_values.map((test: any) => {
                const info = testsInfo.find(ti => ti.id === test.attribute_test_id);
                return {
                    snapshot_id: snapshot.id,
                    attribute_test_id: test.attribute_test_id,
                    value: test.value,
                    unit: info?.unit || 'unknown'
                };
            });

            // 3. حفظ قيم الـ Tests المرفقة بالـ Snapshot
            await tx.snapshot_test_values.createMany({ data: dataToInsert });

            // 🎯 التعديل التاني: ربط الـ Snapshot بجدول الـ Enrollments عشان نعدي تيستاية الـ Program baseline
            if (program_enrollment_id) {
                if (snapshot_type === 'program_baseline') {
                    await tx.enrollments.update({
                        where: { id: program_enrollment_id },
                        data: { baseline_snapshot_id: snapshot.id }
                    });
                } else if (snapshot_type === 'program_posttest') {
                    await tx.enrollments.update({
                        where: { id: program_enrollment_id },
                        data: { posttest_snapshot_id: snapshot.id }
                    });
                }
            }

            return snapshot;
        });

        res.status(201).json({ success: true, message: "Snapshot saved!", snapshot_id: result.id });
    } catch (error: any) {
        console.error("Create Snapshot Error:", error);

        // 🎯 تعديل إضافي عشان لو حصلت مشكلة Prisma يبعتها للـ Global Error Handler بتاعك
        if (error.code) {
            return next(error);
        }

        return next(new AppError("Failed to save snapshot", 500));
    }
};

export const getSnapshots = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;
        const type = req.query.type as unknown as snapshot_type | undefined;

        const whereClause: any = { user_id: userId };
        if (type) whereClause.snapshot_type = type;

        const totalCount = await prisma.physical_snapshots.count({ where: whereClause });
        const snapshots = await prisma.physical_snapshots.findMany({
            where: whereClause,
            take: limit, skip: offset,
            orderBy: { created_at: 'desc' },
            include: { snapshot_test_values: { include: { attribute_tests: { select: { test_name: true } } } } }
        });

        const formattedSnapshots = snapshots.map(snap => ({
            id: snap.id, snapshot_type: snap.snapshot_type, created_at: snap.created_at, notes: snap.notes,
            test_values: snap.snapshot_test_values.map(tv => ({
                attribute_test_id: tv.attribute_test_id, test_name: tv.attribute_tests?.test_name, value: tv.value, unit: tv.unit
            }))
        }));

        res.status(200).json({ success: true, data: formattedSnapshots, meta: { total: totalCount, limit, offset } });
    } catch (error: any) {
        console.error("Get Snapshots Error:", error);
        return next(new AppError("Failed to fetch snapshots.", 500));
    }
};
export const getRadarData = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const cohortLevel = req.query.level as unknown as competitive_level | undefined;
        const cohortWeight = req.query.weight_class as unknown as weight_class | undefined;

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: { date_of_birth: true, user_sport_profiles: { where: { is_primary: true } } }
        });
        const profile = user?.user_sport_profiles[0];

        if (!profile) {
            return next(new AppError("Profile not found.", 404));
        }

        const ageGroupId = getAgeGroupId(user!.date_of_birth);
        const targetLevel = cohortLevel || profile.level;
        const targetWeight = cohortWeight || profile.weight_class;

        const latestSnapshot = await prisma.physical_snapshots.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: { snapshot_test_values: { include: { attribute_tests: { include: { sport_attributes: true } } } } }
        });

        // 🎯 التعديل هنا: خلينا الرسالة تطابق الـ Test Description بتاعك بالملي
        if (!latestSnapshot) {
            return next(new AppError("No snapshot data found.", 404));
        }

        const attributeMap = new Map<number, { name: string; tests: any[]; totalWeight: number }>();
        for (const testVal of latestSnapshot.snapshot_test_values) {
            const attr = testVal.attribute_tests?.sport_attributes;
            if (!attr) continue;
            const attrId = attr.id;
            if (!attributeMap.has(attrId)) attributeMap.set(attrId, { name: attr.name, tests: [], totalWeight: 0 });

            const entry = attributeMap.get(attrId)!;
            const weight = Number(testVal.attribute_tests?.weight || 1);

            entry.tests.push({
                testId: testVal.attribute_test_id, rawValue: Number(testVal.value),
                higherIsBetter: testVal.attribute_tests?.higher_is_better ?? true, weight: weight, unit: testVal.unit
            });
            entry.totalWeight += weight;
        }

        const radar_axes: any[] = [];
        let foundationPct = 0, acceleratorPct = 0, transferPct = 0;

        for (const [attrId, attrData] of attributeMap.entries()) {
            let weightedPercentileSum = 0;
            let highestFallback = 0;

            for (const test of attrData.tests) {
                const { percentile, fallbackLevel } = await getPercentileWithFallback(test.testId, test.rawValue, test.higherIsBetter, targetLevel, targetWeight, ageGroupId);
                weightedPercentileSum += percentile * test.weight;
                if (fallbackLevel > highestFallback) highestFallback = fallbackLevel;

                const testName = await getTestName(test.testId);
                if (testName === 'Trap Bar Deadlift') foundationPct = percentile;
                if (testName === 'Power Clean' || testName === 'Box Jump Height') acceleratorPct = percentile;
                if (testName === 'Medicine Ball Rotational Throw') transferPct = percentile;
            }

            const finalPercentile = attrData.totalWeight > 0 ? weightedPercentileSum / attrData.totalWeight : 0;
            radar_axes.push({ attribute_name: attrData.name, percentile: Math.round(finalPercentile), fallback_level: highestFallback });
        }

        const punch_power = {
            score: calculatePunchPower(foundationPct, acceleratorPct, transferPct),
            foundation: { percentile: foundationPct }, accelerator: { percentile: acceleratorPct }, transfer: { percentile: transferPct }
        };

        res.status(200).json({
            success: true,
            data: {
                radar_axes, punch_power,
                cohort_used: { weight_class: targetWeight, level: targetLevel, age_group: ageGroupId === 2 ? '18-35' : (ageGroupId === 1 ? 'Under 18' : '35+') },
                snapshot_date: latestSnapshot.created_at
            }
        });

    } catch (error: any) {
        console.error("Get Radar Data Error:", error);
        return next(new AppError("Failed to generate radar data", 500));
    }
};
export const getProgress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const attributeTestId = parseInt(req.query.attribute_test_id as string);
        if (isNaN(attributeTestId)) {
            return next(new AppError("Invalid test ID.", 400));
        }

        const [testInfo, user, profile] = await Promise.all([
            prisma.attribute_tests.findUnique({ where: { id: attributeTestId } }),
            prisma.users.findUnique({ where: { id: userId }, select: { date_of_birth: true } }),
            prisma.user_sport_profiles.findFirst({ where: { user_id: userId, is_primary: true } })
        ]);

        if (!testInfo || !profile || !user) {
            return next(new AppError("Data not found.", 404));
        }

        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const userLevel = profile.level;
        const userWeight = profile.weight_class;
        const higherIsBetter = testInfo.higher_is_better ?? true;

        const history = await prisma.physical_snapshots.findMany({
            where: { user_id: userId, snapshot_test_values: { some: { attribute_test_id: attributeTestId } } },
            orderBy: { created_at: 'asc' },
            include: { snapshot_test_values: { where: { attribute_test_id: attributeTestId }, take: 1 } }
        });

        const data_points = await Promise.all(history.map(async (snap) => {
            const rawValue = Number(snap.snapshot_test_values[0]?.value || 0);
            const { percentile } = await getPercentileWithFallback(attributeTestId, rawValue, higherIsBetter, userLevel, userWeight, ageGroupId);
            return { date: snap.created_at, raw_value: rawValue, snapshot_type: snap.snapshot_type, percentile: Math.round(percentile) };
        }));

        res.status(200).json({ success: true, data: { test_name: testInfo.test_name, unit: testInfo.unit, higher_is_better: higherIsBetter, data_points } });
    } catch (error: any) {
        console.error("Get Progress Error:", error);
        return next(new AppError("Failed to fetch progress.", 500));
    }
};

export const getMyEnrollments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const status = req.query.status as enrollment_status | undefined;

        const whereClause: any = { user_id: userId };
        if (status) whereClause.status = status;

        const enrollments = await prisma.enrollments.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            include: { programs: { select: { title: true, goal_primary: true, duration_weeks: true, cover_image: true, users: { select: { username: true } } } } }
        });

        const formatted = enrollments.map(e => ({
            id: e.id, status: e.status, start_date: e.start_date, completed_date: e.completed_date,
            program: { title: e.programs.title, goal: e.programs.goal_primary, duration: e.programs.duration_weeks, cover: e.programs.cover_image, coach: e.programs.users.username }
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error: any) {
        console.error("Get Enrollments Error:", error);
        return next(new AppError("Failed to fetch enrollments.", 500));
    }
};
// --- جلب بروفايلات الرياضة ---
export const getSportProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;

        const profiles = await prisma.user_sport_profiles.findMany({
            where: { user_id: userId },
            orderBy: { is_primary: 'desc' }, // هيجيب الأساسي أول واحد
            include: { sports: { select: { name: true } } }
        });

        res.status(200).json({ success: true, data: profiles });
    } catch (error: any) {
        console.error("Get Sport Profile Error:", error);
        return next(new AppError("Failed to fetch sport profiles.", 500));
    }
};

// --- مسح بروفايل رياضي ---
export const deleteSportProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const profileId = req.params.id;

        const profile = await prisma.user_sport_profiles.findUnique({ where: { id: profileId as any } });

        if (!profile) return next(new AppError("Sport profile not found.", 404));
        if (profile.user_id !== userId) return next(new AppError("Forbidden — You can only delete your own profile.", 403));

        await prisma.user_sport_profiles.delete({ where: { id: profileId as any } });

        res.status(200).json({ success: true, message: "Sport profile deleted successfully." });
    } catch (error: any) {
        console.error("Delete Sport Profile Error:", error);
        return next(new AppError("Failed to delete sport profile.", 500));
    }
};

// --- مسح القياسات الجسدية للمستخدم ---
export const deleteUserMetrics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;

        const metrics = await prisma.user_metrics.findUnique({ where: { user_id: userId } });
        if (!metrics) return next(new AppError("User metrics not found.", 404));

        await prisma.user_metrics.delete({ where: { user_id: userId } });

        res.status(200).json({ success: true, message: "User metrics deleted successfully." });
    } catch (error: any) {
        console.error("Delete User Metrics Error:", error);
        return next(new AppError("Failed to delete user metrics.", 500));
    }
};

// --- مسح قياس (Snapshot) معين ---
export const deleteSnapshot = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const snapshotId = req.params.id;

        const snapshot = await prisma.physical_snapshots.findUnique({ where: { id: snapshotId as any } });

        if (!snapshot) return next(new AppError("Snapshot not found.", 404));
        if (snapshot.user_id !== userId) return next(new AppError("Forbidden — You can only delete your own snapshot.", 403));

        await prisma.physical_snapshots.delete({ where: { id: snapshotId as any } });

        res.status(200).json({ success: true, message: "Snapshot deleted successfully." });
    } catch (error: any) {
        console.error("Delete Snapshot Error:", error);
        return next(new AppError("Failed to delete snapshot.", 500));
    }
};
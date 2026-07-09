import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';
import { calculateZScore, calculatePercentile, calculatePunchPower, getAgeGroupId, computeAttributeScore, getLatestTestValue, Cohort, computeAttributeScoreRaw } from '../services/calculation.service';
import { snapshot_type, competitive_level, weight_class, enrollment_status } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { addMetricsJob, addMetricsJobFromSnapshot } from '../queues/metrics.queue';

const ATTRIBUTE_METRIC_KEY: Record<string, keyof UserMetricsScores> = {
    'Strength': 'strength_score',
    'Explosiveness': 'explosiveness_score',
    'Aerobic Endurance': 'aerobic_score',
    'Muscular Endurance': 'endurance_score',
    'Anaerobic Capacity': 'anaerobic_score',
};

type UserMetricsScores = {
    endurance_score: number | null;
    strength_score: number | null;
    explosiveness_score: number | null;
    aerobic_score: number | null;
    anaerobic_score: number | null;
};

export const createSportProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { sport_id = 1, level, weight_class, is_primary = true } = req.body;

        if (!level || !weight_class) {
            res.status(400).json({ success: false, error: "Level and weight class are required." });
            return;
        }

        const existingProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, sport_id: Number(sport_id) }
        });

        if (existingProfile) {
            res.status(409).json({ success: false, error: "Sport profile already exists for this sport. Use PATCH to update." });
            return;
        }

        const newProfile = await prisma.user_sport_profiles.create({
            data: { user_id: userId, sport_id: Number(sport_id), level, weight_class, is_primary }
        });

        res.status(201).json({ success: true, message: "Sport profile created successfully!", data: newProfile });
    } catch (error: any) {
        console.error("Create Sport Profile Error:", error);
        res.status(500).json({ success: false, error: "Failed to create sport profile." });
    }
};

export const updateSportProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { level, weight_class } = req.body;

        const existingProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true }
        });

        if (!existingProfile) {
            res.status(404).json({ success: false, error: "Sport profile not found. Please create one first." });
            return;
        }

        const updatedProfile = await prisma.user_sport_profiles.update({
            where: { id: existingProfile.id },
            data: { ...(level && { level }), ...(weight_class && { weight_class }) }
        });

        res.status(200).json({ success: true, message: "Sport profile updated successfully!", data: updatedProfile });
    } catch (error: any) {
        console.error("Update Sport Profile Error:", error);
        res.status(500).json({ success: false, error: "Failed to update sport profile." });
    }
};

// ==========================================
// 3.3 & 3.4: Snapshots
// ==========================================


export const createSnapshot = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        // what is a must in body and what isn't
        const { sport_id = 1, snapshot_type = 'manual_update', notes, test_values } = req.body;

        if (!test_values || !Array.isArray(test_values) || test_values.length === 0) {
            res.status(400).json({ success: false, error: "test_values array is required" });
            return;
        }
        /*if ((snapshot_type === 'program_baseline' || snapshot_type === 'program_posttest') && !program_enrollment_id) {
            res.status(400).json({ success: false, error: "program_enrollment_id is required for this snapshot type." });
            return;
        }*/

        const result = await prisma.$transaction(async (tx) => {
            const snapshot = await tx.physical_snapshots.create({
                data: { user_id: userId, sport_id: Number(sport_id), snapshot_type, notes }
            });

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

            await tx.snapshot_test_values.createMany({ data: dataToInsert });
            return snapshot;
        });

        // Enqueue after transaction commits — if the transaction rolled back this never runs.
        await addMetricsJobFromSnapshot(userId, Number(sport_id), test_values);

        res.status(201).json({ success: true, message: "Snapshot saved!", snapshot_id: result.id });

    } catch (error: any) {
        console.error("Create Snapshot Error:", error);
        res.status(500).json({ success: false, error: "Failed to save snapshot" });
    }
};

// POST (update the snapshots values)
/*export const updateSnapshotValues = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { snapshot_id, test_values } = req.body;

        if (!snapshot_id || !test_values || !Array.isArray(test_values) || test_values.length === 0) {
            res.status(400).json({ success: false, error: "snapshot_id and test_values array are required" });
            return;
        }

        const result = await prisma.$transaction(async (tx) => {
            const snapshot = await tx.physical_snapshots.update({
                where: { id: snapshot_id },
                data: {
                    user_id: userId,
                    snapshot_type: 'manual_update',
                }
            });

            const testIds = test_values.map((t: any) => t.attribute_test_id);
            const testsInfo = await tx.attribute_tests.findMany(
                { where: { id: { in: testIds } } });

            const dataToInsert = test_values.map((test: any) => {
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

        res.status(201).json({ success: true, message: "Snapshot updated!", snapshot_id: result.id });
    } catch (error: any) {
        console.error("Update Snapshot Error:", error);
        res.status(500).json({ success: false, error: "Failed to update snapshot" });
    }
};*/

// GET (get the snapshots values)
/*export const getLatestTestValues = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;

        // 1. Locate the user's primary sport profile (same as radar)
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    select: { sport_id: true }
                }
            }
        });

        if (!user) {
            res.status(404).json({ success: false, error: "User not found." });
            return;
        }

        const primaryProfile = user.user_sport_profiles[0];
        if (!primaryProfile) {
            res.status(404).json({ success: false, error: "Primary sport profile not found." });
            return;
        }
        const sportId = primaryProfile.sport_id;

        // 2. Get all attribute tests for this sport
        const attributes = await prisma.sport_attributes.findMany({
            where: { sport_id: sportId },
            orderBy: { display_order: 'asc' },
            include: { attribute_tests: true }
        });

        if (attributes.length === 0) {
            res.status(404).json({ success: false, error: "No attribute tests configured for this sport." });
            return;
        }

        // 3. Fetch all snapshot values for this user/sport, ordered newest first
        const allTestValues = await prisma.snapshot_test_values.findMany({
            where: {
                physical_snapshots: {
                    user_id: userId,
                    sport_id: sportId,
                },
                attribute_test_id: { in: attributes.map(t => t.id) }
            },
            include: {
                physical_snapshots: {
                    select: { created_at: true }
                }
            },
            orderBy: {
                physical_snapshots: { created_at: 'desc' }
            }
        });

        // 4. Build a map of test_id → latest value (first occurrence wins because of desc order)
        const latestMap = new Map<number, { value: number; unit: string }>();
        for (const record of allTestValues) {
            const testId = record.attribute_test_id;
            if (!latestMap.has(testId)) {
                latestMap.set(testId, {
                    value: Number(record.value),
                    unit: record.unit
                });
            }
        }

        // 5. Assemble response – only tests that have at least one recorded value
        const testValues = attributes
            .filter(test => latestMap.has(test.id))
            .map(test => ({
                attribute_test_id: test.id,
                test_name: test.test_name,
                value: String(latestMap.get(test.id)!.value),  // string to match example
                unit: test.unit
            }));

        if (testValues.length === 0) {
            res.status(404).json({ success: false, error: "No test data found for this user." });
            return;
        }

        res.status(200).json({
            success: true,
            data: { test_values: testValues }
        });

    } catch (error: any) {
        console.error("Get Latest Test Values Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch latest test values" });
    }
};*/


export const getRadarData = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;

        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: {
                date_of_birth: true,
                user_sport_profiles: { where: { is_primary: true } }
            }
        });

        if (!user) {
            res.status(404).json({ success: false, error: "User not found." });
            return;
        }

        const profile = user.user_sport_profiles[0];
        if (!profile) {
            res.status(404).json({ success: false, error: "Profile not found." });
            return;
        }

        // Run both independent queries in parallel — no reason to wait on attributes
        // before starting the metrics fetch, or vice versa.
        const [attributes, scores] = await Promise.all([
            prisma.sport_attributes.findMany({
                where: { sport_id: profile.sport_id },
                orderBy: { display_order: 'asc' },
            }),
            prisma.user_metrics.findUnique({
                where: { user_id: userId }, // double-check this matches your actual PK/FK column name
                select: {
                    endurance_score: true,
                    strength_score: true,
                    explosiveness_score: true,
                    aerobic_score: true,
                    anaerobic_score: true,
                } satisfies Record<keyof UserMetricsScores, true>,
            }),
        ]);

        const radar_axes = attributes.map((attr) => ({
            sport_attribute_id: attr.id,
            attribute_name: attr.name,
            display_order: attr.display_order,
            // Looks up the right column by attribute name. Null covers two cases:
            // no scores row exists yet (new user), or this attribute has no mapped
            // column (seeded a new attribute but forgot to update the map above —
            // at least it's explicit null instead of silently wrong data).
            percentile: scores?.[ATTRIBUTE_METRIC_KEY[attr.name]] ?? null,
        }));

        res.status(200).json({
            success: true,
            data: { radar_axes },
        });

    } catch (error: any) {
        console.error("Get Radar Data Error:", error);
        res.status(500).json({ success: false, error: "Failed to generate radar data" });
    }
};

// ==========================================
// 3.6: Progress Tracking (CR-16 fixed)
// ==========================================

export const getProgress = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const attributeTestId = parseInt(req.params.attributeTestId as string);
        if (isNaN(attributeTestId)) {
            res.status(400).json({ success: false, error: "Invalid test ID." });
            return;
        }

        // 3 requests to database?
        const [testInfo, user, profile] = await Promise.all([
            prisma.attribute_tests.findUnique({ where: { id: attributeTestId } }),
            prisma.users.findUnique({ where: { id: userId } }),
            prisma.user_sport_profiles.findFirst({ where: { user_id: userId, is_primary: true } })
        ]);

        if (!testInfo || !profile || !user) {
            res.status(404).json({ success: false, error: "Data not found." });
            return;
        }

        const ageGroupId = getAgeGroupId(user.date_of_birth);
        const userLevel = profile.level;
        const userWeight = profile.weight_class;
        const higherIsBetter = testInfo.higher_is_better ?? true;

        const cohort: Cohort = {
            weight_class: userWeight,
            level: userLevel,
            age_group_id: ageGroupId
        }

        const history = await prisma.physical_snapshots.findMany({
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
            const percentile = await computeAttributeScoreRaw(
                attributeTestId,
                cohort,
                user.sex,
                rawValue
            );
            return {
                date: snap.created_at,
                raw_value: rawValue,
                snapshot_type: snap.snapshot_type,
                percentile: percentile
            };
        }));

        res.status(200).json({
            success: true,
            data: { test_name: testInfo.test_name, unit: testInfo.unit, higher_is_better: higherIsBetter, data_points }
        });
    } catch (error: any) {
        console.error("Get Progress Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch progress." });
    }
};
// ==========================================
// 3.7: Enrollments
// ==========================================

export const getMyEnrollments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const status = req.query.status as enrollment_status | undefined;

        const whereClause: any = { user_id: userId };
        if (status) whereClause.status = status;

        const enrollments = await prisma.enrollments.findMany({
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
    } catch (error: any) {
        console.error("Get Enrollments Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch enrollments." });
    }
};

export const completeOnboarding = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const { sport_id, level, weight_class, test_values } = req.body;

        // 🛡️ Validation
        if (!sport_id || !level || !weight_class || !test_values) {
            return next(new AppError(
                "Missing required fields: sport_id, level, weight_class, and test_values are required.",
                400
            ));
        }

        if (!Array.isArray(test_values) || test_values.length === 0) {
            return next(new AppError("test_values must be a non-empty array.", 400));
        }

        // تحقق من صحة الـ sport
        const sport = await prisma.sports.findUnique({
            where: { id: Number(sport_id) },
            include: {
                sport_attributes: {
                    include: {
                        attribute_tests: true
                    }
                }
            }
        });

        if (!sport) {
            return next(new AppError("Sport not found.", 404));
        }

        // تحقق من صحة الـ test_values (إنها تابعة للرياضة دي)
        const allTestIds = sport.sport_attributes.flatMap(attr =>
            attr.attribute_tests.map(test => test.id)
        );

        for (const test of test_values) {
            if (!allTestIds.includes(test.attribute_test_id)) {
                return next(new AppError(
                    `Invalid test_id: ${test.attribute_test_id} does not belong to this sport.`,
                    400
                ));
            }
        }

        // 🎯 تنفيذ الـ Onboarding في Transaction واحد
        const result = await prisma.$transaction(async (tx) => {
            // 1. إنشاء Sport Profile
            const sportProfile = await tx.user_sport_profiles.create({
                data: {
                    user_id: userId,
                    sport_id: Number(sport_id),
                    level,
                    weight_class,
                    is_primary: true,
                },
            });

            // 2. إنشاء Baseline Snapshot
            const snapshot = await tx.physical_snapshots.create({
                data: {
                    user_id: userId,
                    sport_id: Number(sport_id),
                    snapshot_type: 'initial_onboarding',
                    notes: `Initial onboarding baseline assessment for ${sport.name}`,
                },
            });

            // 3. إضافة الـ Test Values
            const testValuesData = test_values.map((test: any) => ({
                snapshot_id: snapshot.id,
                attribute_test_id: test.attribute_test_id,
                value: test.value,
                unit: test.unit || 'unknown',
            }));

            await tx.snapshot_test_values.createMany({
                data: testValuesData,
            });

            // 4. (اختياري) تحديث user_metrics لو مش موجودة
            // هنعملها بعدين لو احتجنا

            return {
                sportProfile,
                snapshot,
                testCount: testValuesData.length
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
                weight_class,
            },
        });
        const existingProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true }
        });
        if (existingProfile) {
            return next(new AppError("Onboarding already completed. Use settings to update profile.", 409));
        }

    } catch (error: any) {
        console.error("Complete Onboarding Error:", error);
        return next(new AppError(error.message || "Failed to complete onboarding.", 500));
    }
};

// ==========================================
// 3. معرفة حالة الـ Onboarding
// ==========================================
export const getOnboardingStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;

        // 1. جلب الـ Sport Profile الأساسي
        const sportProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, is_primary: true },
            include: {
                sports: {
                    select: {
                        id: true,
                        name: true,
                        icon: true,
                    }
                }
            }
        });

        // 2. جلب الـ User Metrics
        const metrics = await prisma.user_metrics.findUnique({
            where: { user_id: userId }
        });

        // 3. جلب أحدث Snapshot (عشان نشوف إذا كان في Baseline)
        const latestSnapshot = await prisma.physical_snapshots.findFirst({
            where: {
                user_id: userId,
                snapshot_type: 'initial_onboarding'
            },
            orderBy: { created_at: 'desc' },
            include: {
                snapshot_test_values: {
                    take: 1 // عشان نشوف لو في قياسات أصلاً
                }
            }
        });

        // 🎯 حساب الـ Status
        const hasSportProfile = !!sportProfile;
        const hasMetrics = !!metrics;
        const hasBaselineSnapshot = !!latestSnapshot && latestSnapshot.snapshot_test_values.length > 0;

        // هل الـ Onboarding مكتمل؟
        const isComplete = hasSportProfile && hasMetrics && hasBaselineSnapshot;

        // إيه الخطوة الناقصة؟
        let missingSteps: string[] = [];
        if (!hasSportProfile) missingSteps.push('sport_profile');
        if (!hasMetrics) missingSteps.push('user_metrics');
        if (!hasBaselineSnapshot) missingSteps.push('baseline_snapshot');

        // Progress Percentage
        let progressPercentage = 0;
        if (hasSportProfile) progressPercentage += 33;
        if (hasMetrics) progressPercentage += 33;
        if (hasBaselineSnapshot) progressPercentage += 34;

        res.status(200).json({
            success: true,
            data: {
                is_complete: isComplete,
                progress_percentage: progressPercentage,
                missing_steps: missingSteps,
                sport_profile: sportProfile ? {
                    id: sportProfile.id,
                    sport_id: sportProfile.sport_id,
                    sport_name: sportProfile.sports?.name,
                    level: sportProfile.level,
                    weight_class: sportProfile.weight_class,
                } : null,
                has_metrics: hasMetrics,
                has_baseline: hasBaselineSnapshot,
                baseline_snapshot_id: latestSnapshot?.id || null,
            }
        });

    } catch (error: any) {
        console.error("Get Onboarding Status Error:", error);
        return next(new AppError("Failed to get onboarding status.", 500));
    }
};

// ==========================================
// 4. Middleware: التحقق من إكمال الـ Onboarding
// ==========================================
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateProgram = exports.completeEnrollment = exports.enrollInProgram = exports.deleteProgram = exports.updateProgram = exports.getProgramById = exports.listPrograms = exports.createProgram = void 0;
const prisma_1 = require("../config/prisma");
// --- 4.1 Create Program (Coach Only) ---
const createProgram = async (req, res) => {
    try {
        const coachId = req.user?.sub;
        // 1. Ensure this user is a coach directly from the token
        const userRole = req.user?.role;
        if (userRole !== 'coach') {
            res.status(403).json({ success: false, error: "Only coaches can create programs." });
            return;
        }
        const { title, description, sport_id, goal_primary, level_target, duration_weeks, sessions_per_week, is_published = false, cover_image, blocks } = req.body;
        if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
            res.status(400).json({ success: false, error: "Program must contain at least one block." });
            return;
        }
        const newProgram = await prisma_1.prisma.programs.create({
            data: {
                coach_id: coachId,
                sport_id: Number(sport_id),
                title,
                description,
                goal_primary,
                level_target,
                duration_weeks: Number(duration_weeks),
                sessions_per_week: Number(sessions_per_week),
                is_published,
                cover_image,
                program_blocks: {
                    create: blocks.map((block) => ({
                        name: block.name,
                        description: block.description,
                        order_index: block.order_index,
                        week_start: block.week_start,
                        week_end: block.week_end,
                        program_sessions: {
                            create: block.sessions.map((session) => ({
                                name: session.name,
                                description: session.description,
                                day_offset: session.day_offset,
                                estimated_duration_minutes: session.estimated_duration_minutes,
                                session_exercises: {
                                    create: session.exercises.map((exercise) => ({
                                        exercise_name: exercise.exercise_name,
                                        sets: exercise.sets,
                                        reps: String(exercise.reps),
                                        rest_seconds: exercise.rest_seconds,
                                        intensity_note: exercise.intensity_note,
                                        notes: exercise.notes,
                                        order_index: exercise.order_index
                                    }))
                                }
                            }))
                        }
                    }))
                }
            },
            include: {
                program_blocks: {
                    include: {
                        program_sessions: {
                            include: {
                                session_exercises: true
                            }
                        }
                    }
                }
            }
        });
        res.status(201).json({ success: true, message: "Program created successfully!", data: newProgram });
    }
    catch (error) {
        console.error("Create Program Error:", error);
        res.status(500).json({ success: false, error: "Failed to create program." });
    }
};
exports.createProgram = createProgram;
// --- 4.2 List Programs ---
const listPrograms = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const sport_id = req.query.sport_id ? Number(req.query.sport_id) : undefined;
        const goal = req.query.goal;
        const level = req.query.level;
        const duration_weeks = req.query.duration_weeks ? Number(req.query.duration_weeks) : undefined;
        const min_rating = req.query.min_rating ? Number(req.query.min_rating) : undefined;
        const whereClause = { is_published: true };
        if (sport_id)
            whereClause.sport_id = sport_id;
        if (goal)
            whereClause.goal_primary = goal;
        if (level)
            whereClause.level_target = level;
        if (duration_weeks)
            whereClause.duration_weeks = duration_weeks;
        if (min_rating)
            whereClause.rating_avg = { gte: min_rating };
        const totalCount = await prisma_1.prisma.programs.count({ where: whereClause });
        const programs = await prisma_1.prisma.programs.findMany({
            where: whereClause,
            orderBy: [{ enrollment_count: 'desc' }, { rating_avg: 'desc' }],
            take: limit,
            skip: offset,
            select: {
                id: true, title: true, description: true, goal_primary: true,
                level_target: true, duration_weeks: true, sessions_per_week: true,
                cover_image: true, rating_avg: true, rating_count: true, enrollment_count: true,
                users: { select: { username: true, profile_photo: true } },
                sports: { select: { name: true } }
            }
        });
        // Used (p: any) to prevent TypeScript errors on related tables
        const formattedPrograms = programs.map((p) => ({
            id: p.id, title: p.title, description: p.description, goal_primary: p.goal_primary,
            level_target: p.level_target, duration_weeks: p.duration_weeks, sessions_per_week: p.sessions_per_week,
            cover_image: p.cover_image, rating_avg: p.rating_avg, rating_count: p.rating_count,
            enrollment_count: p.enrollment_count, coach_name: p.users?.username, coach_photo: p.users?.profile_photo,
            sport_name: p.sports?.name
        }));
        res.status(200).json({ success: true, data: formattedPrograms, meta: { total: totalCount, limit, offset } });
    }
    catch (error) {
        console.error("List Programs Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch programs." });
    }
};
exports.listPrograms = listPrograms;
// --- 4.3 Get Program By ID ---
const getProgramById = async (req, res) => {
    try {
        const programId = req.params.id;
        const program = await prisma_1.prisma.programs.findUnique({
            where: { id: programId, is_published: true },
            include: {
                users: { select: { username: true, profile_photo: true, bio: true } },
                program_blocks: {
                    orderBy: { order_index: 'asc' },
                    include: {
                        program_sessions: {
                            orderBy: { day_offset: 'asc' },
                            include: { session_exercises: { orderBy: { order_index: 'asc' } } }
                        }
                    }
                },
                program_ratings: {
                    orderBy: { created_at: 'desc' },
                    take: 5,
                    include: { users: { select: { username: true, profile_photo: true } } }
                }
            }
        });
        if (!program) {
            res.status(404).json({ success: false, error: "Program not found." });
            return;
        }
        const formattedProgram = {
            id: program.id, title: program.title, description: program.description,
            goal_primary: program.goal_primary, level_target: program.level_target,
            duration_weeks: program.duration_weeks, sessions_per_week: program.sessions_per_week,
            cover_image: program.cover_image, rating_avg: program.rating_avg,
            rating_count: program.rating_count, enrollment_count: program.enrollment_count,
            coach: { name: program.users?.username, photo: program.users?.profile_photo, bio: program.users?.bio },
            blocks: program.program_blocks,
            recent_reviews: program.program_ratings.map((r) => ({
                rating: r.rating, review: r.review, username: r.users?.username, date: r.created_at
            }))
        };
        res.status(200).json({ success: true, data: formattedProgram });
    }
    catch (error) {
        console.error("Get Program By ID Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch program details." });
    }
};
exports.getProgramById = getProgramById;
// --- 4.4 Update Program (Coach Only) ---
const updateProgram = async (req, res) => {
    try {
        const coachId = req.user?.sub;
        const programId = req.params.id;
        const updateData = req.body;
        const program = await prisma_1.prisma.programs.findUnique({ select: { coach_id: true }, where: { id: programId } });
        if (!program) {
            res.status(404).json({ success: false, error: "Program not found." });
            return;
        }
        if (program.coach_id !== coachId) {
            res.status(403).json({ success: false, error: "Forbidden: You can only update your own programs." });
            return;
        }
        const updatedProgram = await prisma_1.prisma.programs.update({
            where: { id: programId },
            data: {
                ...(updateData.title && { title: updateData.title }),
                ...(updateData.description && { description: updateData.description }),
                ...(updateData.goal_primary && { goal_primary: updateData.goal_primary }),
                ...(updateData.level_target && { level_target: updateData.level_target }),
                ...(updateData.duration_weeks && { duration_weeks: Number(updateData.duration_weeks) }),
                ...(updateData.sessions_per_week && { sessions_per_week: Number(updateData.sessions_per_week) }),
                ...(updateData.is_published !== undefined && { is_published: updateData.is_published }),
                ...(updateData.cover_image && { cover_image: updateData.cover_image })
            }
        });
        res.status(200).json({ success: true, message: "Program updated successfully.", data: updatedProgram });
    }
    catch (error) {
        console.error("Update Program Error:", error);
        res.status(500).json({ success: false, error: "Failed to update program." });
    }
};
exports.updateProgram = updateProgram;
// --- 4.5 Delete Program (Coach Only) ---
const deleteProgram = async (req, res) => {
    try {
        const coachId = req.user?.sub;
        const programId = req.params.id;
        const program = await prisma_1.prisma.programs.findUnique({ select: { coach_id: true }, where: { id: programId } });
        if (!program) {
            res.status(404).json({ success: false, error: "Program not found." });
            return;
        }
        if (program.coach_id !== coachId) {
            res.status(403).json({ success: false, error: "Forbidden: You can only delete your own programs." });
            return;
        }
        const activeEnrollments = await prisma_1.prisma.enrollments.count({
            where: { program_id: programId, status: 'active' }
        });
        if (activeEnrollments > 0) {
            res.status(409).json({ success: false, error: "Conflict: Cannot delete a program with active enrollments." });
            return;
        }
        await prisma_1.prisma.programs.delete({ where: { id: programId } });
        res.status(200).json({ success: true, message: "Program deleted successfully." });
    }
    catch (error) {
        console.error("Delete Program Error:", error);
        res.status(500).json({ success: false, error: "Failed to delete program." });
    }
};
exports.deleteProgram = deleteProgram;
// --- 4.6 Enroll in Program (Athlete) ---
const enrollInProgram = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const programId = String(req.params.id);
        const { preferred_days, preferred_time, baseline_test_values } = req.body;
        let formattedTime = null;
        if (preferred_time) {
            formattedTime = new Date(`1970-01-01T${preferred_time}:00.000Z`);
        }
        const program = await prisma_1.prisma.programs.findUnique({
            where: { id: programId, is_published: true },
            select: { id: true, title: true, sport_id: true }
        });
        if (!program) {
            res.status(404).json({ success: false, error: "Program not found or not published." });
            return;
        }
        const existingEnrollment = await prisma_1.prisma.enrollments.findFirst({
            where: { user_id: userId, program_id: programId, status: 'active' }
        });
        if (existingEnrollment) {
            res.status(409).json({ success: false, error: "You are already actively enrolled in this program." });
            return;
        }
        let testUnits = {};
        if (baseline_test_values && Array.isArray(baseline_test_values)) {
            const testIds = baseline_test_values.map(t => Number(t.attribute_test_id));
            const testsInfo = await prisma_1.prisma.attribute_tests.findMany({
                where: { id: { in: testIds } },
                select: { id: true, unit: true }
            });
            testsInfo.forEach(t => { testUnits[t.id] = t.unit; });
        }
        const transactionResult = await prisma_1.prisma.$transaction(async (tx) => {
            const baselineSnapshot = await tx.physical_snapshots.create({
                data: {
                    user_id: userId,
                    sport_id: program.sport_id,
                    snapshot_type: 'program_baseline',
                    snapshot_test_values: {
                        create: baseline_test_values.map((test) => ({
                            attribute_test_id: Number(test.attribute_test_id),
                            value: Number(test.value),
                            unit: testUnits[Number(test.attribute_test_id)] || 'units'
                        }))
                    }
                }
            });
            const enrollment = await tx.enrollments.create({
                data: {
                    users: { connect: { id: userId } },
                    programs: { connect: { id: programId } },
                    status: 'active',
                    start_date: new Date(),
                    preferred_days: Array.isArray(preferred_days) ? preferred_days : [],
                    preferred_time: formattedTime,
                    physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots: {
                        connect: { id: baselineSnapshot.id }
                    }
                }
            });
            await tx.physical_snapshots.update({
                where: { id: baselineSnapshot.id },
                data: { program_enrollment_id: enrollment.id }
            });
            const user = await tx.users.findUnique({ where: { id: userId }, select: { username: true } });
            await tx.posts.create({
                data: {
                    user_id: userId,
                    program_id: programId,
                    content: `${user?.username || 'A user'} just started the "${program.title}" training program! Time to put in the work! 🥊🔥`,
                    is_system_generated: true
                }
            });
            return enrollment;
        });
        res.status(201).json({ success: true, message: "Successfully enrolled!", data: transactionResult });
    }
    catch (error) {
        console.error("Enrollment Error:", error);
        res.status(500).json({ success: false, error: "Failed to enroll in program." });
    }
};
exports.enrollInProgram = enrollInProgram;
// --- 4.7 Complete Enrollment (Athlete) ---
const completeEnrollment = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const enrollmentId = String(req.params.id);
        const { posttest_test_values } = req.body;
        const enrollment = await prisma_1.prisma.enrollments.findUnique({
            where: { id: enrollmentId },
            include: {
                programs: { select: { title: true, sport_id: true, id: true } },
                physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots: {
                    include: { snapshot_test_values: true }
                }
            }
        });
        if (!enrollment) {
            res.status(404).json({ success: false, error: "Enrollment not found." });
            return;
        }
        if (enrollment.user_id !== userId) {
            res.status(403).json({ success: false, error: "Forbidden: Not your enrollment." });
            return;
        }
        if (enrollment.status !== 'active') {
            res.status(409).json({ success: false, error: "Conflict: Enrollment is not active." });
            return;
        }
        let testUnits = {};
        if (posttest_test_values && Array.isArray(posttest_test_values)) {
            const testIds = posttest_test_values.map(t => Number(t.attribute_test_id));
            const testsInfo = await prisma_1.prisma.attribute_tests.findMany({ where: { id: { in: testIds } }, select: { id: true, unit: true } });
            testsInfo.forEach(t => { testUnits[t.id] = t.unit; });
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const postSnapshot = await tx.physical_snapshots.create({
                data: {
                    user_id: userId,
                    sport_id: enrollment.programs.sport_id,
                    snapshot_type: 'program_posttest',
                    program_enrollment_id: enrollment.id,
                    snapshot_test_values: {
                        create: posttest_test_values.map((t) => ({
                            attribute_test_id: Number(t.attribute_test_id),
                            value: Number(t.value),
                            unit: testUnits[Number(t.attribute_test_id)] || 'units'
                        }))
                    }
                }
            });
            const updatedEnrollment = await tx.enrollments.update({
                where: { id: enrollmentId },
                data: {
                    status: 'completed',
                    completed_date: new Date(),
                    physical_snapshots_enrollments_posttest_snapshot_idTophysical_snapshots: {
                        connect: { id: postSnapshot.id }
                    }
                }
            });
            const baselineValues = enrollment.physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots?.snapshot_test_values || [];
            let deltas = [];
            posttest_test_values.forEach((postTest) => {
                const baseTest = baselineValues.find(b => b.attribute_test_id === Number(postTest.attribute_test_id));
                if (baseTest) {
                    const diff = Number(postTest.value) - Number(baseTest.value);
                    deltas.push({
                        test_id: postTest.attribute_test_id,
                        baseline: Number(baseTest.value),
                        posttest: Number(postTest.value),
                        improvement: diff
                    });
                }
            });
            const user = await tx.users.findUnique({ where: { id: userId }, select: { username: true } });
            const testimonial = `${user?.username || 'A user'} completed "${enrollment.programs.title}" and leveled up their stats! 📈🥊`;
            await tx.posts.create({
                data: {
                    user_id: userId,
                    program_id: enrollment.program_id,
                    content: testimonial,
                    is_system_generated: true,
                    metadata: { deltas, testimonial }
                }
            });
            return { updatedEnrollment, deltas, testimonial };
        });
        res.status(200).json({ success: true, message: "Program completed successfully!", data: result });
    }
    catch (error) {
        console.error("Complete Enrollment Error:", error);
        res.status(500).json({ success: false, error: "Failed to complete enrollment." });
    }
};
exports.completeEnrollment = completeEnrollment;
// --- 4.8 Rate Program (Athlete) ---
const rateProgram = async (req, res) => {
    try {
        const { rating, review } = req.body;
        const numericRating = Number(rating);
        if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            res.status(400).json({ success: false, error: "Rating must be an integer between 1 and 5." });
            return;
        }
        const userId = String(req.user?.sub);
        const programId = String(req.params.id);
        const completedEnrollment = await prisma_1.prisma.enrollments.findFirst({
            where: { user_id: userId, program_id: programId, status: 'completed' }
        });
        if (!completedEnrollment) {
            res.status(403).json({ success: false, error: "Forbidden: You must complete the program before rating it." });
            return;
        }
        const existingRating = await prisma_1.prisma.program_ratings.findFirst({
            where: { user_id: userId, program_id: programId }
        });
        if (existingRating) {
            res.status(409).json({ success: false, error: "Conflict: You have already rated this program." });
            return;
        }
        const newRating = await prisma_1.prisma.program_ratings.create({
            data: {
                enrollment_id: completedEnrollment.id,
                user_id: userId,
                program_id: programId,
                rating: numericRating,
                review: review ? String(review) : null
            }
        });
        res.status(201).json({ success: true, message: "Program rated successfully!", data: newRating });
    }
    catch (error) {
        console.error("Rate Program Error:", error);
        res.status(500).json({ success: false, error: "Failed to rate program." });
    }
};
exports.rateProgram = rateProgram;

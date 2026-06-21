"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkoutHistory = exports.logWorkout = exports.getNextWorkout = void 0;
const prisma_1 = require("../config/prisma");
// --- 1. Get Next Workout ---
const getNextWorkout = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        // 1. Fetch active enrollment for the player
        const activeEnrollment = await prisma_1.prisma.enrollments.findFirst({
            where: { user_id: userId, status: 'active' },
            include: {
                programs: {
                    include: {
                        program_blocks: {
                            orderBy: { order_index: 'asc' },
                            include: {
                                program_sessions: {
                                    orderBy: { day_offset: 'asc' },
                                    include: {
                                        session_exercises: { orderBy: { order_index: 'asc' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!activeEnrollment) {
            res.status(404).json({ success: false, error: "No active enrollment found." });
            return;
        }
        // 2. Fetch completed workouts in this enrollment
        const completedSessions = await prisma_1.prisma.completed_sessions.findMany({
            where: { enrollment_id: activeEnrollment.id },
            select: { program_session_id: true }
        });
        const completedSessionIds = completedSessions.map(cs => cs.program_session_id);
        // 3. Find the first incomplete workout session
        let nextSession = null;
        for (const block of activeEnrollment.programs.program_blocks) {
            for (const session of block.program_sessions) {
                if (!completedSessionIds.includes(session.id)) {
                    nextSession = session;
                    break;
                }
            }
            if (nextSession)
                break;
        }
        if (!nextSession) {
            res.status(200).json({ success: true, message: "You have completed all workouts in this program!" });
            return;
        }
        res.status(200).json({
            success: true,
            enrollment_id: activeEnrollment.id,
            workout: nextSession
        });
    }
    catch (error) {
        console.error("Get Next Workout Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch workout." });
    }
};
exports.getNextWorkout = getNextWorkout;
// --- 2. Log Workout ---
const logWorkout = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const { enrollment_id, program_session_id, rpe, duration_minutes, notes, exercises } = req.body;
        if (!enrollment_id || !program_session_id || !exercises) {
            res.status(400).json({ success: false, error: "Missing required workout data." });
            return;
        }
        // Use Transaction to prevent partial saves on error
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Log the workout session
            const completedSession = await tx.completed_sessions.create({
                data: {
                    user_id: userId,
                    enrollment_id: enrollment_id,
                    program_session_id: program_session_id,
                    rpe: Number(rpe) || null,
                    duration_minutes: Number(duration_minutes) || null,
                    notes: notes || null
                }
            });
            // 2. Log actual exercises and weights inside this session
            const exercisesData = exercises.map((ex) => ({
                completed_session_id: completedSession.id,
                session_exercise_id: ex.session_exercise_id,
                sets_data: ex.sets_data, // Actual array: [{set: 1, reps: 8, weight: 50}]
                notes: ex.notes || null
            }));
            await tx.completed_exercises.createMany({
                data: exercisesData
            });
            return completedSession;
        });
        res.status(201).json({
            success: true,
            message: "Workout logged successfully! Great job! 💪",
            data: result
        });
    }
    catch (error) {
        console.error("Log Workout Error:", error);
        res.status(500).json({ success: false, error: "Failed to log workout." });
    }
};
exports.logWorkout = logWorkout;
// --- 3. Get Workout History ---
const getWorkoutHistory = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // 1. Fetch all completed sessions ordered from newest to oldest
        const history = await prisma_1.prisma.completed_sessions.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: limit,
            skip: offset,
            include: {
                // Include session name (e.g., Heavy Strength Day)
                program_sessions: {
                    select: { name: true }
                },
                // Include program title this session belongs to
                enrollments: {
                    include: {
                        programs: { select: { title: true } }
                    }
                },
                // Include played exercises and weights
                completed_exercises: {
                    include: {
                        session_exercises: { select: { exercise_name: true } }
                    }
                }
            }
        });
        // 2. Format data for frontend display
        const formattedHistory = history.map(session => ({
            id: session.id,
            date: session.created_at,
            program_title: session.enrollments?.programs?.title || 'Unknown Program',
            session_name: session.program_sessions?.name || 'Unknown Session',
            rpe: session.rpe,
            duration_minutes: session.duration_minutes,
            session_notes: session.notes,
            exercises: session.completed_exercises.map(ex => ({
                id: ex.id,
                exercise_name: ex.session_exercises?.exercise_name || 'Unknown Exercise',
                sets_data: ex.sets_data,
                exercise_notes: ex.notes
            }))
        }));
        res.status(200).json({
            success: true,
            data: formattedHistory
        });
    }
    catch (error) {
        console.error("Get Workout History Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch workout history." });
    }
};
exports.getWorkoutHistory = getWorkoutHistory;

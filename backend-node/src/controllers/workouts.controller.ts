import { Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

// Get Next Workout
export const getNextWorkout = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Sad Path: No token (Authorization Handle)
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized: Missing user payload." });
      return;
    }

    const queryEnrollmentId = req.query.enrollment_id as string;
    let activeEnrollment = null;

    if (queryEnrollmentId) {
      const enrollment = await prisma.enrollments.findUnique({
        where: { id: queryEnrollmentId },
        select: {
          id: true,
          user_id: true,
          status: true,
          program_id: true,
          start_date: true,
        },
      });

      if (!enrollment) {
        res
          .status(404)
          .json({ success: false, error: "Enrollment not found." });
        return;
      }

      if (enrollment.user_id !== userId) {
        res.status(403).json({ success: false, error: "Forbidden." });
        return;
      }

      if (enrollment.status !== "active") {
        res
          .status(404)
          .json({ success: false, error: "No active enrollment found." });
        return;
      }

      activeEnrollment = enrollment;
    } else {
      activeEnrollment = await prisma.enrollments.findFirst({
        where: { user_id: userId, status: "active" },
        orderBy: { created_at: "desc" },
        select: { id: true, program_id: true, start_date: true },
      });
    }

    if (!activeEnrollment) {
      res
        .status(404)
        .json({ success: false, error: "No active enrollment found." });
      return;
    }

    const completedSessions = await prisma.completed_sessions.findMany({
      where: { enrollment_id: activeEnrollment.id },
      select: { program_session_id: true },
    });
    const completedSessionIds = completedSessions.map(
      (cs) => cs.program_session_id,
    );

    const nextSession = await prisma.program_sessions.findFirst({
      where: {
        id: { notIn: completedSessionIds },
        program_blocks: {
          program_id: activeEnrollment.program_id,
        },
      },
      orderBy: [
        { program_blocks: { order_index: "asc" } },
        { day_offset: "asc" },
      ],
      include: {
        session_exercises: {
          orderBy: { order_index: "asc" },
          select: {
            id: true,
            name: true,
            order_index: true,
            sets: true,
            reps: true,
            rest_seconds: true,
          },
        },
      },
    });

    if (!nextSession) {
      res.status(200).json({
        next_workout: null,
        message: "All sessions completed. Ready to finish the program.",
      });
      return;
    }

    const scheduledDate = new Date(activeEnrollment.start_date);
    scheduledDate.setDate(scheduledDate.getDate() + nextSession.day_offset);

    res.status(200).json({
      success: true,
      enrollment_id: activeEnrollment.id,
      workout: {
        session_id: nextSession.id,
        session_name: nextSession.name,
        day_offset: nextSession.day_offset,
        estimated_duration_minutes: nextSession.estimated_duration_minutes,
        scheduled_date: scheduledDate.toISOString().split("T")[0],
        exercises: nextSession.session_exercises,
      },
    });
  } catch (error: any) {
    console.error("Get Next Workout Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Internal server error occurred." });
  }
};

//Log Workout
export const logWorkout = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // 1. Sad Path: No token
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }

    const {
      enrollment_id,
      session_id,
      program_session_id,
      rpe,
      duration_minutes,
      notes,
      exercises,
      completed_at,
    } = req.body;
    const targetSessionId = session_id || program_session_id;

    if (!enrollment_id || !targetSessionId) {
      res.status(400).json({
        success: false,
        error: "Validation error: Missing required fields.",
      });
      return;
    }

    if (completed_at) {
      const logDate = new Date(completed_at);
      const now = new Date();
      if (logDate > now) {
        res.status(400).json({
          success: false,
          error: "Cannot log a workout in the future.",
        });
        return;
      }
    }

    const enrollment = await prisma.enrollments.findUnique({
      where: { id: enrollment_id },
      select: { user_id: true, status: true, program_id: true },
    });

    if (!enrollment) {
      res.status(404).json({ success: false, error: "Enrollment not found." });
      return;
    }

    if (enrollment.user_id !== userId) {
      res.status(403).json({
        success: false,
        error: "Forbidden: This enrollment does not belong to you.",
      });
      return;
    }

    if (enrollment.status !== "active") {
      res.status(404).json({
        success: false,
        error: "Cannot log to completed or inactive enrollment.",
      });
      return;
    }

    const sessionInProgram = await prisma.program_sessions.findFirst({
      where: {
        id: targetSessionId,
        program_blocks: {
          program_id: enrollment.program_id,
        },
      },
    });

    if (!sessionInProgram) {
      res.status(403).json({
        success: false,
        error:
          "Forbidden — session does not belong to this enrollment's program.",
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const completedSession = await tx.completed_sessions.create({
        data: {
          user_id: userId,
          enrollment_id: enrollment_id,
          program_session_id: targetSessionId,
          rpe: rpe ? Number(rpe) : null,
          duration_minutes: duration_minutes ? Number(duration_minutes) : null,
          notes: notes || null,
          created_at: completed_at ? new Date(completed_at) : new Date(), // دعم الـ timestamp المبعوت
        },
      });

      if (exercises && Array.isArray(exercises)) {
        const exercisesData = exercises.map((ex: any) => ({
          completed_session_id: completedSession.id,
          session_exercise_id: ex.session_exercise_id,
          sets_data: ex.sets_data || [],
          notes: ex.notes || null,
        }));

        await tx.completed_exercises.createMany({
          data: exercisesData,
        });
      }

      return completedSession;
    });

    res.status(201).json({
      success: true,
      id: result.id,
      session_info: {
        session_id: result.program_session_id,
        notes: result.notes,
      },
      timestamp: result.created_at,
    });
  } catch (error: any) {
    console.error("Log Workout Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error occurred while logging workout.",
    });
  }
};

// Get Workout History
export const getWorkoutHistory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // 1. Sad Path: No token
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized." });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const queryEnrollmentId = req.query.enrollment_id as string;

    const whereCondition: any = { user_id: userId };

    if (queryEnrollmentId) {
      const enrollment = await prisma.enrollments.findUnique({
        where: { id: queryEnrollmentId },
        select: { user_id: true },
      });

      if (!enrollment) {
        res
          .status(404)
          .json({ success: false, error: "Enrollment not found." });
        return;
      }

      if (enrollment.user_id !== userId) {
        res.status(403).json({ success: false, error: "Forbidden." });
        return;
      }

      whereCondition.enrollment_id = queryEnrollmentId;
    }

    const history = await prisma.completed_sessions.findMany({
      where: whereCondition,
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
      include: {
        program_sessions: {
          select: { name: true },
        },
        enrollments: {
          include: {
            programs: { select: { title: true } },
          },
        },
        completed_exercises: {
          include: {
            session_exercises: { select: { exercise_name: true } },
          },
        },
      },
    });

    const formattedHistory = history.map((session) => ({
      id: session.id,
      date: session.created_at,
      program_title: session.enrollments?.programs?.title || "Unknown Program",
      session_name: session.program_sessions?.name || "Unknown Session",
      rpe: session.rpe,
      duration_minutes: session.duration_minutes,
      session_notes: session.notes,
      exercises: session.completed_exercises.map((ex) => ({
        id: ex.id,
        exercise_name:
          ex.session_exercises?.exercise_name || "Unknown Exercise",
        sets_data: ex.sets_data,
        exercise_notes: ex.notes,
      })),
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory,
    });
  } catch (error: any) {
    console.error("Get Workout History Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Internal server error occurred." });
  }
};

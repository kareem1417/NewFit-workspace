import { Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AppError } from "../utils/AppError";

// Get Next Workout
export const getNextWorkout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction, // 👈 الـ Next لترحيل الأخطاء للـ Global Error Handler
): Promise<void> => {
  try {
    // 🚨 Sad Path: التشييك على التوكن والـ Payload
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      return next(new AppError("Unauthorized.", 401));
    }

    const queryEnrollmentId = req.query.enrollment_id as string;
    let activeEnrollment = null;

    // 1. التعامل مع الـ Enrollment لو مبعوت أو جلب الأحدث ديناميكياً
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
        return next(new AppError("Enrollment not found.", 404));
      }

      if (enrollment.user_id !== userId) {
        return next(new AppError("Forbidden.", 403));
      }

      if (enrollment.status !== "active") {
        return next(new AppError("No active enrollment found.", 404));
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
      return next(new AppError("No active enrollment found.", 404));
    }

    // 2. جلب الـ Sessions المتبقية والـ Exercises المرتبطة بها
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
            exercise_name: true, // 👈 الحقل الصحيح من الـ Schema بعد الفيكس
            order_index: true,
            sets: true,
            reps: true,
            rest_seconds: true,
          },
        },
      },
    });

    // 🎯 الـ Happy Path: في حالة إتمام البرنامج بالكامل
    if (!nextSession) {
      res.status(200).json({
        next_workout: null,
        message: "All sessions completed. Ready to finish the program.", // مطابقة للشيت
      });
      return;
    }

    // حساب تاريخ التمرين بناءً على الـ start_date والـ day_offset
    const scheduledDate = new Date(activeEnrollment.start_date);
    scheduledDate.setDate(scheduledDate.getDate() + nextSession.day_offset);

    // 🔄 تحويل الـ exercise_name إلى name بالملي لإرضاء الـ Automated Test
    const formattedExercises = nextSession.session_exercises.map((ex) => ({
      id: ex.id,
      name: ex.exercise_name, // 👈 الـ Alias المطلوب للشيت
      order_index: ex.order_index,
      sets: ex.sets,
      reps: ex.reps,
      rest_seconds: ex.rest_seconds,
    }));

    // 🎯 الـ Happy Path الأساسي: الداتا مفرودة بالكامل ومباشرة بدون wrappers
    res.status(200).json({
      session_id: nextSession.id,
      session_name: nextSession.name,
      day_offset: nextSession.day_offset,
      estimated_duration_minutes: nextSession.estimated_duration_minutes,
      scheduled_date: scheduledDate.toISOString().split("T")[0],
      exercises: formattedExercises,
    });
  } catch (error: any) {
    console.error("Get Next Workout Error:", error);
    next(error); // 👈 ترحيل أي خطأ طارئ للـ Global Error Handler ليتعامل مع الـ 500 بنظافة
  }
};

//Log Workout
export const logWorkout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      return next(new AppError("Unauthorized.", 401));
    }

    const {
      enrollment_id,
      session_id,
      rpe,
      duration_minutes,
      notes,
      exercises,
      completed_at,
    } = req.body;

    // 1. جلب الـ Enrollment والتحقق من وجوده وصاحبه
    const enrollment = await prisma.enrollments.findUnique({
      where: { id: enrollment_id },
      select: { user_id: true, status: true, program_id: true },
    });

    if (!enrollment) {
      return next(new AppError("Enrollment not found.", 404));
    }

    // تأمين الـ Resource: التأكد من أن الـ Athlete هو صاحب الـ Enrollment
    if (enrollment.user_id !== userId) {
      return next(new AppError("Forbidden.", 403));
    }

    // 🚨 سطر 40 في الشيت: لو الـ enrollment مش active يرجع 409 Conflict
    if (enrollment.status !== "active") {
      return next(new AppError("Cannot log to completed enrollment.", 409));
    }

    // 2. سطر 39 في الشيت: التأكد إن الـ Session دي تبع الـ Program المسجل فيه اللاعب فعلياً
    const sessionInProgram = await prisma.program_sessions.findFirst({
      where: {
        id: session_id,
        program_blocks: {
          program_id: enrollment.program_id,
        },
      },
    });

    if (!sessionInProgram) {
      return next(new AppError("Forbidden — session does not belong to this enrollment's program.", 403));
    }

    // 3. تنفيذ الـ Transaction لتسجيل الـ Log وحفظ الداتا متكاملة في خطوة واحدة
    const result = await prisma.$transaction(async (tx) => {
      const completedSession = await tx.completed_sessions.create({
        data: {
          user_id: userId,
          enrollment_id: enrollment_id,
          program_session_id: session_id,
          rpe: rpe ? Number(rpe) : null,
          duration_minutes: duration_minutes ? Number(duration_minutes) : null,
          notes: notes || null, // الحماية هنا: هتنزل null في الـ DB لو مش مبعوتة من الـ body
          created_at: completed_at ? new Date(completed_at) : new Date(),
        },
      });

      // لو مبعوت داتا للـ Exercises الفرعية، سيفها معاها في نفس اللحظة
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

    // 🎯 الـ Happy Paths (سطر 33 و 34): إرجاع الـ JSON بالـ Structure المطلوب تماماً
    res.status(201).json({
      id: result.id,
      session_info: {
        session_id: result.program_session_id,
        notes: result.notes, // هترجع null تلقائياً لو مكنش ليها قيمة
      },
      timestamp: result.created_at.toISOString(),
    });
  } catch (error: any) {
    console.error("Log Workout Error:", error);
    next(error); // ترحيل آمن للـ Global Error Handler عشان يرجع الـ 500 النظيفة
  }
};

// Get Workout History
export const getWorkoutHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Sad Path: No token
    const userId = req.user?.sub ? String(req.user.sub) : null;
    if (!userId) {
      return next(new AppError("Unauthorized.", 401));
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
        return next(new AppError("Enrollment not found.", 404));
      }

      if (enrollment.user_id !== userId) {
        return next(new AppError("Forbidden.", 403));
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

    res.status(200).json(formattedHistory);
  } catch (error: any) {
    console.error("Get Workout History Error:", error);
    next(new AppError("Internal server error occurred.", 500));
  }
};

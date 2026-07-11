import { Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AppError } from "../utils/AppError";
import { getReadinessAdvice } from "../services/ai.service";

const calculateReadinessScore = ({
  sleepHours,
  fatigue,
  soreness,
  stress,
}: {
  sleepHours: number;
  fatigue: number;
  soreness: number;
  stress: number;
}): number => {
  const sleepScore = Math.min(Math.max((sleepHours / 8) * 40, 0), 40);
  const fatigueScore = ((6 - fatigue) / 5) * 25;
  const sorenessScore = ((6 - soreness) / 5) * 20;
  const stressScore = ((6 - stress) / 5) * 15;

  return Math.round(sleepScore + fatigueScore + sorenessScore + stressScore);
};

const getReadinessRecommendation = (score: number) => {
  if (score >= 80) {
    return {
      status: "Ready to Train",
      recommendation: "Train normally.",
      intensity_adjustment: 0,
    };
  }

  if (score >= 60) {
    return {
      status: "Moderate Readiness",
      recommendation:
        "Continue with the planned workout, but reduce intensity by 10%.",
      intensity_adjustment: -10,
    };
  }

  if (score >= 40) {
    return {
      status: "Low Readiness",
      recommendation:
        "Perform a light recovery session instead of the planned workout.",
      intensity_adjustment: -30,
    };
  }

  return {
    status: "Very Low Readiness",
    recommendation:
      "Rest today and focus on sleep, hydration, and recovery.",
    intensity_adjustment: -100,
  };
};

const getReadinessHistoryContext = async (userId: string) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentReadiness = await prisma.daily_readiness_scores.findMany({
    where: {
      user_id: userId,
      created_at: {
        gte: sevenDaysAgo,
      },
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      score: true,
      created_at: true,
    },
  });

  const sevenDayAverage =
    recentReadiness.length > 0
      ? Math.round(
          recentReadiness.reduce((sum, item) => sum + item.score, 0) /
            recentReadiness.length,
        )
      : null;

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const yesterdayEnd = new Date();
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const yesterdayReadiness = await prisma.daily_readiness_scores.findFirst({
    where: {
      user_id: userId,
      created_at: {
        gte: yesterdayStart,
        lte: yesterdayEnd,
      },
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      score: true,
    },
  });

  const previousWorkout = await prisma.completed_sessions.findFirst({
    where: {
      user_id: userId,
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      rpe: true,
      duration_minutes: true,
      created_at: true,
    },
  });

  let daysSinceLastWorkout: number | null = null;

  if (previousWorkout?.created_at) {
    const diffMs = Date.now() - previousWorkout.created_at.getTime();
    daysSinceLastWorkout = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  return {
    seven_day_average: sevenDayAverage,
    yesterday_score: yesterdayReadiness?.score ?? null,
    previous_workout_rpe: previousWorkout?.rpe ?? null,
    previous_workout_duration_minutes:
      previousWorkout?.duration_minutes ?? null,
    days_since_last_workout: daysSinceLastWorkout,
  };
};

const applyHistoryAdjustments = (
  baseScore: number,
  history: {
    seven_day_average: number | null;
    previous_workout_rpe: number | null;
    previous_workout_duration_minutes: number | null;
  },
): number => {
  let adjustedScore = baseScore;

  if (history.seven_day_average !== null) {
    const drop = history.seven_day_average - baseScore;

    if (drop >= 20) {
      adjustedScore -= 8;
    } else if (drop >= 12) {
      adjustedScore -= 5;
    }
  }

  if (history.previous_workout_rpe !== null) {
    if (history.previous_workout_rpe >= 9) {
      adjustedScore -= 8;
    } else if (history.previous_workout_rpe >= 8) {
      adjustedScore -= 5;
    }
  }

  if (
    history.previous_workout_duration_minutes !== null &&
    history.previous_workout_duration_minutes >= 90
  ) {
    adjustedScore -= 4;
  }

  return Math.max(0, Math.min(100, Math.round(adjustedScore)));
};

export const submitReadiness = async (
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
      sleep_hours,
      fatigue,
      soreness,
      stress,
      enrollment_id,
      program_session_id,
    } = req.body;

    const sleepHours = Number(sleep_hours);
    const fatigueValue = Number(fatigue);
    const sorenessValue = Number(soreness);
    const stressValue = Number(stress);

    if (enrollment_id) {
      const enrollment = await prisma.enrollments.findUnique({
        where: { id: enrollment_id },
        select: { user_id: true, status: true },
      });

      if (!enrollment) {
        return next(new AppError("Enrollment not found.", 404));
      }

      if (enrollment.user_id !== userId) {
        return next(new AppError("Forbidden.", 403));
      }

      if (enrollment.status !== "active") {
        return next(new AppError("Enrollment is not active.", 409));
      }
    }

    let workoutContext: {
      session_name: string | null;
      estimated_duration_minutes: number | null;
    } | null = null;

    if (program_session_id) {
      const session = await prisma.program_sessions.findUnique({
        where: { id: program_session_id },
        select: {
          id: true,
          name: true,
          estimated_duration_minutes: true,
        },
      });

      if (!session) {
        return next(new AppError("Program session not found.", 404));
      }

      workoutContext = {
        session_name: session.name,
        estimated_duration_minutes: session.estimated_duration_minutes,
      };
    }

    const baseScore = calculateReadinessScore({
      sleepHours,
      fatigue: fatigueValue,
      soreness: sorenessValue,
      stress: stressValue,
    });

    const historyContext = await getReadinessHistoryContext(userId);

    const score = applyHistoryAdjustments(baseScore, historyContext);

    const recommendation = getReadinessRecommendation(score);

    const userContext = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        user_sport_profiles: {
          where: { is_primary: true },
          take: 1,
          select: {
            level: true,
            sports: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const primaryProfile = userContext?.user_sport_profiles?.[0];

    const readiness = await prisma.daily_readiness_scores.create({
      data: {
        user_id: userId,
        enrollment_id: enrollment_id || null,
        program_session_id: program_session_id || null,
        sleep_hours: sleepHours,
        fatigue: fatigueValue,
        soreness: sorenessValue,
        stress: stressValue,
        score,
        status: recommendation.status,
        recommendation: recommendation.recommendation,
        intensity_adjustment: recommendation.intensity_adjustment,
      },
    });

    let aiAdvice = null;

    try {
      aiAdvice = await getReadinessAdvice({
        score,
        status: recommendation.status,
        recommendation: recommendation.recommendation,
        intensity_adjustment: recommendation.intensity_adjustment,
        inputs: {
          sleep_hours: sleepHours,
          fatigue: fatigueValue,
          soreness: sorenessValue,
          stress: stressValue,
        },
        history: historyContext,
        workout: workoutContext,
        sport: primaryProfile?.sports?.name || "general",
        level: primaryProfile?.level || null,
      });
    } catch (error) {
      console.error("Readiness AI Advice Error:", error);

      aiAdvice = {
        summary: `Today's readiness score is ${score}/100.`,
        explanation:
          "AI explanation is unavailable right now. Using rule-based recommendation.",
        advice: recommendation.recommendation,
        safety_note:
          "Listen to your body. If you feel sharp pain or unusual symptoms, stop training and consult a professional.",
        sources: [],
      };
    }

    res.status(201).json({
      success: true,
      data: {
        ...readiness,
        base_score: baseScore,
        history_context: historyContext,
        ai_advice: aiAdvice,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTodayReadiness = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;

    if (!userId) {
      return next(new AppError("Unauthorized.", 401));
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const readiness = await prisma.daily_readiness_scores.findFirst({
      where: {
        user_id: userId,
        created_at: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: readiness || null,
    });
  } catch (error) {
    next(error);
  }
};

export const getReadinessHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;

    if (!userId) {
      return next(new AppError("Unauthorized.", 401));
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const history = await prisma.daily_readiness_scores.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
      take: limit,
      skip: offset,
    });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

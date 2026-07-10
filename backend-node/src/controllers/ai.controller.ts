import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  askRingsideAI,
  getProgramRecommendation,
} from "../services/ai.service";

import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

// Helper function to calculate age from Date of Birth
const calculateAge = (dob: Date) => {
  const diff = Date.now() - dob.getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};
const mapUserGoalToProgramGoal = (goal: string): string => {
  const normalized = goal.toLowerCase();

  const map: Record<string, string> = {
    weight_loss: "general",
    muscle_gain: "strength",
    endurance: "endurance",
    strength: "strength",
    agility: "speed",
    speed: "speed",
    flexibility: "general",
    recovery: "general",
    power: "power",
    general: "general",
  };

  return map[normalized] || "general";
};

const formatProgramCard = (p: any) => ({
  id: p.id,
  title: p.title,
  description: p.description || "",
  goal_primary: p.goal_primary,
  level_target: p.level_target,
  duration_weeks: p.duration_weeks,
  sessions_per_week: p.sessions_per_week,
  cover_image: p.cover_image,
  rating_avg: p.rating_avg ? String(p.rating_avg) : "0",
  rating_count: p.rating_count || 0,
  enrollment_count: p.enrollment_count || 0,
  sport_name: p.sports?.name || "General",
  coach_name: p.users?.username || "Unknown Coach",
  coach_photo: p.users?.profile_photo || null,
});


export const askQuestion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub;
    // The frontend sends the question, and optionally a session_id for existing chats
    const { question, session_id } = req.body;

    if (!question) {
      return next(new AppError("Question is required", 400));
    }

    // 1. Fetch user data for Context
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_sport_profiles: {
          where: { is_primary: true },
          include: { sports: true },
        },
        user_metrics: true,
      },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const primaryProfile = user.user_sport_profiles[0];
    const sportName = primaryProfile?.sports?.name || "general";
    const goal = user.user_metrics?.goal?.replace(/_/g, " ") || null;

    // 2. Chat Session Management and Memory
    let currentSessionId = session_id;
    let chatHistory: Array<{ role: string; content: string }> = [];

    if (currentSessionId) {
      // 🚨 Security Check: Verify session belongs to the user
      const existingSession = await prisma.chat_sessions.findUnique({
        where: { id: currentSessionId },
      });

      if (!existingSession) {
        return next(new AppError("Session not found", 404));
      }
      if (existingSession.user_id !== userId) {
        return next(
          new AppError("Forbidden — Session belongs to another user", 403),
        );
      }

      // If session exists and belongs to user, pull the last 6 messages
      const previousMessages = await prisma.chat_messages.findMany({
        where: { session_id: currentSessionId },
        orderBy: { created_at: "asc" },
        take: -6,
      });

      chatHistory = previousMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    } else {
      // If no session exists, create a new one...
      // If no session exists, create a new one for this user
      const newSession = await prisma.chat_sessions.create({
        data: {
          user_id: userId as string,
          title: question.substring(0, 50) + "...", // Use first 50 chars as chat title
        },
      });
      currentSessionId = newSession.id;
    }

    // 3. Build the Payload for Python (including History)
    const aiPayload = {
      question: question,
      sport: sportName.toLowerCase(),
      history: chatHistory,
      current_program: null,
      user_goal: goal,
    };

    // 4. Send request to Python AI Service
    const aiResponse = await askRingsideAI(aiPayload);

    // 5. Save messages to DB in the same session
    await prisma.chat_messages.createMany({
      data: [
        {
          session_id: currentSessionId,
          role: "user",
          content: question,
        },
        {
          session_id: currentSessionId,
          role: "assistant",
          content: aiResponse.answer, // Python AI response
        },
      ],
    });

    // 6. Return response to mobile with Session ID for future requests
    res.status(200).json({
      success: true,
      session_id: currentSessionId,
      data: aiResponse,
    });
  } catch (error: any) {
    console.error("AI Ask Error:", error);
    next(new AppError("Failed to get AI response", 500));
  }
};

//============================================
// This commented part are Updated
//============================================

// export const recommendProgram = async (req: AuthRequest, res: Response): Promise<void> => {
//     try {
//         const userId = req.user?.sub;

//         // Fetch user with their sport profile and latest metrics
//         const user = await prisma.users.findUnique({
//             where: { id: userId },
//             include: {
//                 user_sport_profiles: {
//                     where: { is_primary: true },
//                     include: { sports: true }
//                 },
//                 user_metrics: true // Fetch metrics table
//             }
//         });

//         if (!user) {
//             res.status(404).json({ success: false, error: "User not found" });
//             return;
//         }

//         if (!user.user_metrics) {
//             res.status(400).json({
//                 success: false,
//                 error: "User metrics not found. Please complete onboarding first."
//             });
//             return;
//         }

//         const primaryProfile = user.user_sport_profiles[0];
//         const metrics = user.user_metrics;

//         // Calculate age
//         const diff = Date.now() - user.date_of_birth.getTime();
//         const userAge = Math.abs(new Date(diff).getUTCFullYear() - 1970);

//         // Calculate BMI (Weight / (Height in m)^2)
//         const heightInMeters = Number(metrics.height_cm) / 100;
//         const calculatedBMI = Number(metrics.weight_kg) / (heightInMeters * heightInMeters);

//         // Build the actual Payload for the ML model
//         const mlPayload = {
//             Age: userAge,
//             Height_cm: Number(metrics.height_cm),
//             Weight_kg: Number(metrics.weight_kg),
//             BMI: Number(calculatedBMI.toFixed(1)),
//             Sport_Type: primaryProfile?.sports?.name || "General Fitness",
//             Level: primaryProfile?.level ? primaryProfile.level.charAt(0).toUpperCase() + primaryProfile.level.slice(1) : "Beginner",
//             Goal: metrics.goal.replace(/_/g, " "), // Convert Muscle_Gain to Muscle Gain
//             Training_Days_Per_Week: metrics.training_days_per_week,
//             Years_Training: Number(metrics.years_training),
//             Has_Injury_History: metrics.has_injury_history ? 1 : 0,
//             Endurance_Score: metrics.endurance_score,
//             Strength_Score: metrics.strength_score,
//             Speed_Score: metrics.speed_score,
//             Flexibility_Score: metrics.flexibility_score,
//             Explosiveness_Score: metrics.explosiveness_score,
//             Recovery_Score: metrics.recovery_score
//         };

//         const recommendation = await getProgramRecommendation(mlPayload);

//         res.status(200).json({ success: true, data: recommendation });
//     } catch (error: any) {
//         console.error("ML Recommend Error:", error);
//         res.status(500).json({ success: false, error: "Failed to get program recommendation" });
//     }
// };

// the New Recommend program depends on the User_Metrics
export const recommendProgram = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;
    const overrides = req.body || {};

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_sport_profiles: {
          include: { sports: true },
        },
        user_metrics: true,
      },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.user_metrics) {
      return next(
        new AppError(
          "User metrics not found. Please complete onboarding first.",
          400,
        ),
      );
    }

    const primaryProfile =
      user.user_sport_profiles.find((p) => p.is_primary) ??
      user.user_sport_profiles[0];

    if (!primaryProfile) {
      return next(
        new AppError(
          "Sport profile not found. Please complete onboarding first.",
          400,
        ),
      );
    }

    let metrics = user.user_metrics;

    if (overrides && Object.keys(overrides).length > 0) {
      metrics = await prisma.user_metrics.update({
        where: { user_id: userId },
        data: {
          ...(overrides.height_cm !== undefined && {
            height_cm: Number(overrides.height_cm),
          }),
          ...(overrides.weight_kg !== undefined && {
            weight_kg: Number(overrides.weight_kg),
          }),
          ...(overrides.goal !== undefined && {
            goal: overrides.goal,
          }),
          ...(overrides.training_days_per_week !== undefined && {
            training_days_per_week: Number(overrides.training_days_per_week),
          }),
          ...(overrides.years_training !== undefined && {
            years_training: Number(overrides.years_training),
          }),
          ...(overrides.has_injury_history !== undefined && {
            has_injury_history: Boolean(overrides.has_injury_history),
          }),
          ...(overrides.endurance_score !== undefined && {
            endurance_score: Number(overrides.endurance_score),
          }),
          ...(overrides.strength_score !== undefined && {
            strength_score: Number(overrides.strength_score),
          }),
          ...(overrides.speed_score !== undefined && {
            speed_score: Number(overrides.speed_score),
          }),
          ...(overrides.flexibility_score !== undefined && {
            flexibility_score: Number(overrides.flexibility_score),
          }),
          ...(overrides.explosiveness_score !== undefined && {
            explosiveness_score: Number(overrides.explosiveness_score),
          }),
          ...(overrides.recovery_score !== undefined && {
            recovery_score: Number(overrides.recovery_score),
          }),
        },
      });
    }

    const userAge = calculateAge(user.date_of_birth);

    const heightInMeters = Number(metrics.height_cm) / 100;
    const calculatedBMI =
      Number(metrics.weight_kg) / (heightInMeters * heightInMeters);

    const mlPayload = {
      Age: userAge,
      Height_cm: Number(metrics.height_cm),
      Weight_kg: Number(metrics.weight_kg),
      BMI: Number(calculatedBMI.toFixed(1)),
      Sport_Type: primaryProfile.sports?.name || "General Fitness",
      Level: primaryProfile.level
        ? primaryProfile.level.charAt(0).toUpperCase() +
          primaryProfile.level.slice(1)
        : "Novice",
      Goal: String(metrics.goal).replace(/_/g, " "),
      Training_Days_Per_Week: metrics.training_days_per_week,
      Years_Training: Number(metrics.years_training),
      Has_Injury_History: metrics.has_injury_history ? 1 : 0,
      Endurance_Score: metrics.endurance_score,
      Strength_Score: metrics.strength_score,
      Speed_Score: metrics.speed_score,
      Flexibility_Score: metrics.flexibility_score,
      Explosiveness_Score: metrics.explosiveness_score,
      Recovery_Score: metrics.recovery_score,
    };

    const recommendation = await getProgramRecommendation(mlPayload);

    if (!recommendation) {
      return next(new AppError("AI recommendation service returned no data.", 502));
    }

    if (recommendation?.error) {
      return next(
        new AppError(
          `AI recommendation failed: ${recommendation.error}`,
          502,
        ),
      );
    }

    const programGoal = mapUserGoalToProgramGoal(String(metrics.goal));

    let recommendedPrograms = await prisma.programs.findMany({
      where: {
        is_published: true,
        sport_id: primaryProfile.sport_id,
        OR: [
          {
            title: {
              contains: recommendation.recommended_program || "",
              mode: "insensitive",
            },
          },
          {
            goal_primary: programGoal as any,
          },
          {
            level_target: primaryProfile.level,
          },
        ],
      },
      orderBy: [{ rating_avg: "desc" }, { enrollment_count: "desc" }],
      take: 5,
      include: {
        sports: {
          select: {
            name: true,
          },
        },
        users: {
          select: {
            username: true,
            profile_photo: true,
          },
        },
      },
    });

    if (recommendedPrograms.length === 0) {
      recommendedPrograms = await prisma.programs.findMany({
        where: {
          is_published: true,
          sport_id: primaryProfile.sport_id,
        },
        orderBy: [{ rating_avg: "desc" }, { enrollment_count: "desc" }],
        take: 5,
        include: {
          sports: {
            select: {
              name: true,
            },
          },
          users: {
            select: {
              username: true,
              profile_photo: true,
            },
          },
        },
      });
    }

    if (recommendedPrograms.length === 0) {
      recommendedPrograms = await prisma.programs.findMany({
        where: {
          is_published: true,
        },
        orderBy: [{ rating_avg: "desc" }, { enrollment_count: "desc" }],
        take: 5,
        include: {
          sports: {
            select: {
              name: true,
            },
          },
          users: {
            select: {
              username: true,
              profile_photo: true,
            },
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        recommendation,
        recommended_programs: recommendedPrograms.map(formatProgramCard),
        user_metrics: metrics,
        sport_profile: {
          id: primaryProfile.id,
          sport_id: primaryProfile.sport_id,
          sport_name: primaryProfile.sports?.name || null,
          level: primaryProfile.level,
          player_category: primaryProfile.player_category,
          is_primary: primaryProfile.is_primary,
        },
      },
    });
  } catch (error: any) {
    console.error("ML Recommend Error:", error);
    next(new AppError("Failed to get program recommendation", 500));
  }
};


export const getCoachAdvice = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Receive raw data from punch power endpoint
    const { score, level, weight_class, breakdown_percentiles, raw_values } =
      req.body;

    // Quick check if all data is present
    if (score === undefined || !breakdown_percentiles || !raw_values) {
      return next(new AppError("Complete performance data is required.", 400));
    }

    // Python Microservice Link (New Analysis Route)
    const AI_SERVICE_URL =
      process.env.AI_SERVICE_URL || "http://localhost:8000/coach-analysis";

    // Send request to Python server
    const aiResponse = await fetch(AI_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: score,
        level: level || "amateur",
        weight_class: weight_class || "middleweight",
        foundation_pct: breakdown_percentiles.foundation,
        accelerator_pct: breakdown_percentiles.accelerator,
        transfer_pct: breakdown_percentiles.transfer,
        raw_foundation: raw_values.foundation,
        raw_accelerator: raw_values.accelerator,
        raw_transfer: raw_values.transfer,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI Service responded with status: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();

    // Return final advice to frontend
    res.status(200).json({
      success: true,
      advice: data.analysis,
      engine: data.engine, // Returns Hybrid RAG + Direct Analysis
    });
  } catch (error: any) {
    console.error("AI Coach Analysis Error:", error);
    next(
      new AppError(
        "Failed to generate coach advice from AI microservice.",
        500,
      ),
    );
  }
};
// --- 8.2 Get User Sessions ---
export const getSessions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);

    const sessions = await prisma.chat_sessions.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: "desc" }, // Newest first
      take: 20, // Max 20 per Specs
    });

    res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    console.error("Get Sessions Error:", error);
    next(new AppError("Failed to fetch chat sessions.", 500));
  }
};

// --- 8.3 Get Session Messages ---
// --- 8.3 Get Session Messages ---
export const getSessionMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);
    const sessionId = String(req.params.id);

    // 1. Verify this session belongs to the user (Security/Authorization)
    const session = await prisma.chat_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return next(new AppError("Session not found.", 404));
    }

    if (session.user_id !== userId) {
      return next(new AppError("Unauthorized to view this session.", 403));
    }

    // 2. Fetch messages ordered from oldest to newest
    const messages = await prisma.chat_messages.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        suggested_program_ids: true,
        created_at: true,
      },
    });

    // 3. Format data
    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        // message type
        // Variable must be defined here outside the if-block to be accessible in return
        let suggested_programs: { id: string; title: string }[] = [];

        if (
          Array.isArray(msg.suggested_program_ids) &&
          msg.suggested_program_ids.length > 0
        ) {
          const stringIds = (msg.suggested_program_ids as any[]).map((id) =>
            String(id),
          );

          suggested_programs = await prisma.programs.findMany({
            where: { id: { in: stringIds } },
            select: { id: true, title: true },
          });
        }

        return {
          id: msg.id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
          // Can be read safely without ReferenceError
          suggested_programs: suggested_programs,
        };
      }),
    );

    res.status(200).json({ success: true, data: formattedMessages });
  } catch (error: any) {
    console.error("Get Session Messages Error:", error);
    next(new AppError("Failed to fetch session messages.", 500));
  }
};

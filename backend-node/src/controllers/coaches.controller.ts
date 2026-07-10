import { Response, NextFunction } from "express";
import { competitive_level } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { AppError } from "../utils/AppError";

export const upsertCoachProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const { sport, level } = req.body as {
      sport?: string;
      level?: competitive_level;
    };

    if (!sport || !sport.trim()) {
      return next(new AppError("Sport is required", 400));
    }

    if (!level) {
      return next(new AppError("Level is required", 400));
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.role !== "coach") {
      return next(new AppError("Only coaches can create coach profiles", 403));
    }

    const profile = await prisma.coach_profiles.upsert({
      where: { user_id: userId },
      update: {
        sport: sport.trim(),
        level,
      },
      create: {
        user_id: userId,
        sport: sport.trim(),
        level,
      },
    });

    res.status(200).json({
      success: true,
      message: "Coach profile saved successfully",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyCoachProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const profile = await prisma.coach_profiles.findUnique({
      where: { user_id: userId },
    });

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getCoachProfileByUserId = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userIdParam = req.params.userId;

    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;

    if (!userId) {
      return next(new AppError("Invalid userId", 400));
    }

    const profile = await prisma.coach_profiles.findUnique({
      where: { user_id: userId },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            full_name: true,
            profile_photo: true,
            bio: true,
            role: true,
          },
        },
      },
    });

    if (!profile) {
      return next(new AppError("Coach profile not found", 404));
    }

    const user = profile.users;

    res.status(200).json({
      success: true,
      data: {
        user_id: profile.user_id,
        username: user.username,
        full_name: user.full_name,
        profile_photo: user.profile_photo,
        bio: user.bio,
        sport: profile.sport,
        level: profile.level,
      },
    });
  } catch (error) {
    next(error);
  }
};



export const getMyCoachPrograms = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.sub ? String(req.user.sub) : null;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.role !== "coach") {
      return next(new AppError("Only coaches can view their programs", 403));
    }

    const programs = await prisma.programs.findMany({
      where: {
        coach_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        id: true,
        title: true,
        level_target: true,
        duration_weeks: true,
        sessions_per_week: true,
        cover_image: true,
        enrollment_count: true,
        rating_avg: true,
        rating_count: true,
        is_published: true,
        sports: {
          select: {
            name: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: programs.map((program) => ({
        id: program.id,
        title: program.title,
        sport_name: program.sports?.name || "General",
        level_target: program.level_target,
        duration_weeks: program.duration_weeks,
        sessions_per_week: program.sessions_per_week,
        cover_image: program.cover_image,
        enrollment_count: program.enrollment_count || 0,
        rating_avg: program.rating_avg ? Number(program.rating_avg) : 0,
        rating_count: program.rating_count || 0,
        is_published: program.is_published,
      })),
    });
  } catch (error) {
    next(error);
  }
};

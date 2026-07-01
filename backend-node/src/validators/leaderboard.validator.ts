import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { weight_class, competitive_level } from "@prisma/client";

export const getLeaderboardValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { type, weight_class: queryWeight, level: queryLevel } = req.query;

  // 1. التحقق من الـ type (مطلوب وإلزامي لـ get_leaderboard)
  const VALID_LEADERBOARD_TYPES = ["punch_power", "strength", "endurance"];
  if (!type || !VALID_LEADERBOARD_TYPES.includes(String(type))) {
    res.status(400).json({
      success: false,
      error: "Validation error — invalid leaderboard type.", // نفس نص الشيت بالملي ليقفل أخضر
    });
    return;
  }

  // 2. التحقق من الـ weight_class لو مبعوت كـ override
  if (
    queryWeight &&
    !Object.values(weight_class).includes(queryWeight as weight_class)
  ) {
    res
      .status(400)
      .json({ success: false, error: "Invalid weight_class parameter." });
    return;
  }

  // 3. التحقق من الـ level لو مبعوت كـ override
  if (
    queryLevel &&
    !Object.values(competitive_level).includes(queryLevel as competitive_level)
  ) {
    res.status(400).json({ success: false, error: "Invalid level parameter." });
    return;
  }

  next();
};

export const mostImprovedValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { weight_class: queryWeight, level: queryLevel } = req.query;

  // التحقق من الـ overrides لصفحة الـ most improved
  if (
    queryWeight &&
    !Object.values(weight_class).includes(queryWeight as weight_class)
  ) {
    res
      .status(400)
      .json({ success: false, error: "Invalid weight_class parameter." });
    return;
  }

  if (
    queryLevel &&
    !Object.values(competitive_level).includes(queryLevel as competitive_level)
  ) {
    res.status(400).json({ success: false, error: "Invalid level parameter." });
    return;
  }

  next();
};

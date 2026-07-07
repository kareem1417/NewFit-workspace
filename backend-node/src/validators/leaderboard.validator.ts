import { query, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { player_category, competitive_level } from "@prisma/client"; // 📌 التعديل هنا

// ==========================================
// Reusable Pagination Validator
// ==========================================
const paginationValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Validation error — limit must be a positive integer."),
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Validation error — offset must be a non-negative integer."),
];

// ==========================================
// 1. Get Leaderboard Validation
// ==========================================
export const getLeaderboardValidation: (
  ValidationChain | ((req: Request, res: Response, next: NextFunction) => void)
)[] = [
  query("type")
    .notEmpty()
    .withMessage("Validation error — invalid leaderboard type.")
    .isIn(["punch_power", "strength", "endurance"])
    .withMessage("Validation error — invalid leaderboard type."),
  query("player_category") // 📌 التعديل هنا
    .optional()
    .isIn(Object.values(player_category))
    .withMessage("Invalid player_category parameter."),
  query("level")
    .optional()
    .isIn(Object.values(competitive_level))
    .withMessage("Invalid level parameter."),
  ...paginationValidation,
];

// ==========================================
// 2. Most Improved Validation
// ==========================================
export const mostImprovedValidation: (
  ValidationChain | ((req: Request, res: Response, next: NextFunction) => void)
)[] = [
  query("player_category") // 📌 التعديل هنا
    .optional()
    .isIn(Object.values(player_category))
    .withMessage("Invalid player_category parameter."),
  query("level")
    .optional()
    .isIn(Object.values(competitive_level))
    .withMessage("Invalid level parameter."),
  ...paginationValidation,
];

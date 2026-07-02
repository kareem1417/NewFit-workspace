import { query, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { weight_class, competitive_level } from "@prisma/client";

// ==========================================
// Reusable Pagination Validator
// ==========================================
const paginationValidation = [
  query("limit").optional().isInt({ min: 1 }).withMessage("Validation error — limit must be a positive integer."),
  query("offset").optional().isInt({ min: 0 }).withMessage("Validation error — offset must be a non-negative integer.")
];

// ==========================================
// 1. Get Leaderboard Validation
// ==========================================
export const getLeaderboardValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  query("type")
    .notEmpty()
    .withMessage("Validation error — invalid leaderboard type.")
    .isIn(["punch_power", "strength", "endurance"])
    .withMessage("Validation error — invalid leaderboard type."),
  query("weight_class")
    .optional()
    .isIn(Object.values(weight_class))
    .withMessage("Invalid weight_class parameter."),
  query("level")
    .optional()
    .isIn(Object.values(competitive_level))
    .withMessage("Invalid level parameter."),
  ...paginationValidation
];

// ==========================================
// 2. Most Improved Validation
// ==========================================
export const mostImprovedValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  query("weight_class")
    .optional()
    .isIn(Object.values(weight_class))
    .withMessage("Invalid weight_class parameter."),
  query("level")
    .optional()
    .isIn(Object.values(competitive_level))
    .withMessage("Invalid level parameter."),
  ...paginationValidation
];
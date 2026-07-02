import { query, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

// ==========================================
// 1. Search Query Validation
// ==========================================
export const searchValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
    query("q")
        .notEmpty()
        .withMessage("Validation error — q cannot be empty or missing.")
        .isString()
        .withMessage("Validation error — q must be a string."),

    query("type")
        .optional()
        .isIn(["all", "users", "programs", "posts"])
        .withMessage("Validation error — invalid type provided. Allowed types are: all, users, programs, posts."),

    query("limit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Validation error — limit must be a positive integer."),

    query("offset")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Validation error — offset must be a non-negative integer.")
];

// ==========================================
// 2. Sync Search Validation (Admin Only)
// ==========================================
export const syncSearchValidation = [
    (req: Request, res: Response, next: NextFunction): void => {
        const reqAny = req as any;
        // التأكد من وجود التوكن وأن الـ Role هو أدمن (بندعم الحروف الكبيرة والصغيرة عشان الأمان)
        if (!reqAny.user || (reqAny.user.role !== "ADMIN" && reqAny.user.role !== "admin")) {
            return next(new AppError("Forbidden — admin only.", 403));
        }
        next();
    }
];
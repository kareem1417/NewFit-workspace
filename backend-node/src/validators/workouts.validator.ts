import { body, query, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

// ==========================================
// Reusable Pagination Validator
// ==========================================
const paginationValidation = [
  query("limit").optional().isInt({ min: 1 }).withMessage("Validation error — limit must be a positive integer."),
  query("offset").optional().isInt({ min: 0 }).withMessage("Validation error — offset must be a non-negative integer.")
];

// ==========================================
// 1. Get Next Workout Validation
// ==========================================
export const getNextWorkoutValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  (req: Request, res: Response, next: NextFunction): void => {
    const enrollment_id = req.query.enrollment_id as string;
    if (enrollment_id && typeof enrollment_id === "string") {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(enrollment_id)) {
        // 🎯 التعديل: رمي AppError بدل res.status
        return next(new AppError("Enrollment not found.", 404));
      }
    }
    next();
  },
];

// ==========================================
// 2. Post Log Validation
// ==========================================
export const postLogValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  body("enrollment_id")
    .notEmpty()
    .withMessage("Validation error."),
  body("session_id")
    .notEmpty()
    .withMessage("Validation error."),

  (req: Request, res: Response, next: NextFunction): void => {
    const { enrollment_id, session_id, completed_at } = req.body;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (enrollment_id && session_id) {
      if (!uuidRegex.test(enrollment_id) || !uuidRegex.test(session_id)) {
        return next(new AppError("Validation error.", 400));
      }
    }

    if (completed_at) {
      const logDate = new Date(completed_at);
      const now = new Date();

      if (isNaN(logDate.getTime()) || logDate.getTime() > now.getTime() + 5000) {
        return next(new AppError("Cannot log a workout in the future.", 400));
      }
    }

    next();
  },
];

// ==========================================
// 3. Get Workout History Validation
// ==========================================
export const getHistoryValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  (req: Request, res: Response, next: NextFunction): void => {
    const queryEnrollmentId = req.query.enrollment_id as string;
    if (queryEnrollmentId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(queryEnrollmentId)) {
        return next(new AppError("Enrollment not found.", 404));
      }
    }
    next();
  },
  // 🎯 التعديل: إضافة الـ Pagination هنا
  ...paginationValidation
];
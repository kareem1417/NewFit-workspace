import { body, query, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError"; // 🎯 تأكد من المسار

// ==========================================
// 1. Create Program Validation (Coach Only)
// ==========================================
export const createProgramValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  (req: Request, res: Response, next: NextFunction): void => {
    const reqAny = req as any;
    if (reqAny.user?.role !== "coach") {
      return next(new AppError("Forbidden — only coaches can create programs.", 403));
    }
    next();
  },
  body("title").notEmpty().withMessage("Validation error — title required.").trim().isLength({ min: 1 }).withMessage("Validation error — title required."),
  body("sport_id").notEmpty().withMessage("Validation error — sport_id is required."),
  body("goal_primary").optional().trim().toLowerCase().isIn(["power", "strength", "hypertrophy", "endurance"]).withMessage("Validation error — Invalid goal_primary enum."),
];

// ==========================================
// 2. List Programs Validation
// ==========================================
export const listProgramsValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  query("limit").optional().isInt({ gt: 0 }).withMessage("Validation error — limit must be a positive number."),
  query("offset").optional().isInt({ min: 0 }).withMessage("Validation error — offset must be a non-negative number."),
  query("sport_id").optional().isNumeric().withMessage("Validation error — sport_id must be a valid number."),
  query("duration_weeks").optional().isInt({ gt: 0 }).withMessage("Validation error — duration_weeks must be a positive number."),
  query("min_rating").optional().isFloat({ min: 0, max: 5 }).withMessage("Validation error — min_rating must be between 0 and 5."),
  query("goal").optional().trim().toLowerCase().isIn(["power", "strength", "hypertrophy", "endurance"]).withMessage("Validation error — invalid goal filter."),
  query("level").optional().trim().toLowerCase().isIn(["novice", "amateur", "intermediate", "advanced"]).withMessage("Validation error — invalid level filter."),
];

// ==========================================
// 3. Get Program By ID Validation
// ==========================================
export const getProgramValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  query("program_id").notEmpty().withMessage("Validation error — program_id query parameter is required.").matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage("Validation error."),
];

// ==========================================
// 4. Update Program Validation
// ==========================================
export const updateProgramValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  (req: Request, res: Response, next: NextFunction): void => {
    const reqAny = req as any;
    if (reqAny.user?.role === "athlete") {
      return next(new AppError("Forbidden — athletes cannot update programs.", 403));
    }
    next();
  },
  (req: Request, res: Response, next: NextFunction): void => {
    const program_id = req.query.program_id || req.body.program_id;
    if (!program_id) {
      return next(new AppError("Validation error — program_id is required in query or body.", 400));
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(String(program_id))) {
      return next(new AppError("Validation error — Invalid program_id format.", 400));
    }
    next();
  },
  body("duration_weeks").optional().isInt({ gt: 0 }).withMessage("Validation error — duration_weeks must be a positive number."),
  body("sessions_per_week").optional().isInt({ gt: 0 }).withMessage("Validation error — sessions_per_week must be a positive number."),
];

// ==========================================
// 5. Enroll In Program Validation
// ==========================================
export const enrollProgramValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  (req: Request, res: Response, next: NextFunction): void => {
    const reqAny = req as any;
    if (reqAny.user?.role === "coach") {
      return next(new AppError("Forbidden — only coaches can create programs.", 403)); // رسالة الشيت
    }
    next();
  },
  body("program_id").notEmpty().withMessage("Validation error — program_id is required in body.").matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage("Validation error — Invalid program_id format."),
  body("preferred_time").optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage("Invalid preferred_time format. Use HH:MM (e.g., 07:00)."),
  (req: Request, res: Response, next: NextFunction): void => {
    const { baseline_test_values } = req.body;
    if (!baseline_test_values || !Array.isArray(baseline_test_values) || baseline_test_values.length === 0) {
      return next(new AppError("baseline_test_values is required and must be a non-empty array.", 400));
    }
    next();
  },
];

// ==========================================
// 6. Complete Enrollment Validation
// ==========================================
export const completeEnrollmentValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  body("enrollment_id").notEmpty().withMessage("Validation error — enrollment_id is required in body.").matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage("Validation error — Invalid enrollment_id format."),
  (req: Request, res: Response, next: NextFunction): void => {
    const { posttest_test_values } = req.body;
    if (!posttest_test_values || !Array.isArray(posttest_test_values) || posttest_test_values.length === 0) {
      return next(new AppError("posttest_test_values is required and must be a non-empty array.", 400));
    }
    next();
  },
];

// ==========================================
// 7. Rate Program Validation
// ==========================================
export const rateProgramValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  body("program_id").notEmpty().withMessage("Validation error — program_id is required in body.").matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage("Validation error."),
  body("rating").notEmpty().withMessage("Validation error — rating must be 1-5.").isFloat({ min: 1, max: 5 }).withMessage("Validation error — rating must be 1-5."),
];

// ==========================================
// 8. Get My Enrolled Programs Validation
// ==========================================
export const getMyEnrolledProgramsValidation: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[] = [
  (req: Request, res: Response, next: NextFunction): void => {
    const reqAny = req as any;
    if (!reqAny.user || !reqAny.user.sub) {
      return next(new AppError("Unauthorized — Invalid or missing token.", 401));
    }
    next();
  },
];
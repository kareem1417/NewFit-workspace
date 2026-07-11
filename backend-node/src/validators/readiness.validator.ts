import { body, query, ValidationChain } from "express-validator";

export const submitReadinessValidation: ValidationChain[] = [
  body("sleep_hours")
    .isFloat({ min: 0, max: 14 })
    .withMessage("sleep_hours must be between 0 and 14."),

  body("fatigue")
    .isInt({ min: 1, max: 5 })
    .withMessage("fatigue must be between 1 and 5."),

  body("soreness")
    .isInt({ min: 1, max: 5 })
    .withMessage("soreness must be between 1 and 5."),

  body("stress")
    .isInt({ min: 1, max: 5 })
    .withMessage("stress must be between 1 and 5."),

  body("enrollment_id")
    .optional()
    .isUUID()
    .withMessage("enrollment_id must be a valid UUID."),

  body("program_session_id")
    .optional()
    .isUUID()
    .withMessage("program_session_id must be a valid UUID."),
];

export const getReadinessHistoryValidation: ValidationChain[] = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100."),

  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("offset must be a non-negative integer."),
];

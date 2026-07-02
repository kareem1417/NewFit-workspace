import { body, param, ValidationChain } from "express-validator";

// ==========================================
// 1. Ask Question Validation
// ==========================================
export const askQuestionValidation: ValidationChain[] = [
    body("question")
        .notEmpty()
        .withMessage("Validation error — question cannot be empty.")
        .isString()
        .withMessage("Validation error — question must be a string.")
        .isLength({ max: 2000 })
        .withMessage("Validation error — question cannot exceed 2000 characters."),
    body("session_id")
        .optional()
        .isUUID()
        .withMessage("Validation error — session_id must be a valid UUID.")
];

// ==========================================
// 2. Recommend Program Validation
// ==========================================
export const recommendValidation: ValidationChain[] = [
    // Validate potential overrides from the frontend
    body("height_cm").optional().isNumeric(),
    body("weight_kg").optional().isNumeric(),
    body("goal").optional().isString(),
    body("training_days_per_week").optional().isInt({ min: 1, max: 7 }),
    body("years_training").optional().isNumeric(),
    body("has_injury_history").optional().isBoolean(),
    // Scores validation
    body("endurance_score").optional().isNumeric(),
    body("strength_score").optional().isNumeric(),
    body("speed_score").optional().isNumeric(),
    body("flexibility_score").optional().isNumeric(),
    body("explosiveness_score").optional().isNumeric(),
    body("recovery_score").optional().isNumeric(),
];

// ==========================================
// 3. Coach Advice Validation
// ==========================================
export const coachAdviceValidation: ValidationChain[] = [
    body("score").isNumeric().withMessage("Score is required and must be numeric."),
    body("level").isString().notEmpty().withMessage("Level is required."),
    body("weight_class").isString().notEmpty().withMessage("Weight class is required."),
    body("breakdown_percentiles").isObject().withMessage("Breakdown percentiles must be an object."),
    body("raw_values").isObject().withMessage("Raw values must be an object.")
];

// ==========================================
// 4. Session Messages Validation
// ==========================================
export const sessionParamValidation: ValidationChain[] = [
    param("id").isUUID().withMessage("Validation error — invalid session ID format.")
];
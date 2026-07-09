"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionParamValidation = exports.coachAdviceValidation = exports.recommendValidation = exports.askQuestionValidation = void 0;
const express_validator_1 = require("express-validator");
// ==========================================
// 1. Ask Question Validation
// ==========================================
exports.askQuestionValidation = [
    (0, express_validator_1.body)("question")
        .notEmpty()
        .withMessage("Validation error — question cannot be empty.")
        .isString()
        .withMessage("Validation error — question must be a string.")
        .isLength({ max: 2000 })
        .withMessage("Validation error — question cannot exceed 2000 characters."),
    (0, express_validator_1.body)("session_id")
        .optional()
        .isUUID()
        .withMessage("Validation error — session_id must be a valid UUID.")
];
// ==========================================
// 2. Recommend Program Validation
// ==========================================
exports.recommendValidation = [
    // Validate potential overrides from the frontend
    (0, express_validator_1.body)("height_cm").optional().isNumeric(),
    (0, express_validator_1.body)("weight_kg").optional().isNumeric(),
    (0, express_validator_1.body)("goal").optional().isString(),
    (0, express_validator_1.body)("training_days_per_week").optional().isInt({ min: 1, max: 7 }),
    (0, express_validator_1.body)("years_training").optional().isNumeric(),
    (0, express_validator_1.body)("has_injury_history").optional().isBoolean(),
    // Scores validation
    (0, express_validator_1.body)("endurance_score").optional().isNumeric(),
    (0, express_validator_1.body)("strength_score").optional().isNumeric(),
    (0, express_validator_1.body)("speed_score").optional().isNumeric(),
    (0, express_validator_1.body)("flexibility_score").optional().isNumeric(),
    (0, express_validator_1.body)("explosiveness_score").optional().isNumeric(),
    (0, express_validator_1.body)("recovery_score").optional().isNumeric(),
];
// ==========================================
// 3. Coach Advice Validation
// ==========================================
exports.coachAdviceValidation = [
    (0, express_validator_1.body)("score").isNumeric().withMessage("Score is required and must be numeric."),
    (0, express_validator_1.body)("level").isString().notEmpty().withMessage("Level is required."),
    (0, express_validator_1.body)("weight_class").isString().notEmpty().withMessage("Weight class is required."),
    (0, express_validator_1.body)("breakdown_percentiles").isObject().withMessage("Breakdown percentiles must be an object."),
    (0, express_validator_1.body)("raw_values").isObject().withMessage("Raw values must be an object.")
];
// ==========================================
// 4. Session Messages Validation
// ==========================================
exports.sessionParamValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid session ID format.")
];

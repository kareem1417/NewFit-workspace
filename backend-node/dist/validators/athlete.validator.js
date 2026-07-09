"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeOnboardingValidation = exports.sportIdParamValidation = exports.getMyEnrollmentsValidation = exports.progressValidation = exports.radarValidation = exports.getSnapshotsValidation = exports.createSnapshotValidation = exports.upsertMetricsValidation = exports.updateSportProfileValidation = exports.createSportProfileValidation = exports.idParamValidation = void 0;
const express_validator_1 = require("express-validator");
// 📌 التعديل هنا: استوردنا player_category بدل weight_class
const client_1 = require("@prisma/client");
// ==========================================
// Reusable ID Param Validator (For Deletes)
// ==========================================
exports.idParamValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Invalid ID format (must be a valid UUID)."),
];
// ==========================================
// Reusable Pagination & Generic Validators
// ==========================================
const paginationValidation = [
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Limit must be a positive integer."),
    (0, express_validator_1.query)("offset")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Offset must be a non-negative integer."),
];
// 📌 التعديل هنا: غيرنا اسم المتغير والـ query parameter والـ Enum
const levelAndCategoryQueryValidation = [
    (0, express_validator_1.query)("level")
        .optional()
        .isIn(Object.values(client_1.competitive_level))
        .withMessage("Invalid competitive level."),
    (0, express_validator_1.query)("player_category")
        .optional()
        .isIn(Object.values(client_1.player_category))
        .withMessage("Invalid player category."),
];
// ==========================================
// 1. Sport Profile Validation
// ==========================================
exports.createSportProfileValidation = [
    (0, express_validator_1.body)("sport_id")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Sport ID must be a valid integer."),
    (0, express_validator_1.body)("level")
        .notEmpty()
        .withMessage("Competitive level is required.")
        .isIn(Object.values(client_1.competitive_level))
        .withMessage("Invalid competitive level."),
    // 📌 التعديل هنا
    (0, express_validator_1.body)("player_category")
        .notEmpty()
        .withMessage("Player category is required.")
        .isIn(Object.values(client_1.player_category))
        .withMessage("Invalid player category."),
    (0, express_validator_1.body)("is_primary")
        .optional()
        .isBoolean()
        .withMessage("is_primary must be a boolean."),
];
exports.updateSportProfileValidation = [
    (0, express_validator_1.body)("level")
        .optional()
        .isIn(Object.values(client_1.competitive_level))
        .withMessage("Invalid competitive level."),
    // 📌 التعديل هنا
    (0, express_validator_1.body)("player_category")
        .optional()
        .isIn(Object.values(client_1.player_category))
        .withMessage("Invalid player category."),
];
// ==========================================
// 2. User Metrics Validation
// ==========================================
exports.upsertMetricsValidation = [
    (0, express_validator_1.body)("height_cm")
        .isNumeric()
        .withMessage("Height (cm) is required and must be a number."),
    (0, express_validator_1.body)("weight_kg")
        .isNumeric()
        .withMessage("Weight (kg) is required and must be a number."),
    (0, express_validator_1.body)("goal")
        .notEmpty()
        .withMessage("Goal is required.")
        .isIn(Object.values(client_1.user_goal_enum))
        .withMessage("Invalid goal type."),
    (0, express_validator_1.body)("training_days_per_week")
        .isInt({ min: 1, max: 7 })
        .withMessage("Training days per week must be between 1 and 7."),
    (0, express_validator_1.body)("years_training")
        .isNumeric()
        .withMessage("Years training must be a number."),
    (0, express_validator_1.body)("has_injury_history")
        .optional()
        .isBoolean()
        .withMessage("Injury history must be a boolean."),
    // Scores
    (0, express_validator_1.body)("endurance_score")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Score must be between 1 and 10."),
    (0, express_validator_1.body)("strength_score")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Score must be between 1 and 10."),
    (0, express_validator_1.body)("speed_score")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Score must be between 1 and 10."),
    (0, express_validator_1.body)("flexibility_score")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Score must be between 1 and 10."),
    (0, express_validator_1.body)("explosiveness_score")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Score must be between 1 and 10."),
    (0, express_validator_1.body)("recovery_score")
        .optional()
        .isInt({ min: 1, max: 10 })
        .withMessage("Score must be between 1 and 10."),
];
// ==========================================
// 3. Snapshots Validation
// ==========================================
exports.createSnapshotValidation = [
    (0, express_validator_1.body)("sport_id")
        .optional()
        .isInt()
        .withMessage("Sport ID must be an integer."),
    (0, express_validator_1.body)("snapshot_type")
        .optional()
        .isIn(Object.values(client_1.snapshot_type))
        .withMessage("Invalid snapshot type."),
    (0, express_validator_1.body)("program_enrollment_id")
        .optional()
        .isUUID()
        .withMessage("Invalid enrollment ID (must be UUID)."),
    (0, express_validator_1.body)("notes")
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage("Notes cannot exceed 500 characters."),
    (0, express_validator_1.body)("test_values")
        .isArray({ min: 1 })
        .withMessage("test_values array is required."),
    (0, express_validator_1.body)("test_values.*.attribute_test_id")
        .isInt()
        .withMessage("Each test value must have a valid attribute_test_id."),
    (0, express_validator_1.body)("test_values.*.value")
        .isNumeric()
        .withMessage("Each test value must have a numeric 'value'."),
];
exports.getSnapshotsValidation = [
    (0, express_validator_1.query)("type")
        .optional()
        .isIn(Object.values(client_1.snapshot_type))
        .withMessage("Invalid snapshot type query."),
    ...paginationValidation,
];
// ==========================================
// 4. Analytics & Progress Validation
// ==========================================
exports.radarValidation = [
    // 📌 التعديل هنا: غيرنا اسم الـ Array اللي بيعمل Spread
    ...levelAndCategoryQueryValidation,
];
exports.progressValidation = [
    (0, express_validator_1.query)("attribute_test_id")
        .notEmpty()
        .withMessage("attribute_test_id query parameter is required.")
        .isInt({ min: 1 })
        .withMessage("Invalid attribute_test_id."),
];
// ==========================================
// 5. Enrollments Validation
// ==========================================
exports.getMyEnrollmentsValidation = [
    (0, express_validator_1.query)("status")
        .optional()
        .isIn(Object.values(client_1.enrollment_status))
        .withMessage("Invalid enrollment status."),
];
// ==========================================
// Reusable Sport ID Param Validator
// ==========================================
exports.sportIdParamValidation = [
    (0, express_validator_1.param)("sport_id")
        .isInt({ min: 1 })
        .withMessage("Sport ID must be a valid positive integer."),
];
// ==========================================
// 6. Onboarding Validation
// ==========================================
exports.completeOnboardingValidation = [
    (0, express_validator_1.body)("sport_id")
        .isInt({ min: 1 })
        .withMessage("sport_id must be a valid integer."),
    (0, express_validator_1.body)("level")
        .notEmpty()
        .withMessage("level is required.")
        .isIn(Object.values(client_1.competitive_level))
        .withMessage("Invalid competitive level."),
    // 📌 التعديل هنا
    (0, express_validator_1.body)("player_category")
        .notEmpty()
        .withMessage("player_category is required.")
        .isIn(Object.values(client_1.player_category))
        .withMessage("Invalid player category."),
    (0, express_validator_1.body)("test_values")
        .isArray({ min: 1 })
        .withMessage("test_values array is required."),
    (0, express_validator_1.body)("test_values.*.attribute_test_id")
        .isInt()
        .withMessage("Each test value must have a valid attribute_test_id."),
    (0, express_validator_1.body)("test_values.*.value")
        .isNumeric()
        .withMessage("Each test value must have a numeric 'value'."),
    (0, express_validator_1.body)("test_values.*.unit")
        .optional()
        .isString()
        .withMessage("Unit must be a string."),
];

import { body, query, param, ValidationChain } from "express-validator";
import { user_goal_enum, competitive_level, weight_class, snapshot_type, enrollment_status } from "@prisma/client";

// ==========================================
// Reusable ID Param Validator (For Deletes)
// ==========================================
export const idParamValidation: ValidationChain[] = [
  param("id").isUUID().withMessage("Invalid ID format (must be a valid UUID).")
];

// ==========================================
// Reusable Pagination & Generic Validators
// ==========================================
const paginationValidation = [
  query("limit").optional().isInt({ min: 1 }).withMessage("Limit must be a positive integer."),
  query("offset").optional().isInt({ min: 0 }).withMessage("Offset must be a non-negative integer.")
];

const levelAndWeightQueryValidation = [
  query("level").optional().isIn(Object.values(competitive_level)).withMessage("Invalid competitive level."),
  query("weight_class").optional().isIn(Object.values(weight_class)).withMessage("Invalid weight class.")
];

// ==========================================
// 1. Sport Profile Validation
// ==========================================
export const createSportProfileValidation: ValidationChain[] = [
  body("sport_id").optional().isInt({ min: 1 }).withMessage("Sport ID must be a valid integer."),
  body("level").notEmpty().withMessage("Competitive level is required.").isIn(Object.values(competitive_level)).withMessage("Invalid competitive level."),
  body("weight_class").notEmpty().withMessage("Weight class is required.").isIn(Object.values(weight_class)).withMessage("Invalid weight class."),
  body("is_primary").optional().isBoolean().withMessage("is_primary must be a boolean.")
];

export const updateSportProfileValidation: ValidationChain[] = [
  body("level").optional().isIn(Object.values(competitive_level)).withMessage("Invalid competitive level."),
  body("weight_class").optional().isIn(Object.values(weight_class)).withMessage("Invalid weight class.")
];

// ==========================================
// 2. User Metrics Validation
// ==========================================
export const upsertMetricsValidation: ValidationChain[] = [
  body("height_cm").isNumeric().withMessage("Height (cm) is required and must be a number."),
  body("weight_kg").isNumeric().withMessage("Weight (kg) is required and must be a number."),
  body("goal").notEmpty().withMessage("Goal is required.").isIn(Object.values(user_goal_enum)).withMessage("Invalid goal type."),
  body("training_days_per_week").isInt({ min: 1, max: 7 }).withMessage("Training days per week must be between 1 and 7."),
  body("years_training").isNumeric().withMessage("Years training must be a number."),
  body("has_injury_history").optional().isBoolean().withMessage("Injury history must be a boolean."),
  // Scores
  body("endurance_score").optional().isNumeric(),
  body("strength_score").optional().isNumeric(),
  body("speed_score").optional().isNumeric(),
  body("flexibility_score").optional().isNumeric(),
  body("explosiveness_score").optional().isNumeric(),
  body("recovery_score").optional().isNumeric(),
];

// ==========================================
// 3. Snapshots Validation
// ==========================================
export const createSnapshotValidation: ValidationChain[] = [
  body("sport_id").optional().isInt().withMessage("Sport ID must be an integer."),
  body("snapshot_type").optional().isIn(Object.values(snapshot_type)).withMessage("Invalid snapshot type."),
  body("program_enrollment_id").optional().isUUID().withMessage("Invalid enrollment ID (must be UUID)."),
  body("notes").optional().isString().isLength({ max: 500 }).withMessage("Notes cannot exceed 500 characters."),
  body("test_values").isArray({ min: 1 }).withMessage("test_values array is required."),
  body("test_values.*.attribute_test_id").isInt().withMessage("Each test value must have a valid attribute_test_id."),
  body("test_values.*.value").isNumeric().withMessage("Each test value must have a numeric 'value'.")
];

export const getSnapshotsValidation: ValidationChain[] = [
  query("type").optional().isIn(Object.values(snapshot_type)).withMessage("Invalid snapshot type query."),
  ...paginationValidation
];

// ==========================================
// 4. Analytics & Progress Validation
// ==========================================
export const radarValidation: ValidationChain[] = [
  ...levelAndWeightQueryValidation
];

export const progressValidation: ValidationChain[] = [
  query("attribute_test_id").notEmpty().withMessage("attribute_test_id query parameter is required.").isInt({ min: 1 }).withMessage("Invalid attribute_test_id.")
];

// ==========================================
// 5. Enrollments Validation
// ==========================================
export const getMyEnrollmentsValidation: ValidationChain[] = [
  query("status").optional().isIn(Object.values(enrollment_status)).withMessage("Invalid enrollment status.")
];
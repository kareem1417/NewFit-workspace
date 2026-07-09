"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoryValidation = exports.postLogValidation = exports.getNextWorkoutValidation = void 0;
const express_validator_1 = require("express-validator");
const AppError_1 = require("../utils/AppError");
// ==========================================
// Reusable Pagination Validator
// ==========================================
const paginationValidation = [
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1 }).withMessage("Validation error — limit must be a positive integer."),
    (0, express_validator_1.query)("offset").optional().isInt({ min: 0 }).withMessage("Validation error — offset must be a non-negative integer.")
];
// ==========================================
// 1. Get Next Workout Validation
// ==========================================
exports.getNextWorkoutValidation = [
    (req, res, next) => {
        const enrollment_id = req.query.enrollment_id;
        if (enrollment_id && typeof enrollment_id === "string") {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(enrollment_id)) {
                // 🎯 التعديل: رمي AppError بدل res.status
                return next(new AppError_1.AppError("Enrollment not found.", 404));
            }
        }
        next();
    },
];
// ==========================================
// 2. Post Log Validation
// ==========================================
exports.postLogValidation = [
    (0, express_validator_1.body)("enrollment_id")
        .notEmpty()
        .withMessage("Validation error."),
    (0, express_validator_1.body)("session_id")
        .notEmpty()
        .withMessage("Validation error."),
    (req, res, next) => {
        const { enrollment_id, session_id, completed_at } = req.body;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (enrollment_id && session_id) {
            if (!uuidRegex.test(enrollment_id) || !uuidRegex.test(session_id)) {
                return next(new AppError_1.AppError("Validation error.", 400));
            }
        }
        if (completed_at) {
            const logDate = new Date(completed_at);
            const now = new Date();
            if (isNaN(logDate.getTime()) || logDate.getTime() > now.getTime() + 5000) {
                return next(new AppError_1.AppError("Cannot log a workout in the future.", 400));
            }
        }
        next();
    },
];
// ==========================================
// 3. Get Workout History Validation
// ==========================================
exports.getHistoryValidation = [
    (req, res, next) => {
        const queryEnrollmentId = req.query.enrollment_id;
        if (queryEnrollmentId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(queryEnrollmentId)) {
                return next(new AppError_1.AppError("Enrollment not found.", 404));
            }
        }
        next();
    },
    // 🎯 التعديل: إضافة الـ Pagination هنا
    ...paginationValidation
];

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncSearchValidation = exports.searchValidation = void 0;
const express_validator_1 = require("express-validator");
const AppError_1 = require("../utils/AppError");
// ==========================================
// 1. Search Query Validation
// ==========================================
exports.searchValidation = [
    (0, express_validator_1.query)("q")
        .notEmpty()
        .withMessage("Validation error — q cannot be empty or missing.")
        .isString()
        .withMessage("Validation error — q must be a string."),
    (0, express_validator_1.query)("type")
        .optional()
        .isIn(["all", "users", "programs", "posts"])
        .withMessage("Validation error — invalid type provided. Allowed types are: all, users, programs, posts."),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Validation error — limit must be a positive integer."),
    (0, express_validator_1.query)("offset")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Validation error — offset must be a non-negative integer.")
];
// ==========================================
// 2. Sync Search Validation (Admin Only)
// ==========================================
exports.syncSearchValidation = [
    (req, res, next) => {
        const reqAny = req;
        // التأكد من وجود التوكن وأن الـ Role هو أدمن (بندعم الحروف الكبيرة والصغيرة عشان الأمان)
        if (!reqAny.user || (reqAny.user.role !== "ADMIN" && reqAny.user.role !== "admin")) {
            return next(new AppError_1.AppError("Forbidden — admin only.", 403));
        }
        next();
    }
];

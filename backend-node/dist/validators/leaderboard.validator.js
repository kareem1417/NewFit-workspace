"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mostImprovedValidation = exports.getLeaderboardValidation = void 0;
const express_validator_1 = require("express-validator");
const client_1 = require("@prisma/client"); // 📌 التعديل هنا
// ==========================================
// Reusable Pagination Validator
// ==========================================
const paginationValidation = [
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Validation error — limit must be a positive integer."),
    (0, express_validator_1.query)("offset")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Validation error — offset must be a non-negative integer."),
];
// ==========================================
// 1. Get Leaderboard Validation
// ==========================================
exports.getLeaderboardValidation = [
    (0, express_validator_1.query)("type")
        .notEmpty()
        .withMessage("Validation error — invalid leaderboard type.")
        .isIn(["punch_power", "strength", "endurance"])
        .withMessage("Validation error — invalid leaderboard type."),
    (0, express_validator_1.query)("player_category") // 📌 التعديل هنا
        .optional()
        .isIn(Object.values(client_1.player_category))
        .withMessage("Invalid player_category parameter."),
    (0, express_validator_1.query)("level")
        .optional()
        .isIn(Object.values(client_1.competitive_level))
        .withMessage("Invalid level parameter."),
    ...paginationValidation,
];
// ==========================================
// 2. Most Improved Validation
// ==========================================
exports.mostImprovedValidation = [
    (0, express_validator_1.query)("player_category") // 📌 التعديل هنا
        .optional()
        .isIn(Object.values(client_1.player_category))
        .withMessage("Invalid player_category parameter."),
    (0, express_validator_1.query)("level")
        .optional()
        .isIn(Object.values(client_1.competitive_level))
        .withMessage("Invalid level parameter."),
    ...paginationValidation,
];

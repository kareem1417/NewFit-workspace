"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leaderboards_controller_1 = require("../controllers/leaderboards.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const leaderboard_validator_1 = require("../validators/leaderboard.validator");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const router = (0, express_1.Router)();
// // Fetch leaderboard route
// router.get('/:type', authenticateToken, getLeaderboard);
router.get("/get_leaderboard", auth_middleware_1.authenticateToken, leaderboard_validator_1.getLeaderboardValidation, validation_middleware_1.validate, leaderboards_controller_1.getLeaderboard);
// 🎯 GET /api/leaderboard/most_improved
router.get("/most_improved", auth_middleware_1.authenticateToken, leaderboard_validator_1.mostImprovedValidation, validation_middleware_1.validate, leaderboards_controller_1.getMostImproved);
exports.default = router;

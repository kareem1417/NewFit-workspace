"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leaderboards_controller_1 = require("../controllers/leaderboards.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Fetch leaderboard route
router.get('/:type', auth_middleware_1.authenticateToken, leaderboards_controller_1.getLeaderboard);
exports.default = router;

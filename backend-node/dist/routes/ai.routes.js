"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_controller_1 = require("../controllers/ai.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// ==========================================
// --- AI & Machine Learning Routes ---
// ==========================================
// Protected routes, user must be logged in
router.post('/ask', auth_middleware_1.authenticateToken, ai_controller_1.askQuestion);
router.post('/recommend', auth_middleware_1.authenticateToken, ai_controller_1.recommendProgram);
router.post('/coach', auth_middleware_1.authenticateToken, ai_controller_1.getCoachAdvice);
// ==========================================
// --- Chat Sessions Management Routes ---
// ==========================================
router.get('/sessions', auth_middleware_1.authenticateToken, ai_controller_1.getSessions);
router.get('/sessions/:id/messages', auth_middleware_1.authenticateToken, ai_controller_1.getSessionMessages);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const athlete_controller_1 = require("../controllers/athlete.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// ==========================================
// 1. Sport Profiles
// ==========================================
router.post('/sport-profile', auth_middleware_1.authenticateToken, athlete_controller_1.createSportProfile);
router.patch('/sport-profile', auth_middleware_1.authenticateToken, athlete_controller_1.updateSportProfile);
// ==========================================
// 2. Physical Snapshots
// ==========================================
router.post('/snapshots', auth_middleware_1.authenticateToken, athlete_controller_1.createSnapshot);
router.get('/snapshots', auth_middleware_1.authenticateToken, athlete_controller_1.getSnapshots);
// ==========================================
// 3. Analytics & Progress Tracking
// ==========================================
router.get('/radar', auth_middleware_1.authenticateToken, athlete_controller_1.getRadarData);
router.get('/progress/:attributeTestId', auth_middleware_1.authenticateToken, athlete_controller_1.getProgress);
// ==========================================
// 4. Program Enrollments
// ==========================================
router.get('/enrollments', auth_middleware_1.authenticateToken, athlete_controller_1.getMyEnrollments);
exports.default = router;

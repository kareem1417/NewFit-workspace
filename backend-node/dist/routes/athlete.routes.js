"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const athlete_controller_1 = require("../controllers/athlete.controller");
const athlete_validator_1 = require("../validators/athlete.validator");
const router = (0, express_1.Router)();
// =======================================================
// Sports (Public)
// =======================================================
router.get("/sports", athlete_controller_1.getSportsList);
router.get("/sports/:sport_id/categories", athlete_validator_1.sportIdParamValidation, validation_middleware_1.validate, athlete_controller_1.getSportCategories);
router.get("/sports/:sport_id/tests", athlete_validator_1.sportIdParamValidation, validation_middleware_1.validate, athlete_controller_1.getSportBaselineTests);
// =======================================================
// Onboarding
// =======================================================
router.post("/onboarding", auth_middleware_1.authenticateToken, athlete_validator_1.completeOnboardingValidation, validation_middleware_1.validate, athlete_controller_1.completeOnboarding);
router.get("/onboarding/status", auth_middleware_1.authenticateToken, athlete_controller_1.getOnboardingStatus);
// =======================================================
// Dashboard
// =======================================================
router.get("/dashboard", auth_middleware_1.authenticateToken, athlete_controller_1.getAthleteDashboard);
// =======================================================
// Sport Profile
// =======================================================
router.post("/sport-profile", auth_middleware_1.authenticateToken, athlete_validator_1.createSportProfileValidation, validation_middleware_1.validate, athlete_controller_1.createSportProfile);
router.get("/sport-profile", auth_middleware_1.authenticateToken, athlete_controller_1.getSportProfile);
router.patch("/sport-profile", auth_middleware_1.authenticateToken, athlete_validator_1.updateSportProfileValidation, validation_middleware_1.validate, athlete_controller_1.updateSportProfile);
router.delete("/sport-profile/:id", auth_middleware_1.authenticateToken, athlete_validator_1.idParamValidation, validation_middleware_1.validate, athlete_controller_1.deleteSportProfile);
// =======================================================
// Metrics
// =======================================================
router.post("/metrics", auth_middleware_1.authenticateToken, athlete_validator_1.upsertMetricsValidation, validation_middleware_1.validate, athlete_controller_1.upsertUserMetrics);
router.get("/metrics", auth_middleware_1.authenticateToken, athlete_controller_1.getUserMetrics);
router.delete("/metrics", auth_middleware_1.authenticateToken, athlete_controller_1.deleteUserMetrics);
// =======================================================
// Snapshots
// =======================================================
router.post("/snapshots", auth_middleware_1.authenticateToken, athlete_validator_1.createSnapshotValidation, validation_middleware_1.validate, athlete_controller_1.createSnapshot);
router.get("/snapshots", auth_middleware_1.authenticateToken, athlete_validator_1.getSnapshotsValidation, validation_middleware_1.validate, athlete_controller_1.getSnapshots);
router.get("/snapshots/latest", auth_middleware_1.authenticateToken, athlete_controller_1.getLatestSnapshot);
router.delete("/snapshots/:id", auth_middleware_1.authenticateToken, athlete_validator_1.idParamValidation, validation_middleware_1.validate, athlete_controller_1.deleteSnapshot);
// =======================================================
// Analytics
// =======================================================
router.get("/radar", auth_middleware_1.authenticateToken, athlete_validator_1.radarValidation, validation_middleware_1.validate, athlete_controller_1.getRadarData);
router.get("/progress", auth_middleware_1.authenticateToken, athlete_validator_1.progressValidation, validation_middleware_1.validate, athlete_controller_1.getProgress);
// =======================================================
// Enrollments
// =======================================================
router.get("/enrollments", auth_middleware_1.authenticateToken, athlete_validator_1.getMyEnrollmentsValidation, validation_middleware_1.validate, athlete_controller_1.getMyEnrollments);
exports.default = router;

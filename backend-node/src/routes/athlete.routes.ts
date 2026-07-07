import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";

import {
  createSportProfile,
  getSportProfile,
  updateSportProfile,
  deleteSportProfile,
  upsertUserMetrics,
  getUserMetrics,
  deleteUserMetrics,
  getSportBaselineTests,
  createSnapshot,
  getSnapshots,
  getLatestSnapshot,
  deleteSnapshot,
  getRadarData,
  getProgress,
  getMyEnrollments,
  getSportsList,
  getSportCategories,
  completeOnboarding,
  getOnboardingStatus,
  getAthleteDashboard,
} from "../controllers/athlete.controller";

import {
  createSportProfileValidation,
  updateSportProfileValidation,
  upsertMetricsValidation,
  createSnapshotValidation,
  getSnapshotsValidation,
  radarValidation,
  progressValidation,
  getMyEnrollmentsValidation,
  idParamValidation,
  sportIdParamValidation,
  completeOnboardingValidation,
} from "../validators/athlete.validator";

const router = Router();

// =======================================================
// Sports (Public)
// =======================================================

router.get("/sports", getSportsList);

router.get(
  "/sports/:sport_id/categories",
  sportIdParamValidation,
  validate,
  getSportCategories,
);

router.get(
  "/sports/:sport_id/tests",
  sportIdParamValidation,
  validate,
  getSportBaselineTests,
);

// =======================================================
// Onboarding
// =======================================================

router.post(
  "/onboarding",
  authenticateToken,
  completeOnboardingValidation,
  validate,
  completeOnboarding,
);

router.get("/onboarding/status", authenticateToken, getOnboardingStatus);

// =======================================================
// Dashboard
// =======================================================

router.get("/dashboard", authenticateToken, getAthleteDashboard);

// =======================================================
// Sport Profile
// =======================================================

router.post(
  "/sport-profile",
  authenticateToken,
  createSportProfileValidation,
  validate,
  createSportProfile,
);

router.get("/sport-profile", authenticateToken, getSportProfile);

router.patch(
  "/sport-profile",
  authenticateToken,
  updateSportProfileValidation,
  validate,
  updateSportProfile,
);

router.delete(
  "/sport-profile/:id",
  authenticateToken,
  idParamValidation,
  validate,
  deleteSportProfile,
);

// =======================================================
// Metrics
// =======================================================

router.post(
  "/metrics",
  authenticateToken,
  upsertMetricsValidation,
  validate,
  upsertUserMetrics,
);

router.get("/metrics", authenticateToken, getUserMetrics);

router.delete("/metrics", authenticateToken, deleteUserMetrics);

// =======================================================
// Snapshots
// =======================================================

router.post(
  "/snapshots",
  authenticateToken,
  createSnapshotValidation,
  validate,
  createSnapshot,
);

router.get(
  "/snapshots",
  authenticateToken,
  getSnapshotsValidation,
  validate,
  getSnapshots,
);

router.get("/snapshots/latest", authenticateToken, getLatestSnapshot);

router.delete(
  "/snapshots/:id",
  authenticateToken,
  idParamValidation,
  validate,
  deleteSnapshot,
);

// =======================================================
// Analytics
// =======================================================

router.get(
  "/radar",
  authenticateToken,
  radarValidation,
  validate,
  getRadarData,
);

router.get(
  "/progress",
  authenticateToken,
  progressValidation,
  validate,
  getProgress,
);

// =======================================================
// Enrollments
// =======================================================

router.get(
  "/enrollments",
  authenticateToken,
  getMyEnrollmentsValidation,
  validate,
  getMyEnrollments,
);

export default router;

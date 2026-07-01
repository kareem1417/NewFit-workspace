import { Router } from "express";
import {
  createSportProfile,
  updateSportProfile,
  createSnapshot,
  getSnapshots,
  getRadarData,
  getProgress,
  getMyEnrollments,
  upsertUserMetrics,
} from "../controllers/athlete.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  createSnapshotValidation,
  createSportProfileValidation,
  getMyEnrollmentsValidation,
  getProgressValidation,
  getRadarDataValidation,
  getSnapshotsValidation,
  updateSportProfileValidation,
} from "../validators/athlete.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();

// ==========================================
// 1. Sport Profiles // done
// ==========================================
router.post(
  "/sport-profile",
  authenticateToken,
  createSportProfileValidation,
  validate,
  createSportProfile,
);
router.patch(
  "/sport-profile",
  authenticateToken,
  updateSportProfileValidation,
  validate,
  updateSportProfile,
);

// ==========================================
// 2. Physical Snapshots // done
// ==========================================
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

// ==========================================
// 3. Analytics & Progress Tracking
// ==========================================
router.get(
  "/radar",
  authenticateToken,
  getRadarDataValidation,
  validate,
  getRadarData,
);
// router.get('/progress/:attributeTestId', authenticateToken,getProgressValidation,validate, getProgress);
router.get("/progress", authenticateToken, getProgressValidation, getProgress);

// ==========================================
// 4. Program Enrollments
// ==========================================
router.get(
  "/enrollments",
  authenticateToken,
  getMyEnrollmentsValidation,
  validate,
  getMyEnrollments,
);

router.patch("/metrics", authenticateToken, upsertUserMetrics); // new athlete function required for the AI Mode

export default router;

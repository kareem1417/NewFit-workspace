import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
    createSportProfile, updateSportProfile, getSportProfile, deleteSportProfile,
    upsertUserMetrics, getUserMetrics, deleteUserMetrics,
    createSnapshot, getSnapshots, deleteSnapshot,
    getRadarData, getProgress, getMyEnrollments, getSportBaselineTests,
    getSportsList, getOnboardingStatus, completeOnboarding
} from '../controllers/athlete.controller';
import {
    createSportProfileValidation, updateSportProfileValidation, upsertMetricsValidation,
    createSnapshotValidation, getSnapshotsValidation, radarValidation,
    progressValidation, getMyEnrollmentsValidation, idParamValidation, sportIdParamValidation, completeOnboardingValidation
} from '../validators/athlete.validator';

const router = Router();

// ==========================================
// Sport Profile Routes
// ==========================================
router.get('/profile', authenticateToken, getSportProfile);
router.post('/profile', authenticateToken, createSportProfileValidation, validate, createSportProfile);
router.patch('/profile', authenticateToken, updateSportProfileValidation, validate, updateSportProfile);
router.delete('/profile/:id', authenticateToken, idParamValidation, validate, deleteSportProfile);

// ==========================================
// User Metrics Routes
// ==========================================
router.get('/metrics', authenticateToken, getUserMetrics);
router.post('/metrics', authenticateToken, upsertMetricsValidation, validate, upsertUserMetrics);
router.delete('/metrics', authenticateToken, deleteUserMetrics);

// ==========================================
// Snapshots Routes
// ==========================================
router.post('/snapshots', authenticateToken, createSnapshotValidation, validate, createSnapshot);
router.get('/snapshots', authenticateToken, getSnapshotsValidation, validate, getSnapshots);
router.delete('/snapshots/:id', authenticateToken, idParamValidation, validate, deleteSnapshot);

// ==========================================
// Analytics & Enrollments Routes
// ==========================================
router.get('/radar', authenticateToken, radarValidation, validate, getRadarData);
router.get('/progress', authenticateToken, progressValidation, validate, getProgress);
router.get('/enrollments', authenticateToken, getMyEnrollmentsValidation, validate, getMyEnrollments);
/////////////// 
router.get('/baseline-tests/:sport_id', authenticateToken, sportIdParamValidation, validate, getSportBaselineTests);
// ==========================================
// Onboarding Routes (NEW)
// ==========================================
router.get('/sports', getSportsList);
router.get('/onboarding/status', authenticateToken, getOnboardingStatus);
router.post('/onboarding/complete', authenticateToken, completeOnboarding);

// ==========================================
// Protected Routes (تتطلب إكمال الـ Onboarding)
// ==========================================
// هتستخدم الـ Middleware الجديد عشان تمنع الوصول لو مكملش
// router.get('/programs/recommended', authenticateToken, requireOnboarding, getRecommendedPrograms);
// router.post('/enroll', authenticateToken, requireOnboarding, enrollInProgram);
export default router;
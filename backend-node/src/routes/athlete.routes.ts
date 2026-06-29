import { Router } from 'express';
import {
    createSportProfile,
    updateSportProfile,
    createSnapshot,
    getSnapshots,
    getRadarData,
    getProgress,
    getMyEnrollments
} from '../controllers/athlete.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { createSnapshotValidation, createSportProfileValidation, updateSportProfileValidation } from '../validators/athlete.validator';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// ==========================================
// 1. Sport Profiles // done 
// ==========================================
router.post('/sport-profile', authenticateToken,createSportProfileValidation,validate, createSportProfile);
router.patch('/sport-profile', authenticateToken,updateSportProfileValidation,validate, updateSportProfile);

// ==========================================
// 2. Physical Snapshots
// ==========================================
router.post('/snapshots', authenticateToken,createSnapshotValidation,validate, createSnapshot);
router.get('/snapshots', authenticateToken, getSnapshots);

// ==========================================
// 3. Analytics & Progress Tracking
// ==========================================
router.get('/radar', authenticateToken, getRadarData);
router.get('/progress/:attributeTestId', authenticateToken, getProgress);

// ==========================================
// 4. Program Enrollments
// ==========================================
router.get('/enrollments', authenticateToken, getMyEnrollments);

export default router;
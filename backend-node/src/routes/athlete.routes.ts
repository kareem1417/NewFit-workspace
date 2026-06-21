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

const router = Router();

// ==========================================
// 1. Sport Profiles
// ==========================================
router.post('/sport-profile', authenticateToken, createSportProfile);
router.patch('/sport-profile', authenticateToken, updateSportProfile);

// ==========================================
// 2. Physical Snapshots
// ==========================================
router.post('/snapshots', authenticateToken, createSnapshot);
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
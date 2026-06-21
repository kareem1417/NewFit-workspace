import { Router } from 'express';
import { askQuestion, recommendProgram, getCoachAdvice, getSessions, getSessionMessages } from '../controllers/ai.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// ==========================================
// --- AI & Machine Learning Routes ---
// ==========================================
// Protected routes, user must be logged in
router.post('/ask', authenticateToken, askQuestion);
router.post('/recommend', authenticateToken, recommendProgram);
router.post('/coach', authenticateToken, getCoachAdvice);

// ==========================================
// --- Chat Sessions Management Routes ---
// ==========================================
router.get('/sessions', authenticateToken, getSessions);
router.get('/sessions/:id/messages', authenticateToken, getSessionMessages);

export default router;
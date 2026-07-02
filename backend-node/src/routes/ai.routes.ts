import { Router } from 'express';
import { askQuestion, recommendProgram, getCoachAdvice, getSessions, getSessionMessages } from '../controllers/ai.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { askQuestionValidation, recommendValidation, coachAdviceValidation, sessionParamValidation } from '../validators/ai.validator';

const router = Router();

// ==========================================
// --- AI & Machine Learning Routes ---
// ==========================================
router.post('/ask', authenticateToken, askQuestionValidation, validate, askQuestion);
router.post('/recommend', authenticateToken, recommendValidation, validate, recommendProgram);
router.post('/coach', authenticateToken, coachAdviceValidation, validate, getCoachAdvice);

// ==========================================
// --- Chat Sessions Management Routes ---
// ==========================================
router.get('/sessions', authenticateToken, getSessions);
router.get('/sessions/:id/messages', authenticateToken, sessionParamValidation, validate, getSessionMessages);

export default router;
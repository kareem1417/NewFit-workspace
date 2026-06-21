import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboards.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Fetch leaderboard route
router.get('/:type', authenticateToken, getLeaderboard);

export default router;
import { Router } from 'express';
import { search, syncSearchVectors } from '../controllers/search.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Search routes
router.get('/', authenticateToken, search);
router.post('/sync', authenticateToken, syncSearchVectors);

export default router;
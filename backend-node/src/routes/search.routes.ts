import { Router } from 'express';
import { search, syncSearchVectors } from '../controllers/search.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { searchValidation, syncSearchValidation } from '../validators/search.validator';

const router = Router();

// 🎯 Search routes with Validations
router.get('/', authenticateToken, searchValidation, validate, search);

// 🎯 Sync route strictly protected for Admins
router.post('/sync', authenticateToken, syncSearchValidation, validate, syncSearchVectors);

export default router;
// ==========================================
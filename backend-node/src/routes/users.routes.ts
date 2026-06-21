import { Router } from 'express';
import { getMe, updateMe, uploadPhoto, getPublicProfile, deactivateAccount } from '../controllers/users.controller';
import { authenticateToken } from '../middlewares/auth.middleware'; // Authentication middleware
import { uploadProfilePhoto } from '../middlewares/upload.middleware'; // Multer upload middleware

const router = Router();

// User Profile Routes
router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken, updateMe);
router.post('/me/photo', authenticateToken, uploadProfilePhoto.single('photo'), uploadPhoto);
router.get('/:id', authenticateToken, getPublicProfile);
router.patch('/me/deactivate', authenticateToken, deactivateAccount);
export default router;
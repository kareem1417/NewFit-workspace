import { Router, Response } from 'express';
import { register, login, refresh, logout } from '../controllers/auth.controller';
import { authenticateToken, AuthRequest } from '../middlewares/auth.middleware';

const router = Router();

// Public routes (Registration and Login)
router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);

// Protected route (Requires valid token)
router.get('/profile', authenticateToken, (req: AuthRequest, res: Response) => {
    // The user ID is accessible here since the user passed through the auth middleware
    res.status(200).json({
        message: 'Welcome to your protected profile!',
        userId: req.user?.sub
    });
});
router.post('/refresh', refresh);

export default router;
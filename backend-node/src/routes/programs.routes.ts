import { Router } from 'express';
import {
    createProgram,
    listPrograms,
    getProgramById,
    updateProgram,
    deleteProgram,
    enrollInProgram,
    completeEnrollment,
    rateProgram
} from '../controllers/programs.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// View routes
router.get('/', authenticateToken, listPrograms);
router.get('/:id', authenticateToken, getProgramById);

// Athlete routes (Enrollment and Rating)
router.post('/:id/enroll', authenticateToken, enrollInProgram);
router.post('/:id/rate', authenticateToken, rateProgram);

// Complete program route (Note: ID is the Enrollment ID)
router.post('/enrollments/:id/complete', authenticateToken, completeEnrollment);

// Coach routes
router.post('/', authenticateToken, createProgram);
router.patch('/:id', authenticateToken, updateProgram);
router.delete('/:id', authenticateToken, deleteProgram);

export default router;
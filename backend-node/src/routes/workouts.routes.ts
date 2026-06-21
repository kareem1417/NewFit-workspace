import { Router } from 'express';
import { getNextWorkout, logWorkout, getWorkoutHistory } from '../controllers/workouts.controller'; // Added getWorkoutHistory function
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Route to get the athlete's next required workout for today
router.get('/next', authenticateToken, getNextWorkout);

// Route to log the actual data after completing a workout
router.post('/log', authenticateToken, logWorkout);

// Route to view past workout history
router.get('/history', authenticateToken, getWorkoutHistory);

export default router;
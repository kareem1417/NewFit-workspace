import { Router } from "express";
import {
  getNextWorkout,
  logWorkout,
  getWorkoutHistory,
} from "../controllers/workouts.controller"; // Added getWorkoutHistory function
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  getHistoryValidation,
  getNextWorkoutValidation,
  postLogValidation,
} from "../validators/workouts.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();

// Route to get the athlete's next required workout for today
router.get(
  "/get_next_workout",
  authenticateToken,
  getNextWorkoutValidation,
  validate,
  getNextWorkout,
);

// Route to log the actual data after completing a workout
router.post(
  "/post_log",
  authenticateToken,
  postLogValidation,
  validate,
  logWorkout,
);

// Route to view past workout history
router.get(
  "/workout_history",
  authenticateToken,
  getHistoryValidation,
  validate,
  getWorkoutHistory,
);

export default router;

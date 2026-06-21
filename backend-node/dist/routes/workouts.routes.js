"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const workouts_controller_1 = require("../controllers/workouts.controller"); // Added getWorkoutHistory function
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Route to get the athlete's next required workout for today
router.get('/next', auth_middleware_1.authenticateToken, workouts_controller_1.getNextWorkout);
// Route to log the actual data after completing a workout
router.post('/log', auth_middleware_1.authenticateToken, workouts_controller_1.logWorkout);
// Route to view past workout history
router.get('/history', auth_middleware_1.authenticateToken, workouts_controller_1.getWorkoutHistory);
exports.default = router;

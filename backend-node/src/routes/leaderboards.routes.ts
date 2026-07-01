import { Router } from "express";
import {
  getLeaderboard,
  getMostImproved,
} from "../controllers/leaderboards.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  getLeaderboardValidation,
  mostImprovedValidation,
} from "../validators/leaderboard.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();

// // Fetch leaderboard route
// router.get('/:type', authenticateToken, getLeaderboard);

router.get(
  "/get_leaderboard",
  authenticateToken,
  getLeaderboardValidation,
  validate,
  getLeaderboard,
);

// 🎯 GET /api/leaderboard/most_improved
router.get(
  "/most_improved",
  authenticateToken,
  mostImprovedValidation,
  validate,
  getMostImproved,
);

export default router;

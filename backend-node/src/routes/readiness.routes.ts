import { Router } from "express";
import {
  submitReadiness,
  getTodayReadiness,
  getReadinessHistory,
} from "../controllers/readiness.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  submitReadinessValidation,
  getReadinessHistoryValidation,
} from "../validators/readiness.validator";

const router = Router();

router.post(
  "/",
  authenticateToken,
  submitReadinessValidation,
  validate,
  submitReadiness,
);

router.get("/today", authenticateToken, getTodayReadiness);

router.get(
  "/history",
  authenticateToken,
  getReadinessHistoryValidation,
  validate,
  getReadinessHistory,
);

export default router;

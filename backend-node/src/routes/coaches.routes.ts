import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  upsertCoachProfile,
  getMyCoachProfile,
  getCoachProfileByUserId,
  getMyCoachPrograms,
} from "../controllers/coaches.controller";
import {
  upsertCoachProfileValidation,
  coachUserIdParamValidation,
} from "../validators/coaches.validator";

const router = Router();

router.get("/profile", authenticateToken, getMyCoachProfile);

router.put(
  "/profile",
  authenticateToken,
  upsertCoachProfileValidation,
  validate,
  upsertCoachProfile,
);

router.get("/me/programs", authenticateToken, getMyCoachPrograms);

router.get(
  "/:userId/profile",
  authenticateToken,
  coachUserIdParamValidation,
  validate,
  getCoachProfileByUserId,
);

export default router;

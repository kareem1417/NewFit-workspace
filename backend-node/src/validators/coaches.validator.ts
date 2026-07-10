import { body, param, ValidationChain } from "express-validator";
import { competitive_level } from "@prisma/client";

export const upsertCoachProfileValidation: ValidationChain[] = [
  body("sport")
    .trim()
    .notEmpty()
    .withMessage("Sport is required")
    .isLength({ max: 80 })
    .withMessage("Sport must be less than 80 characters"),

  body("level")
    .isIn(Object.values(competitive_level))
    .withMessage("Invalid level"),
];

export const coachUserIdParamValidation: ValidationChain[] = [
  param("userId")
    .isUUID()
    .withMessage("Invalid userId"),
];

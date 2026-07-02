// src/validators/auth.validator.ts
import { body } from "express-validator";

export const registerValidation = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3–30 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .withMessage(
      "Password must be at least 8 characters long, with 1 uppercase, 1 lowercase, and 1 number",
    ),
  body("date_of_birth")
    .notEmpty()
    .withMessage("Date of birth is required")
    .isISO8601()
    .withMessage("Invalid date format. Use YYYY-MM-DD")
    .custom((value) => {
      const dob = new Date(value);
      if (dob > new Date()) {
        throw new Error("Date of birth cannot be in the future");
      }
      return true;
    }),
  body("role")
    .optional()
    .isIn(["athlete", "coach"])
    .withMessage("Role must be athlete or coach"),
];

export const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Validation error — Email required.")
    .isEmail()
    .withMessage("Please provide a valid email address"),
  body("password")
    .notEmpty()
    .withMessage("Validation error — Password required."),
];
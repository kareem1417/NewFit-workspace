import { body, query } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError"; // 🎯 تأكد من المسار

export const updateMeValidation = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3–30 characters"),

  body("role")
    .optional()
    .isIn(["athlete", "coach", "admin"])
    .withMessage("Role must be either athlete, coach, or admin"),

  body("social_links")
    .optional()
    .custom((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Validation error — social_links must be a JSON object.");
      }
      for (const key in value) {
        const url = value[key];
        if (typeof url !== "string" || !url.startsWith("http")) {
          throw new Error(`Validation error — invalid social media link for ${key}. Must start with http/https.`);
        }
      }
      return true;
    }),

  body("role_models")
    .optional()
    .isArray()
    .withMessage("Role models must be an array of names")
    .custom((value) => {
      if (!value.every((item: any) => typeof item === "string")) {
        throw new Error("All role models must be strings");
      }
      return true;
    }),
];

// 🎯 التعديل الأول: عملنا Chain للـ Public Profile عشان ننظف الكنترولر
export const getPublicProfileValidation = [
  query("user_id")
    .trim()
    .notEmpty()
    .withMessage("Validation error — required param missing.")
    .isUUID()
    .withMessage("Validation error — invalid UUID.")
];

// 🎯 التعديل التاني: تحويل الـ Responses لـ AppError
export const uploadPhotoValidation = (req: Request, res: Response, next: NextFunction): void => {
  const reqAny = req as any;
  const file = reqAny.file || reqAny.files?.photo;

  if (!file) {
    return next(new AppError("Validation error — file required.", 400));
  }

  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size && file.size > MAX_SIZE) {
    return next(new AppError("File size exceeds limit.", 400));
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const fileMime = file.mimetype || "";
  const fileName = file.name || file.filename || "";
  const fileExtension = fileName.split('.').pop()?.toLowerCase();

  if (fileMime === "image/gif" || fileExtension === "gif") {
    return next(new AppError("Rejected — GIF not in allowed list.", 400));
  }

  if (fileMime && !allowedMimeTypes.includes(fileMime)) {
    return next(new AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400));
  }

  next();
};
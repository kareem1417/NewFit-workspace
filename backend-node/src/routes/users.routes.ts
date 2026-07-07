import { Router } from "express";
import {
  getMe,
  updateMe,
  uploadPhoto,
  getPublicProfile,
  deactivateAccount,
} from "../controllers/users.controller";
import { authenticateToken } from "../middlewares/auth.middleware"; // Authentication middleware
import { uploadProfilePhoto } from "../middlewares/upload.middleware"; // Multer upload middleware
import { validate } from "../middlewares/validation.middleware"; // 🎯 Global validator
import {
  updateMeValidation,
  uploadPhotoValidation,
  getPublicProfileValidation,
} from "../validators/users.validator"; // 🎯 Users validators
import multer from "multer";
import { AppError } from "../utils/AppError";

const router = Router();

// ==========================================
// User Profile Routes
// ==========================================

// GET /users/me - جلب بيانات المستخدم الحالي
router.get("/me", authenticateToken, getMe);

// 🎯 ربطنا الفاليديتور بتاع updateMe
router.patch("/me", authenticateToken, updateMeValidation, validate, updateMe);

// 🎯 تنظيف أخطاء Multer واستخدام uploadPhotoValidation
router.post(
  "/upload_photo",
  authenticateToken,
  (req, res, next) => {
    const upload = uploadProfilePhoto.single("photo");

    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("File size exceeds limit.", 400));
        }
        return next(new AppError(err.message, 400));
      } else if (err) {
        // خطأ من Cloudinary أو امتداد مرفوض
        return next(
          new AppError(
            "Invalid file type — only JPEG, PNG, WEBP accepted.",
            400,
          ),
        );
      }

      next(); // لو مفيش خطأ من Multer، كمل
    });
  },
  uploadPhotoValidation, // الفاليديتور بتاعنا كخط دفاع أخير
  uploadPhoto,
);

// 🎯 المسار لـ /public عشان يقرا الـ Query parameter (?user_id=...)
router.get(
  "/public",
  authenticateToken,
  getPublicProfileValidation,
  validate,
  getPublicProfile,
);

// PATCH /users/me/deactivate - إلغاء تنشيط الحساب
router.patch("/me/deactivate", authenticateToken, deactivateAccount);
console.log("Users routes loaded");
export default router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware"); // Authentication middleware
const upload_middleware_1 = require("../middlewares/upload.middleware"); // Multer upload middleware
const validation_middleware_1 = require("../middlewares/validation.middleware"); // 🎯 Global validator
const users_validator_1 = require("../validators/users.validator"); // 🎯 Users validators
const multer_1 = __importDefault(require("multer"));
const AppError_1 = require("../utils/AppError");
const router = (0, express_1.Router)();
// ==========================================
// User Profile Routes
// ==========================================
// GET /users/me - جلب بيانات المستخدم الحالي
router.get("/me", auth_middleware_1.authenticateToken, users_controller_1.getMe);
// 🎯 ربطنا الفاليديتور بتاع updateMe
router.patch("/me", auth_middleware_1.authenticateToken, users_validator_1.updateMeValidation, validation_middleware_1.validate, users_controller_1.updateMe);
// 🎯 تنظيف أخطاء Multer واستخدام uploadPhotoValidation
router.post("/upload_photo", auth_middleware_1.authenticateToken, (req, res, next) => {
    const upload = upload_middleware_1.uploadProfilePhoto.single("photo");
    upload(req, res, function (err) {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return next(new AppError_1.AppError("File size exceeds limit.", 400));
            }
            return next(new AppError_1.AppError(err.message, 400));
        }
        else if (err) {
            // خطأ من Cloudinary أو امتداد مرفوض
            return next(new AppError_1.AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400));
        }
        next(); // لو مفيش خطأ من Multer، كمل
    });
}, users_validator_1.uploadPhotoValidation, // الفاليديتور بتاعنا كخط دفاع أخير
users_controller_1.uploadPhoto);
// 🎯 المسار لـ /public عشان يقرا الـ Query parameter (?user_id=...)
router.get("/public", auth_middleware_1.authenticateToken, users_validator_1.getPublicProfileValidation, validation_middleware_1.validate, users_controller_1.getPublicProfile);
// PATCH /users/me/deactivate - إلغاء تنشيط الحساب
router.patch("/me/deactivate", auth_middleware_1.authenticateToken, users_controller_1.deactivateAccount);
console.log("Users routes loaded");
exports.default = router;

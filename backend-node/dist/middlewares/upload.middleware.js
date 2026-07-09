"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProfilePhoto = exports.uploadPostImage = void 0;
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
const AppError_1 = require("../utils/AppError"); // 🎯 ضيفنا دي عشان نرمي الإيرور مظبوط
// 1. Cloudinary Account Configuration
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// 2. Storage Configuration
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: 'ringside_profiles',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // Magic here 🪄: Automatically crop to 500x500 and focus on the face!
        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
    },
});
const postStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: 'ringside_posts', // 🎯 فولدر منفصل عشان التنظيم
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // 🎯 تحجيم ذكي: بيخلي أقصى عرض 1080 عشان الأداء، بس بيحافظ على أبعاد الصورة الأصلية (طولية أو بالعرض) من غير ما يقصها
        transformation: [{ width: 1080, crop: 'limit' }]
    },
});
exports.uploadPostImage = (0, multer_1.default)({
    storage: postStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 🎯 رفعنا الحجم لـ 5 ميجا لأن صور البوستات بتحتاج جودة أعلى
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new AppError_1.AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400), false);
        }
    }
});
// 3. Export Middleware
exports.uploadProfilePhoto = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 🎯 التعديل الأول: خليناها 2 ميجا زي التوثيق
    // 🎯 التعديل التاني: السحر اللي هيقفل الباب في وش أي ملف مش صورة في نفس الثانية
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true); // ملف سليم، ابدأ ارفعه لـ Cloudinary
        }
        else {
            // ملف مرفوض، ارمي إيرور فوراً واقفل الكونكشن
            cb(new AppError_1.AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400), false);
        }
    }
});

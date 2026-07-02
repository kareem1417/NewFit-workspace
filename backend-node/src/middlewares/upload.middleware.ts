import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { AppError } from '../utils/AppError'; // 🎯 ضيفنا دي عشان نرمي الإيرور مظبوط

// 1. Cloudinary Account Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Storage Configuration
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ringside_profiles',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // Magic here 🪄: Automatically crop to 500x500 and focus on the face!
        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
    } as any,
});
const postStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ringside_posts', // 🎯 فولدر منفصل عشان التنظيم
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // 🎯 تحجيم ذكي: بيخلي أقصى عرض 1080 عشان الأداء، بس بيحافظ على أبعاد الصورة الأصلية (طولية أو بالعرض) من غير ما يقصها
        transformation: [{ width: 1080, crop: 'limit' }]
    } as any,
});

export const uploadPostImage = multer({
    storage: postStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 🎯 رفعنا الحجم لـ 5 ميجا لأن صور البوستات بتحتاج جودة أعلى
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400) as any, false);
        }
    }
});

// 3. Export Middleware
export const uploadProfilePhoto = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 🎯 التعديل الأول: خليناها 2 ميجا زي التوثيق

    // 🎯 التعديل التاني: السحر اللي هيقفل الباب في وش أي ملف مش صورة في نفس الثانية
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true); // ملف سليم، ابدأ ارفعه لـ Cloudinary
        } else {
            // ملف مرفوض، ارمي إيرور فوراً واقفل الكونكشن
            cb(new AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400) as any, false);
        }
    }
});
import { Router } from 'express';
import { getMe, updateMe, uploadPhoto, getPublicProfile, deactivateAccount } from '../controllers/users.controller';
import { authenticateToken } from '../middlewares/auth.middleware'; // Authentication middleware
import { uploadProfilePhoto } from '../middlewares/upload.middleware'; // Multer upload middleware
import { upsertUserMetrics } from '../controllers/athlete.controller';
import { validate } from '../middlewares/validation.middleware'; // 🎯 Global validator
import { updateMeValidation, uploadPhotoValidation, getPublicProfileValidation } from '../validators/users.validator'; // 🎯 Users validators
import multer from 'multer';
import { AppError } from '../utils/AppError';

const router = Router();

// User Profile Routes
router.get('/me', authenticateToken, getMe);

// 🎯 التعديل 1: ربطنا الفاليديتور بتاع updateMe
router.patch('/me', authenticateToken, updateMeValidation, validate, updateMe);

// Route to create or update user's physical metrics (for onboarding/AI)
// (لو upsertUserMetrics ليها validator حطه هنا، لو لأ سيبها كده)
router.post('/me/metrics', authenticateToken, upsertUserMetrics);

// 🎯 التعديل 2: تنظيف أخطاء Multer واستخدام uploadPhotoValidation
router.post(
    '/upload_photo',
    authenticateToken,
    (req, res, next) => {
        const upload = uploadProfilePhoto.single('photo');

        upload(req, res, function (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new AppError("File size exceeds limit.", 400));
                }
                return next(new AppError(err.message, 400));
            } else if (err) {
                // خطأ من Cloudinary أو امتداد مرفوض
                return next(new AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400));
            }

            next(); // لو مفيش خطأ من Multer، كمل
        });
    },
    uploadPhotoValidation, // الفاليديتور بتاعنا كخط دفاع أخير
    uploadPhoto
);

// 🎯 التعديل 3: غيرنا المسار لـ /public عشان يقرا الـ Query parameter (?user_id=...)
router.get('/public', authenticateToken, getPublicProfileValidation, validate, getPublicProfile);

router.patch('/me/deactivate', authenticateToken, deactivateAccount);

export default router;
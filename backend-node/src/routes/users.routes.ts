import { Router } from 'express';
import { getMe, updateMe, uploadPhoto, getPublicProfile, deactivateAccount } from '../controllers/users.controller';
import { authenticateToken } from '../middlewares/auth.middleware'; // Authentication middleware
import { uploadProfilePhoto } from '../middlewares/upload.middleware'; // Multer upload middleware
import { updateMeValidation, uploadPhotoValidation } from '../validators/users.validator';
import { validate } from '../middlewares/validation.middleware';

const router = Router();

// User Profile Routes
router.get('/me', authenticateToken, getMe);
router.patch('/me', authenticateToken,updateMeValidation, validate, updateMe);
// router.post('/me/photo', authenticateToken, uploadProfilePhoto.single('photo'),uploadPhotoValidation, validate,uploadPhoto);
router.post(
  '/me/photo', 
  authenticateToken,                  // 1. الأمان والـ Logout (401)
  uploadProfilePhoto.single('photo'), // 🎯 الصح: كده هيقرا الملف ويحطه في req.file من غير أي تضارب
  uploadPhotoValidation,              // 2. الـ Validator البسيط بتاعنا (بيفحص req.file ويطرد الـ GIF)
  uploadPhoto                         // 3. الـ Controller (201 للـ JPG/PNG والـ catch بيمسك الـ PDF)
);
// router.get('/:id', authenticateToken, getPublicProfile);
router.get('/profiles', authenticateToken, getPublicProfile);
router.patch('/me/deactivate', authenticateToken, deactivateAccount);
export default router;
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

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
        folder: 'ringside_profiles', // Changed folder name
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // Magic here 🪄: Automatically crop to 500x500 and focus on the face!
        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
    } as any, // Added 'as any' to bypass TypeScript transformation type errors
});

// 3. Export Middleware
export const uploadProfilePhoto = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Max file size 5MB
});
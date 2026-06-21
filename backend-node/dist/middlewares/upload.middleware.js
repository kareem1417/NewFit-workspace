"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProfilePhoto = void 0;
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
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
        folder: 'ringside_profiles', // Changed folder name
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        // Magic here 🪄: Automatically crop to 500x500 and focus on the face!
        transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
    }, // Added 'as any' to bypass TypeScript transformation type errors
});
// 3. Export Middleware
exports.uploadProfilePhoto = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Max file size 5MB
});

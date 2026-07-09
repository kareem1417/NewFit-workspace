"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPhotoValidation = exports.getPublicProfileValidation = exports.updateMeValidation = void 0;
const express_validator_1 = require("express-validator"); // 📌 التعديل هنا (ضفنا ValidationChain)
const AppError_1 = require("../utils/AppError");
exports.updateMeValidation = [
    (0, express_validator_1.body)("username")
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage("Username must be 3–30 characters"),
    (0, express_validator_1.body)("role")
        .optional()
        .isIn(["athlete", "coach", "admin"])
        .withMessage("Role must be either athlete, coach, or admin"),
    (0, express_validator_1.body)("full_name")
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Full name must be between 2–100 characters"),
    (0, express_validator_1.body)("social_links")
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
    (0, express_validator_1.body)("role_models")
        .optional()
        .isArray()
        .withMessage("Role models must be an array of names")
        .custom((value) => {
        if (!value.every((item) => typeof item === "string")) {
            throw new Error("All role models must be strings");
        }
        return true;
    }),
];
exports.getPublicProfileValidation = [
    (0, express_validator_1.query)("user_id")
        .trim()
        .notEmpty()
        .withMessage("Validation error — required param missing.")
        .isUUID()
        .withMessage("Validation error — invalid UUID."),
];
const uploadPhotoValidation = (req, res, next) => {
    const reqAny = req;
    const file = reqAny.file || reqAny.files?.photo;
    if (!file) {
        return next(new AppError_1.AppError("Validation error — file required.", 400));
    }
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size && file.size > MAX_SIZE) {
        return next(new AppError_1.AppError("File size exceeds limit.", 400));
    }
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    const fileMime = file.mimetype || "";
    const fileName = file.name || file.filename || "";
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    if (fileMime === "image/gif" || fileExtension === "gif") {
        return next(new AppError_1.AppError("Rejected — GIF not in allowed list.", 400));
    }
    if (fileMime && !allowedMimeTypes.includes(fileMime)) {
        return next(new AppError_1.AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400));
    }
    next();
};
exports.uploadPhotoValidation = uploadPhotoValidation;

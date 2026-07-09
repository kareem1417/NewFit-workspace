"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.followValidation = exports.updateCommentValidation = exports.updatePostValidation = exports.addCommentValidation = exports.getUserPostsValidation = exports.createPostValidation = exports.commentIdParamValidation = exports.userIdParamValidation = exports.postIdParamValidation = exports.paginationValidation = void 0;
const express_validator_1 = require("express-validator");
const AppError_1 = require("../utils/AppError");
// ==========================================
// Reusable Validators (لتقليل التكرار)
// ==========================================
exports.paginationValidation = [
    (0, express_validator_1.query)("limit").optional().isInt({ min: 1 }).withMessage("Limit must be a positive integer"),
    (0, express_validator_1.query)("offset").optional().isInt({ min: 0 }).withMessage("Offset must be a non-negative integer")
];
exports.postIdParamValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid post ID.")
];
exports.userIdParamValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid user ID.")
];
exports.commentIdParamValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid comment ID.")
];
// ==========================================
// Specific Validators
// ==========================================
// 1. Create Post Validation
exports.createPostValidation = [
    (req, res, next) => {
        const content = req.body.content;
        const file = req.file;
        if (!content && !file) {
            return next(new AppError_1.AppError("Validation error — post must contain content or an image", 400));
        }
        if (content && content.length > 500) {
            return next(new AppError_1.AppError("Validation error — content too long.", 400));
        }
        next();
    }
];
// 2. Get User Posts Validation (يدعم قراءة الـ ID من Params أو Query)
exports.getUserPostsValidation = [
    (req, res, next) => {
        const targetUserId = req.params.id || req.query.user_id;
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!targetUserId || !uuidRegex.test(String(targetUserId))) {
            return next(new AppError_1.AppError("Validation error — invalid user ID.", 400));
        }
        next();
    },
    ...exports.paginationValidation
];
// 3. Add Comment Validation
exports.addCommentValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid post ID."),
    (0, express_validator_1.body)("content").custom((value) => {
        if (!value || value.trim().length === 0) {
            throw new Error("Validation error — Comment content is required and cannot be empty.");
        }
        if (value.trim().length > 500) {
            throw new Error("Validation error — Comment exceeds maximum length of 500 characters.");
        }
        return true;
    })
];
// ==========================================
// Update Post & Comment Validators
// ==========================================
exports.updatePostValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid post ID."),
    (req, res, next) => {
        const content = req.body.content;
        const file = req.file;
        // لو مبعتش لا محتوى ولا صورة، هنرفض التعديل
        if (!content && !file) {
            return next(new AppError_1.AppError("Validation error — must provide content or image to update.", 400));
        }
        if (content && content.length > 500) {
            return next(new AppError_1.AppError("Validation error — content too long (max 500 chars).", 400));
        }
        next();
    }
];
exports.updateCommentValidation = [
    (0, express_validator_1.param)("id").isUUID().withMessage("Validation error — invalid comment ID."),
    (0, express_validator_1.body)("content").custom((value) => {
        if (!value || value.trim().length === 0) {
            throw new Error("Validation error — Comment content is required.");
        }
        if (value.trim().length > 500) {
            throw new Error("Validation error — Comment exceeds 500 characters.");
        }
        return true;
    })
];
// 4. Follow / Unfollow Validation
exports.followValidation = [
    (0, express_validator_1.param)("userId").isUUID().withMessage("Validation error — invalid user ID.")
];

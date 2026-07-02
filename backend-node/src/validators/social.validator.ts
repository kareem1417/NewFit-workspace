import { body, param, query, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

// ==========================================
// Reusable Validators (لتقليل التكرار)
// ==========================================
export const paginationValidation = [
    query("limit").optional().isInt({ min: 1 }).withMessage("Limit must be a positive integer"),
    query("offset").optional().isInt({ min: 0 }).withMessage("Offset must be a non-negative integer")
];

export const postIdParamValidation = [
    param("id").isUUID().withMessage("Validation error — invalid post ID.")
];

export const userIdParamValidation = [
    param("id").isUUID().withMessage("Validation error — invalid user ID.")
];
export const commentIdParamValidation = [
    param("id").isUUID().withMessage("Validation error — invalid comment ID.")
];
// ==========================================
// Specific Validators
// ==========================================

// 1. Create Post Validation
export const createPostValidation = [
    (req: Request, res: Response, next: NextFunction) => {
        const content = req.body.content;
        const file = (req as any).file;

        if (!content && !file) {
            return next(new AppError("Validation error — post must contain content or an image", 400));
        }
        if (content && content.length > 500) {
            return next(new AppError("Validation error — content too long.", 400));
        }
        next();
    }
];

// 2. Get User Posts Validation (يدعم قراءة الـ ID من Params أو Query)
export const getUserPostsValidation = [
    (req: Request, res: Response, next: NextFunction) => {
        const targetUserId = req.params.id || req.query.user_id;
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

        if (!targetUserId || !uuidRegex.test(String(targetUserId))) {
            return next(new AppError("Validation error — invalid user ID.", 400));
        }
        next();
    },
    ...paginationValidation
];

// 3. Add Comment Validation
export const addCommentValidation = [
    param("id").isUUID().withMessage("Validation error — invalid post ID."),
    body("content").custom((value) => {
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
export const updatePostValidation = [
    param("id").isUUID().withMessage("Validation error — invalid post ID."),
    (req: Request, res: Response, next: NextFunction) => {
        const content = req.body.content;
        const file = (req as any).file;

        // لو مبعتش لا محتوى ولا صورة، هنرفض التعديل
        if (!content && !file) {
            return next(new AppError("Validation error — must provide content or image to update.", 400));
        }
        if (content && content.length > 500) {
            return next(new AppError("Validation error — content too long (max 500 chars).", 400));
        }
        next();
    }
];

export const updateCommentValidation = [
    param("id").isUUID().withMessage("Validation error — invalid comment ID."),
    body("content").custom((value) => {
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
export const followValidation = [
    param("userId").isUUID().withMessage("Validation error — invalid user ID.")
];
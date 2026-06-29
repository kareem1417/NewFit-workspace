import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';

// 🎯 تحديث الـ Interface عشان الـ TS يفهم الخصائص الإضافية للأخطاء الجاية من الرفع
interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
    http_code?: number; // لقط الخطأ الجاي من Cloudinary
    code?: string;      // لقط كود الخطأ الجاي من Multer/Uploader زي LIMIT_FILE_SIZE
}

export const errorHandler = (
    err: any, // تحويلها لـ any هنا بيسهل التعامل مع الأخطاء الجاية من مكاتب خارجية مختلفة
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    // 1. Handle validation errors from express-validator
    if (Array.isArray(err) && err[0]?.msg) {
        const errors = (err as ValidationError[]).map((e) => ({
            field: e.type === 'field' ? e.path : undefined,
            message: e.msg,
        }));
        return res.status(400).json({
            success: false,
            errors,
        });
    }

    // 2. مصيدة أخطاء صيغة الملفات (زي الـ PDF المرفوض من السيرفر)
    if (err.message?.includes("format pdf not allowed") || err.http_code === 400) {
        return res.status(400).json({
            success: false,
            error: "Invalid file type — only JPEG, PNG, WEBP accepted."
        });
    }

    // 3. مصيدة أخطاء حجم الملف الكبير
    if (err.message?.includes("limit") || err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            error: "File size exceeds limit."
        });
    }

    // 4. مصيدة أخطاء الـ Prisma للـ Constraints والتكرار هندسناها بشكل منفصل ومضمون ⚡
    if (err.code === "P2002") {
        return res.status(409).json({
            success: false,
            error: "Conflict — sport profile already exists. Use PATCH to update."
        });
    }

    if (err.code === "P2003") {
        return res.status(400).json({
            success: false,
            error: "Database constraint violation. Referenced record not found."
        });
    }

    // 5. Custom operational error (لو حابب تفعلها مستقبلاً)
    if (err.isOperational) {
        return res.status(err.statusCode || 400).json({
            success: false,
            error: err.message,
        });
    }

    // 6. Unexpected server error (لأي حاجة تانية مجهولة)
    console.error('Unhandled error:', err);
    return res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
};
import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const updateMeValidation = [
  // 1. فحص الـ username (لو مبعوث)
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3–30 characters"),

  // 2. فحص الـ role والتأكد إنه يطابق الـ Enum بالظبط
  body("role")
    .optional()
    .isIn(["athlete", "coach", "admin"])
    .withMessage("Role must be either athlete, coach, or admin"),

  // 3. فحص الـ social_links والتأكد إنه Object والروابط تبدأ بـ http/https
  body("social_links")
    .optional()
    .custom((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Validation error — social_links must be a JSON object.");
      }
      
      // التأكد إن كل لينك جوه الـ Object عبارة عن URL صحيح
      for (const key in value) {
        const url = value[key];
        if (typeof url !== "string" || !url.startsWith("http")) {
          throw new Error(`Validation error — invalid social media link for ${key}. Must start with http/https.`);
        }
      }
      return true;
    }),

  // 4. فحص الـ role_models والتأكد إنها مصفوفة نصوص (Array of strings)
  body("role_models")
    .optional()
    .isArray()
    .withMessage("Role models must be an array of names")
    .custom((value) => {
      if (!value.every((item: any) => typeof item === "string")) {
        throw new Error("All role models must be strings");
      }
      return true;
    }),

  // الميدل وير اللي بيفحص النتيجة وبيرد فوراً بـ 400 لو فيه أي غلطة
  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: errors.array()[0].msg // هيرجع أول رسالة خطأ واضحة في بوست مان
      });
      return;
    }
    next();
  }
];


// export const uploadPhotoValidation = (req: Request, res: Response, next: NextFunction): void => {

//   console.log("DEBUG FILE -> req.file:", (req as any).file);
//   console.log("DEBUG FILES -> req.files:", (req as any).files);
//   console.log("DEBUG BODY -> req.body:", req.body);

//   // لقط الملف بالطريقة المتاحة في الـ Request عندك
//   const file = (req as any).file; 

//   // 1. لو مفيش ملف مبعوث أصلاً (Missing file field)
//   if (!file) {
//     res.status(400).json({ 
//       success: false, 
//       error: "Validation error — file required." 
//     });
//     return;
//   }

//   // 2. فحص الحجم الكبر من 2MB
//   const MAX_SIZE = 2 * 1024 * 1024;
//   if (file.size && file.size > MAX_SIZE) {
//     res.status(400).json({
//       success: false,
//       error: "File size exceeds limit."
//     });
//     return;
//   }

//   // 3. فحص الامتدادات والـ MIME types
//   const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
//   const fileMime = file.mimetype || "";
//   const fileName = file.name || file.filename || "";
//   const fileExtension = fileName.split('.').pop()?.toLowerCase();

//   // لو الملف PDF يرفضه فوراً بـ 400
//   if (fileMime === "application/pdf" || fileExtension === "pdf") {
//     res.status(400).json({
//       success: false,
//       error: "Invalid file type — only JPEG, PNG, WEBP accepted."
//     });
//     return;
//   }

//   // لو الملف GIF يرفضه فوراً بـ 400 والرسالة المطلوبة في الـ test
//   if (fileMime === "image/gif" || fileExtension === "gif") {
//     res.status(400).json({
//       success: false,
//       error: "Rejected — GIF not in allowed list."
//     });
//     return;
//   }

//   // أي امتداد آخر مخالف
//   if (fileMime && !allowedMimeTypes.includes(fileMime)) {
//     res.status(400).json({
//       success: false,
//       error: "Invalid file type — only JPEG, PNG, WEBP accepted."
//     });
//     return;
//   }

//   next();
// };

export const uploadPhotoValidation = (req: Request, res: Response, next: NextFunction): void => {
  // كاستنج سريع عشان الـ TS يقرا الـ file بكل أشكاله
  const reqAny = req as any;
  const file = reqAny.file || reqAny.files?.photo;

  // 1. فحص وجود الملف
  if (!file) {
    res.status(400).json({ 
      success: false, 
      error: "Validation error — file required." 
    });
    return;
  }

  // 2. فحص الحجم محلياً كخط دفاع احتياطي (أكبر من 2MB)
  const MAX_SIZE = 2 * 1024 * 1024;
  if (file.size && file.size > MAX_SIZE) {
    res.status(400).json({
      success: false,
      error: "File size exceeds limit."
    });
    return;
  }

  // 3. فحص الـ GIF والامتدادات المرفوضة
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const fileMime = file.mimetype || "";
  const fileName = file.name || file.filename || "";
  const fileExtension = fileName.split('.').pop()?.toLowerCase();

  if (fileMime === "image/gif" || fileExtension === "gif") {
    res.status(400).json({
      success: false,
      error: "Rejected — GIF not in allowed list."
    });
    return;
  }

  if (fileMime && !allowedMimeTypes.includes(fileMime)) {
    res.status(400).json({
      success: false,
      error: "Invalid file type — only JPEG, PNG, WEBP accepted."
    });
    return;
  }

  next();
};
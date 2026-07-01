import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";

export const getNextWorkoutValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { enrollment_id } = req.query;

  // 🚨 Sad Path: لو بعت enrollment_id وفورمات الـ UUID مش سليم (مثلاً مش 36 حرف أو حروف عشوائية)
  // ده بيمنع الـ Prisma إنها تضرب 500 وبيرجع 404 فوراً زي ما الشيت طالب
  if (enrollment_id && typeof enrollment_id === "string") {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(enrollment_id)) {
      res.status(404).json({ error: "Enrollment not found." }); // نفس رسالة الشيت بالملي
      return;
    }
  }

  next();
};

export const postLogValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { enrollment_id, session_id, completed_at } = req.body;

  // 1. التشييك على الحقول الإلزامية (سطر 41 في الشيت)
  if (!enrollment_id || !session_id) {
    res.status(400).json({ error: "Validation error." });
    return;
  }

  // 2. التحقق من صحة فورمات الـ UUIDs لمنع كراش الـ Prisma الـ Internal
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(enrollment_id) || !uuidRegex.test(session_id)) {
    res.status(400).json({ error: "Validation error." });
    return;
  }

  // 3. التشييك على تاريخ المستقبل (سطر 42 في الشيت)
  if (completed_at) {
    const logDate = new Date(completed_at);
    const now = new Date();

    // إضافة حماية 5 ثواني كفارق بين الأجهزة لمنع الـ False Negatives
    if (isNaN(logDate.getTime()) || logDate.getTime() > now.getTime() + 5000) {
      res.status(400).json({ error: "Cannot log a workout in the future." });
      return;
    }
  }

  next();
};

export const getHistoryValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const queryEnrollmentId = req.query.enrollment_id as string;

  // سطر 47 و 48 في الشيت: لو الـ enrollment_id مبعوت، لازم نتأكد من الـ format بتاعه أولاً
  if (queryEnrollmentId) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // لو الفورمات غلط، يرجع فوراً 404 Enrollment not found زي ما الـ Test مستني في حالة الأصفار
    if (!uuidRegex.test(queryEnrollmentId)) {
      res.status(404).json({ error: "Enrollment not found." });
      return;
    }
  }

  next();
};

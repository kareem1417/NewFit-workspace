import { body , validationResult} from "express-validator";
import { Request, Response, NextFunction } from "express";

export const createSportProfileValidation = (req: Request, res: Response, next: NextFunction): void => {
  const reqAny = req as any;
  const { sport_id, level, weight_class } = req.body;
  const userRole = reqAny.user?.role; // لقط الـ Role من التوكن

  // 🎯 أ: حماية الـ Roles (الـ 403 للكوتش) بناءً على الـ Sheet
  if (userRole === "coach") {
    res.status(403).json({
      success: false,
      error: "Forbidden — coaches cannot create athlete profiles."
    });
    return;
  }

  // ب: فحص وجود الـ sport_id ونوعه
  const parsedSportId = Number(sport_id);
  if (!sport_id || isNaN(parsedSportId) || parsedSportId <= 0) {
    res.status(400).json({
      success: false,
      error: "Validation error — invalid or missing sport_id."
    });
    return;
  }

  // ج: فحص الـ Level Enum بالرسالة المطلوبة في الـ Sheet بالملي
  if (!level || typeof level !== "string") {
    res.status(400).json({
      success: false,
      error: "Validation error — must be novice/amateur/professional."
    });
    return;
  }

  const validLevels = ["novice", "amateur", "professional"];
  if (!validLevels.includes(level.toLowerCase().trim())) {
    res.status(400).json({
      success: false,
      error: "Validation error — must be novice/amateur/professional."
    });
    return;
  }

  // د: فحص الـ Weight Class Enum بالرسالة المطلوبة في الـ Sheet بالملي
  if (!weight_class || typeof weight_class !== "string") {
    res.status(400).json({
      success: false,
      error: "Validation error — invalid weight class enum."
    });
    return;
  }

  // ضيف الـ Enums المعتمدة عندك في الداتا بيز (زي اللي في الـ Sheet: middleweight, welterweight...)
  const validWeights = ["heavyweight", "middleweight", "welterweight", "lightweight", "featherweight"];
  if (!validWeights.includes(weight_class.toLowerCase().trim())) {
    res.status(400).json({
      success: false,
      error: "Validation error — invalid weight class enum."
    });
    return;
  }

  next();
};


export const updateSportProfileValidation = (req: Request, res: Response, next: NextFunction): void => {
  const { level, weight_class } = req.body;

  // 1. حماية: منع إرسال Request فارغ (Empty payload) بناءً على الـ Sheet بالملي
  if (!level && !weight_class) {
    res.status(400).json({
      success: false,
      error: "Validation error — at least one field required."
    });
    return;
  }

  // 2. فحص الـ Level Enum لو مبعوث
  if (level) {
    if (typeof level !== "string") {
      res.status(400).json({ success: false, error: "Validation error." });
      return;
    }
    const validLevels = ["novice", "amateur", "professional"];
    if (!validLevels.includes(level.toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: "Validation error." // مطابقة للـ Sheet بالملي لـ "grandmaster"
      });
      return;
    }
  }

  // 3. فحص الـ Weight Class Enum لو مبعوث (اختياري حماية للـ DB)
  if (weight_class) {
    if (typeof weight_class !== "string") {
      res.status(400).json({ success: false, error: "Validation error." });
      return;
    }
    const validWeights = ["heavyweight", "middleweight", "welterweight", "lightweight", "featherweight", "light_middleweight"];
    if (!validWeights.includes(weight_class.toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: "Validation error."
      });
      return;
    }
  }

  next();
};


export const createSnapshotValidation = (req: Request, res: Response, next: NextFunction): void => {
  const { sport_id, snapshot_type, program_enrollment_id, test_values } = req.body;

  // 1. فحص الـ sport_id
  const parsedSportId = Number(sport_id);
  if (!sport_id || isNaN(parsedSportId) || parsedSportId <= 0) {
    res.status(400).json({
      success: false,
      error: "Validation error — invalid or missing sport_id."
    });
    return;
  }

  // 2. فحص الـ snapshot_type وضبط الـ Enums المذكورة في الـ Sheet
  const validSnapshotTypes = ["initial_onboarding", "manual_update", "program_baseline", "program_posttest"];
  if (!snapshot_type || !validSnapshotTypes.includes(snapshot_type)) {
    res.status(400).json({
      success: false,
      error: `Validation error — invalid snapshot_type.`
    });
    return;
  }

  // 3. فحص الـ program_enrollment_id بناءً على النوع
  if ((snapshot_type === "program_baseline" || snapshot_type === "program_posttest") && !program_enrollment_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — program_enrollment_id is required for this snapshot type."
    });
    return;
  }

  // 4. فحص الـ test_values بالكامل
  if (!test_values || !Array.isArray(test_values) || test_values.length === 0) {
    res.status(400).json({
      success: false,
      error: "Validation error — test_values array is required and cannot be empty."
    });
    return;
  }

  // 5. فحص داخلي لعناصر الـ Array للتأكد من سلامة الـ Types قبل الـ DB
  for (const item of test_values) {
    if (!item.attribute_test_id || isNaN(Number(item.attribute_test_id))) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid attribute_test_id."
      });
      return;
    }
    if (item.value === undefined || isNaN(Number(item.value))) {
      res.status(400).json({
        success: false,
        error: "Validation error — test values must be valid numbers."
      });
      return;
    }
  }

  next();
};
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



export const getSnapshotsValidation = (req: Request, res: Response, next: NextFunction): void => {
  const typeStr = req.query.type as string | undefined;

  // 1. فحص الـ snapshot_type enum بناءً على الـ Sheet بالملي
  if (typeStr) {
    const validSnapshotTypes = ["initial_onboarding", "manual_update", "program_baseline", "program_posttest"];
    if (!validSnapshotTypes.includes(typeStr)) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid snapshot_type enum." // نفس رسالة الـ Sheet بالظبط
      });
      return;
    }
  }

  // 2. تنظيف الأرقام وتمريرها جاهزة للـ Controller
  let limit = parseInt(req.query.limit as string);
  if (isNaN(limit) || limit <= 0) limit = 10; // الـ default في الـ sheet هو 10

  let offset = parseInt(req.query.offset as string);
  if (isNaN(offset) || offset < 0) offset = 0;

  // حفظ القيم النضيفة في الـ req عشان الـ Controller يستخدمها علطول
  res.locals.cleanQuery = { limit, offset, typeStr };

  next();
};


export const getRadarDataValidation = (req: Request, res: Response, next: NextFunction): void => {
  // 🎯 التعديل بناءً على الـ Sheet: أسماء الـ Params بقت level و weight_class
  const levelStr = req.query.level as string | undefined;
  const weightStr = req.query.weight_class as string | undefined;

  const validLevels = ["novice", "amateur", "professional"]; 
  const validWeights = [
    "flyweight", "bantamweight", "featherweight", "lightweight",
    "light_welterweight", "welterweight", "light_middleweight",
    "middleweight", "super_middleweight", "light_heavyweight",
    "cruiserweight", "heavyweight"
  ];

  // 1. التحقق من الـ level لو مبعوت
  if (levelStr) {
    const cleanedLevel = levelStr.toLowerCase().trim();
    if (!validLevels.includes(cleanedLevel)) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid competitive level enum."
      });
      return;
    }
    res.locals.overrideLevel = cleanedLevel;
  }

  // 2. التحقق من الـ weight_class لو مبعوت
  if (weightStr) {
    const cleanedWeight = weightStr.toLowerCase().trim();
    if (!validWeights.includes(cleanedWeight)) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid weight class enum." // مطابقة للـ الـ Sheet
      });
      return;
    }
    res.locals.overrideWeight = cleanedWeight;
  }

  next();
};


export const getProgressValidation = (req: Request, res: Response, next: NextFunction): void => {
  // 🎯 التعديل: قراءة الـ ID كـ Query Parameter بناءً على الـ Sheet
  const testIdStr = req.query.attribute_test_id as string | undefined;

  // 1. حالة الـ Sad Path: المعامل مش مبعوث أصلاً
  if (!testIdStr) {
    res.status(400).json({
      success: false,
      error: "Validation error — required param." // نفس رسالة الـ Sheet بالظبط
    });
    return;
  }

  const attributeTestId = parseInt(testIdStr);

  // 2. حالة الـ Sad Path: مبعوث بس مش رقم أو رقم سالب
  if (isNaN(attributeTestId) || attributeTestId <= 0) {
    res.status(400).json({
      success: false,
      error: "Validation error — attribute_test_id must be a positive number."
    });
    return;
  }

  // تمرير القيمة النظيفة للـ Controller
  res.locals.attributeTestId = attributeTestId;
  next();
};


export const getMyEnrollmentsValidation = (req: Request, res: Response, next: NextFunction): void => {
  const statusStr = req.query.status as string | undefined;
  
  // 🎯 الـ Enums المعتمدة في الـ Excel Sheet بالملي
  const validStatuses = ["active", "completed", "cancelled"];

  if (statusStr) {
    const cleanedStatus = statusStr.toLowerCase().trim();
    if (!validStatuses.includes(cleanedStatus)) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid status enum." // نفس جملة الـ Sheet بالظبط
      });
      return;
    }
    // تمرير القيمة النظيفة للـ Controller
    res.locals.statusFilter = cleanedStatus;
  }

  next();
};
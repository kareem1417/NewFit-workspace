import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware"; // 🎯 تأكد من صحة مسار الـ middleware عندك

export const createProgramValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { title, goal_primary, sport_id } = req.body;

  // 1. صلاحية الحساب (فقط الـ Coach)
  if (req.user?.role !== "coach") {
    res.status(403).json({
      success: false,
      error: "Forbidden — only coaches can create programs.",
    });
    return;
  }

  // 2. فحص الـ Title المطلوب
  if (!title || String(title).trim() === "") {
    res.status(400).json({
      success: false,
      error: "Validation error — title required.",
    });
    return;
  }

  // 🎯 التعديل الجديد: التأكد من إرسال الـ sport_id لأن الداتا بيز بتجبرنا عليه
  if (!sport_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — sport_id is required.",
    });
    return;
  }

  // 3. فحص الـ goal_primary والـ Enums
  const validGoals = ["power", "strength", "hypertrophy", "endurance"];
  if (goal_primary && !validGoals.includes(goal_primary.toLowerCase().trim())) {
    res.status(400).json({
      success: false,
      error: "Validation error — Invalid goal_primary enum.",
    });
    return;
  }

  next();
};

export const listProgramsValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { limit, offset, sport_id, duration_weeks, min_rating, goal, level } =
    req.query;

  // 1. فحص الـ Limit
  if (limit) {
    const parsedLimit = parseInt(limit as string, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      res.status(400).json({
        success: false,
        error: "Validation error — limit must be a positive number.",
      });
      return;
    }
  }

  // 2. فحص الـ Offset
  if (offset) {
    const parsedOffset = parseInt(offset as string, 10);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      res.status(400).json({
        success: false,
        error: "Validation error — offset must be a non-negative number.",
      });
      return;
    }
  }

  // 3. فحص الـ sport_id
  if (sport_id) {
    const parsedSportId = Number(sport_id);
    if (isNaN(parsedSportId)) {
      res.status(400).json({
        success: false,
        error: "Validation error — sport_id must be a valid number.",
      });
      return;
    }
  }

  // 4. فحص الـ duration_weeks
  if (duration_weeks) {
    const parsedDuration = Number(duration_weeks);
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      res.status(400).json({
        success: false,
        error: "Validation error — duration_weeks must be a positive number.",
      });
      return;
    }
  }

  // 5. فحص الـ min_rating
  if (min_rating) {
    const parsedRating = Number(min_rating);
    if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5) {
      res.status(400).json({
        success: false,
        error: "Validation error — min_rating must be between 0 and 5.",
      });
      return;
    }
  }

  // 6. 🔥 التيست المطلوب في السكرين شوت (Sad Path - Invalid goal filter)
  if (goal) {
    const validGoals = ["power", "strength", "hypertrophy", "endurance"];
    if (!validGoals.includes(String(goal).toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid goal filter.", // مطابقة للـ Assertion بالملي
      });
      return;
    }
  }

  // 7. فحص الـ level لو مبعوث
  if (level) {
    const validLevels = ["novice", "amateur", "intermediate", "advanced"];
    if (!validLevels.includes(String(level).toLowerCase().trim())) {
      res.status(400).json({
        success: false,
        error: "Validation error — invalid level filter.",
      });
      return;
    }
  }

  next();
};

export const getProgramValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { program_id } = req.query; // 🎯 مبعوث كـ Query Parameter حسب الشيت

  // 1. التأكد من وجود الـ ID
  if (!program_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — program_id query parameter is required.",
    });
    return;
  }

  // 2. الفحص بالـ Regex للتأكد أنه UUID سليم (Sad Path: Invalid UUID)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(program_id))) {
    res.status(400).json({
      success: false,
      error: "Validation error.", // مطابقة للـ Assertion بالملي
    });
    return;
  }

  next();
};

export const updateProgramValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const userRole = req.user?.role;

  // 1. جدار الحماية للأدوار: الـ Athlete ممنوع تماماً (Sad Path)
  if (userRole === "athlete") {
    res.status(403).json({
      success: false,
      error: "Forbidden — athletes cannot update programs.",
    });
    return;
  }

  // 2. 🎯 جلب الـ ID سواء مبعوث في الـ Query أو الـ Body حسب الشيت الجديد
  const program_id = req.query.program_id || req.body.program_id;
  const { duration_weeks, sessions_per_week } = req.body;

  if (!program_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — program_id is required in query or body.",
    });
    return;
  }

  // 3. فحص الـ UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(program_id))) {
    res.status(400).json({
      success: false,
      error: "Validation error — Invalid program_id format.",
    });
    return;
  }

  // 4. فحص الأرقام الاختيارية
  if (duration_weeks !== undefined) {
    const duration = Number(duration_weeks);
    if (isNaN(duration) || duration <= 0) {
      res.status(400).json({
        success: false,
        error: "Validation error — duration_weeks must be a positive number.",
      });
      return;
    }
  }

  if (sessions_per_week !== undefined) {
    const sessions = Number(sessions_per_week);
    if (isNaN(sessions) || sessions <= 0) {
      res.status(400).json({
        success: false,
        error:
          "Validation error — sessions_per_week must be a positive number.",
      });
      return;
    }
  }

  next();
};

export const enrollProgramValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const userRole = req.user?.role;
  const { program_id, preferred_time, baseline_test_values } = req.body;

  // 1. جدار حماية الأدوار: الـ Athlete فقط هو من يسجل (الكوتش ممنوع 403)
  if (userRole === "coach") {
    res.status(403).json({
      success: false,
      error: "Forbidden — only coaches can create programs.", // مطابقة للـ الـ Rule العام في السيستم عندك
    });
    return;
  }

  // 2. التأكد من إرسال الـ program_id جوه الـ Payload
  if (!program_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — program_id is required in body.",
    });
    return;
  }

  // 3. فحص الـ UUID للـ program_id
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(program_id))) {
    res.status(400).json({
      success: false,
      error: "Validation error — Invalid program_id format.",
    });
    return;
  }

  // 4. فحص صيغة الوقت (HH:MM) لو اتبعتت (لأنها اختيارية بناءً على الشيت)
  if (preferred_time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(preferred_time)) {
      res.status(400).json({
        success: false,
        error: "Invalid preferred_time format. Use HH:MM (e.g., 07:00).",
      });
      return;
    }
  }

  // 5. فحص الـ baseline_test_values
  if (
    !baseline_test_values ||
    !Array.isArray(baseline_test_values) ||
    baseline_test_values.length === 0
  ) {
    res.status(400).json({
      success: false,
      error: "baseline_test_values is required and must be a non-empty array.",
    });
    return;
  }

  next();
};

export const completeEnrollmentValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { enrollment_id, posttest_test_values } = req.body; // 🎯 جلب من الـ body بناءً على الشيت

  // 1. التأكد من إرسال الـ enrollment_id
  if (!enrollment_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — enrollment_id is required in body.",
    });
    return;
  }

  // 2. فحص صيغة الـ UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(enrollment_id))) {
    res.status(400).json({
      success: false,
      error: "Validation error — Invalid enrollment_id format.",
    });
    return;
  }

  // 3. فحص الـ posttest_test_values
  if (
    !posttest_test_values ||
    !Array.isArray(posttest_test_values) ||
    posttest_test_values.length === 0
  ) {
    res.status(400).json({
      success: false,
      error: "posttest_test_values is required and must be a non-empty array.",
    });
    return;
  }

  next();
};

export const rateProgramValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const { program_id, rating } = req.body; // 🎯 جلب من الـ body بناءً على الشيت

  // 1. التأكد من إرسال الـ program_id
  if (!program_id) {
    res.status(400).json({
      success: false,
      error: "Validation error — program_id is required in body.",
    });
    return;
  }

  // 2. فحص صيغة الـ UUID للـ program_id
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(program_id))) {
    res.status(400).json({
      success: false,
      error: "Validation error.",
    });
    return;
  }

  // 3. فحص الـ Rating وجودته ونطاقه
  const numericRating = Number(rating);
  if (
    rating === undefined ||
    isNaN(numericRating) ||
    numericRating < 1 ||
    numericRating > 5
  ) {
    res.status(400).json({
      success: false,
      error: "Validation error — rating must be 1-5.",
    });
    return;
  }

  next();
};

export const getMyEnrolledProgramsValidation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  // الـ Endpoint تعتمد بالكامل على الـ Token (req.user)
  if (!req.user || !req.user.sub) {
    res.status(401).json({
      success: false,
      error: "Unauthorized — Invalid or missing token.",
    });
    return;
  }

  next();
};

import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";

// --- 4.1 Create Program (Coach Only) ---
// Validated
export const createProgram = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const coachId = req.user?.sub as string;
    const {
      title,
      description, // جاي من الـ Body
      sport_id,
      goal_primary,
      level_target,
      duration_weeks,
      sessions_per_week,
      is_published = false,
      cover_image,
      blocks = [],
    } = req.body;

    // 1. فحص وجود الـ Sport في قاعدة البيانات
    const sportExists = await prisma.sports.findUnique({
      where: { id: Number(sport_id) },
    });
    if (!sportExists) {
      res.status(404).json({
        success: false,
        error: "Sport not found.",
      });
      return;
    }

    // 2. بناء الـ Blocks والـ Sessions ديناميكياً لو مبعوتين
    const blocksCreateData = Array.isArray(blocks)
      ? blocks.map((block: any) => ({
          name: block.name,
          description: block.description || "", // حماية للبلوكات لو ليها وصف إجباري
          order_index: block.order_index || 0,
          week_start: block.week_start || 1,
          week_end: block.week_end || 1,
          program_sessions: {
            create: Array.isArray(block.sessions)
              ? block.sessions.map((session: any) => ({
                  name: session.name,
                  description: session.description || "",
                  day_offset: session.day_offset || 0,
                  estimated_duration_minutes:
                    session.estimated_duration_minutes || 0,
                  session_exercises: {
                    create: Array.isArray(session.exercises)
                      ? session.exercises.map((exercise: any) => ({
                          exercise_name: exercise.exercise_name,
                          sets: exercise.sets || 0,
                          reps: String(exercise.reps || 0),
                          rest_seconds: exercise.rest_seconds || 0,
                          intensity_note: exercise.intensity_note,
                          notes: exercise.notes,
                          order_index: exercise.order_index || 0,
                        }))
                      : [],
                  },
                }))
              : [],
          },
        }))
      : [];

    // 3. الحفظ في قاعدة البيانات
    const newProgram = await prisma.programs.create({
      data: {
        coach_id: coachId,
        sport_id: Number(sport_id),
        title,
        description: description || "", // 🔥 الحماية الكبرى هنا: لو مش مبعوث عدي نص فاضي للـ DB عشان متضربش
        goal_primary,
        level_target,
        duration_weeks: duration_weeks ? Number(duration_weeks) : 0,
        sessions_per_week: sessions_per_week ? Number(sessions_per_week) : 0,
        is_published,
        cover_image: cover_image || undefined,
        program_blocks: {
          create: blocksCreateData,
        },
      },
      include: {
        program_blocks: {
          include: {
            program_sessions: {
              include: {
                session_exercises: true,
              },
            },
          },
        },
      },
    });

    // 4. الـ Response في النجاح (201)
    res.status(201).json({
      ...newProgram,
      enrollment_count: 0,
    });
  } catch (error: any) {
    console.error("Create Program Error:", error);
    next(error); // تمرير ذكي وآمن للـ Global Error Handler
  }
};

// Validated
export const listPrograms = async (
  req: Request,
  res: Response,
  next: NextFunction, // 🎯 ضفنا الـ next عشان الـ Global Error Handler
): Promise<void> => {
  try {
    // 1. التقاط القيم المبعوثة وجعل الـ Defaults مطابقة للـ Validator
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const offset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    const sport_id = req.query.sport_id
      ? Number(req.query.sport_id)
      : undefined;
    const duration_weeks = req.query.duration_weeks
      ? Number(req.query.duration_weeks)
      : undefined;
    const min_rating = req.query.min_rating
      ? Number(req.query.min_rating)
      : undefined;
    const goal = req.query.goal as string | undefined;
    const level = req.query.level as string | undefined;

    // 2. بناء الـ Filter (مع استبعاد الـ Drafts صراحةً لضمان شروط الشيت)
    const whereClause: any = { is_published: true };

    if (sport_id) whereClause.sport_id = sport_id;
    if (goal) whereClause.goal_primary = goal.toLowerCase().trim();
    if (level) whereClause.level_target = level.toLowerCase().trim();
    if (duration_weeks) whereClause.duration_weeks = duration_weeks;

    // فحص الـ rating_avg مع الـ Prisma (لو قاعدة البيانات مخزناه كـ Decimal أو Float)
    if (min_rating) {
      whereClause.rating_avg = { gte: String(min_rating) };
    }

    // 3. جلب البيانات بترتيب الـ Popularity والـ Rating الأعلى أولاً
    const programs = await prisma.programs.findMany({
      where: whereClause,
      orderBy: [{ enrollment_count: "desc" }, { rating_avg: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        description: true,
        goal_primary: true,
        level_target: true,
        duration_weeks: true,
        sessions_per_week: true,
        cover_image: true,
        rating_avg: true,
        rating_count: true,
        enrollment_count: true,
        users: { select: { username: true, profile_photo: true } }, // تأكد إن اسم جدول المدربين مربوط صح بـ Prisma
        sports: { select: { name: true } },
      },
    });

    // 4. عمل الـ Formatting المطابق للـ Expected Fields في السكرين شوت
    const formattedPrograms = programs.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description || "",
      goal_primary: p.goal_primary,
      level_target: p.level_target,
      duration_weeks: p.duration_weeks,
      sessions_per_week: p.sessions_per_week,
      cover_image: p.cover_image,
      rating_avg: p.rating_avg ? String(p.rating_avg) : "0",
      rating_count: p.rating_count || 0,
      enrollment_count: p.enrollment_count || 0,
      coach_name: p.users?.username || "Unknown Coach",
      coach_photo: p.users?.profile_photo || null,
      sport_name: p.sports?.name || "General",
    }));

    // 5. 🔥 الـ Response صريح ومفرود Array علطول بدون أي wrapper لتطابق الـ Test Cases
    res.status(200).json(formattedPrograms);
  } catch (error: any) {
    console.error("List Programs Error:", error);
    next(error); // 🔥 ترحيل آمن للـ Global Error Handler
  }
};

//Validated
// --- 4.3 Get Program By ID ---

export const getProgramById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const programId = req.query.program_id as string; // جلب من الـ Query
    const userRole = req.user?.role; // الـ Role الجاي من الـ Token
    const userId = req.user?.sub; // الـ ID بتاع المستخدم الحالي

    // جلب البرنامج مع كافة العلاقات المطلوبة في الشيت
    const program = await prisma.programs.findUnique({
      where: { id: programId },
      include: {
        users: { select: { username: true, profile_photo: true, bio: true } },
        program_blocks: {
          orderBy: { order_index: "asc" },
          include: {
            program_sessions: {
              orderBy: { day_offset: "asc" },
              include: {
                session_exercises: { orderBy: { order_index: "asc" } },
              },
            },
          },
        },
        program_ratings: {
          orderBy: { created_at: "desc" },
          take: 5,
          include: {
            users: { select: { username: true, profile_photo: true } },
          },
        },
      },
    });

    // 1. لو البرنامج مش موجود أصلاً في قاعدة البيانات (Non-existent program_id) -> 404
    if (!program) {
      res.status(404).json({ success: false, error: "Program not found." });
      return;
    }

    // 2. 🔥 سيناريو الـ Sad Path المعقد: البرنامج Draft واللاعب بيحاول يدخل عليه
    if (!program.is_published && userRole === "athlete") {
      res.status(404).json({
        success: false,
        error: "Not found — athletes cannot see unpublished programs.", // مطابقة للشيت بالملي
      });
      return;
    }

    // 3. ترتيب الـ Mapping والـ Formatting المفرود بدون Wrapper
    const formattedProgram = {
      id: program.id,
      title: program.title,
      description: program.description || "",
      goal_primary: program.goal_primary,
      level_target: program.level_target,
      duration_weeks: program.duration_weeks,
      sessions_per_week: program.sessions_per_week,
      cover_image: program.cover_image,
      rating_avg: program.rating_avg ? String(program.rating_avg) : "0",
      rating_count: program.rating_count || 0,
      enrollment_count: program.enrollment_count || 0,
      coach: {
        name: program.users?.username || "Unknown Coach",
        photo: program.users?.profile_photo || null,
        bio: program.users?.bio || "",
      },
      // تفكيك البلوكات والـ Sessions والـ Exercises بشكل نظيف
      blocks: program.program_blocks.map((block: any) => ({
        id: block.id,
        name: block.name,
        description: block.description || "",
        order_index: block.order_index,
        week_start: block.week_start,
        week_end: block.week_end,
        sessions: block.program_sessions.map((session: any) => ({
          id: session.id,
          name: session.name,
          description: session.description || "",
          day_offset: session.day_offset,
          estimated_duration_minutes: session.estimated_duration_minutes,
          exercises: session.session_exercises.map((exercise: any) => ({
            id: exercise.id,
            exercise_name: exercise.exercise_name,
            sets: exercise.sets,
            reps: String(exercise.reps), // التأكد إنها راجعة String '5' أو '8-12' زي الشيت
            rest_seconds: exercise.rest_seconds,
            intensity_note: exercise.intensity_note,
            notes: exercise.notes,
            order_index: exercise.order_index,
          })),
        })),
      })),
      recent_ratings: program.program_ratings.map((r: any) => ({
        rating: r.rating,
        review: r.review || "",
        username: r.users?.username || "Anonymous",
        date: r.created_at,
      })), // سميناها recent_ratings لتطابق الـ Assertion (last 5)
    };

    // 4. الـ Response مفرود تماماً في الـ Root
    res.status(200).json(formattedProgram);
  } catch (error: any) {
    console.error("Get Program By ID Error:", error);
    next(error); // الترحيل الذكي والآمن للـ Global Error Handler
  }
};

// VALIDATED
// --- 4.4 Update Program (Coach Only) ---
export const updateProgram = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const coachId = req.user?.sub as string;

    // 🎯 قراءة الـ ID ديناميكياً من الـ Query أو الـ Body
    const programId = (req.query.program_id || req.body.program_id) as string;
    const updateData = req.body;

    // 1. فحص الـ Exist
    const program = await prisma.programs.findUnique({
      where: { id: programId },
      select: { coach_id: true },
    });

    if (!program) {
      res.status(404).json({
        success: false,
        error: "Not found.",
      });
      return;
    }

    // 2. فحص الملكية (Coach tries to update another coach's program)
    if (program.coach_id !== coachId) {
      res.status(403).json({
        success: false,
        error: "Forbidden — not program owner.",
      });
      return;
    }

    // 3. التحديث (مع استبعاد الـ program_id لو مبعوث جوه الـ body عشان ميعملش مشاكل مع الـ Prisma)
    const { program_id, ...pureUpdateData } = updateData;

    const updatedProgram = await prisma.programs.update({
      where: { id: programId },
      data: {
        ...(pureUpdateData.title !== undefined && {
          title: pureUpdateData.title,
        }),
        ...(pureUpdateData.description !== undefined && {
          description: pureUpdateData.description,
        }),
        ...(pureUpdateData.goal_primary !== undefined && {
          goal_primary: pureUpdateData.goal_primary,
        }),
        ...(pureUpdateData.level_target !== undefined && {
          level_target: pureUpdateData.level_target,
        }),
        ...(pureUpdateData.duration_weeks !== undefined && {
          duration_weeks: Number(pureUpdateData.duration_weeks),
        }),
        ...(pureUpdateData.sessions_per_week !== undefined && {
          sessions_per_week: Number(pureUpdateData.sessions_per_week),
        }),
        ...(pureUpdateData.is_published !== undefined && {
          is_published: pureUpdateData.is_published,
        }),
        ...(pureUpdateData.cover_image !== undefined && {
          cover_image: pureUpdateData.cover_image,
        }),
      },
    });

    // 4. Response مفرود تماماً في الـ Root
    res.status(200).json(updatedProgram);
  } catch (error: any) {
    console.error("Update Program Error:", error);
    next(error);
  }
};

// not Validated i think it work good
// --- 4.5 Delete Program (Coach Only) ---
export const deleteProgram = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const coachId = req.user?.sub as string;
    const programId = req.params.id as string;

    // Validate UUID format to prevent Prisma from throwing a 500 error
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(programId)) {
      res.status(400).json({
        success: false,
        error: "Invalid Program ID format. Must be a valid UUID.",
      });
      return;
    }

    const program = await prisma.programs.findUnique({
      select: { coach_id: true },
      where: { id: programId },
    });

    if (!program) {
      res.status(404).json({ success: false, error: "Program not found." });
      return;
    }
    if (program.coach_id !== coachId) {
      res.status(403).json({
        success: false,
        error: "Forbidden: You can only delete your own programs.",
      });
      return;
    }

    const activeEnrollments = await prisma.enrollments.count({
      where: { program_id: programId, status: "active" },
    });

    if (activeEnrollments > 0) {
      res.status(409).json({
        success: false,
        error: "Conflict: Cannot delete a program with active enrollments.",
      });
      return;
    }

    await prisma.programs.delete({ where: { id: programId } });

    res
      .status(200)
      .json({ success: true, message: "Program deleted successfully." });
  } catch (error: any) {
    console.error("Delete Program Error:", error);
    // If Prisma fails due to foreign key constraints
    if (error.code === "P2003") {
      res.status(409).json({
        success: false,
        error:
          "Conflict: Cannot delete this program because it is referenced by other records (e.g., past completed enrollments or history).",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while deleting the program.",
    });
  }
};

//Validated
// --- 4.6 Enroll in Program (Athlete) ---
// export const enrollInProgram = async (
//   req: AuthRequest,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const userId = String(req.user?.sub);
//     const { program_id, preferred_days, preferred_time, baseline_test_values } = req.body;

//     // 1. صياغة الوقت بشكل سليم أو تركه null لو مش موجود (إختياري في الشيت)
//     let formattedTime: Date | null = null;
//     if (preferred_time) {
//       formattedTime = new Date(`1970-01-01T${preferred_time}:00.000Z`);
//     }

//     // 2. التحقق من وجود البرنامج وأنه Published
//     const program = await prisma.programs.findUnique({
//       where: { id: program_id, is_published: true },
//       select: { id: true, title: true, sport_id: true },
//     });

//     if (!program) {
//       res.status(404).json({
//         success: false,
//         error: "Program not found or not published."
//       });
//       return;
//     }

//     // 3. فحص الـ Conflict (التسجيل المزدوج لمنع الـ Athlete من التسجيل مرتين)
//     const existingEnrollment = await prisma.enrollments.findFirst({
//       where: { user_id: userId, program_id: program_id, status: "active" },
//     });

//     if (existingEnrollment) {
//       res.status(409).json({
//         success: false,
//         error: "Conflict — already actively enrolled." // مطابقة للشيت بالملي
//       });
//       return;
//     }

//     // 4. فحص صحة الـ attribute_test_ids المبعوثة في الـ Array
//     const testIds = baseline_test_values.map((t: any) => {
//       if (!t.attribute_test_id || t.value === undefined) {
//         throw new Error("VALIDATION_ERROR: Each test value must have an attribute_test_id and a value.");
//       }
//       return Number(t.attribute_test_id);
//     });

//     const testsInfo = await prisma.attribute_tests.findMany({
//       where: { id: { in: testIds } },
//       select: { id: true, unit: true },
//     });

//     if (testsInfo.length !== [...new Set(testIds)].length) {
//       res.status(404).json({
//         success: false,
//         error: "One or more provided attribute_test_ids are invalid or do not exist."
//       });
//       return;
//     }

//     let testUnits: Record<number, string> = {};
//     testsInfo.forEach((t) => {
//       testUnits[t.id] = t.unit;
//     });

//     // 5. 🎯 الـ Transaction المقفلة بذكاء لتفادي مشاكل الـ Scope والـ TypeScript الـ الـ Compiler
//     const transactionResult = await prisma.$transaction(async (tx) => {
//       // أ) إنشاء الـ Baseline Snapshot
//       const baselineSnapshot = await tx.physical_snapshots.create({
//         data: {
//           user_id: userId,
//           sport_id: program.sport_id,
//           snapshot_type: "program_baseline",
//           snapshot_test_values: {
//             create: baseline_test_values.map((test: any) => ({
//               attribute_test_id: Number(test.attribute_test_id),
//               value: Number(test.value),
//               unit: testUnits[Number(test.attribute_test_id)] || "units",
//             })),
//           },
//         },
//       });

//       // ب) إنشاء الـ Enrollment وربطه بالـ Snapshot
//       const enrollment = await tx.enrollments.create({
//         data: {
//           users: { connect: { id: userId } },
//           programs: { connect: { id: program_id } },
//           status: "active",
//           start_date: new Date(),
//           preferred_days: Array.isArray(preferred_days) ? preferred_days : [],
//           preferred_time: formattedTime,
//           physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots: {
//             connect: { id: baselineSnapshot.id },
//           },
//         },
//       });

//       // جـ) تحديث الـ Snapshot بالإشارة العكسية للـ Enrollment ID
//       await tx.physical_snapshots.update({
//         where: { id: baselineSnapshot.id },
//         data: { program_enrollment_id: enrollment.id },
//       });

//       // د) توليد الـ System post تلقائياً على الفيد
//       const user = await tx.users.findUnique({
//         where: { id: userId },
//         select: { username: true },
//       });

//       await tx.posts.create({
//         data: {
//           user_id: userId,
//           program_id: program_id,
//           content: `${user?.username || "A user"} just started the "${program.title}" training program! Time to put in the work! 🥊🔥`,
//           is_system_generated: true,
//         },
//       });

//       // 🎯 بنرجع الـ الاثنين سوا في Object كـ Return للـ Transaction عشان الـ Scope الخارجي يشوفهم بأمان
//       return { enrollment, baselineSnapshotId: baselineSnapshot.id };
//     });

//     // 6. 🎯 إرجاع الـ Response مفرود ونظيف ومطابق للـ Assertions في الـ Excel
//     res.status(201).json({
//       id: transactionResult.enrollment.id,
//       status: transactionResult.enrollment.status,
//       start_date: transactionResult.enrollment.start_date,
//       baseline_snapshot_id: transactionResult.baselineSnapshotId // 👈 مقروءة بـ Type-safety كاملة
//     });

//   } catch (error: any) {
//     // إمساك أخطاء الفاليديشن اليدوية بداخل الـ Transaction
//     if (error.message?.startsWith("VALIDATION_ERROR:")) {
//       res.status(400).json({
//         success: false,
//         error: error.message.replace("VALIDATION_ERROR: ", ""),
//       });
//       return;
//     }

//     console.error("Enrollment Error:", error);
//     next(error); // الـ الـ الترحيل السليم للـ Global Error Handler
//   }
// };
export const enrollInProgram = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);
    const { program_id, preferred_days, preferred_time, baseline_test_values } =
      req.body;

    // 1. صياغة الوقت بشكل سليم أو تركه null لو مش موجود
    let formattedTime: Date | null = null;
    if (preferred_time) {
      formattedTime = new Date(`1970-01-01T${preferred_time}:00.000Z`);
    }

    // 2. التحقق من وجود البرنامج وأنه Published
    const program = await prisma.programs.findUnique({
      where: { id: program_id, is_published: true },
      select: { id: true, title: true, sport_id: true },
    });

    if (!program) {
      res.status(404).json({
        success: false,
        error: "Program not found or not published.",
      });
      return;
    }

    // 3. 🎯 فحص الـ Conflict المتطور (الحل الجذري لمنع ضرب الـ Unique Constraint في الـ Database)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingEnrollment = await prisma.enrollments.findFirst({
      where: {
        user_id: userId,
        program_id: program_id,
        OR: [
          { status: "active" }, // لو التسجيل الحالي لسه شغال ونشط
          {
            start_date: {
              gte: todayStart,
              lte: todayEnd,
            },
          }, // أو لو تم تسجيله بالفعل في نفس اليوم (لحماية التست السريع ورا بعضه)
        ],
      },
    });

    if (existingEnrollment) {
      res.status(409).json({
        success: false,
        error: "Conflict — already actively enrolled.", // مطابقة للشيت بالملي
      });
      return;
    }

    // 4. فحص صحة الـ attribute_test_ids المبعوثة في الـ Array
    const testIds = baseline_test_values.map((t: any) => {
      if (!t.attribute_test_id || t.value === undefined) {
        throw new Error(
          "VALIDATION_ERROR: Each test value must have an attribute_test_id and a value.",
        );
      }
      return Number(t.attribute_test_id);
    });

    const testsInfo = await prisma.attribute_tests.findMany({
      where: { id: { in: testIds } },
      select: { id: true, unit: true },
    });

    if (testsInfo.length !== [...new Set(testIds)].length) {
      res.status(404).json({
        success: false,
        error:
          "One or more provided attribute_test_ids are invalid or do not exist.",
      });
      return;
    }

    let testUnits: Record<number, string> = {};
    testsInfo.forEach((t) => {
      testUnits[t.id] = t.unit;
    });

    // 5. الـ Transaction لتنفيذ الـ Baseline والـ Enrollment والـ Post سوا بـ Type-safety كاملة
    const transactionResult = await prisma.$transaction(async (tx) => {
      // أ) إنشاء الـ Baseline Snapshot
      const baselineSnapshot = await tx.physical_snapshots.create({
        data: {
          user_id: userId,
          sport_id: program.sport_id,
          snapshot_type: "program_baseline",
          snapshot_test_values: {
            create: baseline_test_values.map((test: any) => ({
              attribute_test_id: Number(test.attribute_test_id),
              value: Number(test.value),
              unit: testUnits[Number(test.attribute_test_id)] || "units",
            })),
          },
        },
      });

      // ب) إنشاء الـ Enrollment وربطه بالـ Snapshot
      const enrollment = await tx.enrollments.create({
        data: {
          users: { connect: { id: userId } },
          programs: { connect: { id: program_id } },
          status: "active",
          start_date: new Date(),
          preferred_days: Array.isArray(preferred_days) ? preferred_days : [],
          preferred_time: formattedTime,
          physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots:
            {
              connect: { id: baselineSnapshot.id },
            },
        },
      });

      // جـ) تحديث الـ Snapshot بالإشارة العكسية للـ Enrollment ID
      await tx.physical_snapshots.update({
        where: { id: baselineSnapshot.id },
        data: { program_enrollment_id: enrollment.id },
      });

      // د) توليد الـ System post تلقائياً على الفيد
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      await tx.posts.create({
        data: {
          user_id: userId,
          program_id: program_id,
          content: `${user?.username || "A user"} just started the "${program.title}" training program! Time to put in the work! 🥊🔥`,
          is_system_generated: true,
        },
      });

      return { enrollment, baselineSnapshotId: baselineSnapshot.id };
    });

    // 6. 🎯 إرجاع الـ Response مفرود ونظيف ومطابق للـ Assertions في الـ Excel
    res.status(201).json({
      id: transactionResult.enrollment.id,
      status: transactionResult.enrollment.status,
      start_date: transactionResult.enrollment.start_date,
      baseline_snapshot_id: transactionResult.baselineSnapshotId,
    });
  } catch (error: any) {
    // إمساك أخطاء Prisma الـ Unique Constraint كخط دفاع ثانٍ وإرجاع 409 نظيفة
    if (error.code === "P2002") {
      res.status(409).json({
        success: false,
        error: "Conflict — already actively enrolled.",
      });
      return;
    }

    if (error.message?.startsWith("VALIDATION_ERROR:")) {
      res.status(400).json({
        success: false,
        error: error.message.replace("VALIDATION_ERROR: ", ""),
      });
      return;
    }

    console.error("Enrollment Error:", error);
    next(error);
  }
};
//validated
// --- 4.7 Complete Enrollment (Athlete) ---
export const completeEnrollment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);
    const { enrollment_id, posttest_test_values } = req.body;

    // 1. جلب الـ Enrollment مع علاقات الـ Baseline للتأكد من الـ وجود والملكيه
    const enrollment = await prisma.enrollments.findUnique({
      where: { id: enrollment_id },
      include: {
        programs: { select: { title: true, sport_id: true, id: true } },
        physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots:
          {
            include: { snapshot_test_values: true },
          },
      },
    });

    if (!enrollment) {
      res.status(404).json({ success: false, error: "Enrollment not found." });
      return;
    }

    if (enrollment.user_id !== userId) {
      res
        .status(403)
        .json({ success: false, error: "Forbidden: Not your enrollment." });
      return;
    }

    // 2. 🔥 الصد الفوري لسيناريو الـ Sad Path لو الـ Enrollment مش active
    if (enrollment.status !== "active") {
      res.status(409).json({
        success: false,
        error: "Conflict — enrollment is not active.", // مطابقة للشيت بالملي
      });
      return;
    }

    // 3. التحقق من الـ attribute_test_ids وصحتها
    const testIds: number[] = [];
    for (const t of posttest_test_values) {
      if (
        !t.attribute_test_id ||
        t.value === undefined ||
        isNaN(Number(t.value))
      ) {
        res.status(400).json({
          success: false,
          error:
            "Each posttest item must include a valid attribute_test_id and a numerical value.",
        });
        return;
      }
      testIds.push(Number(t.attribute_test_id));
    }

    const testsInfo = await prisma.attribute_tests.findMany({
      where: { id: { in: testIds } },
      select: { id: true, unit: true },
    });

    if (testsInfo.length !== [...new Set(testIds)].length) {
      res.status(404).json({
        success: false,
        error:
          "One or more provided attribute_test_ids do not exist in the system.",
      });
      return;
    }

    let testUnits: Record<number, string> = {};
    testsInfo.forEach((t) => {
      testUnits[t.id] = t.unit;
    });

    // 4. استخراج الـ Baseline لعمل الـ Mapping والحسابات
    const baselineValues =
      enrollment
        .physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots
        ?.snapshot_test_values || [];
    let deltas: any[] = [];

    posttest_test_values.forEach((postTest: any) => {
      const baseTest = baselineValues.find(
        (b) => b.attribute_test_id === Number(postTest.attribute_test_id),
      );
      if (baseTest) {
        const diff = Number(postTest.value) - Number(baseTest.value);
        deltas.push({
          test_id: postTest.attribute_test_id,
          baseline: Number(baseTest.value),
          posttest: Number(postTest.value),
          improvement: diff,
        });
      }
    });

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const testimonial = `${user?.username || "A user"} completed "${enrollment.programs.title}" and leveled up their stats! 📈🥊`;

    // 5. 🎯 الـ Transaction المقفلة والآمنه للـ Database Updates
    const transactionResult = await prisma.$transaction(async (tx) => {
      const postSnapshot = await tx.physical_snapshots.create({
        data: {
          user_id: userId,
          sport_id: enrollment.programs.sport_id,
          snapshot_type: "program_posttest",
          program_enrollment_id: enrollment.id,
          snapshot_test_values: {
            create: posttest_test_values.map((t: any) => ({
              attribute_test_id: Number(t.attribute_test_id),
              value: Number(t.value),
              unit: testUnits[Number(t.attribute_test_id)] || "units",
            })),
          },
        },
      });

      const updatedEnrollment = await tx.enrollments.update({
        where: { id: enrollment_id },
        data: {
          status: "completed",
          completed_date: new Date(),
          physical_snapshots_enrollments_posttest_snapshot_idTophysical_snapshots:
            {
              connect: { id: postSnapshot.id },
            },
        },
      });

      await tx.posts.create({
        data: {
          user_id: userId,
          program_id: enrollment.program_id,
          content: testimonial,
          is_system_generated: true,
          metadata: { deltas, testimonial },
        },
      });

      return updatedEnrollment;
    });

    // 6. 🎯 الـ Response مفرود بالكامل لتلبية كافة الـ Assertions بدون Wrapper
    res.status(200).json({
      enrollment: {
        id: transactionResult.id,
        status: transactionResult.status,
        completed_date: transactionResult.completed_date,
      },
      deltas,
      testimonial,
    });
  } catch (error: any) {
    console.error("Complete Enrollment Error:", error);
    next(error); // الـ الـ الترحيل الذكي والآمن للـ Global Error Handler فورا
  }
};

// --- 4.8 Rate Program (Athlete) ---
export const rateProgram = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);
    const { program_id, rating, review } = req.body;
    const numericRating = Number(rating);

    // 1. فحص هل المستخدم عنده أي سجل تسجيل (Enrollment) في هذا البرنامج أصلاً
    const anyEnrollment = await prisma.enrollments.findFirst({
      where: { user_id: userId, program_id: program_id },
    });

    if (!anyEnrollment) {
      res.status(403).json({
        success: false,
        error: "Forbidden — no completed enrollment found.", // مطابقة للشيت بالملي
      });
      return;
    }

    // 2. فحص هل الـ Enrollment لسه active ولم يكتمل بعد
    if (anyEnrollment.status !== "completed") {
      res.status(403).json({
        success: false,
        error: "Forbidden — must complete program first.", // مطابقة للشيت بالملي
      });
      return;
    }

    // 3. فحص التقييم المزدوج (هل قيم البرنامج ده قبل كدة؟)
    const existingRating = await prisma.program_ratings.findFirst({
      where: { user_id: userId, program_id: program_id },
    });

    if (existingRating) {
      res.status(409).json({
        success: false,
        error: "Conflict — already rated (unique constraint).", // مطابقة للشيت بالملي
      });
      return;
    }

    // 4. تنفيذ الـ Transaction لتسجيل التقييم وتحديث إحصائيات البرنامج
    const transactionResult = await prisma.$transaction(async (tx) => {
      // أ) إنشاء سجل التقييم الجديد
      const newRating = await tx.program_ratings.create({
        data: {
          enrollment_id: anyEnrollment.id,
          user_id: userId,
          program_id: program_id,
          rating: numericRating,
          review: review ? String(review).trim() : null,
        },
      });

      // ب) حساب المتوسط والعدد الجديد للتقييمات
      const aggregations = await tx.program_ratings.aggregate({
        where: { program_id: program_id },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const newAvg = aggregations._avg.rating || numericRating;
      const newCount = aggregations._count.rating || 1;

      // جـ) تحديث جدول الـ programs الأساسي بالمتوسط والعدد الجديد
      // ملاحظة: الشيت أشار إلى أن الـ DB trigger بيقوم بده تلقائياً، ولكن زيادة تأكيد وأمان للـ Tests بنعملها جوه الـ Transaction
      await tx.programs.update({
        where: { id: program_id },
        data: {
          rating_avg: newAvg,
          rating_count: newCount,
        },
      });

      return newRating;
    });

    // 5. 🎯 إرجاع الـ Response مفرود بالكامل لتلبية شروط التيست
    res.status(201).json({
      id: transactionResult.id,
      program_id: transactionResult.program_id,
      user_id: transactionResult.user_id,
      rating: transactionResult.rating,
      review: transactionResult.review,
      created_at: transactionResult.created_at,
    });
  } catch (error: any) {
    console.error("Rate Program Error:", error);
    next(error); // الـ الترحيل السليم للـ Global Error Handler
  }
};

// the missed part on the old code // Getting the athlete enrolled programs
export const getMyEnrolledPrograms = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);

    // 1. جلب سجلات التسجيل الخاصة باللاعب مع تفاصيل البرنامج الأساسية
    const enrollments = await prisma.enrollments.findMany({
      where: { user_id: userId },
      include: {
        programs: {
          select: {
            id: true,
            title: true,
            description: true,
            duration_weeks: true,
            rating_avg: true,
            rating_count: true,
            sport_id: true,
            coach_id: true,
          },
        },
        // اختياري: لو عاوز تجيب الـ snapshots المرتبطة بالتسجيل ده
        physical_snapshots_enrollments_baseline_snapshot_idTophysical_snapshots:
          {
            select: { id: true, created_at: true },
          },
      },
      orderBy: {
        start_date: "desc", // ترتيب من الأحدث للأقدم
      },
    });

    // 2. 🎯 الـ Sad Path: لو اللاعب مش مسجل في أي برنامج نهائي في السيستم
    if (!enrollments || enrollments.length === 0) {
      res.status(404).json({
        success: false,
        error: "No enrolled programs found for this user.",
      });
      return;
    }

    // 3. 🎯 الـ Happy Path: تجهيز الداتا ومطابقتها وتصفيتها بشكل مفرود
    const formattedPrograms = enrollments.map((enrollment) => ({
      enrollment_id: enrollment.id,
      status: enrollment.status,
      start_date: enrollment.start_date,
      completed_date: enrollment.completed_date,
      preferred_days: enrollment.preferred_days,
      preferred_time: enrollment.preferred_time,
      baseline_snapshot_id: enrollment.baseline_snapshot_id,
      posttest_snapshot_id: enrollment.posttest_snapshot_id,
      program: enrollment.programs, // بيانات البرنامج المدمجة
    }));

    // إرسال الـ Response مفرود في الـ Root بدون Wrapper تلبية لشروط الشيتات السابقة
    res.status(200).json(formattedPrograms);
  } catch (error: any) {
    console.error("Get Enrolled Programs Error:", error);
    next(error); // الترحيل الفوري للـ Global Error Handler الآمن
  }
};

//we have in explore the top popular programs
// i think it handled by the front end by doing a for loop on the rating and list the largest on the Rate

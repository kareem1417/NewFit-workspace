import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";

// --- 4.1 Create Program (Coach Only) ---
export const createProgram = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const coachId = req.user?.sub as string;

    // 1. Ensure this user is a coach directly from the token
    const userRole = req.user?.role;
    if (userRole !== "coach") {
      res
        .status(403)
        .json({ success: false, error: "Only coaches can create programs." });
      return;
    }

    const {
      title,
      description,
      sport_id,
      goal_primary,
      level_target,
      duration_weeks,
      sessions_per_week,
      is_published = false,
      cover_image,
      blocks,
    } = req.body;

    // 2. Validate Root Program Data
    if (
      !title ||
      !sport_id ||
      !duration_weeks ||
      !sessions_per_week ||
      !goal_primary ||
      !level_target
    ) {
      res.status(400).json({
        success: false,
        error:
          "Missing required fields: title, sport_id, goal_primary, level_target, duration_weeks, and sessions_per_week are required.",
      });
      return;
    }

    // 3. Verify that the sport exists in the Database
    const sportExists = await prisma.sports.findUnique({
      where: { id: Number(sport_id) },
    });
    if (!sportExists) {
      res.status(404).json({
        success: false,
        error: `Sport with ID ${sport_id} does not exist.`,
      });
      return;
    }

    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      res.status(400).json({
        success: false,
        error: "Program must contain at least one block.",
      });
      return;
    }

    for (const block of blocks) {
      if (
        !block.name ||
        block.order_index === undefined ||
        block.week_start === undefined ||
        block.week_end === undefined
      ) {
        res.status(400).json({
          success: false,
          error:
            "Each block must have a name, order_index, week_start, and week_end.",
        });
        return;
      }

      if (
        !block.sessions ||
        !Array.isArray(block.sessions) ||
        block.sessions.length === 0
      ) {
        res.status(400).json({
          success: false,
          error: `Block '${block.name}' must contain at least one session.`,
        });
        return;
      }

      for (const session of block.sessions) {
        if (
          !session.name ||
          session.day_offset === undefined ||
          session.estimated_duration_minutes === undefined
        ) {
          res.status(400).json({
            success: false,
            error: `Each session in block '${block.name}' must have a name, day_offset, and estimated_duration_minutes.`,
          });
          return;
        }

        if (
          !session.exercises ||
          !Array.isArray(session.exercises) ||
          session.exercises.length === 0
        ) {
          res.status(400).json({
            success: false,
            error: `Session '${session.name}' must contain at least one exercise.`,
          });
          return;
        }

        for (const exercise of session.exercises) {
          if (
            !exercise.exercise_name ||
            exercise.sets === undefined ||
            exercise.reps === undefined ||
            exercise.order_index === undefined
          ) {
            res.status(400).json({
              success: false,
              error: `Each exercise in session '${session.name}' must have an exercise_name, sets, reps, and order_index.`,
            });
            return;
          }
        }
      }
    }

    const newProgram = await prisma.programs.create({
      data: {
        coach_id: coachId,
        sport_id: Number(sport_id),
        title,
        description,
        goal_primary,
        level_target,
        duration_weeks: Number(duration_weeks),
        sessions_per_week: Number(sessions_per_week),
        is_published,
        cover_image,
        program_blocks: {
          create: blocks.map((block: any) => ({
            name: block.name,
            description: block.description,
            order_index: block.order_index,
            week_start: block.week_start,
            week_end: block.week_end,
            program_sessions: {
              create: block.sessions.map((session: any) => ({
                name: session.name,
                description: session.description,
                day_offset: session.day_offset,
                estimated_duration_minutes: session.estimated_duration_minutes,
                session_exercises: {
                  create: session.exercises.map((exercise: any) => ({
                    exercise_name: exercise.exercise_name,
                    sets: exercise.sets,
                    reps: String(exercise.reps),
                    rest_seconds: exercise.rest_seconds,
                    intensity_note: exercise.intensity_note,
                    notes: exercise.notes,
                    order_index: exercise.order_index,
                  })),
                },
              })),
            },
          })),
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

    res.status(201).json({
      success: true,
      message: "Program created successfully!",
      data: newProgram,
    });
  } catch (error: any) {
    console.error("Create Program Error:", error);

    if (error.code === "P2002") {
      res.status(400).json({
        success: false,
        error: "A unique constraint failed on the program creation.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while creating the program.",
    });
  }
};

// Handelled
// --- 4.2 List Programs ---
export const listPrograms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 1. Validate and Parse Pagination (Limit & Offset)
    const rawLimit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const rawOffset = req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : 0;

    if (isNaN(rawLimit) || rawLimit <= 0) {
      res.status(400).json({
        success: false,
        error: "Query parameter 'limit' must be a positive number.",
      });
      return;
    }
    if (isNaN(rawOffset) || rawOffset < 0) {
      res.status(400).json({
        success: false,
        error: "Query parameter 'offset' must be a non-negative number.",
      });
      return;
    }

    let sport_id: number | undefined;
    if (req.query.sport_id) {
      sport_id = Number(req.query.sport_id);
      if (isNaN(sport_id)) {
        res.status(400).json({
          success: false,
          error: "Query parameter 'sport_id' must be a valid number.",
        });
        return;
      }
    }

    let duration_weeks: number | undefined;
    if (req.query.duration_weeks) {
      duration_weeks = Number(req.query.duration_weeks);
      if (isNaN(duration_weeks) || duration_weeks <= 0) {
        res.status(400).json({
          success: false,
          error: "Query parameter 'duration_weeks' must be a positive number.",
        });
        return;
      }
    }

    let min_rating: number | undefined;
    if (req.query.min_rating) {
      min_rating = Number(req.query.min_rating);
      if (isNaN(min_rating) || min_rating < 0 || min_rating > 5) {
        res.status(400).json({
          success: false,
          error:
            "Query parameter 'min_rating' must be a number between 0 and 5.",
        });
        return;
      }
    }

    const goal = req.query.goal as string | undefined;
    const level = req.query.level as string | undefined;

    const whereClause: any = { is_published: true };

    if (sport_id) whereClause.sport_id = sport_id;
    if (goal) whereClause.goal_primary = goal;
    if (level) whereClause.level_target = level;
    if (duration_weeks) whereClause.duration_weeks = duration_weeks;
    if (min_rating) whereClause.rating_avg = { gte: min_rating };

    const totalCount = await prisma.programs.count({ where: whereClause });

    const programs = await prisma.programs.findMany({
      where: whereClause,
      orderBy: [{ enrollment_count: "desc" }, { rating_avg: "desc" }],
      take: rawLimit,
      skip: rawOffset,
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
        users: { select: { username: true, profile_photo: true } },
        sports: { select: { name: true } },
      },
    });

    // Used (p: any) to prevent TypeScript errors on related tables
    const formattedPrograms = programs.map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      goal_primary: p.goal_primary,
      level_target: p.level_target,
      duration_weeks: p.duration_weeks,
      sessions_per_week: p.sessions_per_week,
      cover_image: p.cover_image,
      rating_avg: p.rating_avg,
      rating_count: p.rating_count,
      enrollment_count: p.enrollment_count,
      coach_name: p.users?.username,
      coach_photo: p.users?.profile_photo,
      sport_name: p.sports?.name,
    }));

    res.status(200).json({
      success: true,
      data: formattedPrograms,
      meta: { total: totalCount, rawLimit, rawOffset },
    });
  } catch (error: any) {
    console.error("List Programs Error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while fetching programs.",
    });
  }
};

//
// --- 4.3 Get Program By ID ---
export const getProgramById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const programId = req.params.id as string;

    const program = await prisma.programs.findUnique({
      where: { id: programId, is_published: true },
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

    if (!program) {
      res.status(404).json({ success: false, error: "Program not found." });
      return;
    }

    const formattedProgram = {
      id: program.id,
      title: program.title,
      description: program.description,
      goal_primary: program.goal_primary,
      level_target: program.level_target,
      duration_weeks: program.duration_weeks,
      sessions_per_week: program.sessions_per_week,
      cover_image: program.cover_image,
      rating_avg: program.rating_avg,
      rating_count: program.rating_count,
      enrollment_count: program.enrollment_count,
      coach: {
        name: program.users?.username,
        photo: program.users?.profile_photo,
        bio: program.users?.bio,
      },
      blocks: program.program_blocks,
      recent_reviews: program.program_ratings.map((r: any) => ({
        rating: r.rating,
        review: r.review,
        username: r.users?.username,
        date: r.created_at,
      })),
    };

    res.status(200).json({ success: true, data: formattedProgram });
  } catch (error: any) {
    console.error("Get Program By ID Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch program details." });
  }
};

//  HANdelled
// --- 4.4 Update Program (Coach Only) ---
export const updateProgram = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const coachId = req.user?.sub as string; // if(program.coach_id !== coachId){}
    const programId = req.params.id as string; // if(!programId) {}
    const updateData = req.body;

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

    // Prevent empty body updates
    if (!updateData || Object.keys(updateData).length === 0) {
      res
        .status(400)
        .json({ success: false, error: "Update body cannot be empty." });
      return;
    }

    // Validate numbers if they are provided in the body
    if (updateData.duration_weeks !== undefined) {
      const duration = Number(updateData.duration_weeks);
      if (isNaN(duration) || duration <= 0) {
        res.status(400).json({
          success: false,
          error: "duration_weeks must be a positive number.",
        });
        return;
      }
    }

    if (updateData.sessions_per_week !== undefined) {
      const sessions = Number(updateData.sessions_per_week);
      if (isNaN(sessions) || sessions <= 0) {
        res.status(400).json({
          success: false,
          error: "sessions_per_week must be a positive number.",
        });
        return;
      }
    }

    // check if program exists
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
        error: "Forbidden: You can only update your own programs.",
      });
      return;
    }

    const updatedProgram = await prisma.programs.update({
      // updating data of the program
      where: { id: programId },
      data: {
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.description && { description: updateData.description }),
        ...(updateData.goal_primary && {
          goal_primary: updateData.goal_primary,
        }),
        ...(updateData.level_target && {
          level_target: updateData.level_target,
        }),
        ...(updateData.duration_weeks && {
          duration_weeks: Number(updateData.duration_weeks),
        }),
        ...(updateData.sessions_per_week && {
          sessions_per_week: Number(updateData.sessions_per_week),
        }),
        ...(updateData.is_published !== undefined && {
          is_published: updateData.is_published,
        }),
        ...(updateData.cover_image && { cover_image: updateData.cover_image }),
      },
    });

    res.status(200).json({
      success: true,
      message: "Program updated successfully.",
      data: updatedProgram,
    });
  } catch (error: any) {
    console.error("Update Program Error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while updating the program.",
    });
  }
};

// HAndelled
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

//Handelled
// --- 4.6 Enroll in Program (Athlete) ---
export const enrollInProgram = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);
    const programId = String(req.params.id as string);
    //Validate UUID format to prevent Prisma from throwing a 500 error
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(programId)) {
      res.status(400).json({
        success: false,
        error: "Invalid Program ID format. Must be a valid UUID.",
      });
      return;
    }

    const { preferred_days, preferred_time, baseline_test_values } = req.body;

    // 2. Validate preferred_time format (HH:MM)
    let formattedTime: Date | null = null;
    if (preferred_time) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(preferred_time)) {
        res.status(400).json({
          success: false,
          error: "Invalid preferred_time format. Use HH:MM (e.g., 18:00).",
        });
        return;
      }
      formattedTime = new Date(`1970-01-01T${preferred_time}:00.000Z`);
    }

    const program = await prisma.programs.findUnique({
      where: { id: programId, is_published: true },
      select: { id: true, title: true, sport_id: true },
    });

    if (!program) {
      res
        .status(404)
        .json({ success: false, error: "Program not found or not published." });
      return;
    }

    const existingEnrollment = await prisma.enrollments.findFirst({
      where: { user_id: userId, program_id: programId, status: "active" },
    });

    if (existingEnrollment) {
      res.status(409).json({
        success: false,
        error: "You are already actively enrolled in this program.",
      });
      return;
    }

    //Validate baseline_test_values array structure
    if (
      !baseline_test_values ||
      !Array.isArray(baseline_test_values) ||
      baseline_test_values.length === 0
    ) {
      res.status(400).json({
        success: false,
        error:
          "baseline_test_values is required and must be a non-empty array.",
      });
      return;
    }

    let testUnits: Record<number, string> = {};
    const testIds = baseline_test_values.map((t) => {
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

    testsInfo.forEach((t) => {
      testUnits[t.id] = t.unit;
    });

    const transactionResult = await prisma.$transaction(async (tx) => {
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

      const enrollment = await tx.enrollments.create({
        data: {
          users: { connect: { id: userId } },
          programs: { connect: { id: programId } },
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

      await tx.physical_snapshots.update({
        where: { id: baselineSnapshot.id },
        data: { program_enrollment_id: enrollment.id },
      });

      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      await tx.posts.create({
        data: {
          user_id: userId,
          program_id: programId,
          content: `${user?.username || "A user"} just started the "${program.title}" training program! Time to put in the work! 🥊🔥`,
          is_system_generated: true,
        },
      });

      return enrollment;
    });

    res.status(201).json({
      success: true,
      message: "Successfully enrolled!",
      data: transactionResult,
    });
  } catch (error: any) {
    console.error("Enrollment Error:", error);

    if (error.message?.startsWith("VALIDATION_ERROR:")) {
      res.status(400).json({
        success: false,
        error: error.message.replace("VALIDATION_ERROR: ", ""),
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "An unexpected error occurred during enrollment.",
    });
  }
};

// --- 4.7 Complete Enrollment (Athlete) ---
export const completeEnrollment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = String(req.user?.sub);
    const enrollmentId = String(req.params.id as string);

    //Validate UUID format to prevent Prisma from throwing a 500 error
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(enrollmentId)) {
      res.status(400).json({
        success: false,
        error: "Invalid Enrollment ID format. Must be a valid UUID.",
      });
      return;
    }

    const { posttest_test_values } = req.body;

    //Validate posttest_test_values array structure
    if (
      !posttest_test_values ||
      !Array.isArray(posttest_test_values) ||
      posttest_test_values.length === 0
    ) {
      res.status(400).json({
        success: false,
        error:
          "posttest_test_values is required and must be a non-empty array.",
      });
      return;
    }

    const enrollment = await prisma.enrollments.findUnique({
      where: { id: enrollmentId },
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
    if (enrollment.status !== "active") {
      res
        .status(409)
        .json({ success: false, error: "Conflict: Enrollment is not active." });
      return;
    }

    let testUnits: Record<number, string> = {};
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

    testsInfo.forEach((t) => {
      testUnits[t.id] = t.unit;
    });

    const result = await prisma.$transaction(async (tx) => {
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
        where: { id: enrollmentId },
        data: {
          status: "completed",
          completed_date: new Date(),
          physical_snapshots_enrollments_posttest_snapshot_idTophysical_snapshots:
            {
              connect: { id: postSnapshot.id },
            },
        },
      });

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

      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      const testimonial = `${user?.username || "A user"} completed "${enrollment.programs.title}" and leveled up their stats! 📈🥊`;

      await tx.posts.create({
        data: {
          user_id: userId,
          program_id: enrollment.program_id,
          content: testimonial,
          is_system_generated: true,
          metadata: { deltas, testimonial },
        },
      });

      return { updatedEnrollment, deltas, testimonial };
    });

    res.status(200).json({
      success: true,
      message: "Program completed successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("Complete Enrollment Error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while completing the enrollment.",
    });
  }
};

// --- 4.8 Rate Program (Athlete) ---
export const rateProgram = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { rating, review } = req.body;
    const userId = String(req.user?.sub);
    const programId = String(req.params.id as string);

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

    // 2. Validate Rating boundaries and type
    const numericRating = Number(rating);
    if (
      isNaN(numericRating) ||
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      res.status(400).json({
        success: false,
        error: "Rating must be an integer between 1 and 5.",
      });
      return;
    }

    // Verify user completed this specific program
    const completedEnrollment = await prisma.enrollments.findFirst({
      where: { user_id: userId, program_id: programId, status: "completed" },
    });

    if (!completedEnrollment) {
      res.status(403).json({
        success: false,
        error: "Forbidden: You must complete the program before rating it.",
      });
      return;
    }

    // Verify no previous rating exists
    const existingRating = await prisma.program_ratings.findFirst({
      where: { user_id: userId, program_id: programId },
    });

    if (existingRating) {
      res.status(409).json({
        success: false,
        error: "Conflict: You have already rated this program.",
      });
      return;
    }

    // 5. Execute DB Transaction (Create Rating & Update Program Stats)
    const result = await prisma.$transaction(async (tx) => {
      // Create the new rating record
      const newRating = await tx.program_ratings.create({
        data: {
          enrollment_id: completedEnrollment.id,
          user_id: userId,
          program_id: programId,
          rating: numericRating,
          review: review ? String(review).trim() : null,
        },
      });

      // Aggregate all ratings for this program to calculate new avg
      const aggregations = await tx.program_ratings.aggregate({
        where: { program_id: programId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const newAvg = aggregations._avg.rating || numericRating;
      const newCount = aggregations._count.rating || 1;

      // Update the program main table with recalculated metrics
      await tx.programs.update({
        where: { id: programId },
        data: {
          rating_avg: newAvg,
          rating_count: newCount,
        },
      });

      return newRating;
    });

    res.status(201).json({
      success: true,
      message: "Program rated successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("Rate Program Error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred while rating the program.",
    });
  }
};

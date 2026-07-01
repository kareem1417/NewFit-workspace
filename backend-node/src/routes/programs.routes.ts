import { Router } from "express";
import {
  createProgram,
  listPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  enrollInProgram,
  completeEnrollment,
  rateProgram,
  getMyEnrolledPrograms,
} from "../controllers/programs.controller";
import { authenticateToken } from "../middlewares/auth.middleware";
import {
  completeEnrollmentValidation,
  createProgramValidation,
  enrollProgramValidation,
  getMyEnrolledProgramsValidation,
  getProgramValidation,
  listProgramsValidation,
  rateProgramValidation,
  updateProgramValidation,
} from "../validators/programs.validator";
import { validate } from "../middlewares/validation.middleware";

const router = Router();

// View routes // Validated
router.get(
  "/",
  authenticateToken,
  listProgramsValidation,
  validate,
  listPrograms,
);
// router.get('/:id', authenticateToken,getProgramValidation,validate, getProgramById);
router.get(
  "/get_program",
  authenticateToken,
  getProgramValidation,
  validate,
  getProgramById,
);

// Athlete routes (Enrollment and Rating)
// router.post('/:id/enroll', authenticateToken,enrollProgramValidation,validate, enrollInProgram);
router.post(
  "/enroll_program",
  authenticateToken,
  enrollProgramValidation,
  validate,
  enrollInProgram,
);

// router.post('/:id/rate', authenticateToken,rateProgramValidation,validate, rateProgram);
router.post(
  "/rate_program",
  authenticateToken,
  rateProgramValidation,
  validate,
  rateProgram,
);

// Complete program route (Note: ID is the Enrollment ID)
// router.post('/enrollments/:id/complete', authenticateToken,completeEnrollmentValidation,validate, completeEnrollment);
router.post(
  "/complete_enrollment",
  authenticateToken,
  completeEnrollmentValidation,
  validate,
  completeEnrollment,
);

// Coach routes
router.post(
  "/",
  authenticateToken,
  createProgramValidation,
  validate,
  createProgram,
); // Validated
// router.patch('/:id', authenticateToken,updateProgramValidation,validate, updateProgram); // Validated
router.patch(
  "/update_program",
  authenticateToken,
  updateProgramValidation,
  validate,
  updateProgram,
);

router.delete("/:id", authenticateToken, deleteProgram);

// 🎯 جلب البرامج التي سجل فيها اللاعب الحالي: GET /my_enrolled
router.get(
  "/my_enrolled",
  authenticateToken, // الـ Middleware اللي بيشفر الـ Token ويطلع الـ userId
  getMyEnrolledProgramsValidation,
  getMyEnrolledPrograms,
);

export default router;

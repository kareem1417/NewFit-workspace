"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const programs_controller_1 = require("../controllers/programs.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const programs_validator_1 = require("../validators/programs.validator");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const router = (0, express_1.Router)();
// View routes // Validated
router.get("/", auth_middleware_1.authenticateToken, programs_validator_1.listProgramsValidation, validation_middleware_1.validate, programs_controller_1.listPrograms);
// router.get('/:id', authenticateToken,getProgramValidation,validate, getProgramById);
router.get("/get_program", auth_middleware_1.authenticateToken, programs_validator_1.getProgramValidation, validation_middleware_1.validate, programs_controller_1.getProgramById);
// Athlete routes (Enrollment and Rating)
// router.post('/:id/enroll', authenticateToken,enrollProgramValidation,validate, enrollInProgram);
router.post("/enroll_program", auth_middleware_1.authenticateToken, programs_validator_1.enrollProgramValidation, validation_middleware_1.validate, programs_controller_1.enrollInProgram);
// router.post('/:id/rate', authenticateToken,rateProgramValidation,validate, rateProgram);
router.post("/rate_program", auth_middleware_1.authenticateToken, programs_validator_1.rateProgramValidation, validation_middleware_1.validate, programs_controller_1.rateProgram);
// Complete program route (Note: ID is the Enrollment ID)
// router.post('/enrollments/:id/complete', authenticateToken,completeEnrollmentValidation,validate, completeEnrollment);
router.post("/complete_enrollment", auth_middleware_1.authenticateToken, programs_validator_1.completeEnrollmentValidation, validation_middleware_1.validate, programs_controller_1.completeEnrollment);
// Coach routes
router.post("/", auth_middleware_1.authenticateToken, programs_validator_1.createProgramValidation, validation_middleware_1.validate, programs_controller_1.createProgram); // Validated
// router.patch('/:id', authenticateToken,updateProgramValidation,validate, updateProgram); // Validated
router.patch("/update_program", auth_middleware_1.authenticateToken, programs_validator_1.updateProgramValidation, validation_middleware_1.validate, programs_controller_1.updateProgram);
router.delete("/:id", auth_middleware_1.authenticateToken, programs_controller_1.deleteProgram);
// 🎯 جلب البرامج التي سجل فيها اللاعب الحالي: GET /my_enrolled
router.get("/my_enrolled", auth_middleware_1.authenticateToken, programs_validator_1.getMyEnrolledProgramsValidation, validation_middleware_1.validate, // 👈 التعديل هنا: ضفنا دي!
programs_controller_1.getMyEnrolledPrograms);
exports.default = router;

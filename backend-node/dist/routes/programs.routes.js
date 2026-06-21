"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const programs_controller_1 = require("../controllers/programs.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// View routes
router.get('/', auth_middleware_1.authenticateToken, programs_controller_1.listPrograms);
router.get('/:id', auth_middleware_1.authenticateToken, programs_controller_1.getProgramById);
// Athlete routes (Enrollment and Rating)
router.post('/:id/enroll', auth_middleware_1.authenticateToken, programs_controller_1.enrollInProgram);
router.post('/:id/rate', auth_middleware_1.authenticateToken, programs_controller_1.rateProgram);
// Complete program route (Note: ID is the Enrollment ID)
router.post('/enrollments/:id/complete', auth_middleware_1.authenticateToken, programs_controller_1.completeEnrollment);
// Coach routes
router.post('/', auth_middleware_1.authenticateToken, programs_controller_1.createProgram);
router.patch('/:id', auth_middleware_1.authenticateToken, programs_controller_1.updateProgram);
router.delete('/:id', auth_middleware_1.authenticateToken, programs_controller_1.deleteProgram);
exports.default = router;

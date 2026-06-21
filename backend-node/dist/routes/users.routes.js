"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware"); // Authentication middleware
const upload_middleware_1 = require("../middlewares/upload.middleware"); // Multer upload middleware
const router = (0, express_1.Router)();
// User Profile Routes
router.get('/me', auth_middleware_1.authenticateToken, users_controller_1.getMe);
router.patch('/me', auth_middleware_1.authenticateToken, users_controller_1.updateMe);
router.post('/me/photo', auth_middleware_1.authenticateToken, upload_middleware_1.uploadProfilePhoto.single('photo'), users_controller_1.uploadPhoto);
router.get('/:id', auth_middleware_1.authenticateToken, users_controller_1.getPublicProfile);
router.patch('/me/deactivate', auth_middleware_1.authenticateToken, users_controller_1.deactivateAccount);
exports.default = router;

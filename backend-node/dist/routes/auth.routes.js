"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (Registration and Login)
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.post('/logout', auth_middleware_1.authenticateToken, auth_controller_1.logout);
// Protected route (Requires valid token)
router.get('/profile', auth_middleware_1.authenticateToken, (req, res) => {
    // The user ID is accessible here since the user passed through the auth middleware
    res.status(200).json({
        message: 'Welcome to your protected profile!',
        userId: req.user?.sub
    });
});
router.post('/refresh', auth_controller_1.refresh);
exports.default = router;

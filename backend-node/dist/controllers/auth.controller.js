"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../config/prisma");
const AppError_1 = require("../utils/AppError");
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqO6Z5z1jFvJk9fJk9fJk9fJk9fJk9';
const generateTokens = (user) => {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret', { expiresIn: '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret', { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
const register = async (req, res, next) => {
    try {
        const { username, email, password, date_of_birth, role = 'athlete' } = req.body;
        const existingEmail = await prisma_1.prisma.users.findUnique({ where: { email } });
        if (existingEmail) {
            return next(new AppError_1.AppError("Unable to create account with the provided information.", 409));
        }
        const existingUsername = await prisma_1.prisma.users.findUnique({ where: { username } });
        if (existingUsername) {
            return next(new AppError_1.AppError("Username already exists", 409));
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const password_hash = await bcryptjs_1.default.hash(password, salt);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const newUser = await tx.users.create({
                data: {
                    username, email, password_hash,
                    date_of_birth: new Date(date_of_birth),
                    role,
                },
            });
            const { accessToken, refreshToken } = generateTokens(newUser);
            await tx.user_tokens.create({
                data: {
                    user_id: newUser.id,
                    token: refreshToken,
                    token_type: 'REFRESH',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            });
            return { user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role }, tokens: { accessToken, refreshToken } };
        });
        res.status(201).json({ success: true, message: 'User registered successfully', data: result });
    }
    catch (error) {
        console.error('Registration Error:', error);
        return next(new AppError_1.AppError("Internal server error", 500));
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.users.findFirst({ where: { email, is_active: true } });
        const passwordHashToCompare = user ? user.password_hash : DUMMY_HASH;
        const isMatch = await bcryptjs_1.default.compare(password, passwordHashToCompare);
        if (!user || !isMatch) {
            return next(new AppError_1.AppError("Invalid credentials", 401));
        }
        const { accessToken, refreshToken } = generateTokens(user);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user_tokens.deleteMany({ where: { user_id: user.id, token_type: 'REFRESH' } }),
            prisma_1.prisma.user_tokens.create({
                data: {
                    user_id: user.id, token: refreshToken, token_type: 'REFRESH',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            })
        ]);
        res.status(200).json({
            success: true, message: 'Login successful',
            data: { user: { id: user.id, username: user.username, email: user.email, role: user.role }, tokens: { accessToken, refreshToken } }
        });
    }
    catch (error) {
        console.error('Login Error:', error);
        return next(new AppError_1.AppError("Internal server error", 500));
    }
};
exports.login = login;
const refresh = async (req, res) => {
    try {
        const refreshToken = req.body?.refreshToken;
        if (!refreshToken) {
            res.status(400).json({ success: false, error: 'Refresh token is required in the body' });
            return;
        }
        const tokenRecord = await prisma_1.prisma.user_tokens.findUnique({ where: { token: refreshToken } });
        if (!tokenRecord || tokenRecord.token_type !== 'REFRESH' || tokenRecord.expires_at < new Date()) {
            res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret');
        const user = await prisma_1.prisma.users.findUnique({ where: { id: decoded.sub, is_active: true } });
        if (!user) {
            res.status(401).json({ success: false, error: 'User inactive or not found' });
            return;
        }
        const tokens = generateTokens(user);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.user_tokens.delete({ where: { user_token_id: tokenRecord.user_token_id } }),
            prisma_1.prisma.user_tokens.create({
                data: {
                    user_id: user.id, token: tokens.refreshToken, token_type: 'REFRESH',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            })
        ]);
        res.status(200).json({ success: true, message: 'Token refreshed successfully', data: { tokens } });
    }
    catch (error) {
        console.error('Refresh Error:', error);
        res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
};
exports.refresh = refresh;
const logout = async (req, res) => {
    try {
        const userId = req.user?.sub;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        await prisma_1.prisma.user_tokens.deleteMany({ where: { user_id: userId, token_type: 'REFRESH' } });
        res.status(200).json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ success: false, error: "Failed to logout" });
    }
};
exports.logout = logout;

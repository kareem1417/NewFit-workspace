import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';

const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqO6Z5z1jFvJk9fJk9fJk9fJk9fJk9';

const generateTokens = (user: { id: string; username: string; role: string }) => {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret', { expiresIn: '15m' });
    const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret', { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { username, email, password, date_of_birth, role = 'athlete' } = req.body;

        const existingEmail = await prisma.users.findUnique({ where: { email } });
        if (existingEmail) {
            return next(new AppError("Unable to create account with the provided information.", 409));
        }

        const existingUsername = await prisma.users.findUnique({ where: { username } });
        if (existingUsername) {
            return next(new AppError("Username already exists", 409));
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const result = await prisma.$transaction(async (tx) => {
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
    } catch (error) {
        console.error('Registration Error:', error);
        return next(new AppError("Internal server error", 500));
    }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, password } = req.body;


        const user = await prisma.users.findFirst({ where: { email, is_active: true } });

        const passwordHashToCompare = user ? user.password_hash : DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, passwordHashToCompare);

        if (!user || !isMatch) {
            return next(new AppError("Invalid credentials", 401));
        }

        const { accessToken, refreshToken } = generateTokens(user);

        await prisma.$transaction([
            prisma.user_tokens.deleteMany({ where: { user_id: user.id, token_type: 'REFRESH' } }),
            prisma.user_tokens.create({
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
    } catch (error) {
        console.error('Login Error:', error);
        return next(new AppError("Internal server error", 500));
    }
};
export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.body?.refreshToken;
        if (!refreshToken) {
            res.status(400).json({ success: false, error: 'Refresh token is required in the body' });
            return;
        }

        const tokenRecord = await prisma.user_tokens.findUnique({ where: { token: refreshToken } });
        if (!tokenRecord || tokenRecord.token_type !== 'REFRESH' || tokenRecord.expires_at < new Date()) {
            res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
            return;
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret') as { sub: string };
        const user = await prisma.users.findUnique({ where: { id: decoded.sub, is_active: true } });
        if (!user) {
            res.status(401).json({ success: false, error: 'User inactive or not found' });

            return;
        }

        const tokens = generateTokens(user);

        await prisma.$transaction([
            prisma.user_tokens.delete({ where: { user_token_id: tokenRecord.user_token_id } }),
            prisma.user_tokens.create({
                data: {
                    user_id: user.id, token: tokens.refreshToken, token_type: 'REFRESH',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            })
        ]);

        res.status(200).json({ success: true, message: 'Token refreshed successfully', data: { tokens } });
    } catch (error) {
        console.error('Refresh Error:', error);
        res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        await prisma.user_tokens.deleteMany({ where: { user_id: userId, token_type: 'REFRESH' } });
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ success: false, error: "Failed to logout" });
    }
};
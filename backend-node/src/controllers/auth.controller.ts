import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqO6Z5z1jFvJk9fJk9fJk9fJk9fJk9';

const generateTokens = (user: { id: string; username: string; role: string }) => {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret', { expiresIn: '15m' });
    const refreshToken = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret', { expiresIn: '7d' });
    return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, email, password, date_of_birth, role = 'athlete' } = req.body;
        if (!username || !email || !password || !date_of_birth) {
            res.status(409).json({
                success: false,
                error: "Missing required fields"
            });
            return;
        }
        const existingEmail = await prisma.users.findUnique({ where: { email } });
        if (existingEmail) {
            res.status(409).json({ success: false, error: 'Unable to create account with the provided information.' });
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            res.status(400).json({
                success: false,
                error: "Weak password. Must be at least 8 characters long, containing 1 uppercase letter, 1 lowercase letter, and 1 number."
            });
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                error: "Invalid email format. Please provide a valid email address."
            });
            return;
        }

        const existingUsername = await prisma.users.findUnique({ where: { username } });
        if (existingUsername) {
            res.status(409).json({ success: false, error: 'Username already exists' });
            return;
        }
        if (!date_of_birth) {
            res.status(400).json({ success: false, error: "Validation error — DOB required." });
            return;
        }

        // Ensure DOB is valid and not in the future
        const dob = new Date(date_of_birth);
        const today = new Date();

        // 1. Verify date is valid format
        if (isNaN(dob.getTime())) {
            res.status(400).json({ success: false, error: "Invalid date format. Use YYYY-MM-DD." });
            return;
        }

        // 2. Verify date is not in the future
        if (dob > today) {
            res.status(400).json({ success: false, error: "Date of birth cannot be in the future." });
            return;
        }
        if (!['athlete', 'coach'].includes(role)) {
            res.status(400).json({
                success: false,
                error: "Validation error — role must be athlete or coach."
            });
            return;
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Use Transaction to save user and token together
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

        // Standardize frontend response
        res.status(201).json({ success: true, message: 'User registered successfully', data: result });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        if (!email || email.trim() === '') {
            res.status(400).json({ success: false, error: "Validation error — Email required." });
            return;
        }
        if (!password || password.trim() === '') {
            res.status(400).json({ success: false, error: "Validation error — Password required." });
            return;
        }
        const user = await prisma.users.findFirst({ where: { email, is_active: true } });

        // 1. Define Dummy Hash for non-existent user
        const DUMMY_HASH = '$2a$10$dummyHashDummyHashDummyHashDummyHashDummyHash';

        // 2. Determine password to compare (Timing Attack Resistance)
        const passwordHashToCompare = user ? user.password_hash : DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, passwordHashToCompare);

        // 3. Generic error message if user missing or password invalid
        if (!user || !isMatch) {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
            return;
        }

        const { accessToken, refreshToken } = generateTokens(user);

        // 4. Transaction to clear old tokens and create new one
        // (Note: deleteMany clears previous tokens, logging out other devices)
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
        res.status(500).json({ success: false, error: 'Internal server error' });
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
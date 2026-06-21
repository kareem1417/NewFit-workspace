import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        sub: string;
        username: string;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // Added success: false to response
        res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret') as {
            sub: string;
            username: string;
            role: string;
        };
        req.user = decoded;
        next();
    } catch (error) {
        // Added success: false to response
        res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
};
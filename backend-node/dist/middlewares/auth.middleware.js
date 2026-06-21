"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        // Added success: false to response
        res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret');
        req.user = decoded;
        next();
    }
    catch (error) {
        // Added success: false to response
        res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
};
exports.authenticateToken = authenticateToken;

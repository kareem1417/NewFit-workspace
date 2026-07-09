// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'express-validator';

interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (
    err: AppError | ValidationError[],
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    // Handle validation errors from express-validator
    if (Array.isArray(err) && err[0]?.msg) {
        const errors = (err as ValidationError[]).map((e) => ({
            field: e.type === 'field' ? e.path : undefined,
            message: e.msg,
        }));
        return res.status(400).json({
            success: false,
            errors,
        });
    }

    // Custom operational error
    /*if (err.isOperational) {
      return res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }*/

    // Unexpected server error
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
};
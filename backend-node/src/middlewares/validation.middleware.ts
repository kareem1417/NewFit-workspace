// src/middlewares/validate.ts
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validate = (req: Request, res: Response, next: NextFunction): void | Response => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Pass the errors to the global error handler
    return next(errors.array());
  }
  next();
};
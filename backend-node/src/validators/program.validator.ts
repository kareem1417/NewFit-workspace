import { check, body } from 'express-validator';
import { validatorMiddleware } from '../middlewares/validation.middleware';

// Program validators
exports.createProgramValidator = [
    body('title')
        .notEmpty().withMessage('Title is required')
        .isString().withMessage('Title must be a string')
        .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),

    body('description')
        .notEmpty().withMessage('Description is required')
        .isString().withMessage('Description must be a string')
        .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),

    body('durationWeeks')
        .notEmpty().withMessage('Duration is required')
        .isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks'),

    body('difficultyLevel')
        .notEmpty().withMessage('Difficulty level is required')
        .isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),

    body('category')
        .notEmpty().withMessage('Category is required')
        .isString().withMessage('Category must be a string'),

    body('price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

    body('maxParticipants')
        .optional()
        .isInt({ min: 1 }).withMessage('Max participants must be a positive number'),

    validatorMiddleware,
];

exports.updateProgramValidator = [
    check('id')
        .isMongoId().withMessage('Invalid program ID format'),

    body('title')
        .optional()
        .isString().withMessage('Title must be a string')
        .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),

    body('description')
        .optional()
        .isString().withMessage('Description must be a string')
        .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),

    body('durationWeeks')
        .optional()
        .isInt({ min: 1, max: 52 }).withMessage('Duration must be between 1 and 52 weeks'),

    body('difficultyLevel')
        .optional()
        .isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),

    body('category')
        .optional()
        .isString().withMessage('Category must be a string'),

    body('price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Price must be a positive number'),

    body('maxParticipants')
        .optional()
        .isInt({ min: 1 }).withMessage('Max participants must be a positive number'),

    body('status')
        .optional()
        .isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),

    validatorMiddleware,
];

exports.deleteProgramValidator = [
    check('id')
        .isMongoId().withMessage('Invalid program ID format'),
    validatorMiddleware,
];

exports.getProgramByIdValidator = [
    check('id')
        .isMongoId().withMessage('Invalid program ID format'),
    validatorMiddleware,
];

// Enrollment validators
exports.enrollInProgramValidator = [
    check('id')
        .isMongoId().withMessage('Invalid program ID format'),

    body('athleteId')
        .notEmpty().withMessage('Athlete ID is required')
        .isMongoId().withMessage('Invalid athlete ID format'),

    body('startDate')
        .optional()
        .isISO8601().withMessage('Invalid date format'),

    body('notes')
        .optional()
        .isString().withMessage('Notes must be a string'),

    validatorMiddleware,
];

exports.completeEnrollmentValidator = [
    check('id')
        .isMongoId().withMessage('Invalid enrollment ID format'),

    body('completionDate')
        .optional()
        .isISO8601().withMessage('Invalid date format'),

    body('notes')
        .optional()
        .isString().withMessage('Notes must be a string'),

    validatorMiddleware,
];

// Rating validators
exports.rateProgramValidator = [
    check('id')
        .isMongoId().withMessage('Invalid program ID format'),

    body('rating')
        .notEmpty().withMessage('Rating is required')
        .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),

    body('feedback')
        .optional()
        .isString().withMessage('Feedback must be a string')
        .isLength({ max: 500 }).withMessage('Feedback cannot exceed 500 characters'),

    validatorMiddleware,
];
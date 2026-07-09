import { Router } from 'express';
import {
    createProgram,
    listPrograms,
    getProgramById,
    updateProgram,
    deleteProgram,
    enrollInProgram,
    completeEnrollment,
    rateProgram
} from '../controllers/programs.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validate = (validations: any[]) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }
        res.status(400).json({ errors: errors.array() });
    };
};

// View routes
router.get('/', authenticateToken, listPrograms);
router.get('/:id', authenticateToken, getProgramById);

// Athlete routes (Enrollment and Rating)
router.post('/:id/enroll',
    authenticateToken,
    validate([
        body('athleteId').notEmpty().withMessage('Athlete ID is required'),
        body('startDate').optional().isISO8601().withMessage('Invalid date format')
    ]),
    enrollInProgram
);

router.post('/:id/rate',
    authenticateToken,
    validate([
        body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
        body('feedback').optional().isString().withMessage('Feedback must be a string')
    ]),
    rateProgram
);

// Complete program route (Note: ID is the Enrollment ID)
router.post('/enrollments/:id/complete',
    authenticateToken,
    validate([
        body('completionDate').optional().isISO8601().withMessage('Invalid date format'),
        body('notes').optional().isString().withMessage('Notes must be a string')
    ]),
    completeEnrollment
);

// Coach routes
router.post('/',
    authenticateToken,
    validate([
        body('title').notEmpty().withMessage('Title is required'),
        body('description').notEmpty().withMessage('Description is required'),
        body('durationWeeks').isInt({ min: 1 }).withMessage('Duration must be a positive number'),
        body('difficultyLevel').isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
        body('category').notEmpty().withMessage('Category is required'),
        body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
        body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be a positive number')
    ]),
    createProgram
);

router.patch('/:id',
    authenticateToken,
    validate([
        body('title').optional().notEmpty().withMessage('Title cannot be empty'),
        body('description').optional().notEmpty().withMessage('Description cannot be empty'),
        body('durationWeeks').optional().isInt({ min: 1 }).withMessage('Duration must be a positive number'),
        body('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid difficulty level'),
        body('category').optional().notEmpty().withMessage('Category cannot be empty'),
        body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
        body('maxParticipants').optional().isInt({ min: 1 }).withMessage('Max participants must be a positive number'),
        body('status').optional().isIn(['draft', 'published', 'archived']).withMessage('Invalid status')
    ]),
    updateProgram
);

router.delete('/:id', authenticateToken, deleteProgram);

export default router;
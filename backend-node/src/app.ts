import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import athleteRoutes from './routes/athlete.routes'; // New Athlete routes import
import usersRoutes from './routes/users.routes';
import programRoutes from './routes/programs.routes';
import socialRoutes from './routes/social.routes';
import searchRoutes from './routes/search.routes';
import leaderboardsRoutes from './routes/leaderboards.routes';
import workoutsRoutes from './routes/workouts.routes';
const app: Application = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Base API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/athletes', athleteRoutes); // Register Athlete Routes
app.use('/api/users', usersRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/workouts', workoutsRoutes);
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to NeoFit API! 🚀' });
});
export default app;
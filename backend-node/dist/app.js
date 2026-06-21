"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const athlete_routes_1 = __importDefault(require("./routes/athlete.routes")); // New Athlete routes import
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const programs_routes_1 = __importDefault(require("./routes/programs.routes"));
const social_routes_1 = __importDefault(require("./routes/social.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const leaderboards_routes_1 = __importDefault(require("./routes/leaderboards.routes"));
const workouts_routes_1 = __importDefault(require("./routes/workouts.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
// Base API Endpoints
app.use('/api/auth', auth_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/athletes', athlete_routes_1.default); // Register Athlete Routes
app.use('/api/users', users_routes_1.default);
app.use('/api/programs', programs_routes_1.default);
app.use('/api/social', social_routes_1.default);
app.use('/api/search', search_routes_1.default);
app.use('/api/leaderboards', leaderboards_routes_1.default);
app.use('/api/workouts', workouts_routes_1.default);
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to NeoFit API! 🚀' });
});
exports.default = app;

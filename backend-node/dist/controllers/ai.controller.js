"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionMessages = exports.getSessions = exports.getCoachAdvice = exports.recommendProgram = exports.askQuestion = void 0;
const ai_service_1 = require("../services/ai.service");
const prisma_1 = require("../config/prisma");
// Helper function to calculate age from Date of Birth
const calculateAge = (dob) => {
    const diff = Date.now() - dob.getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};
const askQuestion = async (req, res) => {
    try {
        const userId = req.user?.sub;
        // The frontend sends the question, and optionally a session_id for existing chats
        const { question, session_id } = req.body;
        if (!question) {
            res.status(400).json({ success: false, error: "Question is required" });
            return;
        }
        // 1. Fetch user data for Context
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: userId },
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true }
                },
                user_metrics: true
            }
        });
        if (!user) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }
        const primaryProfile = user.user_sport_profiles[0];
        const sportName = primaryProfile?.sports?.name || "general";
        const goal = user.user_metrics?.goal?.replace(/_/g, " ") || null;
        // 2. Chat Session Management and Memory
        let currentSessionId = session_id;
        let chatHistory = [];
        if (currentSessionId) {
            // If session exists, pull the last 6 messages for History
            const previousMessages = await prisma_1.prisma.chat_messages.findMany({
                where: { session_id: currentSessionId },
                orderBy: { created_at: 'asc' }, // Order chronologically
                take: -6 // Take the latest 6 messages
            });
            chatHistory = previousMessages.map(msg => ({
                role: msg.role, // Will be 'user' or 'assistant' based on Enum
                content: msg.content
            }));
        }
        else {
            // If no session exists, create a new one for this user
            const newSession = await prisma_1.prisma.chat_sessions.create({
                data: {
                    user_id: userId,
                    title: question.substring(0, 50) + "..." // Use first 50 chars as chat title
                }
            });
            currentSessionId = newSession.id;
        }
        // 3. Build the Payload for Python (including History)
        const aiPayload = {
            question: question,
            sport: sportName.toLowerCase(),
            history: chatHistory,
            current_program: null,
            user_goal: goal
        };
        // 4. Send request to Python AI Service
        const aiResponse = await (0, ai_service_1.askRingsideAI)(aiPayload);
        // 5. Save messages to DB in the same session
        await prisma_1.prisma.chat_messages.createMany({
            data: [
                {
                    session_id: currentSessionId,
                    role: 'user',
                    content: question
                },
                {
                    session_id: currentSessionId,
                    role: 'assistant',
                    content: aiResponse.answer // Python AI response
                }
            ]
        });
        // 6. Return response to mobile with Session ID for future requests
        res.status(200).json({
            success: true,
            session_id: currentSessionId,
            data: aiResponse
        });
    }
    catch (error) {
        console.error("AI Ask Error:", error);
        res.status(500).json({ success: false, error: "Failed to get AI response" });
    }
};
exports.askQuestion = askQuestion;
const recommendProgram = async (req, res) => {
    try {
        const userId = req.user?.sub;
        // Fetch user with their sport profile and latest metrics
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: userId },
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true }
                },
                user_metrics: true // Fetch metrics table
            }
        });
        if (!user) {
            res.status(404).json({ success: false, error: "User not found" });
            return;
        }
        if (!user.user_metrics) {
            res.status(400).json({
                success: false,
                error: "User metrics not found. Please complete onboarding first."
            });
            return;
        }
        const primaryProfile = user.user_sport_profiles[0];
        const metrics = user.user_metrics;
        // Calculate age
        const diff = Date.now() - user.date_of_birth.getTime();
        const userAge = Math.abs(new Date(diff).getUTCFullYear() - 1970);
        // Calculate BMI (Weight / (Height in m)^2)
        const heightInMeters = Number(metrics.height_cm) / 100;
        const calculatedBMI = Number(metrics.weight_kg) / (heightInMeters * heightInMeters);
        // Build the actual Payload for the ML model
        const mlPayload = {
            Age: userAge,
            Height_cm: Number(metrics.height_cm),
            Weight_kg: Number(metrics.weight_kg),
            BMI: Number(calculatedBMI.toFixed(1)),
            Sport_Type: primaryProfile?.sports?.name || "General Fitness",
            Level: primaryProfile?.level ? primaryProfile.level.charAt(0).toUpperCase() + primaryProfile.level.slice(1) : "Beginner",
            Goal: metrics.goal.replace(/_/g, " "), // Convert Muscle_Gain to Muscle Gain
            Training_Days_Per_Week: metrics.training_days_per_week,
            Years_Training: Number(metrics.years_training),
            Has_Injury_History: metrics.has_injury_history ? 1 : 0,
            Endurance_Score: metrics.endurance_score,
            Strength_Score: metrics.strength_score,
            Speed_Score: metrics.speed_score,
            Flexibility_Score: metrics.flexibility_score,
            Explosiveness_Score: metrics.explosiveness_score,
            Recovery_Score: metrics.recovery_score
        };
        const recommendation = await (0, ai_service_1.getProgramRecommendation)(mlPayload);
        res.status(200).json({ success: true, data: recommendation });
    }
    catch (error) {
        console.error("ML Recommend Error:", error);
        res.status(500).json({ success: false, error: "Failed to get program recommendation" });
    }
};
exports.recommendProgram = recommendProgram;
const getCoachAdvice = async (req, res) => {
    try {
        // Receive raw data from punch power endpoint
        const { score, level, weight_class, breakdown_percentiles, raw_values } = req.body;
        // Quick check if all data is present
        if (score === undefined || !breakdown_percentiles || !raw_values) {
            res.status(400).json({ success: false, error: "Complete performance data is required." });
            return;
        }
        // Python Microservice Link (New Analysis Route)
        const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000/coach-analysis';
        // Send request to Python server
        const aiResponse = await fetch(AI_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score: score,
                level: level || "amateur",
                weight_class: weight_class || "middleweight",
                foundation_pct: breakdown_percentiles.foundation,
                accelerator_pct: breakdown_percentiles.accelerator,
                transfer_pct: breakdown_percentiles.transfer,
                raw_foundation: raw_values.foundation,
                raw_accelerator: raw_values.accelerator,
                raw_transfer: raw_values.transfer
            }),
        });
        if (!aiResponse.ok) {
            throw new Error(`AI Service responded with status: ${aiResponse.status}`);
        }
        const data = await aiResponse.json();
        // Return final advice to frontend
        res.status(200).json({
            success: true,
            advice: data.analysis,
            engine: data.engine // Returns Hybrid RAG + Direct Analysis
        });
    }
    catch (error) {
        console.error("AI Coach Analysis Error:", error);
        res.status(500).json({ success: false, error: "Failed to generate coach advice from AI microservice." });
    }
};
exports.getCoachAdvice = getCoachAdvice;
// --- 8.2 Get User Sessions ---
const getSessions = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const sessions = await prisma_1.prisma.chat_sessions.findMany({
            where: { user_id: userId },
            orderBy: { updated_at: 'desc' }, // Newest first
            take: 20 // Max 20 per Specs
        });
        res.status(200).json({ success: true, data: sessions });
    }
    catch (error) {
        console.error("Get Sessions Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch chat sessions." });
    }
};
exports.getSessions = getSessions;
// --- 8.3 Get Session Messages ---
// --- 8.3 Get Session Messages ---
const getSessionMessages = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const sessionId = String(req.params.id);
        // 1. Verify this session belongs to the user (Security/Authorization)
        const session = await prisma_1.prisma.chat_sessions.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            res.status(404).json({ success: false, error: "Session not found." });
            return;
        }
        if (session.user_id !== userId) {
            res.status(403).json({ success: false, error: "Unauthorized to view this session." });
            return;
        }
        // 2. Fetch messages ordered from oldest to newest
        const messages = await prisma_1.prisma.chat_messages.findMany({
            where: { session_id: sessionId },
            orderBy: { created_at: 'asc' },
            select: {
                id: true,
                role: true,
                content: true,
                suggested_program_ids: true,
                created_at: true
            }
        });
        // 3. Format data
        const formattedMessages = await Promise.all(messages.map(async (msg) => {
            // Variable must be defined here outside the if-block to be accessible in return
            let suggested_programs = [];
            if (Array.isArray(msg.suggested_program_ids) && msg.suggested_program_ids.length > 0) {
                const stringIds = msg.suggested_program_ids.map(id => String(id));
                suggested_programs = await prisma_1.prisma.programs.findMany({
                    where: { id: { in: stringIds } },
                    select: { id: true, title: true }
                });
            }
            return {
                id: msg.id,
                role: msg.role,
                content: msg.content,
                created_at: msg.created_at,
                // Can be read safely without ReferenceError
                suggested_programs: suggested_programs
            };
        }));
        res.status(200).json({ success: true, data: formattedMessages });
    }
    catch (error) {
        console.error("Get Session Messages Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch session messages." });
    }
};
exports.getSessionMessages = getSessionMessages;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgramRecommendation = exports.askRingsideAI = void 0;
const axios_1 = __importDefault(require("axios"));
const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
const askRingsideAI = async (payload) => {
    const response = await axios_1.default.post(`${AI_SERVER_URL}/ask`, payload);
    return response.data;
};
exports.askRingsideAI = askRingsideAI;
const getProgramRecommendation = async (payload) => {
    const response = await axios_1.default.post(`${AI_SERVER_URL}/recommend`, payload);
    return response.data;
};
exports.getProgramRecommendation = getProgramRecommendation;

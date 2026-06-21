import axios from 'axios';

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';

export const askRingsideAI = async (payload: any) => {
    const response = await axios.post(`${AI_SERVER_URL}/ask`, payload);
    return response.data;
};

export const getProgramRecommendation = async (payload: any) => {
    const response = await axios.post(`${AI_SERVER_URL}/recommend`, payload);
    return response.data;
};
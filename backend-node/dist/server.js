"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const prisma_1 = require("./config/prisma");
const PORT = process.env.PORT || 5000;
async function startServer() {
    try {
        // Test database connection
        await prisma_1.prisma.$connect();
        console.log('✅ Successfully connected to the database.');
        // Start the Express server
        app_1.default.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start the server:', error);
        await prisma_1.prisma.$disconnect();
        process.exit(1);
    }
}
startServer();

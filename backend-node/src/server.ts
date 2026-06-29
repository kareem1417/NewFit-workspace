import app from './app';
import { prisma } from './config/prisma';
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Successfully connected to the database.');

        // Start the Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start the server:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}


startServer();

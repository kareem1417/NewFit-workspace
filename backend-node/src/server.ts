import app from './app';
import { prisma } from './config/prisma';
import { metricsWorker } from './queues/metrics.queue'; // 1. Import the worker

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await prisma.$connect();
        console.log('✅ Successfully connected to the database.');

        const server = app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });

        // 2. Handle server shutdown gracefully
        const shutdown = async (signal: string) => {
            console.log(`\n👋 Received ${signal}. Shutting down gracefully...`);

            // Stop the server from accepting new HTTP requests
            server.close();

            // Wait for active BullMQ jobs to finish processing before disconnecting
            await metricsWorker.close();
            console.log('📦 BullMQ Worker disconnected.');

            await prisma.$disconnect();
            console.log('💾 Database disconnected.');

            process.exit(0);
        };

        // Listen for termination signals (e.g., Ctrl+C, Docker stop)
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        console.error('❌ Failed to start the server:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

startServer();
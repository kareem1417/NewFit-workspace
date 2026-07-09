// metrics.queue.ts
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { computeAndSavePhysicalScores, computeAndSaveScoresFromSnapshot } from '../services/calculation.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// FIX: separate connection instances — Worker uses blocking commands (BRPOP)
// that will starve a shared connection and cause the Queue to drop jobs.
const queueConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const workerConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const metricsQueue = new Queue('metrics-recalculation', {
    connection: queueConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        // FIX: { count: 100 } keeps the last 100 failed jobs for inspection,
        // then evicts older ones. `false` is not a valid value and was being
        // ignored, accumulating every failed job in Redis forever.
        removeOnFail: { count: 100 },
    },
});

export const metricsWorker = new Worker(
    'metrics-recalculation',
    async (job: Job) => {
        const { userId, sportId, testValues } = job.data;
        console.log(`[Worker] Recalculating scores for user=${userId} sport=${sportId}`);

        await computeAndSaveScoresFromSnapshot(userId, sportId, testValues);

        console.log(`[Worker] Done for user=${userId}`);
    },
    { connection: workerConnection }
);

metricsWorker.on('error', (err) => {
    console.error('[Worker] Global error:', err);
});

metricsWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});


// Two enqueue helpers — callers pick the right one.

export async function addMetricsJobFromSnapshot(
    userId: string,
    sportId: number,
    testValues: Array<{ attribute_test_id: number; value: number }>,
): Promise<void> {
    try {
        await metricsQueue.add(
            `recalculate-${userId}-${sportId}`,
            { userId, sportId, testValues },
        );
        console.log(`[Queue] Enqueued recalculate-${userId}-${sportId}-${testValues}`);
    } catch (error) {
        console.error(`[Queue] Failed to enqueue snapshot job for user=${userId}:`, error);
    }
}

export async function addMetricsJob(userId: string, sportId: number): Promise<void> {
    try {
        // Using a deterministic job name deduplicates in-flight jobs for the same
        // user+sport if two snapshots are saved in quick succession — the second
        // enqueue is a no-op while the first job is still waiting.
        await metricsQueue.add(
            `recalculate-${userId}-${sportId}`,
            { userId, sportId },
        );
        console.log(`[Queue] Enqueued recalculate-${userId}-${sportId}`);
    } catch (error) {
        // Intentionally non-throwing: a Redis outage must not fail the HTTP response.
        // The next snapshot save will re-enqueue. Log for alerting.
        console.error(`[Queue] Failed to enqueue for user=${userId}:`, error);
    }
}
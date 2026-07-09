import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
    // Retry strategy: exponential backoff, max 5 retries
    retryStrategy(times) {
        if (times > 5) {
            console.error('[Redis] Max reconnection attempts reached. Giving up.');
            return null; // stop retrying
        }
        const delay = Math.min(times * 200, 2000);
        return delay;
    },
    // Do not crash the process on connection failure
    enableOfflineQueue: false,
    lazyConnect: false,
});

redis.on('connect', () => {
    console.log('[Redis] Connected successfully');
});

redis.on('error', (err) => {
    // Log but do not crash – the app works without cache
    console.error('[Redis] Connection error:', err.message);
});

redis.on('reconnecting', () => {
    console.warn('[Redis] Reconnecting...');
});

export default redis;

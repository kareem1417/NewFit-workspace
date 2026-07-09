import redis from '../config/redis';

// ──────────────────────────────────────────────────────────────────────────────
// Cache key helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from the leaderboard query parameters.
 *
 * Example:
 *   leaderboard:sport=1:attr=3:wc=lightweight:lvl=amateur:ag=2:limit=20
 */
export function buildLeaderboardKey(
    sportId: number,
    attributeOrGoal: number | 'punch_power',
    cohort: { weight_class: string; level: string; age_group_id: number },
    limit: number,
): string {
    return [
        'leaderboard',
        `sport=${sportId}`,
        `attr=${attributeOrGoal}`,
        `wc=${cohort.weight_class}`,
        `lvl=${cohort.level}`,
        `ag=${cohort.age_group_id}`,
        `limit=${limit}`,
    ].join(':');
}

/**
 * Build a glob pattern that matches ALL leaderboard keys for a given sport.
 * Used when invalidating after a new snapshot is submitted.
 */
export function buildLeaderboardInvalidationPattern(sportId: number): string {
    return `leaderboard:sport=${sportId}:*`;
}

// ──────────────────────────────────────────────────────────────────────────────
// TTL constant (seconds)
// ──────────────────────────────────────────────────────────────────────────────

/** Leaderboard cache lifetime in seconds (default: 5 minutes) */
export const LEADERBOARD_TTL = parseInt(process.env.LEADERBOARD_CACHE_TTL || '300', 10);

// ──────────────────────────────────────────────────────────────────────────────
// Cache read / write helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Try to retrieve a leaderboard result from Redis.
 * Returns `null` on a cache miss or any Redis error (fail-open).
 */
export async function getCachedLeaderboard<T>(cacheKey: string): Promise<T | null> {
    try {
        const raw = await redis.get(cacheKey);
        if (!raw) return null;
        console.log(`[Leaderboard Cache] HIT  key=${cacheKey}`);
        return JSON.parse(raw) as T;
    } catch (err) {
        // Redis is unavailable – log and fall through to DB
        console.error('[Leaderboard Cache] GET error:', (err as Error).message);
        return null;
    }
}

/**
 * Persist a leaderboard result in Redis with a fixed TTL.
 * Errors are swallowed – caching is always best-effort.
 */
export async function setCachedLeaderboard<T>(cacheKey: string, data: T): Promise<void> {
    try {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', LEADERBOARD_TTL);
        console.log(`[Leaderboard Cache] SET  key=${cacheKey}  ttl=${LEADERBOARD_TTL}s`);
    } catch (err) {
        console.error('[Leaderboard Cache] SET error:', (err as Error).message);
    }
}

/**
 * Invalidate every cached leaderboard for a sport when new snapshot data arrives.
 *
 * Uses SCAN instead of KEYS to avoid blocking the Redis event loop on large keyspaces.
 */
export async function invalidateLeaderboardCache(sportId: number): Promise<void> {
    const pattern = buildLeaderboardInvalidationPattern(sportId);
    try {
        let cursor = '0';
        let deleted = 0;

        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                await redis.del(...keys);
                deleted += keys.length;
            }
        } while (cursor !== '0');

        console.log(`[Leaderboard Cache] Invalidated ${deleted} key(s) for sport=${sportId}`);
    } catch (err) {
        console.error('[Leaderboard Cache] Invalidation error:', (err as Error).message);
    }
}

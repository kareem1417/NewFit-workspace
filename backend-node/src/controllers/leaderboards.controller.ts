import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';
import { getAgeGroupId } from '../services/calculation.service';
import { getLeaderboardWithUser } from '../services/calculation.service';
import {
    buildLeaderboardKey,
    getCachedLeaderboard,
    setCachedLeaderboard,
} from '../services/leaderboard-cache.service';

export const getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        const sportId = 1;

        // Get user's own cohort (for default)
        const ownProfile = await prisma.user_sport_profiles.findFirst({
            where: { user_id: userId, sport_id: sportId, is_primary: true },
        });
        if (!ownProfile) {
            res.status(400).json({ success: false, error: 'Sport profile not found' });
            return;
        }

        const user = await prisma.users.findUnique({ where: { id: userId } });
        const ownAgeGroupId = getAgeGroupId(new Date(user!.date_of_birth!));

        // Determine target cohort – default to user's own, allow overrides
        const targetCohort = {
            weight_class: (req.query.weight_class as string) || ownProfile.weight_class,
            level: (req.query.level as string) || ownProfile.level,
            age_group_id: req.query.age_group_id ? Number(req.query.age_group_id) : ownAgeGroupId,
        };

        const attribute = req.params.attribute === 'punch_power'
            ? 'punch_power'
            : Number(req.params.attribute);

        const limit = Number(req.query.limit) || 20;

        // ── Cache layer ──────────────────────────────────────────────────────────
        // We cache the ranked list WITHOUT the requesting user injected, because
        // the "isCurrentUser" flag is per-request.  We mark it after cache retrieval.
        const cacheKey = buildLeaderboardKey(sportId, attribute, targetCohort, limit);
        const cached = await getCachedLeaderboard<ReturnType<typeof getLeaderboardWithUser> extends Promise<infer T> ? T : never>(cacheKey);

        if (cached) {
            // Re-apply the isCurrentUser flag for this specific requester
            const rehydrated = cached.map((entry: any) => ({
                ...entry,
                isCurrentUser: entry.userId === userId,
            }));

            res.json({
                success: true,
                cohort: targetCohort,
                leaderboard: rehydrated,
                cached: true,
            });
            return;
        }
        // ── Cache miss: compute from DB ──────────────────────────────────────────

        const leaderboard = await getLeaderboardWithUser(
            sportId,
            attribute,
            targetCohort,
            userId,              // always pass – automatically included if part of cohort, added otherwise
            limit,
        );

        // Persist result (strip isCurrentUser before caching – it's per-user)
        const toCache = leaderboard.map((entry) => ({
            ...entry,
            isCurrentUser: false, // reset before storing
        }));
        await setCachedLeaderboard(cacheKey, toCache);

        res.json({
            success: true,
            cohort: targetCohort,
            leaderboard,
            cached: false,
        });
    } catch (error: any) {
        console.error('Get Leaderboard Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};
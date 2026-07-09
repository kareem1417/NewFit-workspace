import { PrismaClient } from '@prisma/client';
import { computeAttributeScore, getLatestTestValue, getAgeGroupId } from './calculation.service';

const prisma = new PrismaClient();

interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    profilePhoto: string | null;
    score: number;
}

export async function getLeaderboard(
    sportId: number,
    attributeOrGoal: number | 'punch_power',   // sport_attributes.id or 'punch_power'
    // Maybe he changes only weight class or level or age group from dropdown so we need to handle that
    baseCohort: { weight_class: string; level: string; age_group_id: number },
    targetCohort?: { weight_class: string; level: string; age_group_id: number },
    limit: number = 20,
): Promise<LeaderboardEntry[]> {
    // 1. Get all athletes matching the base cohort
    //    Need to filter by age_group via date_of_birth, so we join user and compute age.
    const profiles = await prisma.user_sport_profiles.findMany({
        where: {
            sport_id: sportId,
            weight_class: baseCohort.weight_class as any,
            level: baseCohort.level as any,
        },
        include: { users: { select: { id: true, username: true, profile_photo: true, date_of_birth: true } } },
    });

    // Filter by age group
    const filtered = profiles.filter(p => {
        if (!p.users.date_of_birth) return false;
        return getAgeGroupId(new Date(p.users.date_of_birth)) === baseCohort.age_group_id;
    });

    // Use targetCohort if provided, else use baseCohort for scoring
    const scoringCohort = targetCohort || baseCohort;

    const scored: { userId: string; username: string; profilePhoto: string | null; score: number }[] = [];

    for (const prof of filtered) {
        let score: number | null = null;
        /*if (attributeOrGoal === 'punch_power') {
            score = await computePunchPowerForCohort(prof.users.id, sportId, scoringCohort);
        } else {*/

        // computeAttributeScoreForCohort
        score = await computeAttributeScore(attributeOrGoal as number, prof.users.id, sportId, scoringCohort);
        /*}*/
        if (score !== null) {
            scored.push({
                userId: prof.users.id,
                username: prof.users.username,
                profilePhoto: prof.users.profile_photo,
                score,
            });
        }
    }

    // Sort descending
    scored.sort((a, b) => b.score - a.score);

    // Assign ranks (handling ties)
    let rank = 1;
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < scored.length; i++) {
        if (i > 0 && scored[i].score < scored[i - 1].score) rank = i + 1;
        leaderboard.push({ ...scored[i], rank });
        if (leaderboard.length >= limit) break;
    }

    return leaderboard;
}
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';   // ✅ shared singleton

// --- 6.1 Search ---
export const search = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const q = req.query.q as string;
        const type = (req.query.type as string) || 'all';
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        if (!q || q.trim() === '') {
            res.status(200).json({ success: true, data: { users: [], programs: [], posts: [] } });
            return;
        }

        // 1. Sanitize and prepare search query (TSQuery format)
        // Remove symbols that break tsquery and join words with & (AND)
        const sanitizedQ = q.replace(/[&|!:*()]/g, '').trim().split(/\s+/).join(' & ');

        if (!sanitizedQ) {
            res.status(200).json({ success: true, data: { users: [], programs: [], posts: [] } });
            return;
        }

        let results: any = { users: [], programs: [], posts: [] };

        // 2. Search in Users table
        if (type === 'all' || type === 'users') {
            const users = await prisma.$queryRaw`
                SELECT 'user' AS result_type, u.id, u.username, u.profile_photo, u.role,
                       usp.level, usp.weight_class,
                       ts_rank(u.search_vector, to_tsquery('english', ${sanitizedQ})) AS rank
                FROM users u
                LEFT JOIN user_sport_profiles usp ON usp.user_id = u.id AND usp.is_primary = true
                WHERE u.search_vector @@ to_tsquery('english', ${sanitizedQ})
                ORDER BY rank DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
            results.users = users;
        }

        // 3. Search in Programs table
        if (type === 'all' || type === 'programs') {
            const programs = await prisma.$queryRaw`
                SELECT 'program' AS result_type, p.id, p.title, p.description, p.goal_primary,
                       p.rating_avg, p.cover_image, u.username AS coach_name,
                       ts_rank(p.search_vector, to_tsquery('english', ${sanitizedQ})) AS rank
                FROM programs p 
                JOIN users u ON u.id = p.coach_id
                WHERE p.is_published = true AND p.search_vector @@ to_tsquery('english', ${sanitizedQ})
                ORDER BY rank DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
            results.programs = programs;
        }

        // 4. Search in Posts table
        if (type === 'all' || type === 'posts') {
            const posts = await prisma.$queryRaw`
                SELECT 'post' AS result_type, p.id, LEFT(p.content, 150) AS preview,
                       p.created_at, u.username, u.profile_photo,
                       ts_rank(p.search_vector, to_tsquery('english', ${sanitizedQ})) AS rank
                FROM posts p 
                JOIN users u ON u.id = p.user_id
                WHERE p.search_vector @@ to_tsquery('english', ${sanitizedQ})
                ORDER BY rank DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
            results.posts = posts;
        }

        res.status(200).json({ success: true, data: results });

    } catch (error: any) {
        console.error("Search Error:", error);
        res.status(500).json({ success: false, error: "Failed to perform search." });
    }
};
// Temporary function to update Search Vectors in the database
export const syncSearchVectors = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        await prisma.$executeRaw`UPDATE users SET search_vector = to_tsvector('english', coalesce(username, '') || ' ' || coalesce(bio, ''))`;
        await prisma.$executeRaw`UPDATE programs SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))`;
        await prisma.$executeRaw`UPDATE posts SET search_vector = to_tsvector('english', coalesce(content, ''))`;

        res.status(200).json({ success: true, message: "Search vectors synchronized successfully!" });
    } catch (error) {
        console.error("Sync Error:", error);
        res.status(500).json({ success: false, error: "Failed to sync vectors." });
    }
};
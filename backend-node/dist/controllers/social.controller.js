"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFollowing = exports.getFollowers = exports.unfollowUser = exports.followUser = exports.addComment = exports.getComments = exports.unlikePost = exports.likePost = exports.getUserPosts = exports.createPost = exports.getFeed = void 0;
const prisma_1 = require("../config/prisma");
// --- 5.1 Get Social Feed ---
const getFeed = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        // Validate pagination values and set defaults
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // 1. Get the list of user IDs the player is following (Followees)
        const following = await prisma_1.prisma.follows.findMany({
            where: { follower_id: userId },
            select: { followee_id: true }
        });
        const followeeIds = following.map(f => f.followee_id);
        // 2. Posts fetched will belong to the user and their followees
        const targetUserIds = [userId, ...followeeIds];
        // 3. Fetch posts in chronological order (newest first)
        const posts = await prisma_1.prisma.posts.findMany({
            where: {
                user_id: { in: targetUserIds }
            },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true, role: true }
                },
                likes: {
                    where: { user_id: userId },
                    // Modification: Requested a field that actually exists in the table
                    select: { user_id: true }
                }
            }
        });
        // 4. Format data for the frontend according to specifications
        const formattedPosts = posts.map(post => {
            const { likes, users, ...postData } = post;
            return {
                ...postData,
                author: users,
                // If the likes array is not empty, it means I liked this post
                is_liked_by_me: likes.length > 0
            };
        });
        res.status(200).json({
            success: true,
            data: formattedPosts,
            meta: {
                limit,
                offset,
                count: formattedPosts.length
            }
        });
    }
    catch (error) {
        console.error("Get Feed Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch feed." });
    }
};
exports.getFeed = getFeed;
// --- 5.2 Create Post ---
const createPost = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        let { content } = req.body;
        if (!content) {
            res.status(400).json({ success: false, error: "Content is required." });
            return;
        }
        // 1. Sanitize the text
        // Use quick Regex to remove any HTML Tags like <script> or <b>
        content = content.replace(/<[^>]*>?/gm, '');
        // 2. Apply max character limit (500 characters)
        if (content.length > 500) {
            content = content.substring(0, 500);
        }
        // 3. Handle image path (if user uploaded an image via Multer)
        let imagePath = null;
        if (req.file) {
            // req.file.path is provided by Multer after saving the image
            imagePath = req.file.path;
        }
        // 4. Save to the database
        const post = await prisma_1.prisma.posts.create({
            data: {
                user_id: userId,
                content: content,
                image_path: imagePath,
                is_system_generated: false // Standard user post
            }
        });
        res.status(201).json({
            success: true,
            message: "Post created successfully",
            data: post
        });
    }
    catch (error) {
        console.error("Create Post Error:", error);
        res.status(500).json({ success: false, error: "Failed to create post." });
    }
};
exports.createPost = createPost;
// --- 5.3 Get User Posts ---
const getUserPosts = async (req, res) => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Fetch specific user's posts in chronological order
        const posts = await prisma_1.prisma.posts.findMany({
            where: { user_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true, role: true }
                }
            }
        });
        // Format the data
        const formattedPosts = posts.map(post => {
            const { users, ...postData } = post;
            return {
                ...postData,
                author: users
            };
        });
        res.status(200).json({
            success: true,
            data: formattedPosts,
            meta: { limit, offset, count: formattedPosts.length }
        });
    }
    catch (error) {
        console.error("Get User Posts Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch user posts." });
    }
};
exports.getUserPosts = getUserPosts;
// --- 5.4 Like Post ---
const likePost = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        // 1. Ensure the post exists
        const post = await prisma_1.prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found." });
            return;
        }
        // 2. Add like (ignore if already exists ON CONFLICT DO NOTHING)
        try {
            await prisma_1.prisma.likes.create({
                data: { user_id: userId, post_id: postId }
            });
        }
        catch (e) {
            // Prisma code P2002 means Unique Constraint Violation (like already exists)
            // Specs say: silently succeed if exists, so we ignore this error
            if (e.code !== 'P2002')
                throw e;
        }
        // ⚠️ Note: No manual update to likes count here, DB Trigger handles it
        // 3. Respond exactly like Specs
        res.status(200).json({ liked: true });
    }
    catch (error) {
        console.error("Like Post Error:", error);
        res.status(500).json({ success: false, error: "Failed to like post." });
    }
};
exports.likePost = likePost;
// --- 5.5 Unlike Post ---
const unlikePost = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        // 1. Remove like if exists
        // Used deleteMany to avoid needing the exact like ID
        await prisma_1.prisma.likes.deleteMany({
            where: { post_id: postId, user_id: userId }
        });
        // ⚠️ Note: DB Trigger will decrement the count automatically
        // 2. Respond exactly like Specs
        res.status(200).json({ liked: false });
    }
    catch (error) {
        console.error("Unlike Post Error:", error);
        res.status(500).json({ success: false, error: "Failed to unlike post." });
    }
};
exports.unlikePost = unlikePost;
// --- 5.6 Get Comments ---
const getComments = async (req, res) => {
    try {
        const postId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Fetch comments (oldest first, like a chat system)
        const comments = await prisma_1.prisma.comments.findMany({
            where: { post_id: postId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'asc' }, // asc: Oldest first
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true }
                }
            }
        });
        // Format data exactly like Specs
        const formattedComments = comments.map(c => ({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            author_id: c.users?.id,
            username: c.users?.username,
            profile_photo: c.users?.profile_photo
        }));
        res.status(200).json({
            success: true,
            data: formattedComments,
            meta: { limit, offset, count: formattedComments.length }
        });
    }
    catch (error) {
        console.error("Get Comments Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch comments." });
    }
};
exports.getComments = getComments;
// --- 5.7 Add Comment ---
const addComment = async (req, res) => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        let { content } = req.body;
        if (!content) {
            res.status(400).json({ success: false, error: "Comment content is required." });
            return;
        }
        // 1. Ensure the post exists
        const post = await prisma_1.prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            res.status(404).json({ success: false, error: "Post not found." });
            return;
        }
        // 2. Sanitize text and apply max 500 characters limit
        content = content.replace(/<[^>]*>?/gm, '').substring(0, 500);
        // 3. Add comment (no manual count update, Trigger handles it)
        const comment = await prisma_1.prisma.comments.create({
            data: {
                user_id: userId,
                post_id: postId,
                content: content
            },
            include: {
                users: { select: { id: true, username: true, profile_photo: true } }
            }
        });
        res.status(201).json({
            success: true,
            message: "Comment added successfully",
            data: {
                id: comment.id,
                content: comment.content,
                created_at: comment.created_at,
                author: comment.users
            }
        });
    }
    catch (error) {
        console.error("Add Comment Error:", error);
        res.status(500).json({ success: false, error: "Failed to add comment." });
    }
};
exports.addComment = addComment;
// --- 5.8 Follow User ---
const followUser = async (req, res) => {
    try {
        const followerId = String(req.user?.sub);
        const followeeId = String(req.params.userId);
        // 1. Users cannot follow themselves
        if (followerId === followeeId) {
            res.status(400).json({ success: false, error: "You cannot follow yourself." });
            return;
        }
        // 2. Ensure target user exists
        const userExists = await prisma_1.prisma.users.findUnique({ where: { id: followeeId } });
        if (!userExists) {
            res.status(404).json({ success: false, error: "User to follow not found." });
            return;
        }
        // 3. Add follow (ON CONFLICT DO NOTHING handled via Try/Catch)
        try {
            await prisma_1.prisma.follows.create({
                data: {
                    follower_id: followerId,
                    followee_id: followeeId
                }
            });
        }
        catch (e) {
            // If relation already exists (P2002), ignore error and silently succeed
            if (e.code !== 'P2002')
                throw e;
        }
        res.status(200).json({ following: true });
    }
    catch (error) {
        console.error("Follow User Error:", error);
        res.status(500).json({ success: false, error: "Failed to follow user." });
    }
};
exports.followUser = followUser;
// --- 5.9 Unfollow User ---
const unfollowUser = async (req, res) => {
    try {
        const followerId = String(req.user?.sub);
        const followeeId = String(req.params.userId);
        // Remove follow if exists
        await prisma_1.prisma.follows.deleteMany({
            where: {
                follower_id: followerId,
                followee_id: followeeId
            }
        });
        res.status(200).json({ following: false });
    }
    catch (error) {
        console.error("Unfollow User Error:", error);
        res.status(500).json({ success: false, error: "Failed to unfollow user." });
    }
};
exports.unfollowUser = unfollowUser;
// --- 5.10 Get Followers ---
const getFollowers = async (req, res) => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Fetch list of followers (users following this user)
        const followers = await prisma_1.prisma.follows.findMany({
            where: { followee_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
                // ⚠️ If Prisma complains here, change this name to the one in the error
                users_follows_follower_idTousers: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true,
                        role: true,
                        user_sport_profiles: {
                            where: { is_primary: true },
                            select: { level: true, weight_class: true }
                        }
                    }
                }
            }
        });
        // Format data for frontend
        const formattedFollowers = followers.map(f => {
            const user = f.users_follows_follower_idTousers;
            const profile = user?.user_sport_profiles?.[0]; // Primary profile
            return {
                id: user?.id,
                username: user?.username,
                profile_photo: user?.profile_photo,
                role: user?.role,
                level: profile?.level || null,
                weight_class: profile?.weight_class || null
            };
        });
        res.status(200).json({ success: true, data: formattedFollowers, meta: { limit, offset, count: formattedFollowers.length } });
    }
    catch (error) {
        console.error("Get Followers Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch followers." });
    }
};
exports.getFollowers = getFollowers;
// --- 5.11 Get Following ---
const getFollowing = async (req, res) => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // Fetch list of users this user is following
        const following = await prisma_1.prisma.follows.findMany({
            where: { follower_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
                // ⚠️ Same note as above, change name if it complains
                users_follows_followee_idTousers: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true,
                        role: true,
                        user_sport_profiles: {
                            where: { is_primary: true },
                            select: { level: true, weight_class: true }
                        }
                    }
                }
            }
        });
        const formattedFollowing = following.map(f => {
            const user = f.users_follows_followee_idTousers;
            const profile = user?.user_sport_profiles?.[0];
            return {
                id: user?.id,
                username: user?.username,
                profile_photo: user?.profile_photo,
                role: user?.role,
                level: profile?.level || null,
                weight_class: profile?.weight_class || null
            };
        });
        res.status(200).json({ success: true, data: formattedFollowing, meta: { limit, offset, count: formattedFollowing.length } });
    }
    catch (error) {
        console.error("Get Following Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch following." });
    }
};
exports.getFollowing = getFollowing;

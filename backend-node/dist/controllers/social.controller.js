"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPeople = exports.getFollowing = exports.getFollowers = exports.unfollowUser = exports.followUser = exports.deleteComment = exports.updateComment = exports.deletePost = exports.updatePost = exports.addComment = exports.getComments = exports.unlikePost = exports.likePost = exports.getUserPosts = exports.getSpecificPost = exports.createPost = exports.getFeed = void 0;
const prisma_1 = require("../config/prisma");
const AppError_1 = require("../utils/AppError");
require("multer"); // Import for type augmentation to recognize req.file
// --- 5.1 Get Social Feed ---
const getFeed = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        // 1. Get the list of user IDs the player is following (Followees)
        const following = await prisma_1.prisma.follows.findMany({
            where: { follower_id: userId },
            select: { followee_id: true },
        });
        const followeeIds = following.map((f) => f.followee_id);
        // 2. Posts fetched will belong to the user and their followees
        const targetUserIds = [userId, ...followeeIds];
        // 3. Fetch posts in chronological order (newest first)
        const posts = await prisma_1.prisma.posts.findMany({
            where: {
                user_id: { in: targetUserIds },
            },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true, role: true },
                },
                likes: {
                    where: { user_id: userId },
                    select: { user_id: true },
                },
            },
        });
        // 4. Format data for the frontend
        const formattedPosts = posts.map((post) => {
            const { likes, users, ...postData } = post;
            return {
                ...postData,
                author: users,
                is_liked_by_me: likes.length > 0,
            };
        });
        res.status(200).json({
            success: true,
            data: formattedPosts,
            meta: { limit, offset, count: formattedPosts.length },
        });
    }
    catch (error) {
        console.error("Get Feed Error:", error);
        next(new AppError_1.AppError("Failed to fetch feed.", 500));
    }
};
exports.getFeed = getFeed;
// --- 5.2 Create Post ---
const createPost = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        let { content } = req.body;
        const file = req.file;
        // Sanitize content if it exists
        if (content) {
            content = content.replace(/<[^>]*>?/gm, "");
        }
        const imagePath = file ? file.path : null;
        const newPost = await prisma_1.prisma.posts.create({
            data: {
                user_id: userId,
                content: content || "",
                image_path: imagePath,
            },
        });
        res.status(201).json({
            success: true,
            data: newPost,
        });
    }
    catch (error) {
        console.error("Create Post Error:", error);
        next(new AppError_1.AppError("Failed to create post.", 500));
    }
};
exports.createPost = createPost;
// --- 5.12 Get Specific Post ---
const getSpecificPost = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const postId = req.params.id;
        const post = await prisma_1.prisma.posts.findUnique({
            where: { id: postId },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true, role: true },
                },
                likes: {
                    where: { user_id: userId },
                    select: { user_id: true },
                },
            },
        });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 404));
        }
        const { likes, users, ...postData } = post;
        const formattedPost = {
            ...postData,
            author: users,
            is_liked_by_me: likes.length > 0,
        };
        res.status(200).json({
            success: true,
            data: formattedPost,
        });
    }
    catch (error) {
        console.error("Get Specific Post Error:", error);
        next(new AppError_1.AppError("Failed to fetch post.", 500));
    }
};
exports.getSpecificPost = getSpecificPost;
// --- 5.3 Get User Posts ---
const getUserPosts = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const targetUserId = (req.params.id || req.query.user_id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const userExists = await prisma_1.prisma.users.findUnique({
            where: { id: targetUserId },
        });
        if (!userExists) {
            return next(new AppError_1.AppError("User not found.", 404));
        }
        const posts = await prisma_1.prisma.posts.findMany({
            where: { user_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true, role: true },
                },
                likes: {
                    where: { user_id: userId },
                    select: { user_id: true },
                },
                _count: {
                    select: { likes: true, comments: true },
                },
            },
        });
        const formattedPosts = posts.map((post) => {
            const { users, likes, _count, ...postData } = post;
            return {
                ...postData,
                author: users,
                is_liked_by_me: likes.length > 0,
                likes_count: _count.likes,
                comments_count: _count.comments,
            };
        });
        res.status(200).json({
            success: true,
            data: formattedPosts,
            meta: { limit, offset, count: formattedPosts.length },
        });
    }
    catch (error) {
        console.error("Get User Posts Error:", error);
        next(new AppError_1.AppError("Failed to fetch user posts.", 500));
    }
};
exports.getUserPosts = getUserPosts;
// --- 5.4 Like Post ---
const likePost = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        const post = await prisma_1.prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 404));
        }
        try {
            await prisma_1.prisma.likes.create({
                data: { user_id: userId, post_id: postId },
            });
        }
        catch (e) {
            if (e.code !== "P2002")
                throw e;
        }
        res.status(200).json({ liked: true });
    }
    catch (error) {
        console.error("Like Post Error:", error);
        next(new AppError_1.AppError("Failed to like post.", 500));
    }
};
exports.likePost = likePost;
// --- 5.5 Unlike Post ---
const unlikePost = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        const post = await prisma_1.prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 404));
        }
        await prisma_1.prisma.likes.deleteMany({
            where: { post_id: postId, user_id: userId },
        });
        res.status(200).json({ liked: false });
    }
    catch (error) {
        console.error("Unlike Post Error:", error);
        next(new AppError_1.AppError("Failed to unlike post.", 500));
    }
};
exports.unlikePost = unlikePost;
// --- 5.6 Get Comments ---
const getComments = async (req, res, next) => {
    try {
        const postId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const post = await prisma_1.prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 401)); // Requested 401 per your logic
        }
        const comments = await prisma_1.prisma.comments.findMany({
            where: { post_id: postId },
            take: limit,
            skip: offset,
            orderBy: { created_at: "asc" },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true },
                },
            },
        });
        const formattedComments = comments.map((c) => ({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            author_id: c.users?.id,
            username: c.users?.username,
            profile_photo: c.users?.profile_photo,
        }));
        res.status(200).json({
            success: true,
            data: formattedComments,
            meta: { limit, offset, count: formattedComments.length },
        });
    }
    catch (error) {
        console.error("Get Comments Error:", error);
        next(new AppError_1.AppError("Failed to fetch comments.", 500));
    }
};
exports.getComments = getComments;
// --- 5.7 Add Comment ---
const addComment = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        let { content } = req.body;
        const post = await prisma_1.prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 401));
        }
        content = content.trim();
        content = content.replace(/<[^>]*>?/gm, "");
        const comment = await prisma_1.prisma.comments.create({
            data: {
                user_id: userId,
                post_id: postId,
                content: content,
            },
            include: {
                users: { select: { id: true, username: true, profile_photo: true } },
            },
        });
        res.status(201).json({
            success: true,
            message: "Comment added successfully",
            data: {
                id: comment.id,
                content: comment.content,
                created_at: comment.created_at,
                author: comment.users,
            },
        });
    }
    catch (error) {
        console.error("Add Comment Error:", error);
        next(new AppError_1.AppError("Failed to add comment.", 500));
    }
};
exports.addComment = addComment;
// --- 5.13 Update Post ---
const updatePost = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const postId = req.params.id;
        let { content } = req.body;
        const file = req.file;
        const post = await prisma_1.prisma.posts.findUnique({
            where: { id: postId },
        });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 404));
        }
        if (post.user_id !== userId) {
            return next(new AppError_1.AppError("Forbidden — you can only update your own posts.", 403));
        }
        if (content) {
            content = content.replace(/<[^>]*>?/gm, ""); // Sanitize HTML
        }
        const imagePath = file ? file.path : post.image_path;
        const updatedPost = await prisma_1.prisma.posts.update({
            where: { id: postId },
            data: {
                ...(content !== undefined && { content }),
                image_path: imagePath,
            },
        });
        res.status(200).json({ success: true, data: updatedPost });
    }
    catch (error) {
        console.error("Update Post Error:", error);
        next(new AppError_1.AppError("Failed to update post.", 500));
    }
};
exports.updatePost = updatePost;
// --- 5.14 Delete Post ---
const deletePost = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const postId = req.params.id;
        const post = await prisma_1.prisma.posts.findUnique({
            where: { id: postId },
        });
        if (!post) {
            return next(new AppError_1.AppError("Post not found.", 404));
        }
        if (post.user_id !== userId) {
            return next(new AppError_1.AppError("Forbidden — you can only delete your own posts.", 403));
        }
        await prisma_1.prisma.posts.delete({ where: { id: postId } });
        res
            .status(200)
            .json({ success: true, message: "Post deleted successfully." });
    }
    catch (error) {
        console.error("Delete Post Error:", error);
        next(new AppError_1.AppError("Failed to delete post.", 500));
    }
};
exports.deletePost = deletePost;
// --- 5.15 Update Comment ---
const updateComment = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const commentId = req.params.id;
        let { content } = req.body;
        const comment = await prisma_1.prisma.comments.findUnique({
            where: { id: commentId },
        });
        if (!comment) {
            return next(new AppError_1.AppError("Comment not found.", 404));
        }
        if (comment.user_id !== userId) {
            return next(new AppError_1.AppError("Forbidden — you can only update your own comments.", 403));
        }
        content = content.trim().replace(/<[^>]*>?/gm, "");
        const updatedComment = await prisma_1.prisma.comments.update({
            where: { id: commentId },
            data: { content },
        });
        res.status(200).json({ success: true, data: updatedComment });
    }
    catch (error) {
        console.error("Update Comment Error:", error);
        next(new AppError_1.AppError("Failed to update comment.", 500));
    }
};
exports.updateComment = updateComment;
// --- 5.16 Delete Comment ---
// --- 5.16 Delete Comment ---
const deleteComment = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const commentId = req.params.id;
        // 🎯 1. جلب الكومنت، ودمج بيانات البوست المرتبط بيه عشان نعرف مين صاحب البوست
        const comment = await prisma_1.prisma.comments.findUnique({
            where: { id: commentId },
            include: {
                posts: {
                    select: { user_id: true }, // بنجيب ID صاحب البوست بس عشان الأداء
                },
            },
        });
        if (!comment) {
            return next(new AppError_1.AppError("Comment not found.", 404));
        }
        // 🎯 2. تحديد الصلاحيات
        const isCommentAuthor = comment.user_id === userId; // هل هو اللي كاتب الكومنت؟
        const isPostAuthor = comment.posts?.user_id === userId; // هل هو صاحب البوست نفسه؟
        // 🎯 3. لو مش ده ولا ده، نرفض العملية
        if (!isCommentAuthor && !isPostAuthor) {
            return next(new AppError_1.AppError("Forbidden — you can only delete your own comments or comments on your posts.", 403));
        }
        // 4. تنفيذ المسح
        await prisma_1.prisma.comments.delete({ where: { id: commentId } });
        res
            .status(200)
            .json({ success: true, message: "Comment deleted successfully." });
    }
    catch (error) {
        console.error("Delete Comment Error:", error);
        next(new AppError_1.AppError("Failed to delete comment.", 500));
    }
};
exports.deleteComment = deleteComment;
// --- 5.8 Follow User ---
const followUser = async (req, res, next) => {
    try {
        const followerId = String(req.user?.sub);
        const followeeId = String(req.params.userId);
        if (followerId === followeeId) {
            return next(new AppError_1.AppError("You cannot follow yourself.", 400));
        }
        const userExists = await prisma_1.prisma.users.findUnique({
            where: { id: followeeId },
        });
        if (!userExists) {
            return next(new AppError_1.AppError("User to follow not found.", 404));
        }
        try {
            await prisma_1.prisma.follows.create({
                data: { follower_id: followerId, followee_id: followeeId },
            });
        }
        catch (e) {
            if (e.code !== "P2002")
                throw e;
        }
        res.status(200).json({ following: true });
    }
    catch (error) {
        console.error("Follow User Error:", error);
        next(new AppError_1.AppError("Failed to follow user.", 500));
    }
};
exports.followUser = followUser;
// --- 5.9 Unfollow User ---
const unfollowUser = async (req, res, next) => {
    try {
        const followerId = String(req.user?.sub);
        const followeeId = String(req.params.userId);
        await prisma_1.prisma.follows.deleteMany({
            where: { follower_id: followerId, followee_id: followeeId },
        });
        res.status(200).json({ following: false });
    }
    catch (error) {
        console.error("Unfollow User Error:", error);
        next(new AppError_1.AppError("Failed to unfollow user.", 500));
    }
};
exports.unfollowUser = unfollowUser;
// --- 5.10 Get Followers ---
const getFollowers = async (req, res, next) => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const userExists = await prisma_1.prisma.users.findUnique({
            where: { id: targetUserId },
        });
        if (!userExists) {
            return next(new AppError_1.AppError("User not found.", 404));
        }
        const followers = await prisma_1.prisma.follows.findMany({
            where: { followee_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
            include: {
                users_follows_follower_idTousers: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true,
                        role: true,
                        user_sport_profiles: {
                            where: { is_primary: true },
                            select: { level: true, player_category: true },
                        },
                    },
                },
            },
        });
        const formattedFollowers = followers.map((f) => {
            const user = f.users_follows_follower_idTousers;
            const profile = user?.user_sport_profiles?.[0];
            return {
                id: user?.id,
                username: user?.username,
                profile_photo: user?.profile_photo,
                role: user?.role,
                level: profile?.level || null,
                player_category: profile?.player_category || null,
            };
        });
        res
            .status(200)
            .json({
            success: true,
            data: formattedFollowers,
            meta: { limit, offset, count: formattedFollowers.length },
        });
    }
    catch (error) {
        console.error("Get Followers Error:", error);
        next(new AppError_1.AppError("Failed to fetch followers.", 500));
    }
};
exports.getFollowers = getFollowers;
// --- 5.11 Get Following ---
const getFollowing = async (req, res, next) => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const userExists = await prisma_1.prisma.users.findUnique({
            where: { id: targetUserId },
        });
        if (!userExists) {
            return next(new AppError_1.AppError("User not found.", 404));
        }
        const following = await prisma_1.prisma.follows.findMany({
            where: { follower_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: "desc" },
            include: {
                users_follows_followee_idTousers: {
                    select: {
                        id: true,
                        username: true,
                        profile_photo: true,
                        role: true,
                        user_sport_profiles: {
                            where: { is_primary: true },
                            select: { level: true, player_category: true },
                        },
                    },
                },
            },
        });
        const formattedFollowing = following.map((f) => {
            const user = f.users_follows_followee_idTousers;
            const profile = user?.user_sport_profiles?.[0];
            return {
                id: user?.id,
                username: user?.username,
                profile_photo: user?.profile_photo,
                role: user?.role,
                level: profile?.level || null,
                player_category: profile?.player_category || null,
            };
        });
        res
            .status(200)
            .json({
            success: true,
            data: formattedFollowing,
            meta: { limit, offset, count: formattedFollowing.length },
        });
    }
    catch (error) {
        console.error("Get Following Error:", error);
        next(new AppError_1.AppError("Failed to fetch following.", 500));
    }
};
exports.getFollowing = getFollowing;
// --- 5.17 Explore People (Get Users) ---
const getPeople = async (req, res, next) => {
    try {
        const userId = String(req.user?.sub);
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const searchQuery = req.query.q;
        // 1. Build the where clause
        const whereClause = {
            id: { not: userId }, // Exclude the current user
            is_active: true, // Only fetch active users
        };
        // 2. Add search functionality if a query is provided
        if (searchQuery) {
            whereClause.OR = [
                { username: { contains: searchQuery, mode: "insensitive" } },
                { full_name: { contains: searchQuery, mode: "insensitive" } },
            ];
        }
        // 3. Fetch users with their profile data and follow status
        const usersList = await prisma_1.prisma.users.findMany({
            where: whereClause,
            take: limit,
            skip: offset,
            select: {
                id: true,
                username: true,
                full_name: true,
                profile_photo: true,
                role: true,
                bio: true,
                // Check if the current user is following this person
                follows_follows_followee_idTousers: {
                    where: { follower_id: userId },
                    select: { follower_id: true },
                },
            },
            orderBy: { created_at: "desc" }, // Show newest users first
        });
        // 4. Format the response for the frontend
        const formattedUsers = usersList.map((u) => {
            const { follows_follows_followee_idTousers, ...userData } = u;
            return {
                ...userData,
                // If the array has an item, it means the current user follows them
                is_followed_by_me: follows_follows_followee_idTousers.length > 0,
            };
        });
        res.status(200).json({
            success: true,
            data: formattedUsers,
            meta: { limit, offset, count: formattedUsers.length },
        });
    }
    catch (error) {
        console.error("Get People Error:", error);
        next(new AppError_1.AppError("Failed to fetch people for explore tab.", 500));
    }
};
exports.getPeople = getPeople;

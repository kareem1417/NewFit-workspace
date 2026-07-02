import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import 'multer'; // Import for type augmentation to recognize req.file

// --- 5.1 Get Social Feed ---
export const getFeed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        // 1. Get the list of user IDs the player is following (Followees)
        const following = await prisma.follows.findMany({
            where: { follower_id: userId },
            select: { followee_id: true }
        });
        const followeeIds = following.map(f => f.followee_id);

        // 2. Posts fetched will belong to the user and their followees
        const targetUserIds = [userId, ...followeeIds];

        // 3. Fetch posts in chronological order (newest first)
        const posts = await prisma.posts.findMany({
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
                    select: { user_id: true }
                }
            }
        });

        // 4. Format data for the frontend
        const formattedPosts = posts.map(post => {
            const { likes, users, ...postData } = post;
            return {
                ...postData,
                author: users,
                is_liked_by_me: likes.length > 0
            };
        });

        res.status(200).json({
            success: true,
            data: formattedPosts,
            meta: { limit, offset, count: formattedPosts.length }
        });

    } catch (error: any) {
        console.error("Get Feed Error:", error);
        next(new AppError("Failed to fetch feed.", 500));
    }
};

// --- 5.2 Create Post ---
export const createPost = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.sub as string;
        let { content } = req.body;
        const file = (req as any).file;

        // Sanitize content if it exists
        if (content) {
            content = content.replace(/<[^>]*>?/gm, '');
        }

        const imagePath = file ? file.path : null;

        const newPost = await prisma.posts.create({
            data: {
                user_id: userId,
                content: content || '',
                image_path: imagePath
            }
        });

        res.status(201).json({
            success: true,
            data: newPost
        });

    } catch (error: any) {
        console.error("Create Post Error:", error);
        next(new AppError("Failed to create post.", 500));
    }
};

// --- 5.12 Get Specific Post ---
export const getSpecificPost = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const postId = req.params.id;

        const post = await prisma.posts.findUnique({
            where: { id: postId as any },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true, role: true }
                },
                likes: {
                    where: { user_id: userId },
                    select: { user_id: true }
                }
            }
        });

        if (!post) {
            return next(new AppError("Post not found.", 404));
        }

        const { likes, users, ...postData } = post;
        const formattedPost = {
            ...postData,
            author: users,
            is_liked_by_me: likes.length > 0
        };

        res.status(200).json({
            success: true,
            data: formattedPost
        });

    } catch (error: any) {
        console.error("Get Specific Post Error:", error);
        next(new AppError("Failed to fetch post.", 500));
    }
};

// --- 5.3 Get User Posts --- 
export const getUserPosts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const targetUserId = (req.params.id || req.query.user_id) as string;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const userExists = await prisma.users.findUnique({
            where: { id: targetUserId }
        });

        if (!userExists) {
            return next(new AppError("User not found.", 404));
        }

        const posts = await prisma.posts.findMany({
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

    } catch (error: any) {
        console.error("Get User Posts Error:", error);
        next(new AppError("Failed to fetch user posts.", 500));
    }
};

// --- 5.4 Like Post ---
export const likePost = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);

        const post = await prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError("Post not found.", 404));
        }

        try {
            await prisma.likes.create({
                data: { user_id: userId, post_id: postId }
            });
        } catch (e: any) {
            if (e.code !== 'P2002') throw e;
        }

        res.status(200).json({ liked: true });

    } catch (error: any) {
        console.error("Like Post Error:", error);
        next(new AppError("Failed to like post.", 500));
    }
};

// --- 5.5 Unlike Post ---
export const unlikePost = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);

        const post = await prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError("Post not found.", 404));
        }

        await prisma.likes.deleteMany({
            where: { post_id: postId, user_id: userId }
        });

        res.status(200).json({ liked: false });

    } catch (error: any) {
        console.error("Unlike Post Error:", error);
        next(new AppError("Failed to unlike post.", 500));
    }
};

// --- 5.6 Get Comments ---
export const getComments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const postId = String(req.params.id);
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const post = await prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError("Post not found.", 401)); // Requested 401 per your logic
        }

        const comments = await prisma.comments.findMany({
            where: { post_id: postId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'asc' },
            include: {
                users: {
                    select: { id: true, username: true, profile_photo: true }
                }
            }
        });

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

    } catch (error: any) {
        console.error("Get Comments Error:", error);
        next(new AppError("Failed to fetch comments.", 500));
    }
};

// --- 5.7 Add Comment ---
export const addComment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const postId = String(req.params.id);
        let { content } = req.body;

        const post = await prisma.posts.findUnique({ where: { id: postId } });
        if (!post) {
            return next(new AppError("Post not found.", 401));
        }

        content = content.trim();
        content = content.replace(/<[^>]*>?/gm, '');

        const comment = await prisma.comments.create({
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

    } catch (error: any) {
        console.error("Add Comment Error:", error);
        next(new AppError("Failed to add comment.", 500));
    }
};
// --- 5.13 Update Post ---
export const updatePost = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const postId = req.params.id;
        let { content } = req.body;
        const file = (req as any).file;

        const post = await prisma.posts.findUnique({ where: { id: postId as any } });
        if (!post) {
            return next(new AppError("Post not found.", 404));
        }
        if (post.user_id !== userId) {
            return next(new AppError("Forbidden — you can only update your own posts.", 403));
        }

        if (content) {
            content = content.replace(/<[^>]*>?/gm, ''); // Sanitize HTML
        }

        const imagePath = file ? file.path : post.image_path;

        const updatedPost = await prisma.posts.update({
            where: { id: postId as any },
            data: {
                ...(content !== undefined && { content }),
                image_path: imagePath
            }
        });

        res.status(200).json({ success: true, data: updatedPost });
    } catch (error: any) {
        console.error("Update Post Error:", error);
        next(new AppError("Failed to update post.", 500));
    }
};

// --- 5.14 Delete Post ---
export const deletePost = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const postId = req.params.id;

        const post = await prisma.posts.findUnique({ where: { id: postId as any } });
        if (!post) {
            return next(new AppError("Post not found.", 404));
        }
        if (post.user_id !== userId) {
            return next(new AppError("Forbidden — you can only delete your own posts.", 403));
        }

        await prisma.posts.delete({ where: { id: postId as any } });

        res.status(200).json({ success: true, message: "Post deleted successfully." });
    } catch (error: any) {
        console.error("Delete Post Error:", error);
        next(new AppError("Failed to delete post.", 500));
    }
};

// --- 5.15 Update Comment ---
export const updateComment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const commentId = req.params.id;
        let { content } = req.body;

        const comment = await prisma.comments.findUnique({ where: { id: commentId as any } });
        if (!comment) {
            return next(new AppError("Comment not found.", 404));
        }
        if (comment.user_id !== userId) {
            return next(new AppError("Forbidden — you can only update your own comments.", 403));
        }

        content = content.trim().replace(/<[^>]*>?/gm, '');

        const updatedComment = await prisma.comments.update({
            where: { id: commentId as any },
            data: { content }
        });

        res.status(200).json({ success: true, data: updatedComment });
    } catch (error: any) {
        console.error("Update Comment Error:", error);
        next(new AppError("Failed to update comment.", 500));
    }
};

// --- 5.16 Delete Comment ---
// --- 5.16 Delete Comment ---
export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = String(req.user?.sub);
        const commentId = req.params.id;

        // 🎯 1. جلب الكومنت، ودمج بيانات البوست المرتبط بيه عشان نعرف مين صاحب البوست
        const comment = await prisma.comments.findUnique({
            where: { id: commentId as any },
            include: {
                posts: {
                    select: { user_id: true } // بنجيب ID صاحب البوست بس عشان الأداء
                }
            }
        });

        if (!comment) {
            return next(new AppError("Comment not found.", 404));
        }

        // 🎯 2. تحديد الصلاحيات
        const isCommentAuthor = comment.user_id === userId; // هل هو اللي كاتب الكومنت؟
        const isPostAuthor = comment.posts?.user_id === userId; // هل هو صاحب البوست نفسه؟

        // 🎯 3. لو مش ده ولا ده، نرفض العملية
        if (!isCommentAuthor && !isPostAuthor) {
            return next(new AppError("Forbidden — you can only delete your own comments or comments on your posts.", 403));
        }

        // 4. تنفيذ المسح
        await prisma.comments.delete({ where: { id: commentId as any } });

        res.status(200).json({ success: true, message: "Comment deleted successfully." });
    } catch (error: any) {
        console.error("Delete Comment Error:", error);
        next(new AppError("Failed to delete comment.", 500));
    }
};
// --- 5.8 Follow User ---
export const followUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const followerId = String(req.user?.sub);
        const followeeId = String(req.params.userId);

        if (followerId === followeeId) {
            return next(new AppError("You cannot follow yourself.", 400));
        }

        const userExists = await prisma.users.findUnique({ where: { id: followeeId } });
        if (!userExists) {
            return next(new AppError("User to follow not found.", 404));
        }

        try {
            await prisma.follows.create({
                data: { follower_id: followerId, followee_id: followeeId }
            });
        } catch (e: any) {
            if (e.code !== 'P2002') throw e;
        }

        res.status(200).json({ following: true });

    } catch (error: any) {
        console.error("Follow User Error:", error);
        next(new AppError("Failed to follow user.", 500));
    }
};

// --- 5.9 Unfollow User ---
export const unfollowUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const followerId = String(req.user?.sub);
        const followeeId = String(req.params.userId);

        await prisma.follows.deleteMany({
            where: { follower_id: followerId, followee_id: followeeId }
        });

        res.status(200).json({ following: false });

    } catch (error: any) {
        console.error("Unfollow User Error:", error);
        next(new AppError("Failed to unfollow user.", 500));
    }
};

// --- 5.10 Get Followers ---
export const getFollowers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const userExists = await prisma.users.findUnique({
            where: { id: targetUserId }
        });

        if (!userExists) {
            return next(new AppError("User not found.", 404));
        }

        const followers = await prisma.follows.findMany({
            where: { followee_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
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

        const formattedFollowers = followers.map(f => {
            const user = f.users_follows_follower_idTousers;
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

        res.status(200).json({ success: true, data: formattedFollowers, meta: { limit, offset, count: formattedFollowers.length } });

    } catch (error: any) {
        console.error("Get Followers Error:", error);
        next(new AppError("Failed to fetch followers.", 500));
    }
};

// --- 5.11 Get Following ---
export const getFollowing = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const targetUserId = String(req.params.id);
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;

        const userExists = await prisma.users.findUnique({
            where: { id: targetUserId }
        });

        if (!userExists) {
            return next(new AppError("User not found.", 404));
        }

        const following = await prisma.follows.findMany({
            where: { follower_id: targetUserId },
            take: limit,
            skip: offset,
            orderBy: { created_at: 'desc' },
            include: {
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

    } catch (error: any) {
        console.error("Get Following Error:", error);
        next(new AppError("Failed to fetch following.", 500));
    }
};
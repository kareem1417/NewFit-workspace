import { Router } from 'express';
import {
    getFeed,
    createPost,
    getUserPosts,
    likePost,
    unlikePost,
    addComment,
    getComments,
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing
} from '../controllers/social.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Existing routes
router.get('/feed', authenticateToken, getFeed);
router.post('/posts', authenticateToken, createPost);
router.get('/users/:id/posts', authenticateToken, getUserPosts);
router.post('/posts/:id/like', authenticateToken, likePost);
router.delete('/posts/:id/like', authenticateToken, unlikePost);
router.get('/posts/:id/comments', authenticateToken, getComments);
router.post('/posts/:id/comments', authenticateToken, addComment);

// -- New Follow Feature Routes --

// Follow and Unfollow Users
router.post('/follow/:userId', authenticateToken, followUser);
router.delete('/follow/:userId', authenticateToken, unfollowUser);

// Fetch Followers and Following Lists
router.get('/users/:id/followers', authenticateToken, getFollowers);
router.get('/users/:id/following', authenticateToken, getFollowing);

export default router;
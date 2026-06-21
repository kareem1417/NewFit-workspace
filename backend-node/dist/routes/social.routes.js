"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const social_controller_1 = require("../controllers/social.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Existing routes
router.get('/feed', auth_middleware_1.authenticateToken, social_controller_1.getFeed);
router.post('/posts', auth_middleware_1.authenticateToken, social_controller_1.createPost);
router.get('/users/:id/posts', auth_middleware_1.authenticateToken, social_controller_1.getUserPosts);
router.post('/posts/:id/like', auth_middleware_1.authenticateToken, social_controller_1.likePost);
router.delete('/posts/:id/like', auth_middleware_1.authenticateToken, social_controller_1.unlikePost);
router.get('/posts/:id/comments', auth_middleware_1.authenticateToken, social_controller_1.getComments);
router.post('/posts/:id/comments', auth_middleware_1.authenticateToken, social_controller_1.addComment);
// -- New Follow Feature Routes --
// Follow and Unfollow Users
router.post('/follow/:userId', auth_middleware_1.authenticateToken, social_controller_1.followUser);
router.delete('/follow/:userId', auth_middleware_1.authenticateToken, social_controller_1.unfollowUser);
// Fetch Followers and Following Lists
router.get('/users/:id/followers', auth_middleware_1.authenticateToken, social_controller_1.getFollowers);
router.get('/users/:id/following', auth_middleware_1.authenticateToken, social_controller_1.getFollowing);
exports.default = router;

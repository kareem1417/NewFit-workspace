"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const social_controller_1 = require("../controllers/social.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const social_validator_1 = require("../validators/social.validator");
const router = (0, express_1.Router)();
// ==========================================
// Social Feed & Posts
// ==========================================
router.get("/feed", auth_middleware_1.authenticateToken, social_validator_1.paginationValidation, validation_middleware_1.validate, social_controller_1.getFeed);
// ⚠️ ملحوظة مهمة: لو بتستخدم Multer لرفع الصور في البوستات، لازم تحط الـ middleware بتاعه هنا قبل `createPostValidation`
router.post("/posts", auth_middleware_1.authenticateToken, upload_middleware_1.uploadPostImage.single("image"), // 👈 استخدمنا بتاع البوستات، والـ Key اسمه image
social_validator_1.createPostValidation, validation_middleware_1.validate, social_controller_1.createPost);
router.get("/users/:id/posts", auth_middleware_1.authenticateToken, social_validator_1.getUserPostsValidation, validation_middleware_1.validate, social_controller_1.getUserPosts);
router.get("/posts/:id", auth_middleware_1.authenticateToken, social_validator_1.postIdParamValidation, validation_middleware_1.validate, social_controller_1.getSpecificPost); // ضيف دي لو محتاجها للـ Specific Post
router.patch("/posts/:id", auth_middleware_1.authenticateToken, upload_middleware_1.uploadPostImage.single("image"), social_validator_1.updatePostValidation, validation_middleware_1.validate, social_controller_1.updatePost);
router.delete("/posts/:id", auth_middleware_1.authenticateToken, social_validator_1.postIdParamValidation, validation_middleware_1.validate, social_controller_1.deletePost);
// ==========================================
// Likes & Comments
// ==========================================
router.post("/posts/:id/like", auth_middleware_1.authenticateToken, social_validator_1.postIdParamValidation, validation_middleware_1.validate, social_controller_1.likePost);
router.delete("/posts/:id/like", auth_middleware_1.authenticateToken, social_validator_1.postIdParamValidation, validation_middleware_1.validate, social_controller_1.unlikePost);
router.get("/posts/:id/comments", auth_middleware_1.authenticateToken, social_validator_1.postIdParamValidation, validation_middleware_1.validate, social_controller_1.getComments);
router.post("/posts/:id/comments", auth_middleware_1.authenticateToken, social_validator_1.addCommentValidation, validation_middleware_1.validate, social_controller_1.addComment);
router.patch("/comments/:id", auth_middleware_1.authenticateToken, social_validator_1.updateCommentValidation, validation_middleware_1.validate, social_controller_1.updateComment);
router.delete("/comments/:id", auth_middleware_1.authenticateToken, social_validator_1.commentIdParamValidation, validation_middleware_1.validate, social_controller_1.deleteComment);
// ==========================================
// Follow Feature
// ==========================================
router.post("/follow/:userId", auth_middleware_1.authenticateToken, social_validator_1.followValidation, validation_middleware_1.validate, social_controller_1.followUser);
router.delete("/follow/:userId", auth_middleware_1.authenticateToken, social_validator_1.followValidation, validation_middleware_1.validate, social_controller_1.unfollowUser);
router.get("/users/:id/followers", auth_middleware_1.authenticateToken, social_validator_1.userIdParamValidation, social_validator_1.paginationValidation, validation_middleware_1.validate, social_controller_1.getFollowers);
router.get("/users/:id/following", auth_middleware_1.authenticateToken, social_validator_1.userIdParamValidation, social_validator_1.paginationValidation, validation_middleware_1.validate, social_controller_1.getFollowing);
router.get("/explore/people", auth_middleware_1.authenticateToken, social_validator_1.paginationValidation, validation_middleware_1.validate, social_controller_1.getPeople);
exports.default = router;

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
    getFollowing,
    getSpecificPost, // 🎯 تأكد إنك عاملها Import لو موجودة
    updatePost,
    deletePost,
    updateComment,
    deleteComment
} from '../controllers/social.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { uploadPostImage } from '../middlewares/upload.middleware';
import {
    paginationValidation,
    createPostValidation,
    getUserPostsValidation,
    postIdParamValidation,
    addCommentValidation,
    followValidation,
    userIdParamValidation,
    updatePostValidation,
    updateCommentValidation,
    commentIdParamValidation
} from '../validators/social.validator';

const router = Router();

// ==========================================
// Social Feed & Posts
// ==========================================
router.get('/feed', authenticateToken, paginationValidation, validate, getFeed);

// ⚠️ ملحوظة مهمة: لو بتستخدم Multer لرفع الصور في البوستات، لازم تحط الـ middleware بتاعه هنا قبل `createPostValidation`
router.post(
    '/posts',
    authenticateToken,
    uploadPostImage.single('image'), // 👈 استخدمنا بتاع البوستات، والـ Key اسمه image
    createPostValidation,
    validate,
    createPost
);
router.get('/users/:id/posts', authenticateToken, getUserPostsValidation, validate, getUserPosts);
router.get('/posts/:id', authenticateToken, postIdParamValidation, validate, getSpecificPost); // ضيف دي لو محتاجها للـ Specific Post
router.patch('/posts/:id', authenticateToken, uploadPostImage.single('image'), updatePostValidation, validate, updatePost);
router.delete('/posts/:id', authenticateToken, postIdParamValidation, validate, deletePost);

// ==========================================
// Likes & Comments
// ==========================================
router.post('/posts/:id/like', authenticateToken, postIdParamValidation, validate, likePost);
router.delete('/posts/:id/like', authenticateToken, postIdParamValidation, validate, unlikePost);
router.get('/posts/:id/comments', authenticateToken, postIdParamValidation, validate, getComments);
router.post('/posts/:id/comments', authenticateToken, addCommentValidation, validate, addComment);
router.patch('/comments/:id', authenticateToken, updateCommentValidation, validate, updateComment);
router.delete('/comments/:id', authenticateToken, commentIdParamValidation, validate, deleteComment);

// ==========================================
// Follow Feature
// ==========================================
router.post('/follow/:userId', authenticateToken, followValidation, validate, followUser);
router.delete('/follow/:userId', authenticateToken, followValidation, validate, unfollowUser);

router.get('/users/:id/followers', authenticateToken, userIdParamValidation, paginationValidation, validate, getFollowers);
router.get('/users/:id/following', authenticateToken, userIdParamValidation, paginationValidation, validate, getFollowing);

export default router;
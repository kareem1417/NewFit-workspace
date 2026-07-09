"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProfile = exports.updateMe = exports.uploadPhoto = exports.getMe = exports.deactivateAccount = void 0;
const prisma_1 = require("../config/prisma");
const cloudinary_1 = require("cloudinary");
const AppError_1 = require("../utils/AppError");
// Works without Validator
const deactivateAccount = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        await prisma_1.prisma.$transaction([
            // 1. Set account status to Inactive
            prisma_1.prisma.users.update({
                where: { id: userId },
                data: { is_active: false },
            }),
            prisma_1.prisma.user_tokens.deleteMany({
                where: { user_id: userId, token_type: "REFRESH" },
            }),
        ]);
        res.status(200).json({
            success: true,
            message: "Account deactivated successfully. You have been logged out from all devices.",
        });
    }
    catch (error) {
        console.error("Deactivate Account Error:", error);
        next(new AppError_1.AppError("Internal server error", 500));
    }
};
exports.deactivateAccount = deactivateAccount;
// works good without Validator
const getMe = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: userId },
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true },
                },
            },
        });
        if (!user) {
            return next(new AppError_1.AppError("User not found.", 404));
        }
        const { password_hash, ...safeUserData } = user;
        res.status(200).json({
            success: true,
            data: safeUserData,
        });
    }
    catch (error) {
        console.error("Get Me Error:", error);
        next(new AppError_1.AppError("Failed to fetch user profile.", 500));
    }
};
exports.getMe = getMe;
// Done
const uploadPhoto = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        const file = req.file;
        if (!file) {
            return next(new AppError_1.AppError("Validation error — file required.", 400));
        }
        const photoUrl = file.path;
        const user = await prisma_1.prisma.users.findUnique({ where: { id: userId } });
        if (user?.profile_photo) {
            const publicIdMatch = user.profile_photo.match(/\/v\d+\/(.+?)\.\w+$/);
            if (publicIdMatch && publicIdMatch[1]) {
                await cloudinary_1.v2.uploader.destroy(publicIdMatch[1]);
            }
        }
        const updatedUser = await prisma_1.prisma.users.update({
            where: { id: userId },
            data: { profile_photo: photoUrl },
        });
        res.status(201).json({
            success: true,
            profile_photo_url: updatedUser.profile_photo,
        });
    }
    catch (error) {
        if (error.message?.includes("format pdf not allowed") ||
            error.http_code === 400) {
            return next(new AppError_1.AppError("Invalid file type — only JPEG, PNG, WEBP accepted.", 400));
        }
        if (error.message?.includes("limit") || error.message?.includes("large")) {
            return next(new AppError_1.AppError("File size exceeds limit.", 400));
        }
        next(error);
    }
};
exports.uploadPhoto = uploadPhoto;
// Done
const updateMe = async (req, res, next) => {
    try {
        const userId = req.user?.sub;
        // 📌 ضفنا full_name في الـ destructuring
        const { full_name, bio, username, social_links, role_models, role } = req.body;
        if (username) {
            const sanitizedUsername = username.trim();
            const existingUser = await prisma_1.prisma.users.findFirst({
                where: {
                    username: {
                        equals: sanitizedUsername,
                        mode: "insensitive",
                    },
                },
            });
            console.log("DEBUG UPDATE_ME -> Current User ID:", userId);
            console.log("DEBUG UPDATE_ME -> Found Existing User:", existingUser
                ? { id: existingUser.id, username: existingUser.username }
                : "Not Found");
            if (existingUser) {
                if (existingUser.id !== userId) {
                    return next(new AppError_1.AppError("Username is already taken.", 409));
                }
            }
        }
        const updateData = {};
        // 📌 ضفنا السطر ده عشان يجهز الـ full_name للتحديث
        if (full_name !== undefined)
            updateData.full_name = full_name.trim();
        if (bio !== undefined)
            updateData.bio = bio;
        if (username !== undefined)
            updateData.username = username.trim();
        if (social_links !== undefined)
            updateData.social_links = social_links;
        if (role_models !== undefined)
            updateData.role_models = role_models;
        if (role !== undefined)
            updateData.role = role;
        const updatedUser = await prisma_1.prisma.users.update({
            where: { id: userId },
            data: updateData,
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true },
                },
            },
        });
        const { password_hash, ...safeUserData } = updatedUser;
        res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: safeUserData,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMe = updateMe;
// export const getPublicProfile = async (
//   req: AuthRequest,
//   res: Response,
// ): Promise<void> => {
//   try {
//     const targetUserId = req.params.id; // Target profile ID to view
//     const requestingUserId = req.user?.sub as string; // ID of the requesting user
//     if (!targetUserId || (targetUserId as string).trim() === "") {
//       res.status(400).json({
//         success: false,
//         error: "Validation error — user_id param is required.",
//       });
//       return;
//     }
//     const uuidRegex =
//       /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
//     if (!uuidRegex.test(targetUserId as string)) {
//       res
//         .status(400)
//         .json({ success: false, error: "Validation error — invalid UUID." });
//       return;
//     }
//     const targetUser = await prisma.users.findUnique({
//       where: { id: targetUserId as string },
//       include: {
//         user_sport_profiles: {
//           where: { is_primary: true },
//           include: { sports: true },
//         },
//       },
//     });
//     if (!targetUser) {
//       res.status(404).json({ success: false, error: "User not found." });
//       return;
//     }
//     let is_following = false;
//     if (requestingUserId && requestingUserId !== targetUserId) {
//       const followRecord = await prisma.follows.findUnique({
//         where: {
//           follower_id_followee_id: {
//             follower_id: requestingUserId,
//             followee_id: targetUserId as string,
//           },
//         },
//       });
//       is_following = !!followRecord;
//     }
//     const { password_hash, email, date_of_birth, ...publicData } = targetUser;
//     res.status(200).json({
//       success: true,
//       data: {
//         ...publicData,
//         is_following,
//       },
//     });
//   } catch (error: any) {
//     console.error("Get Public Profile Error:", error);
//     res
//       .status(500)
//       .json({ success: false, error: "Failed to fetch user profile." });
//   }
// };
//  i think it works in success format
const getPublicProfile = async (req, res, next) => {
    try {
        const targetUserId = req.query.user_id;
        const requestingUserId = req.user?.sub;
        // 🎯 مسحنا الـ Validation من هنا لأنه بقى بيتعمل في validator.ts
        const targetUser = await prisma_1.prisma.users.findUnique({
            where: { id: targetUserId },
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true },
                },
            },
        });
        if (!targetUser) {
            return next(new AppError_1.AppError("User not found.", 404));
        }
        const followersCount = await prisma_1.prisma.follows.count({
            where: { followee_id: targetUserId },
        });
        const followingCount = await prisma_1.prisma.follows.count({
            where: { follower_id: targetUserId },
        });
        const postsCount = await prisma_1.prisma.posts.count({
            where: { user_id: targetUserId },
        });
        let is_following = false;
        if (requestingUserId && requestingUserId !== targetUserId) {
            const followRecord = await prisma_1.prisma.follows.findUnique({
                where: {
                    follower_id_followee_id: {
                        follower_id: requestingUserId,
                        followee_id: targetUserId,
                    },
                },
            });
            is_following = !!followRecord;
        }
        const userAny = targetUser;
        const sportProfiles = userAny.user_sport_profiles || [];
        const cleanedSportProfiles = sportProfiles.map(({ user_id, ...rest }) => rest);
        const { password_hash, email, date_of_birth, ...publicData } = userAny;
        res.status(200).json({
            success: true,
            data: {
                ...publicData,
                user_sport_profiles: cleanedSportProfiles,
                followers_count: followersCount,
                following_count: followingCount,
                posts_count: postsCount,
                programs_completed: 0,
                is_following,
            },
        });
    }
    catch (error) {
        console.error("Get Public Profile Error:", error);
        next(new AppError_1.AppError("Failed to fetch user profile.", 500));
    }
};
exports.getPublicProfile = getPublicProfile;

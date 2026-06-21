"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicProfile = exports.uploadPhoto = exports.updateMe = exports.getMe = exports.deactivateAccount = void 0;
const prisma_1 = require("../config/prisma");
const deactivateAccount = async (req, res) => {
    try {
        const userId = req.user?.sub;
        // Pro trick: Use Transaction to ensure account deactivation and token deletion happen together
        await prisma_1.prisma.$transaction([
            // 1. Set account status to Inactive
            prisma_1.prisma.users.update({
                where: { id: userId },
                data: { is_active: false }
            }),
            // 2. Delete all Refresh Tokens to log out from all devices immediately
            prisma_1.prisma.user_tokens.deleteMany({
                where: { user_id: userId, token_type: 'REFRESH' }
            })
        ]);
        res.status(200).json({
            success: true,
            message: "Account deactivated successfully. You have been logged out from all devices."
        });
    }
    catch (error) {
        console.error("Deactivate Account Error:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};
exports.deactivateAccount = deactivateAccount;
const getMe = async (req, res) => {
    try {
        const userId = req.user?.sub;
        // Fetch user data along with their sport profile
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: userId },
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true } // Include sport name (e.g. Boxing)
                }
            }
        });
        if (!user) {
            res.status(404).json({ success: false, error: "User not found." });
            return;
        }
        // Safe exclusion: Removed refreshtoken since it's no longer on the user object
        const { password_hash, ...safeUserData } = user;
        res.status(200).json({
            success: true,
            data: safeUserData
        });
    }
    catch (error) {
        console.error("Get Me Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch user profile." });
    }
};
exports.getMe = getMe;
const updateMe = async (req, res) => {
    try {
        const userId = req.user?.sub;
        // Receive optional fields from DTO
        const { bio, username, social_links, role_models } = req.body;
        // 1. If user sends a new username, verify it's not taken
        if (username) {
            const existingUser = await prisma_1.prisma.users.findUnique({ where: { username } });
            if (existingUser && existingUser.id !== userId) {
                res.status(409).json({ success: false, error: "Username is already taken." });
                return;
            }
        }
        // 2. Dynamically build update object (only update provided fields)
        const updateData = {};
        if (bio !== undefined)
            updateData.bio = bio;
        if (username !== undefined)
            updateData.username = username;
        if (social_links !== undefined)
            updateData.social_links = social_links;
        if (role_models !== undefined)
            updateData.role_models = role_models; // Array of names like ["Muhammad Ali", "Mike Tyson"]
        // 3. Execute DB update (include sport profile to match getMe response)
        const updatedUser = await prisma_1.prisma.users.update({
            where: { id: userId },
            data: updateData,
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true }
                }
            }
        });
        // 4. Remove sensitive data
        const { password_hash, ...safeUserData } = updatedUser;
        // 5. Send response to frontend
        res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: safeUserData
        });
    }
    catch (error) {
        console.error("Update Me Error:", error);
        res.status(500).json({ success: false, error: "Failed to update profile." });
    }
};
exports.updateMe = updateMe;
const uploadPhoto = async (req, res) => {
    try {
        const userId = req.user?.sub;
        // Type bypass: Cast req as any to resolve AuthRequest TypeScript error
        const file = req.file;
        if (!file) {
            res.status(400).json({ success: false, error: "No image file provided." });
            return;
        }
        // Cloudinary returns the direct link here
        const photoUrl = file.path;
        const updatedUser = await prisma_1.prisma.users.update({
            where: { id: userId },
            data: { profile_photo: photoUrl }
        });
        res.status(200).json({
            success: true,
            message: "Profile photo uploaded successfully via Cloudinary.",
            profile_photo: updatedUser.profile_photo
        });
    }
    catch (error) {
        console.error("Upload Photo Error:", error);
        res.status(500).json({ success: false, error: "Failed to upload photo." });
    }
};
exports.uploadPhoto = uploadPhoto;
const getPublicProfile = async (req, res) => {
    try {
        const targetUserId = req.params.id; // Target profile ID to view
        const requestingUserId = req.user?.sub; // ID of the requesting user
        // 1. Fetch profile data
        const targetUser = await prisma_1.prisma.users.findUnique({
            where: { id: targetUserId },
            include: {
                user_sport_profiles: {
                    where: { is_primary: true },
                    include: { sports: true }
                }
            }
        });
        if (!targetUser) {
            res.status(404).json({ success: false, error: "User not found." });
            return;
        }
        // 2. Check if current user is following this profile
        // Use follower_id_followee_id due to Composite ID in schema
        let is_following = false;
        if (requestingUserId && requestingUserId !== targetUserId) {
            const followRecord = await prisma_1.prisma.follows.findUnique({
                where: {
                    follower_id_followee_id: {
                        follower_id: requestingUserId,
                        followee_id: targetUserId
                    }
                }
            });
            is_following = !!followRecord; // True if found, otherwise false
        }
        // 3. Remove sensitive data for privacy
        const { password_hash, email, date_of_birth, ...publicData } = targetUser;
        // 4. Respond with data and follow status
        res.status(200).json({
            success: true,
            data: {
                ...publicData,
                is_following
            }
        });
    }
    catch (error) {
        console.error("Get Public Profile Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch user profile." });
    }
};
exports.getPublicProfile = getPublicProfile;

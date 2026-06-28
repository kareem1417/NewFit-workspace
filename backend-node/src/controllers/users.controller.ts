import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../config/prisma";
import { v2 as cloudinary } from "cloudinary";

export const deactivateAccount = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // Pro trick: Use Transaction to ensure account deactivation and token deletion happen together
    await prisma.$transaction([
      // 1. Set account status to Inactive
      prisma.users.update({
        where: { id: userId },
        data: { is_active: false },
      }),

      // 2. Delete all Refresh Tokens to log out from all devices immediately
      prisma.user_tokens.deleteMany({
        where: { user_id: userId, token_type: "REFRESH" },
      }),
    ]);

    res.status(200).json({
      success: true,
      message:
        "Account deactivated successfully. You have been logged out from all devices.",
    });
  } catch (error) {
    console.error("Deactivate Account Error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // Fetch user data along with their sport profile
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_sport_profiles: {
          where: { is_primary: true },
          include: { sports: true }, // Include sport name (e.g. Boxing)
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    // Safe exclusion: Removed refreshtoken since it's no longer on the user object
    const { password_hash, ...safeUserData } = user;

    res.status(200).json({
      success: true,
      data: safeUserData,
    });
  } catch (error: any) {
    console.error("Get Me Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch user profile." });
  }
};

export const updateMe = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // Receive optional fields from DTO
    const { bio, username, social_links, role_models } = req.body;
    if (social_links !== undefined) {
      // بنعمل فحص عشان نتأكد إنها Object، ومش Null، ومش Array
      if (
        typeof social_links !== "object" ||
        social_links === null ||
        Array.isArray(social_links)
      ) {
        res.status(400).json({
          success: false,
          error: "Validation error — must be JSON object.",
        });
        return;
      }

      // 🎯 2. (خطوة سينيور إضافية) التأكد إن القيم اللي جوه الـ Object دي عبارة عن لينكات بجد
      // يعني ميجيش يبعتلك {"instagram": "my_account"}، لازم يبعت لينك كامل
      for (const key in social_links) {
        const url = social_links[key];
        if (typeof url !== "string" || !url.startsWith("http")) {
          res.status(400).json({
            success: false,
            error: `Validation error — invalid social media link for ${key}. Must be a valid URL starting with http/https.`,
          });
          return;
        }
      }
    }
    // 1. If user sends a new username, verify it's not taken
    if (username) {
      const existingUser = await prisma.users.findUnique({
        where: { username },
      });
      if (existingUser && existingUser.id !== userId) {
        res
          .status(409)
          .json({ success: false, error: "Username is already taken." });
        return;
      }
    }

    // 2. Dynamically build update object (only update provided fields)
    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (username !== undefined) updateData.username = username;
    if (social_links !== undefined) updateData.social_links = social_links;
    if (role_models !== undefined) updateData.role_models = role_models; // Array of names like ["Muhammad Ali", "Mike Tyson"]

    // 3. Execute DB update (include sport profile to match getMe response)
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      include: {
        user_sport_profiles: {
          where: { is_primary: true },
          include: { sports: true },
        },
      },
    });

    // 4. Remove sensitive data
    const { password_hash, ...safeUserData } = updatedUser;

    // 5. Send response to frontend
    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: safeUserData,
    });
  } catch (error: any) {
    console.error("Update Me Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update profile." });
  }
};

export const uploadPhoto = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub as string;

    // دلوقتي نقدر نقرأ الملف بأمان من غير as any
    const file = req.file;

    if (!file) {
      // 🎯 مطابقة لرسالة الـ Sad Path
      res
        .status(400)
        .json({ success: false, error: "Validation error — file required." });
      return;
    }

    const photoUrl = file.path;

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (user?.profile_photo) {
      const publicIdMatch = user.profile_photo.match(/\/v\d+\/(.+?)\.\w+$/);
      if (publicIdMatch && publicIdMatch[1])
        await cloudinary.uploader.destroy(publicIdMatch[1]);
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { profile_photo: photoUrl },
    });

    // 🎯 الرد بـ 201 ونفس شكل الـ JSON المتوقع في التيست
    res.status(201).json({
      success: true,
      profile_photo_url: updatedUser.profile_photo,
    });
  } catch (error: any) {
    console.error("Upload Photo Error:", error);
    res.status(500).json({ success: false, error: "Failed to upload photo." });
  }
};
export const getPublicProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const targetUserId = req.params.id; // Target profile ID to view
    const requestingUserId = req.user?.sub as string; // ID of the requesting user

    // 🎯 1. التعديل الجديد: التأكد إن الـ ID مبعوت ومش فاضي
    if (!targetUserId || (targetUserId as string).trim() === "") {
      res.status(400).json({
        success: false,
        error: "Validation error — user_id param is required.",
      });
      return;
    }

    // 🎯 2. التعديل الجديد: التأكد إن الـ ID بصيغة UUID سليمة
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(targetUserId as string)) {
      res
        .status(400)
        .json({ success: false, error: "Validation error — invalid UUID." });
      return;
    }

    // 3. Fetch profile data (الكود بتاعك السليم)
    const targetUser = await prisma.users.findUnique({
      where: { id: targetUserId as string }, // شيلنا الـ 'as string' لأننا ضمنا إنه String فوق
      include: {
        user_sport_profiles: {
          where: { is_primary: true },
          include: { sports: true },
        },
      },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    // 4. Check if current user is following this profile
    let is_following = false;

    // مفيش داعي يعمل فحص لو اليوزر بيفتح بروفايل نفسه
    if (requestingUserId && requestingUserId !== targetUserId) {
      const followRecord = await prisma.follows.findUnique({
        where: {
          follower_id_followee_id: {
            follower_id: requestingUserId,
            followee_id: targetUserId as string,
          },
        },
      });
      is_following = !!followRecord;
    }

    // 5. Remove sensitive data for privacy
    const { password_hash, email, date_of_birth, ...publicData } = targetUser;

    // 6. Respond with data and follow status
    res.status(200).json({
      success: true,
      data: {
        ...publicData,
        is_following,
      },
    });
  } catch (error: any) {
    console.error("Get Public Profile Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch user profile." });
  }
};

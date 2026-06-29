import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

const DUMMY_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqO6Z5z1jFvJk9fJk9fJk9fJk9fJk9";

const generateTokens = (user: {
  id: string;
  username: string;
  role: string;
}) => {
  const payload = { sub: user.id, username: user.username, role: user.role };
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET || "fallback_access_secret",
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret",
    { expiresIn: "7d" },
  );
  return { accessToken, refreshToken };
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // At this point, validation has passed – all fields are valid and present
    const {
      username,
      email,
      password,
      date_of_birth,
      role = "athlete",
    } = req.body;

    // --- Business‑logic checks (uniqueness) ---
    const existingEmail = await prisma.users.findUnique({ where: { email } });
    if (existingEmail) {
      const error: any = new Error(
        "Unable to create account with the provided information.",
      );
      error.statusCode = 409;
      error.isOperational = true;
      throw error;
    }

    const existingUsername = await prisma.users.findUnique({
      where: { username },
    });
    if (existingUsername) {
      const error: any = new Error("Username already exists");
      error.statusCode = 409;
      error.isOperational = true;
      throw error;
    }

    // --- Password hashing ---
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // --- Transaction ---
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          username,
          email,
          password_hash,
          date_of_birth: new Date(date_of_birth),
          role,
        },
      });

      const { accessToken, refreshToken } = generateTokens(newUser);

      await tx.user_tokens.create({
        data: {
          user_id: newUser.id,
          token: refreshToken,
          token_type: "REFRESH",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
        },
        tokens: { accessToken, refreshToken },
      };
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  } catch (error) {
    next(error); // Forward to global error handler
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.users.findFirst({
      where: { email, is_active: true },
    });

    const DUMMY_HASH = "$2a$10$dummyHashDummyHashDummyHashDummyHashDummyHash";
    const passwordHashToCompare = user ? user.password_hash : DUMMY_HASH;

    const isMatch = await bcrypt.compare(password, passwordHashToCompare);

    if (!user || !isMatch) {
      res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user);

    const result = await prisma.$transaction(async (tx) => {
      await tx.user_tokens.deleteMany({
        where: { user_id: user.id, token_type: "REFRESH" },
      });

      await tx.user_tokens.create({
        data: {
          user_id: user.id,
          token: refreshToken,
          token_type: "REFRESH",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        tokens: { accessToken, refreshToken },
      };
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Works without the validation
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: "Refresh token is required in the body",
      });
      return;
    }

    const tokenRecord = await prisma.user_tokens.findUnique({
      where: { token: refreshToken },
    });
    if (
      !tokenRecord ||
      tokenRecord.token_type !== "REFRESH" ||
      tokenRecord.expires_at < new Date()
    ) {
      res
        .status(401)
        .json({ success: false, error: "Invalid or expired refresh token" });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret",
    ) as { sub: string };
    const user = await prisma.users.findUnique({
      where: { id: decoded.sub, is_active: true },
    });
    if (!user) {
      res
        .status(401)
        .json({ success: false, error: "User inactive or not found" });

      return;
    }

    const tokens = generateTokens(user);

    await prisma.$transaction([
      prisma.user_tokens.delete({
        where: { user_token_id: tokenRecord.user_token_id },
      }),
      prisma.user_tokens.create({
        data: {
          user_id: user.id,
          token: tokens.refreshToken,
          token_type: "REFRESH",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: { tokens },
    });
  } catch (error) {
    console.error("Refresh Error:", error);
    res
      .status(401)
      .json({ success: false, error: "Invalid or expired refresh token" });
  }
};

// logout  without the validation its works
export const logout = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    await prisma.user_tokens.deleteMany({
      where: { user_id: userId, token_type: "REFRESH" },
    });
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ success: false, error: "Failed to logout" });
  }
};

// // this logout is depending on the refresh token .............
// export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const userId = req.user?.sub;
//     if (!userId) {
//       res.status(401).json({ success: false, error: "Unauthorized" });
//       return;
//     }

//     const { refreshToken } = req.body;
//     if (!refreshToken) {
//       res.status(400).json({ success: false, error: "Refresh token is required in the body to logout" });
//       return;
//     }

//     const deleteResult = await prisma.user_tokens.deleteMany({
//       where: {
//         user_id: userId,
//         token: refreshToken,
//         token_type: "REFRESH",
//       },
//     });

//     if (deleteResult.count === 0) {
//       res.status(404).json({ success: false, error: "Token not found or already invalidated" });
//       return;
//     }

//     res.status(200).json({ success: true, message: "Logged out successfully" });
//     return;
//   } catch (error) {
//     console.error("Logout Error:", error);
//     res.status(500).json({ success: false, error: "Failed to logout" });
//     return;
//   }
// };

import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ConflictError, Unauthorized } from "../common/exceptions.js";
import { prisma } from "../lib/prisma.js";

type AuthPayload = {
  email: string;
  password: string;
};

export class AuthService {
  async register(input: AuthPayload) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true }
    });

    if (existingUser) {
      throw new ConflictError("User already exists", "https://api.ubereats.local/problems/user-already-exists");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        role: UserRole.USER
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    return user;
  }

  async login(input: AuthPayload) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true
      }
    });

    if (!user) {
      throw new Unauthorized("Invalid credentials", "https://api.ubereats.local/problems/invalid-credentials");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new Unauthorized("Invalid credentials", "https://api.ubereats.local/problems/invalid-credentials");
    }

    return user;
  }

  async setRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash }
    });
  }

  async rotateRefreshToken(refreshToken: string) {
    const users = await prisma.user.findMany({
      where: { refreshTokenHash: { not: null } },
      select: {
        id: true,
        email: true,
        role: true,
        refreshTokenHash: true
      }
    });

    for (const user of users) {
      if (!user.refreshTokenHash) {
        continue;
      }

      const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (match) {
        return {
          id: user.id,
          email: user.email,
          role: user.role
        };
      }
    }

    throw new Unauthorized("Invalid refresh token", "https://api.ubereats.local/problems/invalid-refresh-token");
  }

  async clearRefreshToken(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null }
    });
  }
}

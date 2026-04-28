import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BadRequest, ConflictError, NotFound } from "../common/exceptions.js";
import { prisma } from "../lib/prisma.js";

type UpdateUserInput = {
  email?: string;
  password?: string;
  name?: string;
};

export class UsersService {
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new NotFound("User not found", "https://api.ubereats.local/problems/user-not-found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async updateUser(userId: string, input: UpdateUserInput) {
    const hasEmail = input.email !== undefined && input.email !== "";
    const hasPassword = input.password !== undefined && input.password !== "";
    const hasName = input.name !== undefined && input.name.trim() !== "";

    if (!hasEmail && !hasPassword && !hasName) {
      throw new BadRequest("Nothing to update", "https://api.ubereats.local/problems/empty-update");
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          email: hasEmail ? input.email : undefined,
          password: input.password ? await bcrypt.hash(input.password, 10) : undefined,
          name: input.name !== undefined ? input.name.trim() || null : undefined
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name ?? undefined,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString()
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Email already in use", "https://api.ubereats.local/problems/user-already-exists");
      }
      throw error;
    }
  }

  async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId }
    });
  }
}

import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, Unauthorized } from "../../src/common/exceptions.js";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

import { AuthService } from "../../src/services/auth.service.js";

describe("AuthService", () => {
  const service = new AuthService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("register crée un utilisateur USER avec mot de passe hashé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      role: UserRole.USER
    });

    const result = await service.register({
      email: "test@example.com",
      password: "secret123"
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
      select: { id: true }
    });
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);

    const createArg = prismaMock.user.create.mock.calls[0]?.[0];
    expect(createArg.data.email).toBe("test@example.com");
    expect(createArg.data.role).toBe(UserRole.USER);
    expect(createArg.data.password).not.toBe("secret123");
    expect(await bcrypt.compare("secret123", createArg.data.password)).toBe(true);

    expect(result).toEqual({
      id: "u1",
      email: "test@example.com",
      role: UserRole.USER
    });
  });

  it("register rejette un email déjà existant", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      service.register({
        email: "dup@example.com",
        password: "secret123"
      })
    ).rejects.toBeInstanceOf(ConflictError);

    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("login retourne l'utilisateur si le mot de passe est valide", async () => {
    const hashedPassword = await bcrypt.hash("secret123", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u2",
      email: "login@example.com",
      password: hashedPassword,
      role: UserRole.ADMIN
    });

    const result = await service.login({
      email: "login@example.com",
      password: "secret123"
    });

    expect(result).toEqual({
      id: "u2",
      email: "login@example.com",
      password: hashedPassword,
      role: UserRole.ADMIN
    });
  });

  it("login rejette si le mot de passe est incorrect", async () => {
    const hashedPassword = await bcrypt.hash("secret123", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u3",
      email: "login@example.com",
      password: hashedPassword,
      role: UserRole.USER
    });

    await expect(
      service.login({
        email: "login@example.com",
        password: "wrong-password"
      })
    ).rejects.toBeInstanceOf(Unauthorized);
  });
});

import "dotenv/config";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Unauthorized } from "../../src/common/exceptions.js";

const authServiceMocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  setRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  AuthService: vi.fn().mockImplementation(() => authServiceMocks)
}));

import { buildApp } from "../../src/app.js";

describe("Auth routes integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /auth/register crée un utilisateur et retourne les tokens", async () => {
    authServiceMocks.register.mockResolvedValue({
      id: "user-register-1",
      email: "register@test.local",
      role: "USER"
    });
    authServiceMocks.setRefreshToken.mockResolvedValue(undefined);

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "register@test.local",
        password: "secret123"
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      user: { id: string; email: string; role: string; password?: string };
      accessToken: string;
      refreshToken: string;
    };

    expect(body.user.email).toBe("register@test.local");
    expect(body.user.role).toBe("USER");
    expect(body.user.password).toBeUndefined();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(authServiceMocks.register).toHaveBeenCalledWith({
      email: "register@test.local",
      password: "secret123"
    });
  });

  it("POST /auth/login retourne les tokens si les credentials sont valides", async () => {
    authServiceMocks.login.mockResolvedValue({
      id: "user-login-1",
      email: "login@test.local",
      role: "USER"
    });
    authServiceMocks.setRefreshToken.mockResolvedValue(undefined);

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "login@test.local",
        password: "secret123"
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { accessToken: string; refreshToken: string };
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
  });

  it("POST /auth/login rejette avec 401 si le mot de passe est invalide", async () => {
    authServiceMocks.login.mockRejectedValue(
      new Unauthorized("Invalid credentials", "https://api.ubereats.local/problems/invalid-credentials")
    );

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "bad-login@test.local",
        password: "wrongpass"
      }
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as { detail: string; type: string };
    expect(body.detail).toBe("Invalid credentials");
    expect(body.type).toContain("invalid-credentials");
  });

  it("GET /auth/me retourne l'utilisateur courant avec un bearer token valide", async () => {
    const accessToken = await app.jwt.sign({
      id: "user-me-1",
      email: "me@test.local",
      role: "USER",
      tokenType: "access"
    });
    const meRes = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = meRes.json() as { email: string; role: string };
    expect(meBody.email).toBe("me@test.local");
    expect(meBody.role).toBe("USER");
  });
});

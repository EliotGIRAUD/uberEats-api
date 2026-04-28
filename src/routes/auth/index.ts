import { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { AuthService } from "../../services/auth.service.js";
import {
  loginBodySchema,
  logoutResponseSchema,
  meResponseSchema,
  problemDetailsSchema,
  refreshBodySchema,
  registerBodySchema,
  registerResponseSchema,
  tokensResponseSchema
} from "../../schemas/auth.schema.js";

const authService = new AuthService();
const accessTokenExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "30m";
const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";

type AuthBody = {
  email: string;
  password: string;
};

type RefreshBody = {
  refreshToken: string;
};

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: AuthBody }>(
    "/register",
    {
      schema: {
        body: registerBodySchema,
        response: {
          201: registerResponseSchema,
          409: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      const user = await authService.register(request.body);
      const accessToken = await reply.jwtSign(
        { id: user.id, email: user.email, role: user.role, tokenType: "access" },
        { expiresIn: accessTokenExpiresIn }
      );
      const refreshToken = await reply.jwtSign(
        { id: user.id, email: user.email, role: user.role, tokenType: "refresh" },
        { expiresIn: refreshTokenExpiresIn }
      );

      await authService.setRefreshToken(user.id, refreshToken);

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken
      });
    }
  );

  fastify.post<{ Body: AuthBody }>(
    "/login",
    {
      schema: {
        body: loginBodySchema,
        response: {
          200: tokensResponseSchema,
          401: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      const user = await authService.login(request.body);
      const accessToken = await reply.jwtSign(
        { id: user.id, email: user.email, role: user.role, tokenType: "access" },
        { expiresIn: accessTokenExpiresIn }
      );
      const refreshToken = await reply.jwtSign(
        { id: user.id, email: user.email, role: user.role, tokenType: "refresh" },
        { expiresIn: refreshTokenExpiresIn }
      );

      await authService.setRefreshToken(user.id, refreshToken);

      return reply.send({ accessToken, refreshToken });
    }
  );

  fastify.post<{ Body: RefreshBody }>(
    "/refresh",
    {
      schema: {
        body: refreshBodySchema,
        response: {
          200: tokensResponseSchema,
          401: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      const user = await authService.rotateRefreshToken(request.body.refreshToken);

      const accessToken = await reply.jwtSign(
        { id: user.id, email: user.email, role: user.role, tokenType: "access" },
        { expiresIn: accessTokenExpiresIn }
      );
      const refreshToken = await reply.jwtSign(
        { id: user.id, email: user.email, role: user.role, tokenType: "refresh" },
        { expiresIn: refreshTokenExpiresIn }
      );

      await authService.setRefreshToken(user.id, refreshToken);

      return reply.send({ accessToken, refreshToken });
    }
  );

  fastify.post(
    "/logout",
    {
      preHandler: fastify.authorize(),
      schema: {
        response: {
          200: logoutResponseSchema,
          401: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      await authService.clearRefreshToken(request.authUser.id);
      return reply.send({ message: "Logged out" });
    }
  );

  fastify.get(
    "/me",
    {
      preHandler: fastify.authorize(),
      schema: {
        response: {
          200: meResponseSchema,
          401: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return request.authUser;
    }
  );

  fastify.get(
    "/admin/me",
    {
      preHandler: fastify.authorize([UserRole.ADMIN]),
      schema: {
        response: {
          200: meResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return request.authUser;
    }
  );
}

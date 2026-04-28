import { UserRole } from "@prisma/client";
import fastifyJwt from "@fastify/jwt";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Forbidden, HttpError, Unauthorized } from "../common/exceptions.js";

export async function jwtDecorator(fastify: FastifyInstance) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  await fastify.register(fastifyJwt, {
    secret: jwtSecret
  });

  fastify.decorate(
    "authorize",
    (roles: UserRole[] = []) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
          if (request.user.tokenType !== "access") {
            throw new Unauthorized("Invalid access token", "https://api.ubereats.local/problems/invalid-token");
          }
          request.authUser = request.user;
        } catch (error) {
          if (error instanceof HttpError) {
            throw error;
          }
          throw new Unauthorized("Authentication is required", "https://api.ubereats.local/problems/unauthorized");
        }

        if (roles.length > 0 && !roles.includes(request.authUser.role)) {
          throw new Forbidden("Insufficient role permissions");
        }
      }
  );
}

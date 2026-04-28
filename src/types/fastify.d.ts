import "@fastify/jwt";
import "fastify";
import { UserRole } from "@prisma/client";
import { FastifyReply, FastifyRequest } from "fastify";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
      role: UserRole;
      tokenType: "access" | "refresh";
    };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: {
      id: string;
      email: string;
      role: UserRole;
    };
  }

  interface FastifyInstance {
    authorize: (roles?: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

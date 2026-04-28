import type { UserRole } from "@prisma/client";
import type { FastifyRequest } from "fastify";

export type GraphQLViewer = {
  id: string;
  email: string;
  role: UserRole;
};

export type GraphQLContext = {
  viewer: GraphQLViewer | null;
};

export async function createGraphQLContext(request: FastifyRequest): Promise<GraphQLContext> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return { viewer: null };
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return { viewer: null };
  }

  try {
    const decoded = await request.server.jwt.verify<{
      id: string;
      email: string;
      role: UserRole;
      tokenType: "access" | "refresh";
    }>(token);

    if (decoded.tokenType !== "access") {
      return { viewer: null };
    }

    return {
      viewer: {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      }
    };
  } catch {
    return { viewer: null };
  }
}

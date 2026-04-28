import { UserRole } from "@prisma/client";
import { FastifyInstance } from "fastify";
import {
  deleteMeResponseSchema,
  problemDetailsSchema,
  updateMeBodySchema,
  userProfileResponseSchema
} from "../../schemas/users.schema.js";
import { UsersService } from "../../services/users.service.js";

const usersService = new UsersService();

type UpdateMeBody = {
  email?: string;
  password?: string;
  name?: string;
};

const profileRoles = [UserRole.USER, UserRole.RESTAURANT, UserRole.ADMIN] as const;

export async function usersMeRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      preHandler: fastify.authorize([...profileRoles]),
      schema: {
        tags: ["Users"],
        summary: "Get my profile",
        security: [{ bearerAuth: [] }],
        response: {
          200: userProfileResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return usersService.getMe(request.authUser.id);
    }
  );

  fastify.patch<{ Body: UpdateMeBody }>(
    "/",
    {
      preHandler: fastify.authorize([...profileRoles]),
      schema: {
        tags: ["Users"],
        summary: "Update my profile",
        security: [{ bearerAuth: [] }],
        body: updateMeBodySchema,
        response: {
          200: userProfileResponseSchema,
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          409: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return usersService.updateUser(request.authUser.id, request.body);
    }
  );

  fastify.delete(
    "/",
    {
      preHandler: fastify.authorize([UserRole.USER]),
      schema: {
        tags: ["Users"],
        summary: "Delete my user account",
        security: [{ bearerAuth: [] }],
        response: {
          200: deleteMeResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema
        }
      }
    },
    async (request) => {
      await usersService.deleteUser(request.authUser.id);
      return { message: "User deleted" };
    }
  );
}

import { UserRole } from "@prisma/client";
import { FastifyInstance } from "fastify";
import { Value } from "@sinclair/typebox/value";
import {
  createRestaurantBodySchema,
  createRestaurantOwnerBodySchema,
  createRestaurantRequestBodySchema,
  problemDetailsSchema,
  restaurantIdParamsSchema,
  restaurantListQuerySchema,
  restaurantResponseSchema,
  restaurantsPaginatedResponseSchema,
  updateRestaurantBodySchema
} from "../../schemas/restaurants.schema.js";
import { RestaurantsService } from "../../services/restaurants.service.js";
import { Forbidden, NotFound } from "../../common/exceptions.js";

const restaurantsService = new RestaurantsService();

type UpdateRestaurantBody = {
  name?: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
};

function isAdminCreateBody(body: unknown): body is {
  email: string;
  password: string;
  name: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
} {
  return Value.Check(createRestaurantBodySchema, body);
}

function isOwnerCreateBody(body: unknown): body is {
  name: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
} {
  return Value.Check(createRestaurantOwnerBodySchema, body);
}

export async function restaurantsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Restaurants"],
        summary: "List restaurants with filters",
        querystring: restaurantListQuerySchema,
        response: {
          200: restaurantsPaginatedResponseSchema
        }
      }
    },
    async (request) => {
      const q = request.query as {
        limit?: number;
        offset?: number;
        name?: string;
        city?: string;
        rating?: number;
      };
      return restaurantsService.findRestaurantsPaginated(q);
    }
  );

  fastify.post(
    "/",
    {
      preHandler: fastify.authorize([UserRole.ADMIN, UserRole.RESTAURANT]),
      schema: {
        tags: ["Restaurants"],
        summary: "Create restaurant",
        security: [{ bearerAuth: [] }],
        body: createRestaurantRequestBodySchema,
        response: {
          201: restaurantResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          409: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      const auth = request.authUser;
      const body = request.body;

      const looksAdmin =
        typeof body === "object" &&
        body !== null &&
        "email" in body &&
        typeof (body as { email?: string }).email === "string" &&
        (body as { email: string }).email.length > 0;

      if (looksAdmin) {
        if (auth.role !== UserRole.ADMIN) {
          throw new Forbidden("Only admins can create restaurant with new credentials");
        }
        if (!isAdminCreateBody(body)) {
          throw new Forbidden("Invalid admin create payload");
        }
        const restaurant = await restaurantsService.createRestaurant(body);
        return reply.status(201).send(restaurant);
      }

      if (auth.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Restaurant owners must use the minimal create payload without email");
      }
      if (!isOwnerCreateBody(body)) {
        throw new Forbidden("Invalid restaurant create payload");
      }
      const restaurant = await restaurantsService.createRestaurantForOwner(auth.id, body);
      return reply.status(201).send(restaurant);
    }
  );

  fastify.get(
    "/me",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        tags: ["Restaurants"],
        summary: "Get my restaurant",
        security: [{ bearerAuth: [] }],
        response: {
          200: restaurantResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return restaurantsService.getMyRestaurant(request.authUser.id);
    }
  );

  fastify.patch<{ Body: UpdateRestaurantBody }>(
    "/me",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        tags: ["Restaurants"],
        summary: "Update my restaurant",
        security: [{ bearerAuth: [] }],
        body: updateRestaurantBodySchema,
        response: {
          200: restaurantResponseSchema,
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return restaurantsService.updateRestaurant({
        userId: request.authUser.id,
        ...request.body
      });
    }
  );

  fastify.get<{ Params: { restaurantId: string } }>(
    "/:restaurantId",
    {
      schema: {
        tags: ["Restaurants"],
        summary: "Get restaurant by id",
        params: restaurantIdParamsSchema,
        response: {
          200: restaurantResponseSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      const r = await restaurantsService.getRestaurantByIdPublic(request.params.restaurantId);
      if (!r) {
        throw new NotFound("Restaurant not found", "https://api.ubereats.local/problems/restaurant-not-found");
      }
      return r;
    }
  );

  fastify.delete<{ Params: { restaurantId: string } }>(
    "/:restaurantId",
    {
      preHandler: fastify.authorize([UserRole.ADMIN, UserRole.RESTAURANT]),
      schema: {
        tags: ["Restaurants"],
        summary: "Delete a restaurant",
        security: [{ bearerAuth: [] }],
        params: restaurantIdParamsSchema,
        response: {
          204: { type: "null" },
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      await restaurantsService.deleteRestaurant(
        request.authUser.id,
        request.authUser.role,
        request.params.restaurantId
      );
      return reply.status(204).send();
    }
  );
}

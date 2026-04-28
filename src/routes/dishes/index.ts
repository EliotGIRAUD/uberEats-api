import { UserRole } from "@prisma/client";
import { FastifyInstance } from "fastify";
import {
  createDishBodySchema,
  dishIdParamsSchema,
  dishParamsByRestaurantSchema,
  dishResponseSchema,
  dishesListQuerySchema,
  dishesPaginatedResponseSchema,
  problemDetailsSchema,
  updateDishBodySchema
} from "../../schemas/dishes.schema.js";
import { DishesService } from "../../services/dishes.service.js";

const dishesService = new DishesService();

type RestaurantParams = {
  restaurantId: string;
};

type DishParams = {
  dishId: string;
};

type CreateDishBody = {
  name: string;
  description?: string;
  price: number;
  image?: string;
};

type UpdateDishBody = {
  name?: string;
  description?: string;
  price?: number;
  image?: string;
};

export async function restaurantDishesRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: RestaurantParams; Body: CreateDishBody }>(
    "/",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        params: dishParamsByRestaurantSchema,
        body: createDishBodySchema,
        response: {
          201: dishResponseSchema,
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      const dish = await dishesService.createDish(
        request.authUser.id,
        request.params.restaurantId,
        request.body
      );
      return reply.status(201).send(dish);
    }
  );

  fastify.get<{ Params: RestaurantParams }>(
    "/",
    {
      schema: {
        params: dishParamsByRestaurantSchema,
        querystring: dishesListQuerySchema,
        response: {
          200: dishesPaginatedResponseSchema
        }
      }
    },
    async (request) => {
      const q = request.query as {
        limit?: number;
        offset?: number;
        name?: string;
        minPrice?: number;
        maxPrice?: number;
      };
      return dishesService.findDishesByRestaurantPaginated(request.params.restaurantId, q);
    }
  );
}

export async function dishesRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: DishParams }>(
    "/:dishId",
    {
      schema: {
        params: dishIdParamsSchema,
        response: {
          200: dishResponseSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return dishesService.getDishById(request.params.dishId);
    }
  );

  fastify.patch<{ Params: DishParams; Body: UpdateDishBody }>(
    "/:dishId",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        params: dishIdParamsSchema,
        body: updateDishBodySchema,
        response: {
          200: dishResponseSchema,
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return dishesService.updateDish(request.authUser.id, request.params.dishId, request.body);
    }
  );

  fastify.delete<{ Params: DishParams }>(
    "/:dishId",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        params: dishIdParamsSchema,
        response: {
          204: { type: "null" },
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      await dishesService.deleteDish(request.authUser.id, request.params.dishId);
      return reply.status(204).send();
    }
  );
}

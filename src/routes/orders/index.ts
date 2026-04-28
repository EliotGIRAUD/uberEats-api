import { OrderStatus, UserRole } from "@prisma/client";
import { FastifyInstance } from "fastify";
import {
  createOrderBodySchema,
  orderIdParamsSchema,
  orderResponseSchema,
  ordersListQuerySchema,
  ordersPaginatedResponseSchema,
  problemDetailsSchema,
  statusUpdateBodySchema
} from "../../schemas/orders.schema.js";
import { OrdersService } from "../../services/orders.service.js";

const ordersService = new OrdersService();

type CreateOrderBody = {
  restaurantId: string;
  items: Array<{ dishId: string; quantity: number }>;
};

type StatusUpdateBody = {
  status: OrderStatus;
};

type OrderParams = {
  orderId: string;
};

export async function ordersRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateOrderBody }>(
    "/",
    {
      preHandler: fastify.authorize([UserRole.USER]),
      schema: {
        tags: ["Orders"],
        summary: "Create order",
        security: [{ bearerAuth: [] }],
        body: createOrderBodySchema,
        response: {
          201: orderResponseSchema,
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      const order = await ordersService.createOrder(request.authUser.id, request.body);
      return reply.status(201).send(order);
    }
  );

  fastify.get<{ Params: OrderParams }>(
    "/:orderId",
    {
      preHandler: fastify.authorize(),
      schema: {
        tags: ["Orders"],
        summary: "Get order by id",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        response: {
          200: orderResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return ordersService.getOrderById(request.params.orderId, request.authUser.id, request.authUser.role);
    }
  );

  fastify.patch<{ Params: OrderParams; Body: StatusUpdateBody }>(
    "/:orderId/status",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        tags: ["Orders"],
        summary: "Update order status",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        body: statusUpdateBodySchema,
        response: {
          200: orderResponseSchema,
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request) => {
      return ordersService.updateOrderStatus(request.authUser.id, request.params.orderId, request.body);
    }
  );

  fastify.delete<{ Params: OrderParams }>(
    "/:orderId",
    {
      preHandler: fastify.authorize([UserRole.USER]),
      schema: {
        tags: ["Orders"],
        summary: "Cancel order",
        security: [{ bearerAuth: [] }],
        params: orderIdParamsSchema,
        response: {
          204: { type: "null" },
          400: problemDetailsSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema,
          409: problemDetailsSchema,
          404: problemDetailsSchema
        }
      }
    },
    async (request, reply) => {
      await ordersService.cancelOrder(request.authUser.id, request.params.orderId);
      return reply.status(204).send();
    }
  );
}

export async function userOrdersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/me/orders",
    {
      preHandler: fastify.authorize([UserRole.USER]),
      schema: {
        tags: ["Orders"],
        summary: "List my customer orders",
        security: [{ bearerAuth: [] }],
        querystring: ordersListQuerySchema,
        response: {
          200: ordersPaginatedResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema
        }
      }
    },
    async (request) => {
      const q = request.query as {
        limit?: number;
        offset?: number;
        status?: OrderStatus;
        from?: string;
        to?: string;
      };
      return ordersService.getUserOrdersPaginated(request.authUser.id, q);
    }
  );
}

export async function restaurantOrdersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/me/orders",
    {
      preHandler: fastify.authorize([UserRole.RESTAURANT]),
      schema: {
        tags: ["Orders"],
        summary: "List my restaurant orders",
        security: [{ bearerAuth: [] }],
        querystring: ordersListQuerySchema,
        response: {
          200: ordersPaginatedResponseSchema,
          401: problemDetailsSchema,
          403: problemDetailsSchema
        }
      }
    },
    async (request) => {
      const q = request.query as {
        limit?: number;
        offset?: number;
        status?: OrderStatus;
        from?: string;
        to?: string;
      };
      return ordersService.getRestaurantOrdersPaginated(request.authUser.id, q);
    }
  );
}

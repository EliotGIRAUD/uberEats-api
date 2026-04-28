import { OrderStatus, Prisma, UserRole } from "@prisma/client";
import { BadRequest, ConflictError, Forbidden, NotFound } from "../common/exceptions.js";
import { prisma } from "../lib/prisma.js";
import { parsePaginationQuery, paginationMeta } from "../schemas/pagination.schema.js";
import { notifyRestaurant } from "./websocket.service.js";

type CreateOrderInput = {
  restaurantId: string;
  items: Array<{
    dishId: string;
    quantity: number;
  }>;
};

type UpdateStatusInput = {
  status: OrderStatus;
};

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED],
  CONFIRMED: [OrderStatus.PREPARING],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: []
};

export class OrdersService {
  private applyDateRangeFilter(where: Prisma.OrderWhereInput, from?: string, to?: string) {
    if (from === undefined && to === undefined) {
      return;
    }

    const createdAt: Prisma.DateTimeFilter = {};
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from !== undefined) {
      fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequest("Invalid 'from' date-time", "https://api.ubereats.local/problems/invalid-date-range");
      }
      createdAt.gte = fromDate;
    }

    if (to !== undefined) {
      toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequest("Invalid 'to' date-time", "https://api.ubereats.local/problems/invalid-date-range");
      }
      createdAt.lte = toDate;
    }

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequest("'from' must be before or equal to 'to'", "https://api.ubereats.local/problems/invalid-date-range");
    }

    where.createdAt = createdAt;
  }

  async createOrder(customerId: string, input: CreateOrderInput) {
    if (input.items.length === 0) {
      throw new BadRequest("Order must contain at least one item", "https://api.ubereats.local/problems/invalid-order-items");
    }

    const dishIds = [...new Set(input.items.map((item) => item.dishId))];
    const dishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      select: { id: true, restaurantId: true, price: true }
    });

    if (dishes.length !== dishIds.length) {
      throw new NotFound("One or more dishes were not found", "https://api.ubereats.local/problems/dish-not-found");
    }

    const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
    const allFromRestaurant = dishes.every((dish) => dish.restaurantId === input.restaurantId);
    if (!allFromRestaurant) {
      throw new BadRequest(
        "All dishes must belong to the same restaurant",
        "https://api.ubereats.local/problems/invalid-restaurant-dishes"
      );
    }

    const total = input.items.reduce((sum, item) => {
      const dish = dishMap.get(item.dishId)!;
      return sum + Number(dish.price) * item.quantity;
    }, 0);

    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId,
          restaurantId: input.restaurantId,
          status: OrderStatus.PENDING,
          totalPrice: new Prisma.Decimal(total)
        }
      });

      await tx.orderItem.createMany({
        data: input.items.map((item) => {
          const dish = dishMap.get(item.dishId)!;
          return {
            orderId: order.id,
            dishId: item.dishId,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(dish.price)
          };
        })
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true }
      });
    });

    const serialized = this.serializeOrder(createdOrder);
    const itemCount = input.items.reduce((sum, item) => sum + item.quantity, 0);
    notifyRestaurant(input.restaurantId, "new-order", {
      orderId: serialized.id,
      totalPrice: serialized.totalPrice,
      itemCount,
      createdAt: serialized.createdAt
    });

    return serialized;
  }

  async getOrderById(orderId: string, userId: string, role: UserRole) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        restaurant: { select: { ownerId: true } }
      }
    });

    if (!order) {
      throw new NotFound("Order not found", "https://api.ubereats.local/problems/order-not-found");
    }

    if (role === UserRole.USER && order.customerId !== userId) {
      throw new Forbidden("You cannot access this order");
    }

    if (role === UserRole.RESTAURANT && order.restaurant.ownerId !== userId) {
      throw new Forbidden("You cannot access this order");
    }

    return this.serializeOrder(order);
  }

  async getUserOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { customerId: userId },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async getRestaurantOrders(ownerUserId: string) {
    const orders = await prisma.order.findMany({
      where: {
        restaurant: { ownerId: ownerUserId }
      },
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async getUserOrdersPaginated(
    userId: string,
    params: { limit?: number; offset?: number; status?: OrderStatus; from?: string; to?: string }
  ) {
    const { limit, offset } = parsePaginationQuery(params);
    const where: Prisma.OrderWhereInput = { customerId: userId };
    if (params.status !== undefined) {
      where.status = params.status;
    }
    this.applyDateRangeFilter(where, params.from, params.to);
    const [rows, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where })
    ]);
    return {
      data: rows.map((o) => this.serializeOrder(o)),
      pagination: paginationMeta(total, limit, offset)
    };
  }

  async getRestaurantOrdersPaginated(
    ownerUserId: string,
    params: { limit?: number; offset?: number; status?: OrderStatus; from?: string; to?: string }
  ) {
    const { limit, offset } = parsePaginationQuery(params);
    const where: Prisma.OrderWhereInput = {
      restaurant: { ownerId: ownerUserId }
    };
    if (params.status !== undefined) {
      where.status = params.status;
    }
    this.applyDateRangeFilter(where, params.from, params.to);
    const [rows, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where })
    ]);
    return {
      data: rows.map((o) => this.serializeOrder(o)),
      pagination: paginationMeta(total, limit, offset)
    };
  }

  /**
   * GraphQL (query racine orders) : pagination selon le viewer.
   */
  async listOrdersRootGraphql(
    viewer: { id: string; role: UserRole } | null,
    params: {
      limit?: number;
      offset?: number;
      status?: OrderStatus;
      restaurantId?: string | null;
    }
  ) {
    const { limit, offset } = parsePaginationQuery(params);
    if (!viewer) {
      return { data: [], pagination: paginationMeta(0, limit, offset) };
    }

    let where: Prisma.OrderWhereInput = {};
    if (viewer.role === UserRole.USER) {
      where.customerId = viewer.id;
    } else if (viewer.role === UserRole.RESTAURANT) {
      const resto = await prisma.restaurant.findFirst({
        where: { ownerId: viewer.id },
        select: { id: true }
      });
      if (!resto) {
        return { data: [], pagination: paginationMeta(0, limit, offset) };
      }
      where.restaurantId = resto.id;
    } else if (viewer.role === UserRole.ADMIN) {
      if (params.restaurantId) {
        where.restaurantId = params.restaurantId;
      }
    }

    if (params.status !== undefined) {
      where.status = params.status;
    }

    const [rows, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where })
    ]);

    return {
      data: rows.map((o) => this.serializeOrderForGraphql(o)),
      pagination: paginationMeta(total, limit, offset)
    };
  }

  /**
   * GraphQL : commandes visibles pour ce restaurant selon le JWT (optionnel).
   * Sans auth → []. Admin ou propriétaire du restaurant → toutes les commandes.
   * Client (USER ou autre resto) → uniquement ses commandes passées à ce restaurant.
   */
  async listOrdersForRestaurantGraphql(
    restaurantId: string,
    restaurantOwnerId: string,
    viewer: { id: string; role: UserRole } | null
  ) {
    if (!viewer) {
      return [];
    }

    let where: Prisma.OrderWhereInput;
    if (viewer.role === UserRole.ADMIN) {
      where = { restaurantId };
    } else if (viewer.role === UserRole.RESTAURANT && viewer.id === restaurantOwnerId) {
      where = { restaurantId };
    } else {
      where = { restaurantId, customerId: viewer.id };
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" }
    });

    return orders.map((order) => this.serializeOrderForGraphql(order));
  }

  async updateOrderStatus(ownerUserId: string, orderId: string, input: UpdateStatusInput) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { ownerId: true } }, items: true }
    });

    if (!order) {
      throw new NotFound("Order not found", "https://api.ubereats.local/problems/order-not-found");
    }

    if (order.restaurant.ownerId !== ownerUserId) {
      throw new Forbidden("You cannot update this order");
    }

    if (!allowedTransitions[order.status].includes(input.status)) {
      throw new BadRequest(
        `Cannot change status from ${order.status} to ${input.status}`,
        "https://api.ubereats.local/problems/invalid-status-transition"
      );
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: input.status },
      include: { items: true }
    });

    return this.serializeOrder(updated);
  }

  async cancelOrder(customerId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new NotFound("Order not found", "https://api.ubereats.local/problems/order-not-found");
    }

    if (order.customerId !== customerId) {
      throw new Forbidden("You cannot cancel this order");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictError("Only pending orders can be cancelled", "https://api.ubereats.local/problems/cannot-cancel-order");
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED }
    });
  }

  private serializeOrder(order: {
    id: string;
    status: OrderStatus;
    totalPrice: Prisma.Decimal;
    customerId: string;
    restaurantId: string;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      dishId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }>;
  }) {
    return {
      id: order.id,
      status: order.status,
      totalPrice: Number(order.totalPrice),
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      items: order.items.map((item) => ({
        id: item.id,
        dishId: item.dishId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice)
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    };
  }

  serializeOrderForGraphql(
    order: {
      id: string;
      status: OrderStatus;
      totalPrice: Prisma.Decimal;
      customerId: string;
      restaurantId: string;
      createdAt: Date;
      updatedAt: Date;
      items: Array<{
        id: string;
        orderId: string;
        dishId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }
  ) {
    return {
      id: order.id,
      status: order.status,
      totalPrice: Number(order.totalPrice),
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        dishId: item.dishId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    };
  }
}

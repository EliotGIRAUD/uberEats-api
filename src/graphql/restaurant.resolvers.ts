import { OrderStatus, UserRole, type Restaurant as RestaurantRow } from "@prisma/client";
import type { IResolvers, MercuriusContext } from "mercurius";
import { Forbidden, Unauthorized } from "../common/exceptions.js";
import { DishesService } from "../services/dishes.service.js";
import { OrdersService } from "../services/orders.service.js";
import { RestaurantsService } from "../services/restaurants.service.js";

const restaurantsService = new RestaurantsService();
const dishesService = new DishesService();
const ordersService = new OrdersService();

export const restaurantResolvers: IResolvers<any, MercuriusContext> = {
  Query: {
    restaurants: async (
      _root,
      args: {
        limit?: number | null;
        offset?: number | null;
        name?: string | null;
        city?: string | null;
        rating?: number | null;
      }
    ) =>
      restaurantsService.findRestaurantsPaginatedForGraphql({
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
        name: args.name ?? undefined,
        city: args.city ?? undefined,
        rating: args.rating ?? undefined
      }),
    restaurant: async (_root, args: { id: string }) => restaurantsService.getRestaurantById(args.id),
    dishes: async (
      _root,
      args: {
        restaurantId: string;
        limit?: number | null;
        offset?: number | null;
        nameContains?: string | null;
        minPrice?: number | null;
        maxPrice?: number | null;
      }
    ) =>
      dishesService.findDishesByRestaurantPaginated(args.restaurantId, {
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
        name: args.nameContains ?? undefined,
        minPrice: args.minPrice ?? undefined,
        maxPrice: args.maxPrice ?? undefined
      }),
    orders: async (
      _root,
      args: {
        limit?: number | null;
        offset?: number | null;
        status?: OrderStatus | null;
        restaurantId?: string | null;
      },
      ctx
    ) =>
      ordersService.listOrdersRootGraphql(ctx.viewer, {
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
        status: args.status ?? undefined,
        restaurantId: args.restaurantId ?? undefined
      }),
    me: (_root, _args, ctx) => ctx.viewer
  },
  Mutation: {
    createMyRestaurant: async (
      _root,
      args: {
        input: {
          name: string;
          image?: string;
          address?: string;
          postalCode?: string;
          city?: string;
          rating?: number;
        };
      },
      ctx
    ) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Only RESTAURANT role can create a restaurant");
      }
      return restaurantsService.createRestaurantForOwner(ctx.viewer.id, args.input);
    },
    updateMyRestaurant: async (
      _root,
      args: {
        input: {
          name?: string;
          image?: string;
          address?: string;
          postalCode?: string;
          city?: string;
          rating?: number;
        };
      },
      ctx
    ) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Only RESTAURANT role can update a restaurant");
      }
      return restaurantsService.updateRestaurant({ userId: ctx.viewer.id, ...args.input });
    },
    createDish: async (
      _root,
      args: {
        restaurantId: string;
        input: {
          name: string;
          description?: string;
          price: number;
          image?: string;
        };
      },
      ctx
    ) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Only RESTAURANT role can create dishes");
      }
      return dishesService.createDish(ctx.viewer.id, args.restaurantId, args.input);
    },
    updateDish: async (
      _root,
      args: {
        dishId: string;
        input: {
          name?: string;
          description?: string;
          price?: number;
          image?: string;
        };
      },
      ctx
    ) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Only RESTAURANT role can update dishes");
      }
      return dishesService.updateDish(ctx.viewer.id, args.dishId, args.input);
    },
    deleteDish: async (_root, args: { dishId: string }, ctx) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Only RESTAURANT role can delete dishes");
      }
      await dishesService.deleteDish(ctx.viewer.id, args.dishId);
      return true;
    },
    createOrder: async (
      _root,
      args: {
        input: {
          restaurantId: string;
          items: Array<{ dishId: string; quantity: number }>;
        };
      },
      ctx
    ) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.USER) {
        throw new Forbidden("Only USER role can create orders");
      }
      return ordersService.createOrder(ctx.viewer.id, args.input);
    },
    updateOrderStatus: async (_root, args: { orderId: string; status: OrderStatus }, ctx) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.RESTAURANT) {
        throw new Forbidden("Only RESTAURANT role can update order status");
      }
      return ordersService.updateOrderStatus(ctx.viewer.id, args.orderId, { status: args.status });
    },
    cancelOrder: async (_root, args: { orderId: string }, ctx) => {
      if (!ctx.viewer) {
        throw new Unauthorized("Authentication required");
      }
      if (ctx.viewer.role !== UserRole.USER) {
        throw new Forbidden("Only USER role can cancel orders");
      }
      await ordersService.cancelOrder(ctx.viewer.id, args.orderId);
      return true;
    }
  },
  Restaurant: {
    createdAt: (parent: RestaurantRow) => parent.createdAt.toISOString(),
    updatedAt: (parent: RestaurantRow) => parent.updatedAt.toISOString(),
    dishes: async (parent: RestaurantRow) => dishesService.getDishesByRestaurant(parent.id),
    orders: async (parent: RestaurantRow, _args, ctx) =>
      ordersService.listOrdersForRestaurantGraphql(parent.id, parent.ownerId, ctx.viewer)
  },
  Dish: {
    createdAt: (parent: { createdAt: Date | string }) =>
      typeof parent.createdAt === "string" ? parent.createdAt : parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date | string }) =>
      typeof parent.updatedAt === "string" ? parent.updatedAt : parent.updatedAt.toISOString()
  },
  OrderItem: {
    dish: async (parent: { dishId: string }) => dishesService.getDishById(parent.dishId)
  }
};

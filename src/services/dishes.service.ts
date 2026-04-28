import { Prisma } from "@prisma/client";
import { BadRequest, Forbidden, NotFound } from "../common/exceptions.js";
import { prisma } from "../lib/prisma.js";
import { parsePaginationQuery, paginationMeta } from "../schemas/pagination.schema.js";

type CreateDishInput = {
  name: string;
  description?: string;
  price: number;
  image?: string;
};

type UpdateDishInput = {
  name?: string;
  description?: string;
  price?: number;
  image?: string;
};

export class DishesService {
  async createDish(ownerUserId: string, restaurantId: string, input: CreateDishInput) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, ownerId: true }
    });

    if (!restaurant) {
      throw new NotFound("Restaurant not found", "https://api.ubereats.local/problems/restaurant-not-found");
    }

    if (restaurant.ownerId !== ownerUserId) {
      throw new Forbidden("You cannot create dishes for this restaurant");
    }

    const dish = await prisma.dish.create({
      data: {
        name: input.name,
        description: input.description,
        price: new Prisma.Decimal(input.price),
        image: input.image,
        restaurantId
      }
    });

    return this.serializeDish(dish);
  }

  async getDishesByRestaurant(restaurantId: string) {
    const dishes = await prisma.dish.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" }
    });

    return dishes.map((dish) => this.serializeDish(dish));
  }

  async findDishesByRestaurantPaginated(
    restaurantId: string,
    params: {
      limit?: number;
      offset?: number;
      name?: string;
      minPrice?: number;
      maxPrice?: number;
    }
  ) {
    const { limit, offset } = parsePaginationQuery(params);
    const where: Prisma.DishWhereInput = { restaurantId };

    if (params.name?.trim()) {
      where.name = { contains: params.name.trim() };
    }
    const priceCond: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } = {};
    if (params.minPrice !== undefined) {
      priceCond.gte = new Prisma.Decimal(params.minPrice);
    }
    if (params.maxPrice !== undefined) {
      priceCond.lte = new Prisma.Decimal(params.maxPrice);
    }
    if (priceCond.gte !== undefined || priceCond.lte !== undefined) {
      where.price = priceCond;
    }

    const [rows, total] = await prisma.$transaction([
      prisma.dish.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.dish.count({ where })
    ]);

    return {
      data: rows.map((d) => this.serializeDish(d)),
      pagination: paginationMeta(total, limit, offset)
    };
  }

  async getDishById(dishId: string) {
    const dish = await prisma.dish.findUnique({
      where: { id: dishId }
    });

    if (!dish) {
      throw new NotFound("Dish not found", "https://api.ubereats.local/problems/dish-not-found");
    }

    return this.serializeDish(dish);
  }

  async updateDish(ownerUserId: string, dishId: string, input: UpdateDishInput) {
    if (Object.keys(input).length === 0) {
      throw new BadRequest("Nothing to update", "https://api.ubereats.local/problems/empty-update");
    }

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: { restaurant: { select: { ownerId: true } } }
    });

    if (!dish) {
      throw new NotFound("Dish not found", "https://api.ubereats.local/problems/dish-not-found");
    }

    if (dish.restaurant.ownerId !== ownerUserId) {
      throw new Forbidden("You cannot update this dish");
    }

    const updatedDish = await prisma.dish.update({
      where: { id: dishId },
      data: {
        name: input.name,
        description: input.description,
        price: input.price !== undefined ? new Prisma.Decimal(input.price) : undefined,
        image: input.image
      }
    });

    return this.serializeDish(updatedDish);
  }

  async deleteDish(ownerUserId: string, dishId: string) {
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: { restaurant: { select: { ownerId: true } } }
    });

    if (!dish) {
      throw new NotFound("Dish not found", "https://api.ubereats.local/problems/dish-not-found");
    }

    if (dish.restaurant.ownerId !== ownerUserId) {
      throw new Forbidden("You cannot delete this dish");
    }

    await prisma.dish.delete({
      where: { id: dishId }
    });
  }

  private serializeDish(dish: {
    id: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    image: string | null;
    restaurantId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: dish.id,
      name: dish.name,
      description: dish.description ?? undefined,
      price: Number(dish.price),
      image: dish.image ?? undefined,
      restaurantId: dish.restaurantId,
      createdAt: dish.createdAt.toISOString(),
      updatedAt: dish.updatedAt.toISOString()
    };
  }
}

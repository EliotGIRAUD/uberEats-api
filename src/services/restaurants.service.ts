import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BadRequest, ConflictError, Forbidden, NotFound } from "../common/exceptions.js";
import { prisma } from "../lib/prisma.js";
import { parsePaginationQuery, paginationMeta } from "../schemas/pagination.schema.js";

type CreateRestaurantInput = {
  email: string;
  password: string;
  name: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
};

type CreateRestaurantForOwnerInput = {
  name: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
};

type UpdateRestaurantInput = {
  userId: string;
  name?: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
};

export type SerializedRestaurant = {
  id: string;
  name: string;
  image?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  rating?: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

function serializeRestaurant(
  r: {
    id: string;
    name: string;
    image: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    rating: number | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }
): SerializedRestaurant {
  return {
    id: r.id,
    name: r.name,
    image: r.image ?? undefined,
    address: r.address ?? undefined,
    postalCode: r.postalCode ?? undefined,
    city: r.city ?? undefined,
    rating: r.rating ?? undefined,
    ownerId: r.ownerId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  };
}

export class RestaurantsService {
  async createRestaurant(input: CreateRestaurantInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existingUser) {
      throw new ConflictError("User already exists", "https://api.ubereats.local/problems/user-already-exists");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const restaurant = await prisma.restaurant.create({
      data: {
        name: input.name,
        image: input.image,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        rating: input.rating,
        owner: {
          create: {
            email: input.email,
            password: hashedPassword,
            role: UserRole.RESTAURANT
          }
        }
      }
    });

    return serializeRestaurant(restaurant);
  }

  /**
   * Compte RESTAURANT : attache un restaurant au user courant (un seul autorisé).
   */
  async createRestaurantForOwner(userId: string, input: CreateRestaurantForOwnerInput) {
    const existing = await prisma.restaurant.findFirst({
      where: { ownerId: userId },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictError(
        "Restaurant already exists for this account",
        "https://api.ubereats.local/problems/restaurant-already-exists"
      );
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name: input.name,
        image: input.image,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        rating: input.rating,
        ownerId: userId
      }
    });

    return serializeRestaurant(restaurant);
  }

  async findRestaurantsPaginated(params: {
    limit?: number;
    offset?: number;
    name?: string;
    city?: string;
    rating?: number;
  }) {
    const { limit, offset } = parsePaginationQuery(params);
    const where: Prisma.RestaurantWhereInput = {};
    if (params.name?.trim()) {
      where.name = { contains: params.name.trim() };
    }
    if (params.city?.trim()) {
      where.city = { contains: params.city.trim() };
    }
    if (params.rating !== undefined) {
      where.rating = params.rating;
    }

    const [rows, total] = await prisma.$transaction([
      prisma.restaurant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.restaurant.count({ where })
    ]);

    return {
      data: rows.map(serializeRestaurant),
      pagination: paginationMeta(total, limit, offset)
    };
  }

  /** GraphQL / usages internes : liste complète (sans pagination). */
  async getAllRestaurants() {
    const rows = await prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" }
    });
    return rows;
  }

  /** GraphQL : lignes Prisma + meta (dates brutes pour les field resolvers). */
  async findRestaurantsPaginatedForGraphql(params: {
    limit?: number;
    offset?: number;
    name?: string | null;
    city?: string | null;
    rating?: number | null;
  }) {
    const { limit, offset } = parsePaginationQuery(params);
    const where: Prisma.RestaurantWhereInput = {};
    if (params.name?.trim()) {
      where.name = { contains: params.name.trim() };
    }
    if (params.city?.trim()) {
      where.city = { contains: params.city.trim() };
    }
    if (params.rating !== undefined && params.rating !== null) {
      where.rating = params.rating;
    }

    const [rows, total] = await prisma.$transaction([
      prisma.restaurant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset
      }),
      prisma.restaurant.count({ where })
    ]);

    return {
      data: rows,
      pagination: paginationMeta(total, limit, offset)
    };
  }

  async getRestaurantById(id: string) {
    return prisma.restaurant.findUnique({ where: { id } });
  }

  async getRestaurantByIdPublic(id: string): Promise<SerializedRestaurant | null> {
    const r = await prisma.restaurant.findUnique({ where: { id } });
    if (!r) return null;
    return serializeRestaurant(r);
  }

  async getMyRestaurant(userId: string) {
    const restaurant = await prisma.restaurant.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" }
    });

    if (!restaurant) {
      throw new NotFound("Restaurant not found", "https://api.ubereats.local/problems/restaurant-not-found");
    }

    return serializeRestaurant(restaurant);
  }

  async updateRestaurant(input: UpdateRestaurantInput) {
    const hasPatch =
      input.name !== undefined ||
      input.image !== undefined ||
      input.address !== undefined ||
      input.postalCode !== undefined ||
      input.city !== undefined ||
      input.rating !== undefined;
    if (!hasPatch) {
      throw new BadRequest("Nothing to update", "https://api.ubereats.local/problems/empty-update");
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: { ownerId: input.userId },
      orderBy: { createdAt: "asc" }
    });

    if (!restaurant) {
      throw new NotFound("Restaurant not found", "https://api.ubereats.local/problems/restaurant-not-found");
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        name: input.name,
        image: input.image,
        address: input.address,
        postalCode: input.postalCode,
        city: input.city,
        rating: input.rating
      }
    });

    return serializeRestaurant(updated);
  }

  async deleteRestaurant(actorUserId: string, actorRole: UserRole, restaurantId: string) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, ownerId: true }
    });

    if (!restaurant) {
      throw new NotFound("Restaurant not found", "https://api.ubereats.local/problems/restaurant-not-found");
    }

    if (actorRole === UserRole.ADMIN) {
      await prisma.restaurant.delete({ where: { id: restaurantId } });
      return;
    }

    if (actorRole === UserRole.RESTAURANT && restaurant.ownerId === actorUserId) {
      await prisma.restaurant.delete({ where: { id: restaurantId } });
      return;
    }

    throw new Forbidden("You cannot delete this restaurant", "https://api.ubereats.local/problems/forbidden-delete-restaurant");
  }
}

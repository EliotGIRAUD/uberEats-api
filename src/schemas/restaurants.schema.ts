import { Type } from "@sinclair/typebox";
import { problemDetailsSchema } from "./auth.schema.js";
import { paginationMetaSchema, paginationQuerySchema, paginatedDataSchema } from "./pagination.schema.js";

export const createRestaurantBodySchema = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 6 }),
    name: Type.String({ minLength: 1 }),
    image: Type.Optional(Type.String({ minLength: 1 })),
    address: Type.Optional(Type.String({ minLength: 1 })),
    postalCode: Type.Optional(Type.String({ minLength: 1 })),
    city: Type.Optional(Type.String({ minLength: 1 })),
    rating: Type.Optional(Type.Number({ minimum: 0, maximum: 5 }))
  },
  { additionalProperties: false }
);

/** Création par un compte RESTAURANT déjà existant (sans nouveau login). */
export const createRestaurantOwnerBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    image: Type.Optional(Type.String({ minLength: 1 })),
    address: Type.Optional(Type.String({ minLength: 1 })),
    postalCode: Type.Optional(Type.String({ minLength: 1 })),
    city: Type.Optional(Type.String({ minLength: 1 })),
    rating: Type.Optional(Type.Number({ minimum: 0, maximum: 5 }))
  },
  { additionalProperties: false }
);

export const createRestaurantRequestBodySchema = Type.Union([createRestaurantBodySchema, createRestaurantOwnerBodySchema]);

export const restaurantListQuerySchema = Type.Intersect([
  paginationQuerySchema,
  Type.Object({
    name: Type.Optional(Type.String({ minLength: 1 })),
    city: Type.Optional(Type.String({ minLength: 1 })),
    rating: Type.Optional(Type.Number({ minimum: 0, maximum: 5 }))
  })
]);

export const updateRestaurantBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    image: Type.Optional(Type.String({ minLength: 1 })),
    address: Type.Optional(Type.String({ minLength: 1 })),
    postalCode: Type.Optional(Type.String({ minLength: 1 })),
    city: Type.Optional(Type.String({ minLength: 1 })),
    rating: Type.Optional(Type.Number({ minimum: 0, maximum: 5 }))
  },
  { additionalProperties: false }
);

export const restaurantResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  image: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
  postalCode: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  rating: Type.Optional(Type.Number()),
  ownerId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const restaurantsResponseSchema = Type.Array(restaurantResponseSchema);

export const restaurantsPaginatedResponseSchema = paginatedDataSchema(restaurantResponseSchema);

export const restaurantIdParamsSchema = Type.Object({
  restaurantId: Type.String({ minLength: 1 })
});

export { problemDetailsSchema, paginationMetaSchema, paginationQuerySchema };

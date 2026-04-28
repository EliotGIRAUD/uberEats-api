import { Type } from "@sinclair/typebox";
import { problemDetailsSchema } from "./auth.schema.js";
import { paginatedDataSchema, paginationQuerySchema } from "./pagination.schema.js";

export const dishParamsByRestaurantSchema = Type.Object({
  restaurantId: Type.String({ minLength: 1 })
});

export const dishIdParamsSchema = Type.Object({
  dishId: Type.String({ minLength: 1 })
});

export const createDishBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String({ minLength: 1 })),
    price: Type.Number({ exclusiveMinimum: 0 }),
    image: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);

export const updateDishBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String({ minLength: 1 })),
    price: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    image: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);

export const dishResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  price: Type.Number(),
  image: Type.Optional(Type.String()),
  restaurantId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const dishesResponseSchema = Type.Array(dishResponseSchema);

export const dishesListQuerySchema = Type.Intersect([
  paginationQuerySchema,
  Type.Object({
    name: Type.Optional(Type.String({ minLength: 1 })),
    minPrice: Type.Optional(Type.Number({ minimum: 0 })),
    maxPrice: Type.Optional(Type.Number({ minimum: 0 }))
  })
]);

export const dishesPaginatedResponseSchema = paginatedDataSchema(dishResponseSchema);

export { problemDetailsSchema };

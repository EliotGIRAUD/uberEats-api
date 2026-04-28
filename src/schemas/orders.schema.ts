import { Type } from "@sinclair/typebox";
import { problemDetailsSchema } from "./auth.schema.js";
import { paginatedDataSchema, paginationQuerySchema } from "./pagination.schema.js";

export const createOrderBodySchema = Type.Object(
  {
    restaurantId: Type.String({ minLength: 1 }),
    items: Type.Array(
      Type.Object({
        dishId: Type.String({ minLength: 1 }),
        quantity: Type.Integer({ minimum: 1 })
      }),
      { minItems: 1 }
    )
  },
  { additionalProperties: false }
);

export const statusUpdateBodySchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("CONFIRMED"),
      Type.Literal("PREPARING"),
      Type.Literal("READY"),
      Type.Literal("DELIVERED")
    ])
  },
  { additionalProperties: false }
);

export const orderIdParamsSchema = Type.Object({
  orderId: Type.String({ minLength: 1 })
});

const orderItemResponseSchema = Type.Object({
  id: Type.String(),
  dishId: Type.String(),
  quantity: Type.Integer(),
  unitPrice: Type.Number()
});

export const orderResponseSchema = Type.Object({
  id: Type.String(),
  status: Type.String(),
  totalPrice: Type.Number(),
  customerId: Type.String(),
  restaurantId: Type.String(),
  items: Type.Array(orderItemResponseSchema),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const ordersResponseSchema = Type.Array(orderResponseSchema);

export const ordersListQuerySchema = Type.Intersect([
  paginationQuerySchema,
  Type.Object({
    status: Type.Optional(
      Type.Union([
        Type.Literal("PENDING"),
        Type.Literal("CONFIRMED"),
        Type.Literal("PREPARING"),
        Type.Literal("READY"),
        Type.Literal("DELIVERED"),
        Type.Literal("CANCELLED")
      ])
    ),
    from: Type.Optional(Type.String({ format: "date-time" })),
    to: Type.Optional(Type.String({ format: "date-time" }))
  })
]);

export const ordersPaginatedResponseSchema = paginatedDataSchema(orderResponseSchema);

export { problemDetailsSchema };

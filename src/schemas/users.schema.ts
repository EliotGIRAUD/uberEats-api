import { Type } from "@sinclair/typebox";
import { problemDetailsSchema } from "./auth.schema.js";

export const updateMeBodySchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: "email" })),
    password: Type.Optional(Type.String({ minLength: 6 })),
    name: Type.Optional(Type.String({ minLength: 1 }))
  },
  { additionalProperties: false }
);

export const userProfileResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.Optional(Type.String()),
  role: Type.Union([Type.Literal("USER"), Type.Literal("RESTAURANT"), Type.Literal("ADMIN")]),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const deleteMeResponseSchema = Type.Object({
  message: Type.String()
});

export { problemDetailsSchema };

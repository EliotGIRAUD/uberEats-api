import { Type } from "@sinclair/typebox";

export const registerBodySchema = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 6 })
  },
  { additionalProperties: false }
);

export const loginBodySchema = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 6 })
  },
  { additionalProperties: false }
);

export const refreshBodySchema = Type.Object(
  {
    refreshToken: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export const tokensResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String()
});

export const registerResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    role: Type.Union([Type.Literal("USER"), Type.Literal("RESTAURANT"), Type.Literal("ADMIN")])
  }),
  accessToken: Type.String(),
  refreshToken: Type.String()
});

export const accessTokenResponseSchema = Type.Object({
  accessToken: Type.String()
});

export const logoutResponseSchema = Type.Object({
  message: Type.String()
});

export const meResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  role: Type.Union([Type.Literal("USER"), Type.Literal("RESTAURANT"), Type.Literal("ADMIN")])
});

export const problemDetailsSchema = Type.Object({
  type: Type.String(),
  title: Type.String(),
  detail: Type.String(),
  status: Type.Number()
});

import { Type } from "@sinclair/typebox";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const paginationQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_PAGE_LIMIT })),
  offset: Type.Optional(Type.Integer({ minimum: 0 }))
});

export const paginationMetaSchema = Type.Object({
  total: Type.Integer(),
  limit: Type.Integer(),
  offset: Type.Integer()
});

export function paginatedDataSchema<T extends ReturnType<typeof Type.Object>>(itemSchema: T) {
  return Type.Object({
    data: Type.Array(itemSchema),
    pagination: paginationMetaSchema
  });
}

export function parsePaginationQuery(q: { limit?: number; offset?: number }): {
  limit: number;
  offset: number;
} {
  const limitRaw = q.limit ?? DEFAULT_PAGE_LIMIT;
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, limitRaw));
  const offset = Math.max(0, q.offset ?? 0);
  return { limit, offset };
}

export function paginationMeta(total: number, limit: number, offset: number) {
  return { total, limit, offset };
}

import type { OutgoingHttpHeaders } from "node:http";
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { Type } from "@sinclair/typebox";
import {
  BadRequest,
  ConflictError,
  Forbidden,
  HttpError,
  NotFound,
  Unauthorized
} from "../src/common/exceptions.js";
import { problemDetailsErrorHandler } from "../src/plugins/error-handler.js";

function expectProblemJson(res: { headers: OutgoingHttpHeaders; json: () => unknown }) {
  const ct = res.headers["content-type"] ?? "";
  expect(String(ct)).toContain("application/problem+json");
  const body = res.json() as Record<string, unknown>;
  expect(body).toEqual(
    expect.objectContaining({
      type: expect.any(String),
      title: expect.any(String),
      detail: expect.any(String),
      status: expect.any(Number)
    })
  );
  expect(Object.keys(body).sort()).toEqual(["detail", "status", "title", "type"]);
}

describe("RFC 7807 / gestionnaire d'erreurs", () => {
  it("valide le corps (email) et renvoie 400 + problem+json", async () => {
    const app = Fastify();
    app.setErrorHandler(problemDetailsErrorHandler);
    app.post(
      "/check",
      {
        schema: {
          body: Type.Object({
            email: Type.String({ format: "email" }),
            password: Type.String({ minLength: 6 })
          })
        }
      },
      async () => ({ ok: true })
    );

    const res = await app.inject({
      method: "POST",
      url: "/check",
      payload: { email: "pas-un-email", password: "secret12" }
    });

    expect(res.statusCode).toBe(400);
    expectProblemJson(res);
    const body = res.json() as { status: number; title: string; type: string };
    expect(body.status).toBe(400);
    expect(body.title).toBe("Bad Request");
    expect(body.type).toContain("validation-error");

    await app.close();
  });

  it("rejette un prix négatif (Number exclusiveMinimum) avec 400", async () => {
    const app = Fastify();
    app.setErrorHandler(problemDetailsErrorHandler);
    app.post(
      "/dish",
      {
        schema: {
          body: Type.Object({
            name: Type.String({ minLength: 1 }),
            price: Type.Number({ exclusiveMinimum: 0 })
          })
        }
      },
      async () => ({ ok: true })
    );

    const res = await app.inject({
      method: "POST",
      url: "/dish",
      payload: { name: " tacos", price: -1 }
    });

    expect(res.statusCode).toBe(400);
    expectProblemJson(res);

    await app.close();
  });

  it.each([
    [Unauthorized, 401, "Unauthorized"],
    [Forbidden, 403, "Forbidden"],
    [NotFound, 404, "Not Found"],
    [ConflictError, 409, "Conflict"],
    [BadRequest, 400, "Bad Request"]
  ] as const)(" %p → %i %s", async (ErrClass, status, title) => {
    const app = Fastify();
    app.setErrorHandler(problemDetailsErrorHandler);
    app.get("/t", async (_req, _reply) => {
      throw new ErrClass("détail de test", "https://api.ubereats.local/problems/test");
    });

    const res = await app.inject({ method: "GET", url: "/t" });
    expect(res.statusCode).toBe(status);
    expectProblemJson(res);
    const body = res.json() as { title: string; status: number; detail: string; type: string };
    expect(body.title).toBe(title);
    expect(body.status).toBe(status);
    expect(body.detail).toBe("détail de test");
    expect(body.type).toBe("https://api.ubereats.local/problems/test");

    await app.close();
  });

  it("HttpError expose toProblemDetails() cohérent avec l'envoi HTTP", async () => {
    const err = new NotFound("Ressource absente", "https://api.ubereats.local/problems/x");
    expect(err).toBeInstanceOf(HttpError);
    expect(err.toProblemDetails()).toEqual({
      type: "https://api.ubereats.local/problems/x",
      title: "Not Found",
      detail: "Ressource absente",
      status: 404
    });
  });
});

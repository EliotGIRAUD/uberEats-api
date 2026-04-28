import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import { jwtDecorator } from "./decorators/jwtDecorator.js";
import { registerGraphQL } from "./graphql/index.js";
import { problemDetailsErrorHandler } from "./plugins/error-handler.js";
import { authRoutes } from "./routes/auth/index.js";
import { dishesRoutes, restaurantDishesRoutes } from "./routes/dishes/index.js";
import { ordersRoutes, restaurantOrdersRoutes, userOrdersRoutes } from "./routes/orders/index.js";
import { restaurantsRoutes } from "./routes/restaurants/index.js";
import { restaurantWebSocketRoutes } from "./routes/websocket.js";
import { usersMeRoutes } from "./routes/users/me.js";

export async function buildApp() {
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  const corsCredentials = process.env.CORS_CREDENTIALS === "true";

  const app = Fastify({
    logger: {
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie"],
        remove: true
      }
    }
  });

  await app.register(cors, {
    origin: corsOrigin,
    credentials: corsCredentials
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "UberEats API",
        description: "REST + WebSocket + GraphQL API for UberEats-like project",
        version: "1.0.0"
      },
      servers: [{ url: "http://localhost:3000" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    }
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    staticCSP: true
  });
  app.get("/documentation/json", {
    schema: {
      hide: true
    }
  }, async () => app.swagger());
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute"
  });
  const isDev = process.env.NODE_ENV !== "production";
  await app.register(helmet, isDev ? { contentSecurityPolicy: false } : {});
  await jwtDecorator(app);
  await app.register(websocket);
  restaurantWebSocketRoutes(app);
  app.setErrorHandler(problemDetailsErrorHandler);
  await registerGraphQL(app);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(usersMeRoutes, { prefix: "/users/me" });
  await app.register(userOrdersRoutes, { prefix: "/users" });
  await app.register(restaurantOrdersRoutes, { prefix: "/restaurants" });
  await app.register(restaurantsRoutes, { prefix: "/restaurants" });
  await app.register(restaurantDishesRoutes, { prefix: "/restaurants/:restaurantId/dishes" });
  await app.register(dishesRoutes, { prefix: "/dishes" });
  await app.register(ordersRoutes, { prefix: "/orders" });

  return app;
}

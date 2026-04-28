import type { User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { RawData } from "ws";
import WebSocket from "ws";
import { prisma } from "../lib/prisma.js";
import { registerRestaurantConnection, unregisterRestaurantConnection } from "../services/websocket.service.js";

/**
 * Connexion WebSocket authentifiée : utilisateur (profil sans secrets), restaurant rattaché, socket.
 * Le type `User` métier est représenté par les champs Prisma hors `password` / `refreshTokenHash`.
 */
export interface AuthenticatedSocket {
  user: Pick<User, "id" | "email" | "role" | "createdAt" | "updatedAt">;
  restaurantId: string;
  socket: WebSocket;
}

function safeClose(socket: WebSocket, code: number, reason: string) {
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close(code, reason.slice(0, 120));
  }
}

export function restaurantWebSocketRoutes(fastify: FastifyInstance) {
  fastify.get("/ws/restaurant", { websocket: true }, (socket, request) => {
    let authSocket: AuthenticatedSocket | null = null;

    const cleanup = () => {
      if (authSocket) {
        unregisterRestaurantConnection(authSocket.restaurantId, socket);
        authSocket = null;
      }
    };

    socket.on("message", async (raw: RawData) => {
      if (!authSocket) {
        let msg: { event?: string; token?: string };
        try {
          msg = JSON.parse(raw.toString()) as { event?: string; token?: string };
        } catch {
          safeClose(socket, 1008, "Invalid JSON");
          return;
        }

        if (msg.event !== "authenticate") {
          safeClose(socket, 1008, "Expected authenticate event first");
          return;
        }

        if (!msg.token || typeof msg.token !== "string") {
          safeClose(socket, 1008, "Token required");
          return;
        }

        let payload: { id: string; email: string; role: UserRole; tokenType: string };
        try {
          payload = await fastify.jwt.verify<{
            id: string;
            email: string;
            role: UserRole;
            tokenType: "access" | "refresh";
          }>(msg.token);
        } catch {
          safeClose(socket, 1008, "Invalid token");
          return;
        }

        if (payload.tokenType !== "access") {
          safeClose(socket, 1008, "Access token required");
          return;
        }

        if (payload.role !== UserRole.RESTAURANT) {
          safeClose(socket, 1008, "Restaurant role required");
          return;
        }

        let user: AuthenticatedSocket["user"] | null;
        try {
          user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, email: true, role: true, createdAt: true, updatedAt: true }
          });
        } catch (error) {
          request.log.error(error);
          safeClose(socket, 1011, "Internal server error");
          return;
        }

        if (!user) {
          safeClose(socket, 1008, "User not found");
          return;
        }

        if (user.role !== UserRole.RESTAURANT) {
          safeClose(socket, 1008, "Restaurant role required");
          return;
        }

        let restaurant: { id: string } | null;
        try {
          restaurant = await prisma.restaurant.findFirst({
            where: { ownerId: user.id },
            orderBy: { createdAt: "asc" },
            select: { id: true }
          });
        } catch (error) {
          request.log.error(error);
          safeClose(socket, 1011, "Internal server error");
          return;
        }

        if (!restaurant) {
          safeClose(socket, 1008, "No restaurant for this user");
          return;
        }

        authSocket = { user, restaurantId: restaurant.id, socket };
        registerRestaurantConnection(restaurant.id, socket);

        socket.send(
          JSON.stringify({
            event: "connected",
            data: {
              restaurantId: restaurant.id,
              message: "WebSocket authenticated for restaurant"
            },
            timestamp: Date.now()
          })
        );
        return;
      }

      let msg: { event?: string };
      try {
        msg = JSON.parse(raw.toString()) as { event?: string };
      } catch {
        request.log.warn({ err: "invalid_ws_json_after_auth" }, "WebSocket message JSON invalide");
        return;
      }

      if (msg.event === "ping") {
        socket.send(JSON.stringify({ event: "pong", timestamp: Date.now() }));
      }
    });

    socket.on("close", () => {
      cleanup();
    });

    socket.on("error", (err: Error) => {
      request.log.error(err);
      cleanup();
    });
  });
}

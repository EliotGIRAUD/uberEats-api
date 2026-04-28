/**
 * API GraphQL via Mercurius (paquet npm « mercurius », intégration officielle Fastify).
 * GraphiQL : http://localhost:<PORT>/graphiql (PORT défaut de l’API : 3001, voir server.ts).
 */
import type { FastifyInstance } from "fastify";
import mercurius from "mercurius";
import { createGraphQLContext } from "./context.js";
import { restaurantSchema } from "./restaurant.schema.js";
import { restaurantResolvers } from "./restaurant.resolvers.js";

export async function registerGraphQL(app: FastifyInstance) {
  await app.register(mercurius, {
    schema: restaurantSchema,
    resolvers: restaurantResolvers,
    path: "/graphql",
    graphiql: true,
    context: async (request, _reply) => createGraphQLContext(request)
  });
}

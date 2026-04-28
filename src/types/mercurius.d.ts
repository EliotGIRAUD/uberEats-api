import "mercurius";
import type { GraphQLViewer } from "../graphql/context.js";

declare module "mercurius" {
  interface MercuriusContext {
    viewer: GraphQLViewer | null;
  }
}

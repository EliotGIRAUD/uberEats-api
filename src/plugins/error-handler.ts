import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "../common/exceptions.js";

const PROBLEM_JSON = "application/problem+json";

export function problemDetailsErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof HttpError) {
    return reply.header("Content-Type", PROBLEM_JSON).status(error.status).send(error.toProblemDetails());
  }

  if (error.validation) {
    return reply.header("Content-Type", PROBLEM_JSON).status(400).send({
      type: "https://api.ubereats.local/problems/validation-error",
      title: "Bad Request",
      detail: error.message,
      status: 400
    });
  }

  request.log.error(error);
  return reply.header("Content-Type", PROBLEM_JSON).status(500).send({
    type: "https://api.ubereats.local/problems/internal-server-error",
    title: "Internal Server Error",
    detail: "An unexpected error occurred",
    status: 500
  });
}

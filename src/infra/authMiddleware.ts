import { eq } from "drizzle-orm";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";
import { db } from "../../drizzle/db";
import { users } from "../../drizzle/schema";
import { env } from "../support";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string }; // Ou o tipo completo do seu usuário, se preferir
  }
}

const authMiddleware: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === '/api/auth/login') {
      return
    }
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
      request.log.warn("Missing or malformed Authorization header");
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const [_, token] = authHeader.split(" ");

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      console.log({ decoded })
      const userId = decoded.id;

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      console.log({ user })

      if (!user) {
        request.log.warn(`User with ID ${userId} not found`);
        return reply.status(401).send({ message: "Unauthorized" });
      }

      request.user = { id: user.id }; // Adiciona o usuário ao objeto request
    } catch (err) {
      // if (err instanceof JsonWebTokenError) {
      //   request.log.warn(`Invalid JWT token: ${err.message}`);
      //   return reply.status(401).send({ message: "Unauthorized" });
      // }
      request.log.error(err, "Authentication error");
      return reply.status(500).send({ message: "Internal Server Error" });
    }
  });
});

export default authMiddleware;

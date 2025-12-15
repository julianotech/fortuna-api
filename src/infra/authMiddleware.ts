import { eq } from "drizzle-orm";
import fp from "fastify-plugin";
import jwt from "jsonwebtoken";

import { env } from "@/support";
import { db } from "drizzle/db";
import { users, usersWallets, wallets } from "../../drizzle/schema";

export default fp(async (fastify) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("preHandler", async (request, reply) => {
    const publicRoutes = ["/api/auth/login", "/api/auth/register"];

    if (publicRoutes.includes(request.url)) {
      return;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      reply.status(401).send({ message: "Unauthorized" });
      return;
    }

    const [_, token] = authHeader.split(" ");

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };

      /**
       * 1️⃣ Busca usuário
       */
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.id),
      });

      if (!user || user.status !== "active") {
        reply.status(401).send({ message: "Unauthorized" });
        return;
      }

      /**
       * 2️⃣ Busca wallets às quais ele tem acesso
       */
      const walletsResult = await db
        .select({
          id: wallets.id,
          name: wallets.name,
          role: usersWallets.role,
        })
        .from(usersWallets)
        .innerJoin(wallets, eq(wallets.id, usersWallets.walletId))
        .where(eq(usersWallets.userId, user.id));

      /**
       * 3️⃣ Injeta usuário normalizado na request
       */
      request.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        wallets: walletsResult,
      };

    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        reply.status(401).send({ message: "Unauthorized" });
        return;
      }

      request.log.error(err);
      reply.status(500).send({ message: "Internal Server Error" });
    }
  });
});

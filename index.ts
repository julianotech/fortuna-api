import cors from "@fastify/cors";
import Fastify from "fastify";

import { loggerOptions } from "./infra/";
import { authRoutes, categoriesRoutes, transactionsRoutes } from "./routes/";
import { env, isProduction } from "./support/";

const fastify = Fastify(loggerOptions);

// Register CORS
fastify.register(cors, {
  origin: (origin, cb): void => {
    const allowedOrigins = [
      env.FRONTEND_URL,
      "http://localhost:8080",
      "http://localhost:3000"
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      cb(null, true);
      return;
    }

    if (allowedOrigins.some((allowed) => origin.includes(allowed as string))) {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Health check
fastify.get("/api/health", async (): Promise<{ status: string, service: string }> => {
  return { status: "ok", service: "fortuna-api" };
});

// Register routes
fastify.register(authRoutes);
fastify.register(categoriesRoutes);
fastify.register(transactionsRoutes);

// Start server (for local development)
const start = async (): Promise<void> => {
  try {
    const port = Number(env.PORT) || 3000;
    await fastify.listen({ port, host: "::" });
    if (!isProduction) {
      fastify.log.info(`🚀 Server running at http://localhost:${port}`);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Only start server if not in Vercel
if (isProduction) {
  start();
}

// Export for Vercel serverless
export default async (req: unknown, res: unknown) => {
  await fastify.ready();
  fastify.server.emit("request", req, res);
};

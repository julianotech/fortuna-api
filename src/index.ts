import cors from "@fastify/cors";
import Fastify from "fastify";

import { loggerOptions } from "./infra";
import authMiddleware from "./infra/authMiddleware";
import { authRoutes, categoriesRoutes, transactionsRoutes } from "./routes/";
import { env, isProduction } from "./support/";

const fastify = Fastify(loggerOptions);
const logger = fastify.log

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

// Registra o middleware de autenticação
fastify.register(authMiddleware);

// Start server (for local development)
const start = async (): Promise<void> => {
  try {
    const port = Number(env.PORT) || 3000;
    await fastify.listen({ port, host: "::" });
  } catch (err) {

    logger.error(err);
    process.exit(1);
  }
};

// Only start server if not in Vercel
if (!isProduction) {
  start();
}

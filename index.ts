import cors from "@fastify/cors";
import Fastify from "fastify";

import authRoutes from "./routes/auth";
import categoriesRoutes from "./routes/categories";
import transactionsRoutes from "./routes/transactions";

const fastify = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
        levelFirst: true,
        messageFormat: "{levelLabel} - {msg}",
        customLevels: "trace:10,debug:20,info:30,warn:40,error:50,fatal:60",
        customColors: "trace:gray,debug:blue,info:green,warn:yellow,error:red,fatal:bgRed",
      },
    },
  },
});

// Register CORS
fastify.register(cors, {
  origin: (origin, cb) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:8081",
      process.env.VERCEL_URL,
      process.env.PRODUCTION_URL,
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
fastify.get("/api/health", async () => {
  return { status: "ok", service: "portal-admin-api" };
});

// Register routes
fastify.register(authRoutes);
fastify.register(categoriesRoutes);
fastify.register(transactionsRoutes);

// Start server (for local development)
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await fastify.listen({ port, host: "::" });
    console.log(`🚀 Server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Only start server if not in Vercel
if (process.env.NODE_ENV !== "production") {
  start();
}

// Export for Vercel serverless
export default async (req: unknown, res: unknown) => {
  await fastify.ready();
  fastify.server.emit("request", req, res);
};

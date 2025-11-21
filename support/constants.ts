import { config } from "dotenv";
import { z } from "zod";
import { existsSync } from "fs";

// Load .env.local first, then .env as fallback
if (existsSync(".env.local")) {
  config({ path: ".env.local", quiet: true });
} else if (existsSync(".env")) {
  config({ path: ".env", quiet: true });
}

const envSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
  PORT: z.string().default("3333"),
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string().startsWith('http')
});

export const env = envSchema.parse(process.env);

import { z } from "zod";

import { importConfig } from "./config";
importConfig()

const envSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgresql://"),
  PORT: z.string().default("3333"),
  JWT_SECRET: z.string(),
  FRONTEND_URL: z.string().startsWith('http'),
  NODE_ENV: z.enum(['development', 'production', 'testing']).default('development')
});

export const env = envSchema.parse(process.env);

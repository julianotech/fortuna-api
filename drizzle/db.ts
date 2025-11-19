import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { existsSync } from "fs";
import postgres from "postgres";

import * as schema from "./schema";

// Load .env.local first, then .env as fallback
if (existsSync(".env.local")) {
  config({ path: ".env.local" });
} else if (existsSync(".env")) {
  config({ path: ".env" });
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create postgres client
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1, // Important for serverless environments
});

// Create drizzle instance
export const db = drizzle(client, { schema });

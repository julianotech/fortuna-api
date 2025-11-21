import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "support";
import * as schema from "./schema";


if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create postgres client
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1, // Important for serverless environments
});

// Create drizzle instance
export const db = drizzle(client, { schema });

export type DB = typeof db;

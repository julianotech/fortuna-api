import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local
config({ path: ".env.local" });

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

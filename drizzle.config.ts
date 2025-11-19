import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env
config({ path: ".env" });

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

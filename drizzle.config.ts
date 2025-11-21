import { defineConfig } from "drizzle-kit";
import { env } from "support";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

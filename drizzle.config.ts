import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const drizzleConfig = {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.APP_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@example.invalid:5432/bazi_scaffold",
  },
};

export default drizzleConfig;

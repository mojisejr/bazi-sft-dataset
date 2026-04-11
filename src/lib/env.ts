import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse({
    DATABASE_URL: raw.DATABASE_URL,
  });
}

export function getDatabaseUrl(raw: NodeJS.ProcessEnv = process.env): string {
  const env = readEnv(raw);

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  return env.DATABASE_URL;
}
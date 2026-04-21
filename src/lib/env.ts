import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(raw: Partial<NodeJS.ProcessEnv> = process.env): AppEnv {
  return envSchema.parse({
    DATABASE_URL: raw.DATABASE_URL,
    GEMINI_API_KEY: raw.GEMINI_API_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: raw.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: raw.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: raw.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
      raw.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
      raw.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
  });
}

export function getDatabaseUrl(raw: Partial<NodeJS.ProcessEnv> = process.env): string {
  const env = readEnv(raw);

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  return env.DATABASE_URL;
}

export function getGeminiApiKey(raw: Partial<NodeJS.ProcessEnv> = process.env): string {
  const env = readEnv(raw);

  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for Gemini dataset generation.");
  }

  return env.GEMINI_API_KEY;
}
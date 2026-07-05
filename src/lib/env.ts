import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1).optional(),
  LINE_CHANNEL_SECRET: z.string().min(1).optional(),
  LINE_LOGIN_URL: z.string().url().optional(),
  /** Channel ID ของ LINE Login/LIFF — ใช้ verify id_token จาก LIFF ก่อนตั้ง alert */
  LINE_LOGIN_CHANNEL_ID: z.string().min(1).optional(),
  /** ความลับสำหรับป้องกัน endpoint cron (Vercel Cron แนบ Authorization: Bearer <CRON_SECRET> อัตโนมัติ) */
  CRON_SECRET: z.string().min(1).optional(),
  OPEN_WEBUI_API_TOKEN: z.string().min(1).optional(),
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
    LINE_CHANNEL_ACCESS_TOKEN: raw.LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: raw.LINE_CHANNEL_SECRET,
    LINE_LOGIN_URL: raw.LINE_LOGIN_URL,
    LINE_LOGIN_CHANNEL_ID: raw.LINE_LOGIN_CHANNEL_ID,
    CRON_SECRET: raw.CRON_SECRET,
    OPEN_WEBUI_API_TOKEN: raw.OPEN_WEBUI_API_TOKEN,
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

export function getLineChannelAccessToken(
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): string {
  const env = readEnv(raw);

  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is required for LINE messaging API calls.");
  }

  return env.LINE_CHANNEL_ACCESS_TOKEN;
}

export function getLineChannelSecret(raw: Partial<NodeJS.ProcessEnv> = process.env): string {
  const env = readEnv(raw);

  if (!env.LINE_CHANNEL_SECRET) {
    throw new Error("LINE_CHANNEL_SECRET is required for LINE webhook validation.");
  }

  return env.LINE_CHANNEL_SECRET;
}

export function getLineLoginChannelId(raw: Partial<NodeJS.ProcessEnv> = process.env): string {
  const env = readEnv(raw);

  if (!env.LINE_LOGIN_CHANNEL_ID) {
    throw new Error("LINE_LOGIN_CHANNEL_ID is required to verify LIFF id_token.");
  }

  return env.LINE_LOGIN_CHANNEL_ID;
}

/** ความลับ cron — คืน null ถ้าไม่ตั้ง (endpoint จะปฏิเสธทุก request เพื่อความปลอดภัย) */
export function getCronSecret(raw: Partial<NodeJS.ProcessEnv> = process.env): string | null {
  return readEnv(raw).CRON_SECRET ?? null;
}

export function getLineLoginUrl(raw: Partial<NodeJS.ProcessEnv> = process.env): string {
  const env = readEnv(raw);

  if (!env.LINE_LOGIN_URL) {
    throw new Error("LINE_LOGIN_URL is required for LINE login prompts.");
  }

  return env.LINE_LOGIN_URL;
}

export function getOpenWebUiApiToken(raw: Partial<NodeJS.ProcessEnv> = process.env): string {
  const env = readEnv(raw);

  if (!env.OPEN_WEBUI_API_TOKEN) {
    throw new Error("OPEN_WEBUI_API_TOKEN is required for Open WebUI API access.");
  }

  return env.OPEN_WEBUI_API_TOKEN;
}
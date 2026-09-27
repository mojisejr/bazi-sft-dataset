/**
 * mumate-vercel-to-do-001 slice 2 — bazi ต้องทำงานถูกต้องนอก Vercel (container บน DigitalOcean)
 *   1. APP_DATABASE_URL เท่านั้น — ไม่ fallback ไป DATABASE_URL ของ Neon integration แบบเงียบ ๆ
 *   2. ค่า env ว่าง (`KEY=` ใน docker env_file) = ไม่ได้ตั้ง — ไม่ทำให้ readEnv ล้มทั้งก้อน
 *   3. admin route fail closed เมื่อไม่ตั้ง ADMIN_DOCTRINE_TOKEN (ยกเว้น next dev)
 * แต่ละข้อมี "ทางเดิมบน Vercel" คู่กัน: ค่าที่ Vercel ตั้งไว้ครบ ผลต้องเหมือนเดิม
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { isAdminAuthorized } from "@/lib/admin-token";
import { getCronSecret, getDatabaseUrl, readEnv } from "@/lib/env";

const SUPABASE = "postgresql://app:pw@aws-1.pooler.supabase.com:6543/postgres";
const NEON = "postgresql://demo:demo@example.neon.tech/neondb?sslmode=require";

describe("getDatabaseUrl: APP_DATABASE_URL only", () => {
  test("Vercel path unchanged: APP_DATABASE_URL wins when both are set", () => {
    expect(getDatabaseUrl({ APP_DATABASE_URL: SUPABASE, DATABASE_URL: NEON })).toBe(SUPABASE);
  });

  test("a lone DATABASE_URL (Neon integration) is no longer used silently", () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: NEON })).toThrow(
      "APP_DATABASE_URL is required for database operations.",
    );
  });
});

describe("readEnv: blank values mean unset", () => {
  test("KEY= lines from a docker env_file do not throw", () => {
    expect(() =>
      readEnv({ APP_DATABASE_URL: SUPABASE, LINE_LOGIN_URL: "", GEMINI_API_KEY: "  ", CRON_SECRET: "" }),
    ).not.toThrow();
    expect(getDatabaseUrl({ APP_DATABASE_URL: SUPABASE, LINE_LOGIN_URL: "" })).toBe(SUPABASE);
    expect(getCronSecret({ CRON_SECRET: "" })).toBeNull();
  });

  test("a blank APP_DATABASE_URL is reported by name, not as a schema error", () => {
    expect(() => getDatabaseUrl({ APP_DATABASE_URL: "" })).toThrow("APP_DATABASE_URL is required");
  });

  test("Vercel path unchanged: set values pass through", () => {
    expect(getCronSecret({ CRON_SECRET: "s3cret" })).toBe("s3cret");
  });
});

describe("isAdminAuthorized: fail closed", () => {
  const req = (token?: string) =>
    new Request("http://bazi.test/api/x", { headers: token ? { "x-admin-token": token } : {} });

  test("token unset in production or test = refused", () => {
    expect(isAdminAuthorized(req(), { NODE_ENV: "production" })).toBe(false);
    expect(isAdminAuthorized(req("anything"), { NODE_ENV: "production" })).toBe(false);
    expect(isAdminAuthorized(req(), { NODE_ENV: "test" })).toBe(false);
    expect(isAdminAuthorized(req(), { NODE_ENV: "production", ADMIN_DOCTRINE_TOKEN: "  " })).toBe(false);
  });

  test("token unset under next dev = allowed, as before", () => {
    expect(isAdminAuthorized(req(), { NODE_ENV: "development" })).toBe(true);
  });

  test("Vercel path unchanged: token set, header must match", () => {
    const env = { NODE_ENV: "production" as const, ADMIN_DOCTRINE_TOKEN: "t0ken" };
    expect(isAdminAuthorized(req("t0ken"), env)).toBe(true);
    expect(isAdminAuthorized(req(" t0ken "), env)).toBe(true);
    expect(isAdminAuthorized(req("wrong"), env)).toBe(false);
    expect(isAdminAuthorized(req(), env)).toBe(false);
  });
});

describe("every admin route goes through isAdminAuthorized", () => {
  // v1/chat/completions reads the token only to waive Qi, and already requires it to be set
  const ALLOWED = new Set([join("src", "app", "api", "v1", "chat", "completions", "route.ts")]);

  function routes(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? routes(p) : name === "route.ts" ? [p] : [];
    });
  }

  test("no route reads ADMIN_DOCTRINE_TOKEN itself", () => {
    const offenders = routes(join("src", "app", "api")).filter(
      (p) => !ALLOWED.has(p) && /process\.env\.ADMIN_DOCTRINE_TOKEN/.test(readFileSync(p, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("a real admin route with the token unset", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("POST /api/reading/sacred-map/upload answers 401 before reading the body", async () => {
    vi.stubEnv("ADMIN_DOCTRINE_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await import("@/app/api/reading/sacred-map/upload/route");
    const res = await POST(new Request("http://bazi.test/api/reading/sacred-map/upload", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

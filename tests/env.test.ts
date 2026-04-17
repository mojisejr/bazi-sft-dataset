import { describe, expect, test } from "vitest";

import { getDatabaseUrl, getGeminiApiKey, readEnv } from "@/lib/env";

describe("readEnv", () => {
  test("accepts an empty process env during scaffold stage", () => {
    expect(readEnv({})).toEqual({
      DATABASE_URL: undefined,
      GEMINI_API_KEY: undefined,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined,
      CLERK_SECRET_KEY: undefined,
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: undefined,
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: undefined,
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: undefined,
      NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: undefined,
    });
  });

  test("accepts a postgres connection string", () => {
    const env = readEnv({
      DATABASE_URL: "postgresql://demo:demo@example.neon.tech/neondb?sslmode=require",
      GEMINI_API_KEY: "gemini_test_demo",
    });

    expect(env.DATABASE_URL).toContain("postgresql://");
    expect(env.GEMINI_API_KEY).toBe("gemini_test_demo");
  });

  test("accepts the Clerk routing and key environment variables", () => {
    const env = readEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_demo",
      CLERK_SECRET_KEY: "sk_test_demo",
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-in",
      NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/",
      NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/",
    });

    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_test_demo");
    expect(env.CLERK_SECRET_KEY).toBe("sk_test_demo");
    expect(env.NEXT_PUBLIC_CLERK_SIGN_IN_URL).toBe("/sign-in");
    expect(env.NEXT_PUBLIC_CLERK_SIGN_UP_URL).toBe("/sign-in");
    expect(env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL).toBe("/");
    expect(env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL).toBe("/");
  });
});

describe("getDatabaseUrl", () => {
  test("throws when the database URL is missing", () => {
    expect(() => getDatabaseUrl({})).toThrow(
      "DATABASE_URL is required for database operations.",
    );
  });
});

describe("getGeminiApiKey", () => {
  test("throws when the Gemini API key is missing", () => {
    expect(() => getGeminiApiKey({})).toThrow(
      "GEMINI_API_KEY is required for Gemini dataset generation.",
    );
  });

  test("returns the configured Gemini API key", () => {
    expect(getGeminiApiKey({ GEMINI_API_KEY: "gemini_test_demo" })).toBe(
      "gemini_test_demo",
    );
  });
});
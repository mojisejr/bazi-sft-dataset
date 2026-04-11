import { describe, expect, test } from "vitest";

import { getDatabaseUrl, readEnv } from "@/lib/env";

describe("readEnv", () => {
  test("accepts an empty process env during scaffold stage", () => {
    expect(readEnv({})).toEqual({ DATABASE_URL: undefined });
  });

  test("accepts a postgres connection string", () => {
    const env = readEnv({
      DATABASE_URL: "postgresql://demo:demo@example.neon.tech/neondb?sslmode=require",
    });

    expect(env.DATABASE_URL).toContain("postgresql://");
  });
});

describe("getDatabaseUrl", () => {
  test("throws when the database URL is missing", () => {
    expect(() => getDatabaseUrl({})).toThrow(
      "DATABASE_URL is required for database operations.",
    );
  });
});
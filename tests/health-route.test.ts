import path from "node:path";

import { describe, expect, test, vi } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..");

// The readiness route must run a REAL query through the repo's single DB client factory, not return a
// constant. Mocking that factory lets the test drive both branches without a database.
const sqlMock = vi.fn();
vi.mock("@/db/client", () => ({
  createDbSqlClient: vi.fn(() => sqlMock),
}));

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => Promise<T>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) {
    prev[k] = process.env[k];
    if (patch[k] === undefined) delete process.env[k];
    else process.env[k] = patch[k];
  }
  return fn().finally(() => {
    for (const k of Object.keys(patch)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

describe("GET /api/health (mumate-infra-move-001 slice 1)", () => {
  test("in the container: 200 only after `select 1` succeeded and the runtime files are present; legacy fields kept", async () => {
    sqlMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    await withEnv({ APP_RUNTIME: "container", APP_RUNTIME_ROOT: REPO_ROOT }, async () => {
      const { GET } = await import("@/app/api/health/route");
      const res = await GET();
      const body = await res.json();
      expect(sqlMock).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(body).toMatchObject({
        project: "bazi",
        phase: "2",
        status: "symbolic-engine-ready",
        db: "ok",
        runtimeFiles: "ok",
        runtimeFilesMissing: [],
      });
      expect(body.routes).toContain("/api/bazi/calculate");
    });
  });

  test("outside the container (Vercel): the manifest is not checked and never degrades the status", async () => {
    sqlMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    await withEnv({ APP_RUNTIME: undefined, APP_RUNTIME_ROOT: undefined }, async () => {
      const { GET } = await import("@/app/api/health/route");
      const res = await GET();
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ status: "symbolic-engine-ready", db: "ok", runtimeFiles: "not-checked" });
    });
  });

  test("503 degraded when the database is unreachable — never a constant green", async () => {
    sqlMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", db: "error" });
    expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\/|DATABASE_URL/i);
  });

  test("in the container: a missing runtime file is a 503, not a silent wrong reading", async () => {
    sqlMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    vi.resetModules();
    vi.doMock("@/lib/runtime-files", () => ({
      checkRuntimeFiles: () => ({ ok: false, root: "/app", missing: ["knownlage/extracted"] }),
    }));
    try {
      await withEnv({ APP_RUNTIME: "container", APP_RUNTIME_ROOT: "/app" }, async () => {
        const { GET } = await import("@/app/api/health/route");
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(503);
        expect(body).toMatchObject({ status: "degraded", db: "ok", runtimeFiles: "missing", runtimeFilesMissing: ["knownlage/extracted"] });
      });
    } finally {
      vi.doUnmock("@/lib/runtime-files");
      vi.resetModules();
    }
  });
});

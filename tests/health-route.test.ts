import { describe, expect, test, vi } from "vitest";

// The readiness route must run a REAL query through the repo's single DB client factory, not return a
// constant. Mocking that factory lets the test drive both branches without a database.
const sqlMock = vi.fn();
vi.mock("@/db/client", () => ({
  createDbSqlClient: vi.fn(() => sqlMock),
}));

describe("GET /api/health (mumate-infra-move-001 slice 1)", () => {
  test("200 only after `select 1` succeeded and the runtime files are present; legacy fields kept", async () => {
    sqlMock.mockResolvedValueOnce([{ "?column?": 1 }]);
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

  test("503 degraded when the database is unreachable — never a constant green", async () => {
    sqlMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", db: "error" });
    expect(JSON.stringify(body)).not.toMatch(/postgres(ql)?:\/\/|DATABASE_URL/i);
  });
});

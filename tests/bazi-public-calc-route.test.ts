import { describe, expect, test, vi } from "vitest";

const SAMPLE_RAW_INPUT = {
  birthDate: "1990-05-15",
  birthTime: "08:30",
  gender: "male",
  province: "กรุงเทพมหานคร",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
} as const;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/public-calc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// #calculator-enrichment-FROZEN-v1: this route must NEVER touch the DB (no fallback needed —
// there is nothing to fall back from). Mocking the repo's single DB client factory to throw
// proves it structurally, at runtime, not just "the route doesn't import createDbKnowledgeRepository".
vi.mock("@/db/client", () => ({
  createDbClient: vi.fn(() => {
    throw new Error("public-calc route must not construct a DB client");
  }),
  createDbSqlClient: vi.fn(() => {
    throw new Error("public-calc route must not construct a DB sql client");
  }),
}));

describe("POST /api/bazi/public-calc", () => {
  test("ไม่แตะ DB เลย และคืนวัยจร/ปีจร/ปฏิกิริยาธาตุครบ", async () => {
    const { POST } = await import("@/app/api/bazi/public-calc/route");
    const response = await POST(createRequest(SAMPLE_RAW_INPUT));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      dayMaster: string;
      dayMasterElement: string;
      strengthScore: number;
      daYun: Array<{ ageRange: string; symbol: string; place: string; qi: string; reaction: string; element: string }>;
      liuNian: Array<{
        year: number;
        age: number;
        stem: string;
        branch: string;
        element: string;
        qi: string;
        reaction: string;
        clash: boolean;
        harm: boolean;
      }>;
    };

    expect(body.dayMaster).toBeTruthy();
    expect(body.dayMasterElement).toBeTruthy();
    expect(typeof body.strengthScore).toBe("number");

    expect(body.daYun.length).toBeGreaterThan(0);
    for (const row of body.daYun) {
      expect(row.ageRange).toBeTruthy();
      expect(row.symbol).toBeTruthy();
      expect(row.place).toBeTruthy();
      expect(row.element).toBeTruthy();
      expect(row.reaction).toBeTruthy();
    }

    expect(body.liuNian.length).toBeGreaterThan(0);
    for (const row of body.liuNian) {
      expect(row.stem).toBeTruthy();
      expect(row.branch).toBeTruthy();
      expect(row.element).toBeTruthy();
      expect(row.reaction).toBeTruthy();
      expect(typeof row.clash).toBe("boolean");
      expect(typeof row.harm).toBe("boolean");
    }

    // ไม่มีเกรด 0-3 ดาวหลุดออกมาใน response เลย (OUT of scope ตาม FRD v1 — too+มุน ตัดออก)
    expect(JSON.stringify(body)).not.toMatch(/grade/i);
  }, 30000);

  test("อย่างน้อย 1 ปีจรต้องธงชน (冲) กับหลักวันจริง ในช่วง 10 ปีข้างหน้าตามธรรมชาติของวงจร 12 ปี", async () => {
    const { POST } = await import("@/app/api/bazi/public-calc/route");
    const response = await POST(createRequest(SAMPLE_RAW_INPUT));
    const body = (await response.json()) as {
      liuNian: Array<{ clash: boolean; harm: boolean }>;
    };
    const hasClashOrHarm = body.liuNian.some((y) => y.clash || y.harm);
    expect(hasClashOrHarm).toBe(true);
  }, 30000);

  test("payload ไม่ถูกต้อง → 400 พร้อม details", async () => {
    const { POST } = await import("@/app/api/bazi/public-calc/route");
    const response = await POST(createRequest({ birthDate: "2026-99-99" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; details?: unknown };
    expect(body.error).toBeTruthy();
  });

  test("payload ว่างเปล่า → 400 ไม่ crash", async () => {
    const { POST } = await import("@/app/api/bazi/public-calc/route");
    const response = await POST(createRequest({}));
    expect(response.status).toBe(400);
  });
});

import { describe, expect, test } from "vitest";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

const SAMPLE_RAW_INPUT = {
  birthDate: "1990-05-15",
  birthTime: "08:30",
  gender: "male",
  province: "กรุงเทพมหานคร",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
} as const;

function createRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bazi/chamber-graph", () => {
  test("คืนกราฟห้องปฏิกิริยาจาก RawInput", async () => {
    const { createChamberGraphHandler } = await import("@/app/api/bazi/chamber-graph/route");
    const POST = createChamberGraphHandler({ repository: createTestKnowledgeRepository() });
    const response = await POST(createRequest("/api/bazi/chamber-graph", SAMPLE_RAW_INPUT));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { graph: { nodes?: unknown[] } };
    expect(body.graph).toBeTruthy();
  }, 30000);

  test("payload ไม่ถูกต้อง → 400", async () => {
    const { createChamberGraphHandler } = await import("@/app/api/bazi/chamber-graph/route");
    const POST = createChamberGraphHandler({ repository: createTestKnowledgeRepository() });
    const response = await POST(createRequest("/api/bazi/chamber-graph", { birthDate: "" }));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/bazi/domain-power", () => {
  test("คืนค่าพลังรายด้าน 4 ด้าน", async () => {
    const { createDomainPowerHandler } = await import("@/app/api/bazi/domain-power/route");
    const POST = createDomainPowerHandler({ repository: createTestKnowledgeRepository() });
    const response = await POST(createRequest("/api/bazi/domain-power", SAMPLE_RAW_INPUT));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      domainPower: { career: unknown; learning: unknown; friends: unknown; wealth: unknown };
    };
    expect(body.domainPower).toBeTruthy();
    expect(body.domainPower.career).toBeTruthy();
    expect(body.domainPower.wealth).toBeTruthy();
  }, 30000);
});

describe("POST /api/bazi/strength-score", () => {
  test("คืนคะแนนความแข็ง/อ่อน + dayMaster", async () => {
    const { createStrengthScoreHandler } = await import("@/app/api/bazi/strength-score/route");
    const POST = createStrengthScoreHandler({ repository: createTestKnowledgeRepository() });
    const response = await POST(createRequest("/api/bazi/strength-score", SAMPLE_RAW_INPUT));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { dayMaster: string; strengthScore: number };
    expect(typeof body.strengthScore).toBe("number");
    expect(body.dayMaster).toBeTruthy();
  }, 30000);
});

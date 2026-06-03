import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

function createRequest(body: unknown) {
  return new Request("http://localhost/api/reading/export-docx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reading/export-docx", () => {
  test("returns a .docx attachment from rawInput + calculatedState", async () => {
    const repo = createTestKnowledgeRepository();
    const rawInput = RawInputSchema.parse({
      birthDate: "1966-09-29", birthTime: "11:44", gender: "female",
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const calculatedState = await calculateBaziChart(rawInput, repo);

    const { POST } = await import("@/app/api/reading/export-docx/route");
    const response = await POST(
      createRequest({
        rawInput,
        calculatedState,
        readings: { chart_foundation: "คำอ่านฉบับ LLM ทดสอบ override" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("wordprocessingml.document");
    expect(response.headers.get("content-disposition")).toContain(".docx");
    const buf = Buffer.from(await response.arrayBuffer());
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(buf.length).toBeGreaterThan(3000);
  }, 20000);

  test("rejects invalid payload", async () => {
    const { POST } = await import("@/app/api/reading/export-docx/route");
    const response = await POST(createRequest({ nope: true }));
    expect(response.status).toBe(400);
  });
});

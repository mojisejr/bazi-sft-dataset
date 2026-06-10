import { describe, expect, test, vi } from "vitest";

const SAMPLE_RAW_INPUT = {
  birthDate: "1988-06-08",
  birthTime: "12:08",
  gender: "female",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
} as const;

const SAMPLE_CALCULATED_STATE = {
  fourPillars: {
    year: { stem: "癸", branch: "酉", hiddenStems: ["辛"] },
    month: { stem: "癸", branch: "亥", hiddenStems: ["壬", "甲"] },
    day: { stem: "己", branch: "酉", hiddenStems: ["辛"] },
    hour: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
  },
  dayMaster: "己",
  strengthScore: 2.1,
  tenGods: {},
  twelveQi: { yearBranch: "แป่", monthBranch: "ตี้อ๋วง", dayBranch: "เชี่ยงแซ", hourBranch: "หมกยก" },
  daYun: [{ startAge: 5, endAge: 9, stem: "壬", branch: "戌" }],
};

const SAMPLE_ROWS = [
  { ageRange: "5-9 ปี", symbol: "壬", relationLine: "ถ่ายเท → เชี่ยงแซ", deepNote: "เดิม ก" },
  { ageRange: "10-14 ปี", symbol: "戌", relationLine: "ส่งเสริม → หมอ", deepNote: "เดิม ข" },
];

function createRequest(body: unknown) {
  return new Request("http://localhost/api/reading/relationship-lines", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reading/relationship-lines", () => {
  test("ไม่มี apiKey → 400 (invalid_payload)", async () => {
    const { POST } = await import("@/app/api/reading/relationship-lines/route");
    const response = await POST(
      createRequest({
        rawInput: SAMPLE_RAW_INPUT,
        calculatedState: SAMPLE_CALCULATED_STATE,
        rows: SAMPLE_ROWS,
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { type: string } };
    expect(body.error.type).toBe("invalid_payload");
  });

  test("rows ว่าง → 400 (invalid_payload)", async () => {
    const { POST } = await import("@/app/api/reading/relationship-lines/route");
    const response = await POST(
      createRequest({
        rawInput: SAMPLE_RAW_INPUT,
        calculatedState: SAMPLE_CALCULATED_STATE,
        rows: [],
        apiKey: "test-key",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/reading/relationship-lines — gen deepNotes (mocked LLM)", () => {
  test("คง ageRange/symbol/relationLine แล้วทับเฉพาะ deepNote จาก LLM", async () => {
    vi.resetModules();
    const polishRelationshipLinesLlm = vi.fn().mockImplementation(
      async ({ rows }: { rows: typeof SAMPLE_ROWS }) =>
        rows.map((row, index) => ({ ...row, deepNote: `LLM แต่งใหม่ ${index}` })),
    );

    vi.doMock("@/lib/bazi/reading-llm", () => ({ polishRelationshipLinesLlm }));

    const { POST } = await import("@/app/api/reading/relationship-lines/route");
    const response = await POST(
      createRequest({
        rawInput: SAMPLE_RAW_INPUT,
        calculatedState: SAMPLE_CALCULATED_STATE,
        rows: SAMPLE_ROWS,
        apiKey: "test-key",
        provider: "gemini",
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { relationshipLines: typeof SAMPLE_ROWS };
    expect(body.relationshipLines).toHaveLength(2);
    expect(body.relationshipLines[0]?.deepNote).toBe("LLM แต่งใหม่ 0");
    // คอลัมน์อื่นต้องคงเดิม
    expect(body.relationshipLines[0]?.ageRange).toBe("5-9 ปี");
    expect(body.relationshipLines[1]?.relationLine).toBe("ส่งเสริม → หมอ");
    expect(polishRelationshipLinesLlm).toHaveBeenCalledTimes(1);
    const callArg = polishRelationshipLinesLlm.mock.calls[0]?.[0] as { apiKey: string };
    expect(callArg.apiKey).toBe("test-key");

    vi.doUnmock("@/lib/bazi/reading-llm");
    vi.resetModules();
  });
});

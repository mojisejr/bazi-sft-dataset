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
  elementAnalysis: {
    visibleCounts: { wood: 0, fire: 0, earth: 1, metal: 2, water: 3 },
    hiddenCounts: { wood: 1, fire: 0, earth: 1, metal: 2, water: 2 },
    totalCounts: { wood: 1, fire: 0, earth: 2, metal: 4, water: 5 },
    missingElements: ["fire"],
    dominantElements: ["water", "metal"],
    elementStrengths: [],
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "อ่อน",
    displayLabel: "ดิถีอ่อน",
    narrative: "ดิถีดินอ่อน ถูกแวดล้อมด้วยน้ำและทอง",
  },
  daYun: [
    { startAge: 5, endAge: 9, stem: "壬", branch: "戌" },
  ],
};

function createRequest(body: unknown) {
  return new Request("http://localhost/api/reading/topic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reading/topic", () => {
  // timeout เผื่อ: เทสต์นี้ import route graph (symbolic-engine + adapter) ครั้งแรก ซึ่งช้าตอน transform เต็มชุด
  test("engine mode คืน reading จาก calculatedState โดยไม่เรียก LLM", async () => {
    const { POST } = await import("@/app/api/reading/topic/route");
    const response = await POST(
      createRequest({
        topicId: "wealth_and_investment",
        mode: "engine",
        calculatedState: SAMPLE_CALCULATED_STATE,
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { source: string; reading: { table: unknown[]; prose: string[] } };
    expect(body.source).toBe("engine");
    expect(body.reading.table.length).toBeGreaterThan(0);
    expect(body.reading.prose.length).toBeGreaterThan(0);
  }, 20000);

  test("llm mode ที่ไม่มี apiKey → 400", async () => {
    const { POST } = await import("@/app/api/reading/topic/route");
    const response = await POST(
      createRequest({
        topicId: "wealth_and_investment",
        mode: "llm",
        rawInput: SAMPLE_RAW_INPUT,
        calculatedState: SAMPLE_CALCULATED_STATE,
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { type: string } };
    expect(body.error.type).toBe("missing_api_key");
  });

  test("topicId ที่ไม่รู้จัก → 400", async () => {
    const { POST } = await import("@/app/api/reading/topic/route");
    const response = await POST(
      createRequest({ topicId: "nope", mode: "engine", calculatedState: SAMPLE_CALCULATED_STATE }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/reading/topic — llm mode (mocked Gemini)", () => {
  test("เรียก fallback ด้วย apiKey แล้วคืน prose จาก LLM", async () => {
    vi.resetModules();
    const generateReadingTopicLlm = vi.fn().mockResolvedValue({
      text: "โชคลาภของคุณมาจากสายน้ำที่ต้องหมุนเวียน เหมาะกับงานบริการเฉพาะทาง",
      model: "gemini-3-flash-preview",
    });

    vi.doMock("@/lib/bazi/reading-llm", () => ({ generateReadingTopicLlm }));

    const { POST } = await import("@/app/api/reading/topic/route");
    const response = await POST(
      createRequest({
        topicId: "wealth_and_investment",
        mode: "llm",
        apiKey: "test-key",
        rawInput: SAMPLE_RAW_INPUT,
        calculatedState: SAMPLE_CALCULATED_STATE,
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      source: string;
      humanReading: string;
      sourceLabel: string;
    };
    expect(body.source).toBe("llm");
    // โหมด llm: ผลการทำนาย (humanReading) = ฉบับ LLM เรียบเรียงสไตล์ 1.docx
    expect(body.humanReading).toContain("โชคลาภ");
    expect(body.sourceLabel).toContain("ตำรา");
    expect(generateReadingTopicLlm).toHaveBeenCalledTimes(1);
    const callArg = generateReadingTopicLlm.mock.calls[0]?.[0] as { apiKey: string; topicId: string };
    expect(callArg.apiKey).toBe("test-key");
    expect(callArg.topicId).toBe("wealth_and_investment");

    vi.doUnmock("@/lib/bazi/reading-llm");
    vi.resetModules();
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CalculatedStateSchema } from "@/lib/bazi/schema-types";
import {
  type OpenWebUiBaziExtraction,
  type OpenWebUiTriageResult,
  type TriageRoute,
  type TriageTimeframe,
} from "@/features/open-webui/triage";

vi.mock("@/features/open-webui/api-guard", () => ({
  validateApiToken: vi.fn(() => null),
}));

const runOpenWebUiTriageMock = vi.fn();
vi.mock("@/features/open-webui/triage", async () => {
  const actual = await vi.importActual<typeof import("@/features/open-webui/triage")>(
    "@/features/open-webui/triage",
  );
  return {
    ...actual,
    runOpenWebUiTriage: runOpenWebUiTriageMock,
  };
});

const calculateBaziStateFromRawInputMock = vi.fn();
vi.mock("@/features/bazi-math/bazi-engine-adapter", async () => {
  const actual = await vi.importActual<typeof import("@/features/bazi-math/bazi-engine-adapter")>(
    "@/features/bazi-math/bazi-engine-adapter",
  );
  return {
    ...actual,
    calculateBaziStateFromRawInput: calculateBaziStateFromRawInputMock,
  };
});

const generateGeminiAssistantReplyMock = vi.fn();
vi.mock("@/features/open-webui/gemini-adapter", async () => {
  const actual = await vi.importActual<typeof import("@/features/open-webui/gemini-adapter")>(
    "@/features/open-webui/gemini-adapter",
  );
  return {
    ...actual,
    generateGeminiAssistantReply: generateGeminiAssistantReplyMock,
  };
});

const { buildGlassBoxTrace, buildOpenWebUiExecutionContext, POST } = await import("@/app/api/v1/chat/completions/route");

const SAMPLE_CALCULATED_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
    hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
  },
  dayMaster: "己",
  strengthScore: 3.07,
  tenGods: {
    yearStem: "正财",
    monthStem: "劫财",
    hourStem: "食神",
  },
  twelveQi: {
    yearBranch: "沐浴",
    monthBranch: "沐浴",
    dayBranch: "帝旺",
    hourBranch: "冠带",
  },
  daYun: [
    {
      startAge: 42,
      endAge: 51,
      stem: "辛",
      branch: "酉",
      isCurrent: true,
      currentPhase: "upper",
      upperStageDisplay: "冠带",
      lowerStageDisplay: "临官",
    },
  ],
  liuNian: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
  shenSha: [],
  elementAnalysis: {
    visibleCounts: { wood: 0, fire: 0, earth: 2, metal: 2, water: 1 },
    hiddenCounts: { wood: 1, fire: 2, earth: 3, metal: 2, water: 2 },
    totalCounts: { wood: 1, fire: 2, earth: 5, metal: 4, water: 3 },
    missingElements: [],
    dominantElements: ["earth"],
    elementStrengths: [],
  },
  seasonalInteraction: {
    dayMasterStem: "己",
    dayMasterElement: "earth",
    monthBranch: "申",
    season: "autumn",
    phase: "peak",
    seasonLabel: "ฤดูใบไม้ร่วงช่วงต้น",
    metaphor: "ดินที่ต้องอาศัยไฟช่วยประคองก่อนจะจับรูปได้มั่นคง",
  },
  dayMasterStrengthProfile: {
    dayMaster: "己",
    strengthState: "strong",
    displayLabel: "ดวงแข็งแรง",
    narrative: "ดิถีมีกำลังและยืนได้ด้วยฐานของตัวเอง",
    qiLabel: "帝旺",
  },
  sixtyJiaziCorePersona: {
    code: "己巳",
    narrative: "Measured earth that grows through patience and timing.",
    precedenceNotes: ["Respect seasonal balance before reading annual timing."],
  },
  compatibilityMatrixProfiles: [
    {
      domain: "love",
      pairKey: "day-branch",
      entries: [
        {
          code: "harmonic",
          label: "คู่ที่คุยกันรู้เรื่อง",
          counterpartBranch: "酉",
          narrative: "สัมพันธ์ดีเมื่อค่อย ๆ สร้างความไว้ใจ",
        },
      ],
    },
  ],
  baseChartReading: {
    roleBadges: [],
    stemInteractionBadges: [],
    branchInteractionBadges: [],
    markerBadges: [],
    groups: [],
    legendItems: [],
    readingOrderSteps: ["ดูดิถีก่อน"],
  },
});

const SAMPLE_CHAT_RESULT = {
  baziConsult: {
    rawInput: {
      birthDate: "1992-08-12",
      birthTime: "09:15",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: SAMPLE_CALCULATED_STATE,
  },
} as const;

const SAMPLE_RAW_INPUT = {
  birthDate: "1989-01-03",
  birthTime: "08:45",
  gender: "ชาย",
  province: "จันทบุรี",
};

function extraction(overrides: Partial<OpenWebUiBaziExtraction> = {}): OpenWebUiBaziExtraction {
  return {
    fields: {
      birthDate: SAMPLE_RAW_INPUT.birthDate,
      birthTime: SAMPLE_RAW_INPUT.birthTime,
      gender: SAMPLE_RAW_INPUT.gender,
      province: SAMPLE_RAW_INPUT.province,
    },
    missingFields: [],
    isComplete: true,
    rawInput: SAMPLE_RAW_INPUT,
    ...overrides,
  };
}

function triage(overrides: {
  topicId?: TriageRoute;
  intent?: OpenWebUiTriageResult["classification"]["intent"];
  requiresBaziConsult?: boolean;
  timeframe?: TriageTimeframe;
  confidence?: number;
  extraction?: OpenWebUiBaziExtraction;
} = {}): OpenWebUiTriageResult {
  const requiresBaziConsult = overrides.requiresBaziConsult ?? true;
  const confidence = overrides.confidence ?? 0.9;
  return {
    topicId: overrides.topicId ?? "wealth_and_investment",
    requiresBaziConsult,
    timeframe: overrides.timeframe ?? "none",
    confidence,
    extraction: overrides.extraction ?? extraction(),
    classification: {
      intent: overrides.intent ?? "wealth",
      requiresBaziConsult,
      confidence,
    },
  };
}

function buildJsonRequest(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function reconstructAnswer(streamBody: string) {
  return streamBody
    .trim()
    .split("\n\n")
    .map((event) => event.replace("data: ", ""))
    .filter((event) => event.includes('"content"'))
    .map((event) => JSON.parse(event).choices[0].delta.content)
    .join("");
}

async function consumeStream(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }
  buffer += decoder.decode();
  return buffer;
}

describe("buildOpenWebUiExecutionContext", () => {
  test("attaches a narrowed truth packet when extraction completes", async () => {
    const executionContext = await buildOpenWebUiExecutionContext({
      result: SAMPLE_CHAT_RESULT,
      triage: triage({ topicId: "wealth_and_investment", intent: "wealth" }),
      calculatedState: SAMPLE_CALCULATED_STATE,
    });

    expect(executionContext.intentClassification?.intent).toBe("wealth");
    expect(executionContext.topicId).toBe("wealth_and_investment");
    expect(executionContext.baziConsult?.rawInput?.birthDate).toBe(SAMPLE_RAW_INPUT.birthDate);
    expect(executionContext.baziConsult?.truthPacket).toContain('"intent":"wealth"');
    expect(executionContext.baziMissingFields).toBeUndefined();
  });

  test("keeps non-Bazi traffic stateless by bypassing truth-packet attachment", async () => {
    const executionContext = await buildOpenWebUiExecutionContext({
      result: SAMPLE_CHAT_RESULT,
      triage: triage({ topicId: "chit_chat", intent: "chit_chat", requiresBaziConsult: false, confidence: 0.2 }),
    });

    expect(executionContext.intentClassification?.intent).toBe("chit_chat");
    expect(executionContext.topicId).toBe("chit_chat");
    expect(executionContext.baziConsult?.rawInput?.birthDate).toBe("1992-08-12");
    expect(executionContext.baziConsult?.truthPacket).toBeNull();
  });

  test("emits missingFields and null truth packet when extraction is incomplete", async () => {
    const executionContext = await buildOpenWebUiExecutionContext({
      result: { baziConsult: null },
      triage: triage({
        topicId: "love_partner",
        intent: "love",
        confidence: 0.88,
        extraction: {
          fields: { birthDate: "1989-01-03", birthTime: null, gender: null, province: null },
          missingFields: ["birthTime", "gender", "province"],
          isComplete: false,
          rawInput: null,
        },
      }),
      calculatedState: null,
    });

    expect(executionContext.baziConsult).toEqual({ rawInput: null, truthPacket: null });
    expect(executionContext.baziMissingFields).toEqual(["birthTime", "gender", "province"]);
  });
});

describe("POST /api/v1/chat/completions (Action Loop)", () => {
  beforeEach(() => {
    runOpenWebUiTriageMock.mockReset();
    calculateBaziStateFromRawInputMock.mockReset();
    generateGeminiAssistantReplyMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("chit_chat path streams a reply without calculation, in a single triage call", async () => {
    runOpenWebUiTriageMock.mockResolvedValue(
      triage({
        topicId: "chit_chat",
        intent: "chit_chat",
        requiresBaziConsult: false,
        confidence: 0.5,
        extraction: {
          fields: { birthDate: null, birthTime: null, gender: null, province: null },
          missingFields: ["birthDate", "birthTime", "gender", "province"],
          isComplete: false,
          rawInput: null,
        },
      }),
    );
    generateGeminiAssistantReplyMock.mockResolvedValue({ model: "gemini-2.5-flash", text: "สวัสดีค่ะ" });

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "สวัสดี" }],
    }));

    const body = await consumeStream(response);

    expect(runOpenWebUiTriageMock).toHaveBeenCalledTimes(1);
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(generateGeminiAssistantReplyMock).toHaveBeenCalledTimes(1);
    expect(body).toContain("[DONE]");

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.intentClassification.intent).toBe("chit_chat");
    expect(executionContext.baziConsult).toBeNull();
  });

  test("bazi intent with missing fields skips calculation and passes baziMissingFields", async () => {
    runOpenWebUiTriageMock.mockResolvedValue(
      triage({
        topicId: "love_partner",
        intent: "love",
        extraction: {
          fields: { birthDate: "1989-01-03", birthTime: null, gender: null, province: null },
          missingFields: ["birthTime", "gender", "province"],
          isComplete: false,
          rawInput: null,
        },
      }),
    );
    generateGeminiAssistantReplyMock.mockResolvedValue({ model: "gemini-2.5-flash", text: "ขอข้อมูลเพิ่มหน่อยค่ะ" });

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "ดูดวงให้หน่อย เกิดปี 1989" }],
    }));

    const body = await consumeStream(response);

    expect(runOpenWebUiTriageMock).toHaveBeenCalledTimes(1);
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(body).toContain("[DONE]");

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.baziConsult).toEqual({ rawInput: null, truthPacket: null });
    expect(executionContext.baziMissingFields).toEqual(["birthTime", "gender", "province"]);
  });

  test("bazi intent with complete extraction calls calculator and attaches truth packet", async () => {
    runOpenWebUiTriageMock.mockResolvedValue(
      triage({ topicId: "wealth_and_investment", intent: "wealth", confidence: 0.97 }),
    );
    calculateBaziStateFromRawInputMock.mockResolvedValue(SAMPLE_CALCULATED_STATE);
    generateGeminiAssistantReplyMock.mockResolvedValue({ model: "gemini-2.5-flash", text: "พยากรณ์เสร็จค่ะ" });

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "เกิด 3 ม.ค. 2532 8:45 จันทบุรี ชาย" }],
    }));

    const body = await consumeStream(response);

    expect(calculateBaziStateFromRawInputMock).toHaveBeenCalledTimes(1);
    expect(calculateBaziStateFromRawInputMock).toHaveBeenCalledWith(SAMPLE_RAW_INPUT);
    expect(body).toContain("[DONE]");

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.baziConsult.rawInput).toEqual(SAMPLE_RAW_INPUT);
    expect(typeof executionContext.baziConsult.truthPacket).toBe("string");
    expect((executionContext.baziConsult.truthPacket as string).length).toBeGreaterThan(0);
  });

  test("triage failure still flushes the SSE stream to [DONE]", async () => {
    runOpenWebUiTriageMock.mockRejectedValue(new Error("Gemini triage exploded"));

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "ดูดวงให้หน่อย" }],
    }));

    const body = await consumeStream(response);

    expect(generateGeminiAssistantReplyMock).not.toHaveBeenCalled();
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(body).toContain("[DONE]");
  });
});

describe("Glass Box trace flag (Track B1)", () => {
  beforeEach(() => {
    runOpenWebUiTriageMock.mockReset();
    calculateBaziStateFromRawInputMock.mockReset();
    generateGeminiAssistantReplyMock.mockReset();
    runOpenWebUiTriageMock.mockResolvedValue(
      triage({ topicId: "wealth_and_investment", intent: "wealth", confidence: 0.97 }),
    );
    calculateBaziStateFromRawInputMock.mockResolvedValue(SAMPLE_CALCULATED_STATE);
    generateGeminiAssistantReplyMock.mockResolvedValue({ model: "gemini-2.5-flash", text: "พยากรณ์การเงินปีนี้ดีค่ะ" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("default (no header): the stream carries no trace frame", async () => {
    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "เกิด 3 ม.ค. 2532 8:45 จันทบุรี ชาย ดูเรื่องเงิน" }],
    }));

    const body = await consumeStream(response);

    expect(body).not.toContain("glass-box.trace");
    expect(reconstructAnswer(body)).toBe("พยากรณ์การเงินปีนี้ดีค่ะ");
    expect(body).toContain("[DONE]");
  });

  test("x-glass-box: 1 emits a trace frame (heard + truthUsed) before the answer, without changing it", async () => {
    const response = await POST(buildJsonRequest(
      { messages: [{ role: "user", content: "เกิด 3 ม.ค. 2532 8:45 จันทบุรี ชาย ดูเรื่องเงิน" }] },
      { "x-glass-box": "1" },
    ));

    const body = await consumeStream(response);
    const events = body.trim().split("\n\n").map((event) => event.replace("data: ", ""));
    const traceIndex = events.findIndex((event) => event.includes('"object":"glass-box.trace"'));
    const firstContentIndex = events.findIndex((event) => event.includes('"content"'));

    // trace frame present and strictly before the first answer token
    expect(traceIndex).toBeGreaterThan(-1);
    expect(firstContentIndex).toBeGreaterThan(traceIndex);

    const trace = JSON.parse(events[traceIndex]).trace;
    expect(trace.heard.topicId).toBe("wealth_and_investment");
    expect(trace.heard.requiresBaziConsult).toBe(true);
    expect(trace.heard.birthResolved).toBe(true);
    expect(typeof trace.truthUsed.injectedReadingText).toBe("string");
    expect(trace.truthUsed.injectedReadingText.length).toBeGreaterThan(0);

    // the answer itself is identical to the no-flag case
    expect(reconstructAnswer(body)).toBe("พยากรณ์การเงินปีนี้ดีค่ะ");
  });

  test("same-day question flags honestPrecisionApplied in the trace", async () => {
    runOpenWebUiTriageMock.mockResolvedValue(
      triage({ topicId: "wealth_and_investment", intent: "wealth", timeframe: "today", confidence: 0.9 }),
    );

    const response = await POST(buildJsonRequest(
      { messages: [{ role: "user", content: "วันนี้ดวงการเงินเป็นไง เกิด 3 ม.ค. 2532 8:45 จันทบุรี ชาย" }] },
      { "x-glass-box": "1" },
    ));

    const body = await consumeStream(response);
    const events = body.trim().split("\n\n").map((event) => event.replace("data: ", ""));
    const trace = JSON.parse(events.find((event) => event.includes('"object":"glass-box.trace"'))!).trace;

    expect(trace.heard.timeframe).toBe("today");
    expect(trace.filters.honestPrecisionApplied).toBe(true);
  });
});

describe("buildGlassBoxTrace", () => {
  test("reports heard, the injected engine text, and the resolved seam", () => {
    const trace = buildGlassBoxTrace({
      triage: triage({ topicId: "wealth_and_investment", intent: "wealth", confidence: 0.91 }),
      executionContext: {
        intentClassification: { intent: "wealth", requiresBaziConsult: true, confidence: 0.91 },
        topicId: "wealth_and_investment",
        timeframe: "none",
        baziConsult: { rawInput: SAMPLE_RAW_INPUT, truthPacket: '{"intent":"wealth"}' },
      },
    });

    expect(trace.heard).toEqual({
      topicId: "wealth_and_investment",
      timeframe: "none",
      requiresBaziConsult: true,
      confidence: 0.91,
      birthResolved: true,
    });
    expect(trace.truthUsed.injectedReadingText).toBe('{"intent":"wealth"}');
    expect(trace.truthUsed.seam).toBeTruthy();
    expect(trace.filters.honestPrecisionApplied).toBe(false);
  });

  test("seam is null when no engine reading was injected", () => {
    const trace = buildGlassBoxTrace({
      triage: triage({ topicId: "chit_chat", intent: "chit_chat", requiresBaziConsult: false, confidence: 0.2 }),
      executionContext: {
        intentClassification: { intent: "chit_chat", requiresBaziConsult: false, confidence: 0.2 },
        topicId: "chit_chat",
        timeframe: "none",
        baziConsult: null,
      },
    });

    expect(trace.truthUsed.seam).toBeNull();
    expect(trace.truthUsed.injectedReadingText).toBeNull();
    expect(trace.heard.requiresBaziConsult).toBe(false);
  });
});

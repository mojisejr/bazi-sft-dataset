import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

vi.mock("@/features/open-webui/api-guard", () => ({
  validateApiToken: vi.fn(() => null),
}));

const routeOpenWebUiIntentMock = vi.fn();
vi.mock("@/features/open-webui/intent-router", async () => {
  const actual = await vi.importActual<typeof import("@/features/open-webui/intent-router")>(
    "@/features/open-webui/intent-router",
  );
  return {
    ...actual,
    routeOpenWebUiIntent: routeOpenWebUiIntentMock,
  };
});

const extractOpenWebUiBaziContextMock = vi.fn();
vi.mock("@/features/open-webui/bazi-extractor", async () => {
  const actual = await vi.importActual<typeof import("@/features/open-webui/bazi-extractor")>(
    "@/features/open-webui/bazi-extractor",
  );
  return {
    ...actual,
    extractOpenWebUiBaziContext: extractOpenWebUiBaziContextMock,
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

const { buildOpenWebUiExecutionContext, POST } = await import("@/app/api/v1/chat/completions/route");

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

function buildJsonRequest(body: unknown) {
  return new Request("http://localhost/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  test("attaches a narrowed truth packet when extraction completes", () => {
    const executionContext = buildOpenWebUiExecutionContext({
      result: SAMPLE_CHAT_RESULT,
      intentClassification: { intent: "wealth", requiresBaziConsult: true, confidence: 0.94 },
      extraction: {
        fields: {
          birthDate: SAMPLE_RAW_INPUT.birthDate,
          birthTime: SAMPLE_RAW_INPUT.birthTime,
          gender: SAMPLE_RAW_INPUT.gender,
          province: SAMPLE_RAW_INPUT.province,
        },
        missingFields: [],
        isComplete: true,
        rawInput: SAMPLE_RAW_INPUT,
      },
      calculatedState: SAMPLE_CALCULATED_STATE,
    });

    expect(executionContext.intentClassification?.intent).toBe("wealth");
    expect(executionContext.baziConsult?.rawInput?.birthDate).toBe(SAMPLE_RAW_INPUT.birthDate);
    expect(executionContext.baziConsult?.truthPacket).toContain('"intent": "wealth"');
    expect(executionContext.baziMissingFields).toBeUndefined();
  });

  test("keeps non-Bazi traffic stateless by bypassing truth-packet attachment", () => {
    const executionContext = buildOpenWebUiExecutionContext({
      result: SAMPLE_CHAT_RESULT,
      intentClassification: { intent: "chit_chat", requiresBaziConsult: false, confidence: 0.2 },
    });

    expect(executionContext.intentClassification?.intent).toBe("chit_chat");
    expect(executionContext.baziConsult?.rawInput?.birthDate).toBe("1992-08-12");
    expect(executionContext.baziConsult?.truthPacket).toBeNull();
  });

  test("emits missingFields and null truth packet when extraction is incomplete", () => {
    const executionContext = buildOpenWebUiExecutionContext({
      result: { baziConsult: null },
      intentClassification: { intent: "love", requiresBaziConsult: true, confidence: 0.88 },
      extraction: {
        fields: { birthDate: "1989-01-03", birthTime: null, gender: null, province: null },
        missingFields: ["birthTime", "gender", "province"],
        isComplete: false,
        rawInput: null,
      },
      calculatedState: null,
    });

    expect(executionContext.baziConsult).toEqual({ rawInput: null, truthPacket: null });
    expect(executionContext.baziMissingFields).toEqual(["birthTime", "gender", "province"]);
  });
});

describe("POST /api/v1/chat/completions (Action Loop)", () => {
  beforeEach(() => {
    routeOpenWebUiIntentMock.mockReset();
    extractOpenWebUiBaziContextMock.mockReset();
    calculateBaziStateFromRawInputMock.mockReset();
    generateGeminiAssistantReplyMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("chit_chat path streams a reply without extraction or calculation", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.5,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "สวัสดีค่ะ",
    });

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "สวัสดี" }],
    }));

    const body = await consumeStream(response);

    expect(extractOpenWebUiBaziContextMock).not.toHaveBeenCalled();
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(generateGeminiAssistantReplyMock).toHaveBeenCalledTimes(1);
    expect(body).toContain("[DONE]");

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.intentClassification.intent).toBe("chit_chat");
    expect(executionContext.baziConsult).toBeNull();
  });

  test("route-level stream reconstruction emits only reply-safe content when Gemini returns tagged output", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.5,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: '<bazi_logic>{"intent":"chit_chat"}</bazi_logic>\n<reply>ตอบแบบปลอดภัยค่ะ</reply>',
    });

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "สวัสดีอีกครั้ง" }],
    }));

    const body = await consumeStream(response);
    const reconstructedContent = body
      .trim()
      .split("\n\n")
      .slice(1, -2)
      .map((event) => JSON.parse(event.replace("data: ", "")).choices[0]?.delta?.content ?? "")
      .join("");

    expect(reconstructedContent).toBe("ตอบแบบปลอดภัยค่ะ");
    expect(body).not.toContain("<bazi_logic>");
    expect(body).not.toContain("<reply>");
    expect(body).toContain("[DONE]");
  });

  test("bazi intent with missing fields skips calculation and passes baziMissingFields", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.9,
    });
    extractOpenWebUiBaziContextMock.mockResolvedValue({
      fields: { birthDate: "1989-01-03", birthTime: null, gender: null, province: null },
      missingFields: ["birthTime", "gender", "province"],
      isComplete: false,
      rawInput: null,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "ขอข้อมูลเพิ่มหน่อยค่ะ",
    });

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "ดูดวงให้หน่อย เกิดปี 1989" }],
    }));

    const body = await consumeStream(response);

    expect(extractOpenWebUiBaziContextMock).toHaveBeenCalledTimes(1);
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(body).toContain("[DONE]");

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.baziConsult).toEqual({ rawInput: null, truthPacket: null });
    expect(executionContext.baziMissingFields).toEqual(["birthTime", "gender", "province"]);
  });

  test("bazi intent with complete extraction calls calculator and attaches truth packet", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.97,
    });
    extractOpenWebUiBaziContextMock.mockResolvedValue({
      fields: { ...SAMPLE_RAW_INPUT },
      missingFields: [],
      isComplete: true,
      rawInput: SAMPLE_RAW_INPUT,
    });
    calculateBaziStateFromRawInputMock.mockResolvedValue(SAMPLE_CALCULATED_STATE);
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "พยากรณ์เสร็จค่ะ",
    });

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

  test("bazi follow-up reuses cached calculatedState and emits a fresh intent-specific truth packet", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.95,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "ความรักอ่านจากฐานคู่เดิมค่ะ",
    });

    const response = await POST(buildJsonRequest({
      messages: [
        { role: "user", content: "เกิด 12/08/1992 เวลา 09:15 กรุงเทพ ผู้หญิง" },
        {
          role: "assistant",
          content: "<bazi_logic>{\"intent\":\"wealth\"}</bazi_logic>\n<reply>เรื่องเงินมีแรงหนุนค่ะ</reply>",
        },
        { role: "user", content: "แล้วความรักล่ะ" },
      ],
      baziConsult: SAMPLE_CHAT_RESULT.baziConsult,
    }));

    const body = await consumeStream(response);

    expect(extractOpenWebUiBaziContextMock).not.toHaveBeenCalled();
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(body).toContain("[DONE]");

    const [chatInput, options] = generateGeminiAssistantReplyMock.mock.calls[0];
    expect(chatInput.normalizedMessages[1].content).toBe("<reply>เรื่องเงินมีแรงหนุนค่ะ</reply>");

    const truthPacket = options.executionContext.baziConsult.truthPacket as string;
    expect(options.executionContext.baziConsult.rawInput).toEqual(SAMPLE_CHAT_RESULT.baziConsult.rawInput);
    expect(truthPacket).toContain('"intent": "love"');
    expect(truthPacket).toContain('"spousePalace"');
    expect(truthPacket).toContain('"loveCompatibilityProfile"');
    expect(truthPacket).not.toContain('"financeTenGodHighlights"');
  });

  test("extractor failure still flushes the SSE stream to [DONE]", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "general_reading",
      requiresBaziConsult: true,
      confidence: 0.8,
    });
    extractOpenWebUiBaziContextMock.mockRejectedValue(
      new Error("Gemini extractor exploded"),
    );

    const response = await POST(buildJsonRequest({
      messages: [{ role: "user", content: "ดูดวงให้หน่อย" }],
    }));

    const body = await consumeStream(response);

    expect(generateGeminiAssistantReplyMock).not.toHaveBeenCalled();
    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(body).toContain("[DONE]");
  });
});

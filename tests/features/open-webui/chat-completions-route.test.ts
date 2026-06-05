import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { selectBaziDoctrinePacketForCanonicalQuestion } from "@/lib/bazi/atomic-question-doctrine-harness";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

import {
  PHASE_5A_DETERMINISTIC_PROOF_INVENTORY,
  PHASE_3D_RELATIONSHIP_RESOLVER_FIXTURES,
} from "../../helpers/atomic-question-resolver-fixtures";

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

const findByClerkUserIdMock = vi.fn();
const upsertPartialByClerkUserIdMock = vi.fn();
vi.mock("@/features/open-webui/profile-service", async () => {
  const actual = await vi.importActual<typeof import("@/features/open-webui/profile-service")>(
    "@/features/open-webui/profile-service",
  );
  return {
    ...actual,
    createBaziUserProfileRepository: vi.fn(() => ({
      findByClerkUserId: findByClerkUserIdMock,
      upsertPartialByClerkUserId: upsertPartialByClerkUserIdMock,
    })),
  };
});

const findByClerkUserIdAndThreadIdMock = vi.fn();
const appendFinalizedTurnByClerkUserIdAndThreadIdMock = vi.fn();
vi.mock("@/features/open-webui/episodic-service", async () => {
  const actual = await vi.importActual<typeof import("@/features/open-webui/episodic-service")>(
    "@/features/open-webui/episodic-service",
  );
  return {
    ...actual,
    createBaziOpenWebUiEpisodicRepository: vi.fn(() => ({
      findByClerkUserIdAndThreadId: findByClerkUserIdAndThreadIdMock,
      appendFinalizedTurnByClerkUserIdAndThreadId: appendFinalizedTurnByClerkUserIdAndThreadIdMock,
    })),
  };
});

const { buildOpenWebUiExecutionContext, POST } = await import("@/app/api/v1/chat/completions/route");
const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

const SAMPLE_CALCULATED_STATE = CalculatedStateSchema.parse({
  fourPillars: {
    year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
    day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
    hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
  },
  ageSnapshot: {
    referenceDate: "2026-06-03",
    thaiAge: 37,
    chineseAge: 38,
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
      startAge: 35,
      endAge: 44,
      stem: "辛",
      branch: "酉",
      isCurrent: true,
      currentPhase: "upper",
      upperStageDisplay: "冠带",
      lowerStageDisplay: "临官",
      upperPhase: {
        startAge: 35,
        endAge: 39,
        symbol: "辛",
        source: "stem",
        isCurrent: true,
        twelveQiDisplay: "冠带",
      },
      lowerPhase: {
        startAge: 40,
        endAge: 44,
        symbol: "酉",
        source: "branch",
        isCurrent: false,
        twelveQiDisplay: "临官",
      },
    },
    {
      startAge: 45,
      endAge: 54,
      stem: "壬",
      branch: "戌",
      upperStageDisplay: "帝旺",
      lowerStageDisplay: "衰",
      upperPhase: {
        startAge: 45,
        endAge: 49,
        symbol: "壬",
        source: "stem",
        isCurrent: false,
        twelveQiDisplay: "帝旺",
      },
      lowerPhase: {
        startAge: 50,
        endAge: 54,
        symbol: "戌",
        source: "branch",
        isCurrent: false,
        twelveQiDisplay: "衰",
      },
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
  latestUserMessage: {
    role: "user",
    content: "เกิด 12/08/1992 เวลา 09:15 กรุงเทพ ผู้หญิง ช่วยดูให้หน่อย",
  },
  triageMessages: [
    {
      role: "user",
      content: "เกิด 12/08/1992 เวลา 09:15 กรุงเทพ ผู้หญิง ช่วยดูให้หน่อย",
    },
  ],
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

function buildJsonRequestWithHeaders(body: unknown, headers: HeadersInit) {
  return new Request("http://localhost/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
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

async function buildPromptPayloadFromGeminiRouteCall(callIndex = 0) {
  const geminiCall = generateGeminiAssistantReplyMock.mock.calls[callIndex];

  if (!geminiCall) {
    throw new Error("Expected generateGeminiAssistantReply to be called before building the prompt payload.");
  }

  const { buildOpenWebUiGeminiPromptPayload } = await vi.importActual<typeof import("@/features/open-webui/gemini-adapter")>(
    "@/features/open-webui/gemini-adapter",
  );

  return buildOpenWebUiGeminiPromptPayload({
    ...geminiCall[0],
    executionContext: geminiCall[1].executionContext,
    now: new Date("2026-06-04T09:00:00+07:00"),
  });
}

function reconstructSseContent(body: string) {
  return body
    .trim()
    .split("\n\n")
    .slice(1, -2)
    .map((event) => JSON.parse(event.replace("data: ", "")).choices[0]?.delta?.content ?? "")
    .join("");
}

function expectOperationalEvent(event: string, detail: Record<string, unknown>) {
  expect(consoleInfoSpy).toHaveBeenCalledWith(
    "[open-webui] operational",
    expect.objectContaining({
      event,
      ...detail,
    }),
  );
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
    expect(executionContext.baziConsult?.truthPacket).toContain('"canonicalBucket": "wealth"');
    expect(executionContext.baziConsult?.truthPacket).toContain('"activeTimingWindow"');
    expect(executionContext.baziConsult?.truthPacket).toContain('"35-39"');
    expect(executionContext.baziConsult?.truthPacket).toContain('"40-44"');
    expect(executionContext.baziConsult?.truthPacket).toContain('"45-49"');
    expect(executionContext.baziConsult?.truthPacket).not.toContain('"50-54"');
    expect(executionContext.baziMissingFields).toBeUndefined();
  });

  test("routes career job-switch wording into atomic selection mode without moving resolver logic into the route", () => {
    const executionContext = buildOpenWebUiExecutionContext({
      result: {
        ...SAMPLE_CHAT_RESULT,
        latestUserMessage: {
          role: "user",
          content: "Should I change jobs now or wait for a safer window?",
        },
        triageMessages: [
          {
            role: "assistant",
            content: "Tell me what you are considering.",
          },
          {
            role: "user",
            content: "I am thinking about resigning and moving teams.",
          },
          {
            role: "user",
            content: "Should I change jobs now or wait for a safer window?",
          },
        ],
      },
      intentClassification: { intent: "career", requiresBaziConsult: true, confidence: 0.94 },
      calculatedState: SAMPLE_CALCULATED_STATE,
    });

    expect(executionContext.baziConsult?.truthPacket).toContain('"selectionMode": "atomic_job"');
    expect(executionContext.baziConsult?.truthPacket).toContain('"jobId": "work.job_switch_timing"');
  });

  test("keeps mixed career wording on bucket fallback when resolver confidence is ambiguous", () => {
    const executionContext = buildOpenWebUiExecutionContext({
      result: {
        ...SAMPLE_CHAT_RESULT,
        latestUserMessage: {
          role: "user",
          content: "Should I change jobs now or stay in a role that fits me better?",
        },
        triageMessages: [
          {
            role: "user",
            content: "I want to know what kind of work suits me too.",
          },
          {
            role: "user",
            content: "Should I change jobs now or stay in a role that fits me better?",
          },
        ],
      },
      intentClassification: { intent: "career", requiresBaziConsult: true, confidence: 0.91 },
      calculatedState: SAMPLE_CALCULATED_STATE,
    });

    expect(executionContext.baziConsult?.truthPacket).toContain('"selectionMode": "bucket_fallback"');
    expect(executionContext.baziConsult?.truthPacket).not.toContain('"jobId"');
  });

  test("keeps relationship fixtures consistent through the route execution-context path", () => {
    const executionContexts = PHASE_3D_RELATIONSHIP_RESOLVER_FIXTURES.map((fixture) => buildOpenWebUiExecutionContext({
      result: {
        ...SAMPLE_CHAT_RESULT,
        latestUserMessage: {
          role: "user",
          content: fixture.currentChatEvidence.latestUserMessage,
        },
        triageMessages: [
          ...fixture.currentChatEvidence.recentMessages.map((content) => ({
            role: "user" as const,
            content,
          })),
          {
            role: "user" as const,
            content: fixture.currentChatEvidence.latestUserMessage,
          },
        ],
      },
      intentClassification: fixture.intentClassification,
      calculatedState: SAMPLE_CALCULATED_STATE,
    }));

    expect(executionContexts[0].baziConsult?.truthPacket).toContain('"selectionMode": "atomic_job"');
    expect(executionContexts[0].baziConsult?.truthPacket).toContain('"jobId": "relationship.partner_profile"');
    expect(executionContexts[1].baziConsult?.truthPacket).toContain('"selectionMode": "atomic_job"');
    expect(executionContexts[1].baziConsult?.truthPacket).toContain('"jobId": "relationship.timing_window"');
    expect(executionContexts[2].baziConsult?.truthPacket).toContain('"selectionMode": "bucket_fallback"');
    expect(executionContexts[2].baziConsult?.truthPacket).not.toContain('"jobId"');
  });

  test("serializes the shell-agnostic doctrine harness verbatim for the Phase 5A reviewed inventory", () => {
    const executionContexts = PHASE_5A_DETERMINISTIC_PROOF_INVENTORY.map((fixture) => ({
      fixture,
      executionContext: buildOpenWebUiExecutionContext({
        result: {
          ...SAMPLE_CHAT_RESULT,
          latestUserMessage: {
            role: "user",
            content: fixture.currentChatEvidence.latestUserMessage,
          },
          triageMessages: [
            ...fixture.currentChatEvidence.recentMessages.map((content) => ({
              role: "user" as const,
              content,
            })),
            {
              role: "user" as const,
              content: fixture.currentChatEvidence.latestUserMessage,
            },
          ],
        },
        intentClassification: fixture.intentClassification,
        calculatedState: SAMPLE_CALCULATED_STATE,
      }),
      expectedPacket: selectBaziDoctrinePacketForCanonicalQuestion({
        canonicalBucket: fixture.canonicalBucket,
        payload: SAMPLE_CALCULATED_STATE,
        currentChatEvidence: fixture.currentChatEvidence,
      }),
    }));

    for (const { executionContext, expectedPacket } of executionContexts) {
      expect(executionContext.baziConsult?.truthPacket).toBe(JSON.stringify(expectedPacket, null, 2));
    }
  });

  test("passes persisted active scope through the execution context instead of relying only on summary text", () => {
    const executionContext = buildOpenWebUiExecutionContext({
      result: SAMPLE_CHAT_RESULT,
      intentClassification: { intent: "career", requiresBaziConsult: true, confidence: 0.94 },
      calculatedState: SAMPLE_CALCULATED_STATE,
      episodicMemory: {
        clerkUserId: "clerk-123",
        threadId: "chat-thread-1",
        contextSummary: "ดูเรื่องงานต่อจาก scope เดิม",
        continuityState: {
          profileFingerprint: "1992-08-12::09:15::female::Bangkok",
          profileFields: {
            birthDate: "1992-08-12",
            birthTime: "09:15",
            gender: "female",
            province: "Bangkok",
          },
          activeScope: {
            requestedDomain: "career",
            currentAgeWindow: {
              startAge: 42,
              endAge: 46,
              currentPhase: "upper",
              label: "42-46",
            },
          },
        },
        messages: [
          { role: "user", content: "ดูเรื่องงานต่อ" },
          { role: "assistant", content: "ได้ค่ะ ต่อจาก scope เดิมให้" },
        ],
      },
    });

    expect(executionContext.episodicMemory).toEqual({
      contextSummary: "ดูเรื่องงานต่อจาก scope เดิม",
      activeScope: {
        requestedDomain: "career",
        currentAgeWindow: {
          startAge: 42,
          endAge: 46,
          currentPhase: "upper",
          label: "42-46",
        },
      },
      messages: [
        { role: "user", content: "ดูเรื่องงานต่อ" },
        { role: "assistant", content: "ได้ค่ะ ต่อจาก scope เดิมให้" },
      ],
    });
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
      result: {
        baziConsult: null,
        latestUserMessage: {
          role: "user",
          content: "ดูความรักให้หน่อย",
        },
        triageMessages: [
          {
            role: "user",
            content: "ดูความรักให้หน่อย",
          },
        ],
      },
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
    consoleInfoSpy.mockClear();
    consoleErrorSpy.mockClear();
    routeOpenWebUiIntentMock.mockReset();
    extractOpenWebUiBaziContextMock.mockReset();
    calculateBaziStateFromRawInputMock.mockReset();
    generateGeminiAssistantReplyMock.mockReset();
    findByClerkUserIdMock.mockReset();
    upsertPartialByClerkUserIdMock.mockReset();
    findByClerkUserIdAndThreadIdMock.mockReset();
    appendFinalizedTurnByClerkUserIdAndThreadIdMock.mockReset();
    findByClerkUserIdMock.mockResolvedValue(null);
    upsertPartialByClerkUserIdMock.mockResolvedValue(null);
    findByClerkUserIdAndThreadIdMock.mockResolvedValue(null);
    appendFinalizedTurnByClerkUserIdAndThreadIdMock.mockResolvedValue(null);
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

  test("career runtime path keeps canonical school order and scoped domain guardrails in the final Gemini payload", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "career",
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
      messages: [{ role: "user", content: "ควรเปลี่ยนงานตอนนี้ไหม" }],
    }));

    await consumeStream(response);

    const promptPayload = await buildPromptPayloadFromGeminiRouteCall();

    expect(promptPayload.systemInstruction).toContain("ตรวจกำลังดิถีให้ชัดก่อนข้ามไปเรื่องงาน ความรัก หรือจังหวะเวลา");
    expect(promptPayload.systemInstruction).toContain("ไล่ปฏิกิริยาธาตุทั้ง 5 และ role evidence ตามหัวข้อที่ผู้ใช้ถาม");
    expect(promptPayload.systemInstruction).toContain("ค่อยดูชง เฮ้ง ไห่ ผั่ว ภาคี และแรงปฏิสัมพันธ์ที่ Truth Packet ให้มา");
    expect(promptPayload.userPrompt).toContain("Primary requested domain: career. Stay inside this domain unless the user explicitly asks to compare another domain");
    expect(promptPayload.userPrompt).toContain("Do not drift into unrelated lifestyle commentary, romance, money, health, or personality advice when the current request is career-only or otherwise domain-bounded.");
  });

  test("relationship runtime path preserves compatibility-profile provenance wording in the final Gemini payload", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.95,
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
      messages: [{ role: "user", content: "คนแบบไหนเหมาะกับความรักของฉัน" }],
    }));

    await consumeStream(response);

    const promptPayload = await buildPromptPayloadFromGeminiRouteCall();

    expect(promptPayload.systemInstruction).toContain("compatibility_profile = profile-level evidence only; speak as tendency or signal, not as a directly computed chart fact.");
    expect(promptPayload.systemInstruction).toContain("computed_chart_marker = direct chart fact only when the Truth Packet explicitly gives that marker or structure.");
    expect(promptPayload.userPrompt).toContain('"provenance": "compatibility_profile"');
    expect(promptPayload.userPrompt).toContain('"loveCompatibilityProfile"');
  });

  test("health runtime path keeps direct but non-diagnostic caution in the final Gemini payload", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "health",
      requiresBaziConsult: true,
      confidence: 0.94,
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
      messages: [{ role: "user", content: "ช่วงอายุนี้สุขภาพต้องระวังอะไรบ้าง" }],
    }));

    await consumeStream(response);

    const promptPayload = await buildPromptPayloadFromGeminiRouteCall();

    expect(promptPayload.userPrompt).toContain("Primary requested domain: health. Stay inside this domain unless the user explicitly asks to compare another domain");
    expect(promptPayload.userPrompt).toContain("Health response contract: answer directly with practical cautions and self-care guidance when the Truth Packet supports it; do not diagnose disease, do not claim certainty, and do not refuse only because the topic is health.");
  });

  test("persisted profile fields merge before calculation and persist the merged result", async () => {
    findByClerkUserIdMock.mockResolvedValue({
      clerkUserId: "clerk-123",
      lineUserId: null,
      fields: {
        birthDate: null,
        birthTime: null,
        gender: "หญิง",
        province: "กรุงเทพ",
      },
      isProfileComplete: false,
    });
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "wealth",
      requiresBaziConsult: true,
      confidence: 0.97,
    });
    extractOpenWebUiBaziContextMock.mockImplementation(async (_input, options) => ({
      fields: {
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: options?.existing?.gender ?? null,
        province: options?.existing?.province ?? null,
      },
      missingFields: [],
      isComplete: true,
      rawInput: {
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: options?.existing?.gender ?? "หญิง",
        province: options?.existing?.province ?? "กรุงเทพ",
      },
    }));
    calculateBaziStateFromRawInputMock.mockResolvedValue(SAMPLE_CALCULATED_STATE);
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "พยากรณ์เสร็จค่ะ",
    });

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-123" },
      messages: [{ role: "user", content: "เกิด 3 ม.ค. 2532 เวลา 08:45" }],
    }));

    await consumeStream(response);

    expect(extractOpenWebUiBaziContextMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        existing: {
          birthDate: null,
          birthTime: null,
          gender: "หญิง",
          province: "กรุงเทพ",
        },
      }),
    );
    expect(calculateBaziStateFromRawInputMock).toHaveBeenCalledWith({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "หญิง",
      province: "กรุงเทพ",
    });
    expect(upsertPartialByClerkUserIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-123",
      fields: {
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: "หญิง",
        province: "กรุงเทพ",
      },
    });
  });

  test("partial extraction persists by forwarded user id without crashing the missing-fields path", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.9,
    });
    extractOpenWebUiBaziContextMock.mockResolvedValue({
      fields: {
        birthDate: "1989-01-03",
        birthTime: null,
        gender: "ชาย",
        province: null,
      },
      missingFields: ["birthTime", "province"],
      isComplete: false,
      rawInput: null,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "ขอข้อมูลเพิ่มหน่อยค่ะ",
    });

    const response = await POST(buildJsonRequestWithHeaders(
      {
        messages: [{ role: "user", content: "เกิด 3 ม.ค. 2532 ผู้ชาย" }],
      },
      { "x-openwebui-user-id": "forwarded-user-1" },
    ));

    await consumeStream(response);

    expect(calculateBaziStateFromRawInputMock).not.toHaveBeenCalled();
    expect(upsertPartialByClerkUserIdMock).toHaveBeenCalledWith({
      clerkUserId: "forwarded-user-1",
      fields: {
        birthDate: "1989-01-03",
        birthTime: null,
        gender: "ชาย",
        province: null,
      },
    });

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.baziMissingFields).toEqual(["birthTime", "province"]);
    expectOperationalEvent("request_context", {
      userIdentitySource: "forwarded_header",
      hasThreadId: false,
      threadPersistenceEligible: false,
    });
    expectOperationalEvent("finalized_turn_nonpersistent", {
      reason: "missing_thread_id",
      userIdentitySource: "forwarded_header",
      continuityDisposition: "stateless",
    });
  });

  test("thread-scoped episodic memory hydrates only from the matching chat id", async () => {
    findByClerkUserIdAndThreadIdMock.mockResolvedValue({
      clerkUserId: "clerk-123",
      threadId: "chat-thread-1",
      contextSummary: "ผู้ใช้บอกวันเกิดครบแล้ว เหลือถามต่อเรื่องงาน",
      continuityState: {
        profileFingerprint: "1989-01-03::08:45::ชาย::จันทบุรี",
        profileFields: {
          birthDate: "1989-01-03",
          birthTime: "08:45",
          gender: "ชาย",
          province: "จันทบุรี",
        },
        activeScope: {
          requestedDomain: "career",
          currentAgeWindow: {
            startAge: 42,
            endAge: 46,
            currentPhase: "upper",
            label: "42-46",
          },
        },
      },
      messages: [
        { role: "user", content: "เกิด 3 ม.ค. 2532 เวลา 08:45" },
        { role: "assistant", content: "ได้ค่ะ จำข้อมูลพื้นฐานไว้แล้ว" },
      ],
    });
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.45,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "ต่อเนื่องจากแชตเดิมค่ะ",
    });

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-123" },
      chat_id: "chat-thread-1",
      messages: [{ role: "user", content: "ถามต่อเรื่องงาน" }],
    }));

    await consumeStream(response);

    expect(findByClerkUserIdAndThreadIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-123",
      threadId: "chat-thread-1",
    });

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.episodicMemory).toEqual({
      contextSummary: "ผู้ใช้บอกวันเกิดครบแล้ว เหลือถามต่อเรื่องงาน",
      activeScope: {
        requestedDomain: "career",
        currentAgeWindow: {
          startAge: 42,
          endAge: 46,
          currentPhase: "upper",
          label: "42-46",
        },
      },
      messages: [
        { role: "user", content: "เกิด 3 ม.ค. 2532 เวลา 08:45" },
        { role: "assistant", content: "ได้ค่ะ จำข้อมูลพื้นฐานไว้แล้ว" },
      ],
    });
    expect(appendFinalizedTurnByClerkUserIdAndThreadIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-123",
      threadId: "chat-thread-1",
      userMessage: "ถามต่อเรื่องงาน",
      assistantReply: "ต่อเนื่องจากแชตเดิมค่ะ",
    });
  });

  test("changed-profile turns fail closed and rebuild continuity instead of hydrating stale thread state", async () => {
    findByClerkUserIdAndThreadIdMock.mockResolvedValue({
      clerkUserId: "clerk-222",
      threadId: "chat-thread-2",
      contextSummary: "โปรไฟล์เก่าเรื่องงาน",
      continuityState: {
        profileFingerprint: "1992-08-12::09:15::female::Bangkok",
        profileFields: {
          birthDate: "1992-08-12",
          birthTime: "09:15",
          gender: "female",
          province: "Bangkok",
        },
        activeScope: {
          requestedDomain: "career",
          currentAgeWindow: {
            startAge: 42,
            endAge: 46,
            currentPhase: "upper",
            label: "42-46",
          },
        },
      },
      messages: [
        { role: "user", content: "โปรไฟล์เดิม" },
        { role: "assistant", content: "สรุปเรื่องงานจากโปรไฟล์เดิม" },
      ],
    });
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "career",
      requiresBaziConsult: true,
      confidence: 0.94,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "รับโปรไฟล์ใหม่แล้วค่ะ",
    });

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-222" },
      chat_id: "chat-thread-2",
      messages: [
        { role: "user", content: "เกิด 3 ม.ค. 2532 เวลา 08:45 จันทบุรี ผู้ชาย" },
      ],
      baziConsult: {
        rawInput: {
          birthDate: "1989-01-03",
          birthTime: "08:45",
          gender: "ชาย",
          province: "จันทบุรี",
          calendarSystem: "solar",
          timezone: "Asia/Bangkok",
        },
        calculatedState: SAMPLE_CALCULATED_STATE,
      },
    }));

    await consumeStream(response);

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.episodicMemory).toBeUndefined();
    expect(appendFinalizedTurnByClerkUserIdAndThreadIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-222",
      threadId: "chat-thread-2",
      userMessage: "เกิด 3 ม.ค. 2532 เวลา 08:45 จันทบุรี ผู้ชาย",
      assistantReply: "รับโปรไฟล์ใหม่แล้วค่ะ",
      resetThreadState: true,
      continuityState: {
        profileFingerprint: "1989-01-03::08:45::ชาย::จันทบุรี",
        profileFields: {
          birthDate: "1989-01-03",
          birthTime: "08:45",
          gender: "ชาย",
          province: "จันทบุรี",
        },
        activeScope: {
          requestedDomain: "career",
          currentAgeWindow: {
            startAge: 35,
            endAge: 39,
            currentPhase: "upper",
            label: "35-39",
          },
        },
      },
    });
    expectOperationalEvent("continuity_plan", {
      continuityDisposition: "reset_profile_conflict",
      activeScopeRequestedDomain: "career",
    });
    expectOperationalEvent("finalized_turn_recorded", {
      persistenceOutcome: "assistant_reply_persisted",
      skipReason: null,
      continuityDisposition: "reset_profile_conflict",
      resetThreadState: true,
    });
  });

  test("missing thread identity fails closed to fresh-thread behavior", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.5,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "เริ่มคุยใหม่ได้ค่ะ",
    });

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-456" },
      messages: [{ role: "user", content: "ทักอีกครั้ง" }],
    }));

    await consumeStream(response);

    expect(findByClerkUserIdAndThreadIdMock).not.toHaveBeenCalled();
    expect(appendFinalizedTurnByClerkUserIdAndThreadIdMock).not.toHaveBeenCalled();

    const executionContext = generateGeminiAssistantReplyMock.mock.calls[0][1].executionContext;
    expect(executionContext.episodicMemory).toBeUndefined();
    expectOperationalEvent("finalized_turn_nonpersistent", {
      reason: "missing_thread_id",
      userIdentitySource: "payload_user",
      continuityDisposition: "stateless",
    });
  });

  test("episodic write failure does not break the visible SSE response path", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.45,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: "ยังตอบผู้ใช้ได้ตามปกติค่ะ",
    });
    appendFinalizedTurnByClerkUserIdAndThreadIdMock.mockRejectedValue(
      new Error("db write failed"),
    );

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-789" },
      chat_id: "chat-thread-9",
      messages: [{ role: "user", content: "ถามต่อค่ะ" }],
    }));

    const body = await consumeStream(response);
    const reconstructedContent = reconstructSseContent(body);

    expect(reconstructedContent).toBe("ยังตอบผู้ใช้ได้ตามปกติค่ะ");
    expect(body).toContain("[DONE]");
    expect(appendFinalizedTurnByClerkUserIdAndThreadIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-789",
      threadId: "chat-thread-9",
      userMessage: "ถามต่อค่ะ",
      assistantReply: "ยังตอบผู้ใช้ได้ตามปกติค่ะ",
    });
  });

  test("fallback-only stream output records an explicit skip reason instead of failing silently", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.45,
    });
    generateGeminiAssistantReplyMock.mockRejectedValue(
      new Error("Gemini exploded"),
    );

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-321" },
      chat_id: "chat-thread-4",
      messages: [{ role: "user", content: "ยังอยู่ไหม" }],
    }));

    const body = await consumeStream(response);
    const reconstructedContent = reconstructSseContent(body);

    expect(reconstructedContent).toBe("ขออภัยค่ะ ตอนนี้การเชื่อมต่อ Gemini ใช้เวลานานหรือมีปัญหา กรุณาลองใหม่อีกครั้ง");
    expect(body).toContain("[DONE]");
    expect(appendFinalizedTurnByClerkUserIdAndThreadIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-321",
      threadId: "chat-thread-4",
      userMessage: "ยังอยู่ไหม",
      skipReason: "fallback_response",
    });
    expectOperationalEvent("finalized_turn_recorded", {
      persistenceOutcome: "skip_recorded",
      skipReason: "fallback_response",
      continuityDisposition: "preserve",
      resetThreadState: false,
    });
  });

  test("empty visible reply records an explicit skip reason instead of appending a blank assistant turn", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "chit_chat",
      requiresBaziConsult: false,
      confidence: 0.45,
    });
    generateGeminiAssistantReplyMock.mockResolvedValue({
      model: "gemini-2.5-flash",
      text: '<bazi_logic>{"trace":"internal"}</bazi_logic>',
    });

    const response = await POST(buildJsonRequest({
      user: { id: "clerk-654" },
      chat_id: "chat-thread-5",
      messages: [{ role: "user", content: "ช่วยต่อให้หน่อย" }],
    }));

    const body = await consumeStream(response);

    expect(body).toContain("[DONE]");
    expect(appendFinalizedTurnByClerkUserIdAndThreadIdMock).toHaveBeenCalledWith({
      clerkUserId: "clerk-654",
      threadId: "chat-thread-5",
      userMessage: "ช่วยต่อให้หน่อย",
      skipReason: "empty_visible_reply",
    });
  });

  test("missing effective user id keeps the route non-persistent", async () => {
    routeOpenWebUiIntentMock.mockResolvedValue({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.9,
    });
    extractOpenWebUiBaziContextMock.mockResolvedValue({
      fields: {
        birthDate: "1989-01-03",
        birthTime: null,
        gender: null,
        province: null,
      },
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

    await consumeStream(response);

    expect(findByClerkUserIdMock).not.toHaveBeenCalled();
    expect(upsertPartialByClerkUserIdMock).not.toHaveBeenCalled();
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
    expect(truthPacket).toContain('"canonicalBucket": "relationship"');
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

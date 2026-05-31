import { describe, expect, test } from "vitest";

import {
  MAX_TRIAGE_TURNS,
  runChatPipeline,
  sliceMessagesForTriage,
  type NormalizedChatMessage,
} from "@/features/open-webui/chat-runner";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

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
  compatibilityMatrixProfiles: [],
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

describe("runChatPipeline", () => {
  test("extracts user.id, keeps normalized history, and marks the result stream-ready", () => {
    const result = runChatPipeline({
      user: {
        id: "open-webui-user-123",
      },
      messages: [
        { role: "system", content: "You are Bazi assistant." },
        { role: "user", content: "  อยากรู้ดวงการงาน  " },
        {
          role: "assistant",
          content: [
            { type: "text", text: "ได้เลย" },
            { type: "text", text: " ขอดูวันเกิดก่อนนะคะ " },
          ],
        },
        { role: "user", content: "เกิด 12/08/1992 เวลา 09:15" },
      ],
    });

    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Expected ready result.");
    }

    expect(result.userId).toBe("open-webui-user-123");
    expect(result.normalizedMessages).toEqual([
      { role: "system", content: "You are Bazi assistant." },
      { role: "user", content: "อยากรู้ดวงการงาน" },
      { role: "assistant", content: "ได้เลย\nขอดูวันเกิดก่อนนะคะ" },
      { role: "user", content: "เกิด 12/08/1992 เวลา 09:15" },
    ]);
    expect(result.triageMessages).toEqual([
      { role: "user", content: "อยากรู้ดวงการงาน" },
      { role: "assistant", content: "ได้เลย\nขอดูวันเกิดก่อนนะคะ" },
      { role: "user", content: "เกิด 12/08/1992 เวลา 09:15" },
    ]);
    expect(result.latestUserMessage).toEqual({
      role: "user",
      content: "เกิด 12/08/1992 เวลา 09:15",
    });
    expect(result.baziConsult).toBeNull();
    expect(result.streamPlan).toEqual({
      transport: "sse",
      status: "deferred",
    });
  });

  test("preserves attached Bazi consult context for downstream truth-packet selection", () => {
    const result = runChatPipeline({
      messages: [
        { role: "user", content: "ช่วยดูดวงการเงินให้หน่อย" },
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
    });

    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("Expected ready result.");
    }

    expect(result.baziConsult).toMatchObject({
      rawInput: {
        birthDate: "1992-08-12",
        province: "Bangkok",
      },
      calculatedState: {
        dayMaster: "己",
      },
    });
  });

  test("returns a safe error when messages are missing", () => {
    const result = runChatPipeline({ user: { id: "missing-messages" } });

    expect(result).toMatchObject({
      status: "error",
      phase: "phase-2",
      code: "invalid_payload",
    });
  });

  test("returns a safe error when there is no user message to triage", () => {
    const result = runChatPipeline({
      messages: [
        { role: "system", content: "system only" },
        { role: "assistant", content: "assistant only" },
      ],
    });

    expect(result).toEqual({
      status: "error",
      phase: "phase-2",
      code: "missing_user_message",
      message: "Chat payload must contain at least one user message.",
    });
  });
});

describe("sliceMessagesForTriage", () => {
  test("keeps only the latest two conversational turns", () => {
    const messages: NormalizedChatMessage[] = [
      { role: "system", content: "system" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
    ];

    expect(sliceMessagesForTriage(messages, MAX_TRIAGE_TURNS)).toEqual([
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
    ]);
  });
});
import { describe, expect, test, vi } from "vitest";

import { type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import {
  buildOpenWebUiGeminiPromptPayload,
  DEFAULT_OPEN_WEBUI_GEMINI_MODEL,
  generateGeminiAssistantReply,
  getOpenWebUiGeminiConfig,
  isCrisisMessage,
  isOtherChartRequest,
  wantsSpecificPersonLove,
  MUMATE_PERSONA_INSTRUCTION,
  type OpenWebUiGeminiExecutionContext,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";

const FIXED_NOW = new Date("2026-05-31T09:00:00+07:00");

const readyChatInput = {
  normalizedMessages: [
    { role: "system", content: "You are a practical Bazi guide." },
    { role: "user", content: "สวัสดีค่ะ" },
    { role: "assistant", content: "สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ" },
    { role: "user", content: "อยากรู้เรื่องงาน" },
  ] as NormalizedChatMessage[],
  triageMessages: [
    { role: "user", content: "สวัสดีค่ะ" },
    { role: "assistant", content: "สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ" },
    { role: "user", content: "อยากรู้เรื่องงาน" },
  ] as NormalizedChatMessage[],
  latestUserMessage: { role: "user" as const, content: "อยากรู้เรื่องงาน" },
};

const sampleExecutionContext: OpenWebUiGeminiExecutionContext = {
  intentClassification: {
    intent: "career",
    requiresBaziConsult: true,
    confidence: 0.91,
  },
  baziConsult: {
    rawInput: {
      birthDate: "1992-08-12",
      birthTime: "09:15",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    truthPacket: JSON.stringify({
      intent: "career",
      anchors: [{ key: "careerTenGodHighlights" }],
    }, null, 2),
  },
};

describe("wantsSpecificPersonLove (ความรักเจาะจงคน → ปิดท้ายด้วยไพ่)", () => {
  test("'คนนี้เค้าชอบเราไหม' → true", () => {
    expect(wantsSpecificPersonLove("คนนี้เค้าชอบเราไหม")).toBe(true);
  });
  test("'เขาจะกลับมาไหม' → true", () => {
    expect(wantsSpecificPersonLove("เขาจะกลับมาหาเราไหม")).toBe(true);
  });
  test("ความรักภาพรวม 'ดวงความรักเป็นยังไง' (ไม่เจาะจงคน) → false", () => {
    expect(wantsSpecificPersonLove("ดวงความรักปีนี้เป็นยังไง")).toBe(false);
  });
  test("ดวงคู่ + วันเกิดอีกฝ่าย (compatibility) → false", () => {
    expect(wantsSpecificPersonLove("เขาเกิด 2535 เข้ากันกับเราไหม")).toBe(false);
  });
});

describe("buildOpenWebUiGeminiPromptPayload — ปิดท้ายด้วยไพ่ (hasDrawnCardData)", () => {
  test("มี hasDrawnCardData → สั่งปิดท้ายด้วยไพ่ที่จั่วให้ และห้ามชวนไปเมนูเปิดไพ่", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      latestUserMessage: { role: "user", content: "คนนี้เค้าชอบเราไหม" },
      executionContext: {
        intentClassification: { intent: "love", requiresBaziConsult: true, confidence: 0.9 },
        topicId: "love_partner",
        baziConsult: {
          rawInput: {
            birthDate: "1995-06-15", birthTime: "14:30", gender: "female",
            province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
          },
          truthPacket: "ความรักภาพรวม...\n\n[ไพ่เสี่ยงทายปิดท้าย] ไพ่ที่จั่วได้: #1 ...",
        },
        hasDrawnCardData: true,
      },
    });
    expect(payload.userPrompt).toContain("ปิดท้าย");
    expect(payload.userPrompt).toContain("ไพ่เสี่ยงทาย");
    expect(payload.userPrompt).toContain("ห้ามชวน");
  });
});

describe("buildOpenWebUiGeminiPromptPayload — ตอบจากไพ่เซียมซีเคี้ยงคุง (hasCardReadingData)", () => {
  test("ดวงตอบไม่ได้ → ตอบจากไพ่ที่จั่ว ห้ามขึ้นดวง ไม่ชวนไปเมนู และไม่มี bazi bypass ปน", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      latestUserMessage: { role: "user", content: "รถพี่มีสิ่งไม่ดีตามมาไหม" },
      executionContext: {
        intentClassification: { intent: "general_reading", requiresBaziConsult: false, confidence: 0.8 },
        topicId: "card_reading",
        cardReading: "ไพ่ที่จั่วได้: #9 เมฆบังพระจันทร์ — ความคลุมเครือ...\n\nสถานการณ์: ...",
        hasCardReadingData: true,
      },
    });
    expect(payload.userPrompt).toContain("ไพ่เซียมซีเคี้ยงคุง");
    expect(payload.userPrompt).toContain("เมฆบังพระจันทร์"); // ชื่อไพ่ยังอยู่ในก้อนข้อมูลจริงที่แนบ (สำหรับโมเดลอ่าน) — ไม่ใช่สิ่งที่สั่งให้พูดออกไป
    expect(payload.userPrompt).toContain("ห้ามขึ้นดวง");
    // ซินแสนุ้ย 2026-09-20: ต้องบอกว่า "เสี่ยงทาย" (บังคับ ไม่ใช่แค่ตัวเลือก) แต่ห้ามระบุว่าเป็น "ไพ่"
    // (แชทข้อความ บอกไพ่แล้วคนจะเอ๊ะว่ารู้ได้ไง). verified live 3/3 runs: มี "เสี่ยงทาย" ไม่มี "ไพ่" เลย
    expect(payload.userPrompt).toContain("ต้องเปิดคำตอบด้วยคำว่า \"เสี่ยงทาย\"");
    expect(payload.userPrompt).toContain("ห้ามบอกชื่อไพ่");
    expect(payload.userPrompt).toContain("ห้ามระบุว่าเป็น \"ไพ่\"");
    // ต้องไม่ปล่อยข้อความ non-bazi bypass มาสั่งให้ "ตอบปกติ" ทับโหมดไพ่
    expect(payload.userPrompt).not.toContain("does not require Bazi chart analysis");
  });
});

describe("buildOpenWebUiGeminiPromptPayload — โหมดเสี่ยงทายประจำวัน (dailyFortuneTone)", () => {
  test("ดวงมีกรอบเวลา (วันนี้) → สั่งตอบตรง ๆ เหมือนเสี่ยงทายประจำวัน", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      latestUserMessage: { role: "user", content: "วันนี้ดวงเป็นยังไง" },
      executionContext: {
        ...sampleExecutionContext,
        topicId: "turning_points",
        timeframe: "today",
      },
    });
    expect(payload.userPrompt).toContain("เสี่ยงทายประจำวัน");
  });

  test("คำถามไม่มีกรอบเวลา (none) → ไม่ใส่โหมดเสี่ยงทายประจำวัน", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        ...sampleExecutionContext,
        topicId: "career_potential",
        timeframe: "none",
      },
    });
    expect(payload.userPrompt).not.toContain("โหมดเสี่ยงทายประจำวัน");
  });
});

describe("getOpenWebUiGeminiConfig", () => {
  test("uses the default Open WebUI Gemini model when no model override is provided", () => {
    expect(getOpenWebUiGeminiConfig({ GEMINI_API_KEY: "gemini_test_demo" })).toEqual({
      apiKey: "gemini_test_demo",
      model: DEFAULT_OPEN_WEBUI_GEMINI_MODEL,
    });
  });

  test("fails fast with a named config error when the Gemini API key is missing", () => {
    expect(() => getOpenWebUiGeminiConfig({})).toThrowError(
      expect.objectContaining<Partial<OpenWebUiGeminiError>>({
        code: "gemini_config_error",
      }),
    );
  });
});

describe("buildOpenWebUiGeminiPromptPayload", () => {
  test("maps the triage transcript into a minimal Gemini prompt payload", () => {
    const payload = buildOpenWebUiGeminiPromptPayload(readyChatInput);

    expect(payload.systemInstruction).toContain(MUMATE_PERSONA_INSTRUCTION);
    expect(payload.systemInstruction).toContain("You are a practical Bazi guide.");
    expect(payload.userPrompt).toContain("User: สวัสดีค่ะ");
    expect(payload.userPrompt).toContain("Assistant: สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ");
    expect(payload.userPrompt).toContain("Latest user message: อยากรู้เรื่องงาน");
  });

  test("prepends the mumate persona instruction into the system instruction", () => {
    const payload = buildOpenWebUiGeminiPromptPayload(readyChatInput);

    expect(payload.systemInstruction).toContain(MUMATE_PERSONA_INSTRUCTION);
    expect(payload.systemInstruction.startsWith(MUMATE_PERSONA_INSTRUCTION)).toBe(true);
  });

  test("v2 anchored-expert: persona locks chart facts to the engine but frees the ซินแส voice", () => {
    // Drift is fenced by STRUCTURE (engine = the only source of chart facts), not by fear-framing.
    // v1's closed-book "no Bazi knowledge of my own" + temp 0.2 made answers แข็งกระด้าง; v2 restores
    // identity-first warmth while keeping the fact-lock and the self-analysis ban.
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("อบอุ่น");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("วิธีพูด");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ผลวินิจฉัยจาก engine");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("แหล่งความจริงเดียว");
    // fear-framing removed — this was the root of the stiffness
    expect(MUMATE_PERSONA_INSTRUCTION).not.toContain("ไม่มีความรู้ปาจื่อเป็นของตัวเอง");
    // self-analysis steps still gone (no regress to the original drift bug)
    expect(MUMATE_PERSONA_INSTRUCTION).not.toContain("กระบวนการวิเคราะห์");
    expect(MUMATE_PERSONA_INSTRUCTION).not.toContain("วินิจฉัยด้วย 12 เซิงแซ");
    // verdict voice preserved (no regress to "summarize the reading")
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ฟันธงตรงประเด็น");
  });

  test("injects the fixed system clock line so time grounding is deterministic", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({ ...readyChatInput, now: FIXED_NOW });

    expect(payload.userPrompt).toContain("[เวลาปัจจุบันของระบบ]");
    expect(payload.userPrompt).toContain("ISO: 2026-05-31");
  });

  test("injects the routed intent summary when the phase 7 router already classified the request", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: sampleExecutionContext,
    });

    expect(payload.userPrompt).toContain("Routing: topic=career; timeframe=none; requiresBaziConsult=true; confidence=0.91.");
    expect(payload.userPrompt).toContain("Consult mode: bazi_consult.");
    expect(payload.userPrompt).toContain("ข้อมูลวันเกิดที่ยืนยันแล้ว:");
    expect(payload.userPrompt).toContain("ผลวินิจฉัยจาก engine");
    expect(payload.userPrompt).toContain("วิธีตอบแบบซินแส");
    expect(payload.userPrompt).toContain("ฟันธงตอบคำถามตรงๆ");
    // anti-drift v2: chart facts must come from the engine block, but the explaining voice stays free
    expect(payload.userPrompt).toContain("ต้องมาจากผลวินิจฉัยด้านบน ห้ามแต่งใหม่");
    expect(payload.userPrompt).toContain("ส่วนวิธีอธิบาย ความอบอุ่น อุปมา พูดได้เต็มที่");
    expect(payload.userPrompt).toContain('"careerTenGodHighlights"');
  });

  test("marks non-Bazi traffic as bypassed and excludes chart context", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        intentClassification: {
          intent: "chit_chat",
          requiresBaziConsult: false,
          confidence: 0.23,
        },
        baziConsult: {
          rawInput: {
            birthDate: "1992-08-12",
            birthTime: "09:15",
            gender: "female",
            province: "Bangkok",
            calendarSystem: "solar",
            timezone: "Asia/Bangkok",
          },
          truthPacket: null,
        },
      },
    });

    expect(payload.userPrompt).toContain("Consult mode: non_bazi_bypass.");
    expect(payload.userPrompt).toContain("This request does not require Bazi chart analysis.");
    expect(payload.userPrompt).not.toContain("Truth packet:");
  });

  test("preserves earlier user turns so phase 5 browser truth can verify short-term recall", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [
        { role: "system", content: "You are a practical Bazi guide." },
        { role: "user", content: "Remember that my favorite fruit is mango." },
        { role: "assistant", content: "I will remember that your favorite fruit is mango." },
        { role: "user", content: "Please explain how memory works in this chat." },
        { role: "assistant", content: "I rely on the messages included in the prompt I receive." },
        { role: "user", content: "What fruit did I say was my favorite?" },
      ],
      triageMessages: [
        { role: "user", content: "Please explain how memory works in this chat." },
        { role: "assistant", content: "I rely on the messages included in the prompt I receive." },
        { role: "user", content: "What fruit did I say was my favorite?" },
      ],
      latestUserMessage: { role: "user", content: "What fruit did I say was my favorite?" },
    });

    expect(payload.userPrompt).toContain("User: Remember that my favorite fruit is mango.");
    expect(payload.userPrompt).toContain("Assistant: I will remember that your favorite fruit is mango.");
  });
});

describe("buildOpenWebUiGeminiPromptPayload — Phase 3 verdict + token discipline", () => {
  test("off_topic redirects to sibling tools instead of a dead refusal", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        intentClassification: { intent: "chit_chat", requiresBaziConsult: false, confidence: 0.3 },
        topicId: "off_topic",
        timeframe: "none",
        baziConsult: null,
      },
    });

    expect(payload.userPrompt).toContain("Consult mode: off_topic_refusal.");
    // No longer a flat "ช่วยไม่ได้" refusal — it routes to the app's other tools.
    expect(payload.userPrompt).toContain("เปิดไพ่");
    expect(payload.userPrompt).toContain("เบอร์มงคล");
    expect(payload.userPrompt).toContain("ห้ามปฏิเสธแบบตัดจบ");
    expect(payload.userPrompt).not.toContain("This request does not require Bazi chart analysis.");
  });

  test("same-day questions get the honest period-reframe instruction (no 流日 fabrication)", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        intentClassification: { intent: "wealth", requiresBaziConsult: true, confidence: 0.8 },
        topicId: "wealth_and_investment",
        timeframe: "today",
        baziConsult: {
          rawInput: sampleExecutionContext.baziConsult!.rawInput,
          truthPacket: sampleExecutionContext.baziConsult!.truthPacket,
        },
      },
    });

    expect(payload.userPrompt).toContain("ความแม่นเรื่องเวลา");
    expect(payload.userPrompt).toContain("ห้ามรับปากความแม่นรายวัน");
    // Depth: layers วัยจร → ปีจร → เดือนจร instead of stopping at the life-stage.
    expect(payload.userPrompt).toContain("เดือนจร");
  });

  test("a year-level question does NOT trigger the same-day reframe", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        intentClassification: { intent: "wealth", requiresBaziConsult: true, confidence: 0.8 },
        topicId: "wealth_and_investment",
        timeframe: "next_year",
        baziConsult: {
          rawInput: sampleExecutionContext.baziConsult!.rawInput,
          truthPacket: sampleExecutionContext.baziConsult!.truthPacket,
        },
      },
    });

    expect(payload.userPrompt).not.toContain("ความแม่นเรื่องเวลา");
  });

  test("caps replayed history to the most recent turns", () => {
    const many = Array.from({ length: 14 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg-${index}`,
    }));
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [{ role: "system", content: "guide" }, ...many],
      triageMessages: many.slice(-3),
      latestUserMessage: { role: "user", content: "msg-12" },
    });

    // last 8 kept (msg-6..msg-13); older dropped.
    expect(payload.userPrompt).toContain("msg-13");
    expect(payload.userPrompt).toContain("msg-6");
    expect(payload.userPrompt).not.toContain("msg-0");
    expect(payload.userPrompt).not.toContain("msg-5");
  });

  test("truncates an over-long grounded reading before injecting it", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        intentClassification: { intent: "wealth", requiresBaziConsult: true, confidence: 0.9 },
        topicId: "wealth_and_investment",
        timeframe: "none",
        baziConsult: {
          rawInput: sampleExecutionContext.baziConsult!.rawInput,
          truthPacket: "ก".repeat(5000),
        },
      },
    });

    expect(payload.userPrompt).toContain("ตัดเพื่อความกระชับ");
    expect(payload.userPrompt.length).toBeLessThan(5000);
  });
});

describe("generateGeminiAssistantReply", () => {
  test("returns a non-empty assistant payload from the Gemini adapter", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: "ภาพรวมการงานปีนี้ดีขึ้นจากเดิมค่ะ",
      usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 50 },
    });

    await expect(generateGeminiAssistantReply(readyChatInput, {
      env: {
        GEMINI_API_KEY: "gemini_test_demo",
        OPEN_WEBUI_GEMINI_MODEL: "gemini-2.5-flash-lite",
      },
      generateContent,
      executionContext: sampleExecutionContext,
    })).resolves.toEqual({
      model: "gemini-2.5-flash-lite",
      text: "ภาพรวมการงานปีนี้ดีขึ้นจากเดิมค่ะ",
      // thinking tokens รวมใน outTokens (300 + 50)
      usage: { inTokens: 1200, outTokens: 350 },
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash-lite",
      contents: expect.stringContaining("Routing: topic=career; timeframe=none; requiresBaziConsult=true; confidence=0.91."),
      config: expect.objectContaining({
        systemInstruction: expect.stringContaining("You are a practical Bazi guide."),
        temperature: 0.6,
        topP: 0.95,
        maxOutputTokens: 512,
      }),
    });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      contents: expect.stringContaining("Consult mode: bazi_consult."),
    }));
  });

  test("wraps upstream failures with a named Gemini error path", async () => {
    await expect(generateGeminiAssistantReply(readyChatInput, {
      env: {
        GEMINI_API_KEY: "gemini_test_demo",
      },
      generateContent: vi.fn().mockRejectedValue(new Error("upstream 503")),
    })).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiGeminiError>>({
        code: "gemini_upstream_error",
        message: "upstream 503",
      }),
    );
  });
});
describe("persona (เสี่ยวมู่/เสี่ยวมี่)", () => {
  test("mu → เสี่ยวมู่ + คำลงท้ายผู้ชาย", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({ ...readyChatInput, persona: "mu" });
    expect(payload.systemInstruction).toContain("เสี่ยวมู่");
    expect(payload.systemInstruction).toContain("ครับ/นะครับ");
  });
  test("mi → เสี่ยวมี่ + คำลงท้ายผู้หญิง", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({ ...readyChatInput, persona: "mi" });
    expect(payload.systemInstruction).toContain("เสี่ยวมี่");
    expect(payload.systemInstruction).toContain("ค่ะ/นะคะ");
    expect(payload.systemInstruction).not.toContain("เสี่ยวมู่");
  });
  test("ไม่ระบุ persona → default เสี่ยวมู่", () => {
    const payload = buildOpenWebUiGeminiPromptPayload(readyChatInput);
    expect(payload.systemInstruction).toContain("เสี่ยวมู่");
  });
});

describe("crisis / self-harm safety guard", () => {
  test("isCrisisMessage detects distress signals", () => {
    expect(isCrisisMessage("ชีวิตผมแย่มาก ควรจบๆมันไป")).toBe(true);
    expect(isCrisisMessage("ไม่อยากมีชีวิตอยู่แล้ว")).toBe(true);
    expect(isCrisisMessage("อยากตาย")).toBe(true);
    expect(isCrisisMessage("ปีนี้จะมีแฟนไหม")).toBe(false);
  });

  test("a crisis message forces the helpline directive and drops day-precision", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [{ role: "user", content: "ชีวิตผมแย่มาก ควรจบๆมันไป" }] as NormalizedChatMessage[],
      triageMessages: [{ role: "user", content: "ชีวิตผมแย่มาก ควรจบๆมันไป" }] as NormalizedChatMessage[],
      latestUserMessage: { role: "user", content: "ชีวิตผมแย่มาก ควรจบๆมันไป" },
      executionContext: {
        intentClassification: { intent: "general_reading", requiresBaziConsult: true, confidence: 0.8 },
        topicId: "turning_points",
        timeframe: "this_month",
        hasDailyGoodDayData: true, // even with calendar data attached, crisis must suppress it
        baziConsult: null,
      },
    });

    expect(payload.userPrompt).toContain("ภาวะเปราะบาง");
    expect(payload.userPrompt).toContain("1323");
    // day/period precision instructions must NOT fire during a crisis
    expect(payload.userPrompt).not.toContain("ฟันธงเจาะจงถึง");
    expect(payload.userPrompt).not.toContain("ความแม่นเรื่องเวลา");
  });
});

describe("chartFacts injection (marriage/children answerable from real pillars)", () => {
  test("injects the chart-facts summary into the consult prompt when present", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        ...sampleExecutionContext,
        chartFacts: "ผังดวงจริง (อ้างหลักวิชาได้ ห้ามกุเสาใหม่):\n- เสาสี่: ปี 戊辰 · เดือน 甲子 · วัน 癸? · ยาม 丙辰",
      },
    });
    expect(payload.userPrompt).toContain("ผังดวงจริง");
    expect(payload.userPrompt).toContain("丙辰");
  });

  test("omits chart-facts cleanly when not provided (no stray 'null')", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: sampleExecutionContext,
    });
    expect(payload.userPrompt).not.toContain("ผังดวงจริง");
    expect(payload.userPrompt).not.toContain("\nnull\n");
  });
});


describe("compatibility / other-person chart guard", () => {
  test("isOtherChartRequest fires only when a partner birth-year is given with a compat keyword", () => {
    expect(isOtherChartRequest("แฟนเกิด 2535 เข้ากันไหม")).toBe(true);
    expect(isOtherChartRequest("ดวงสมพงศ์เราสองคน แฟนเกิดปี 1992")).toBe(true);
    expect(isOtherChartRequest("เนื้อคู่ฉันเป็นคนแบบไหน")).toBe(false); // own chart, no other DOB
    expect(isOtherChartRequest("เข้ากันไหม")).toBe(false); // no birth year
  });

  test("an other-chart request injects the no-fabrication directive + ดูดวงคู่รัก redirect", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [{ role: "user", content: "แฟนเกิด 5 พ.ค. 2535 เข้ากันไหม" }] as NormalizedChatMessage[],
      triageMessages: [{ role: "user", content: "แฟนเกิด 5 พ.ค. 2535 เข้ากันไหม" }] as NormalizedChatMessage[],
      latestUserMessage: { role: "user", content: "แฟนเกิด 5 พ.ค. 2535 เข้ากันไหม" },
      executionContext: sampleExecutionContext,
    });
    expect(payload.userPrompt).toContain("ห้ามอ่าน วิเคราะห์ บรรยาย หรือกุดวง");
    expect(payload.userPrompt).toContain("ดูดวงคู่รัก");
  });
});

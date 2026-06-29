import { describe, expect, test, vi } from "vitest";

import { type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import {
  buildOpenWebUiGeminiPromptPayload,
  DEFAULT_OPEN_WEBUI_GEMINI_MODEL,
  generateGeminiAssistantReply,
  getOpenWebUiGeminiConfig,
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

  test("L1 anti-drift: persona casts the model as the engine's mouthpiece, not its own Bazi analyst", () => {
    // The model must relay the engine's verdict, never run its own Bazi analysis (which would
    // pull from its training priors). Closed-book contract present; self-analysis steps gone.
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ปากเสียงของซินแส");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ไม่มีความรู้ปาจื่อเป็นของตัวเอง");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ผลวินิจฉัยจาก engine");
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
    // anti-drift L2: every Bazi fact must trace back to the engine verdict block
    expect(payload.userPrompt).toContain("ต้องสืบกลับไปยังผลวินิจฉัยด้านบนได้ทุกคำ");
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
  test("off_topic routes a polite refusal, not a normal answer", () => {
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
    expect(payload.userPrompt).toContain("ไม่เกี่ยวกับการดูดวง");
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
    expect(payload.userPrompt).toContain("ห้ามรับปากความแม่นระดับวัน");
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
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash-lite",
      contents: expect.stringContaining("Routing: topic=career; timeframe=none; requiresBaziConsult=true; confidence=0.91."),
      config: expect.objectContaining({
        systemInstruction: expect.stringContaining("You are a practical Bazi guide."),
        temperature: 0.2,
        topP: 0.9,
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
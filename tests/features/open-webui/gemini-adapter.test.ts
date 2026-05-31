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

    expect(payload.userPrompt).toContain("Intent routing: intent=career; requiresBaziConsult=true; confidence=0.91.");
    expect(payload.userPrompt).toContain("Consult mode: bazi_consult.");
    expect(payload.userPrompt).toContain("Verified Bazi consult context:");
    expect(payload.userPrompt).toContain("Truth packet:");
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
      contents: expect.stringContaining("Intent routing: intent=career; requiresBaziConsult=true; confidence=0.91."),
      config: expect.objectContaining({
        systemInstruction: expect.stringContaining("You are a practical Bazi guide."),
        temperature: 0.4,
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
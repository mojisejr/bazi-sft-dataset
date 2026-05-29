import { describe, expect, test, vi } from "vitest";

import {
  buildOpenWebUiGeminiPromptPayload,
  DEFAULT_OPEN_WEBUI_GEMINI_MODEL,
  generateGeminiAssistantReply,
  getOpenWebUiGeminiConfig,
  OpenWebUiGeminiError,
} from "@/features/open-webui/gemini-adapter";

const readyChatInput = {
  normalizedMessages: [
    { role: "system", content: "You are a practical Bazi guide." },
    { role: "user", content: "สวัสดีค่ะ" },
    { role: "assistant", content: "สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ" },
    { role: "user", content: "อยากรู้เรื่องงาน" },
  ] as const,
  triageMessages: [
    { role: "user", content: "สวัสดีค่ะ" },
    { role: "assistant", content: "สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ" },
    { role: "user", content: "อยากรู้เรื่องงาน" },
  ] as const,
  latestUserMessage: { role: "user", content: "อยากรู้เรื่องงาน" } as const,
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

    expect(payload.systemInstruction).toBe("You are a practical Bazi guide.");
    expect(payload.userPrompt).toContain("User: สวัสดีค่ะ");
    expect(payload.userPrompt).toContain("Assistant: สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ");
    expect(payload.userPrompt).toContain("Latest user message: อยากรู้เรื่องงาน");
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
    })).resolves.toEqual({
      model: "gemini-2.5-flash-lite",
      text: "ภาพรวมการงานปีนี้ดีขึ้นจากเดิมค่ะ",
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash-lite",
      contents: expect.stringContaining("Latest user message: อยากรู้เรื่องงาน"),
      config: {
        systemInstruction: "You are a practical Bazi guide.",
        temperature: 0.4,
      },
    });
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
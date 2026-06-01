import { describe, expect, test, vi } from "vitest";

import { type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import {
  buildOpenWebUiIntentPromptPayload,
  DEFAULT_OPEN_WEBUI_INTENT_MODEL,
  getOpenWebUiIntentRouterConfig,
  OpenWebUiIntentRouterError,
  routeOpenWebUiIntent,
} from "@/features/open-webui/intent-router";

const readyIntentInput = {
  triageMessages: [
    { role: "user", content: "สวัสดีค่ะ" },
    { role: "assistant", content: "สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ" },
    { role: "user", content: "ปีนี้ความรักจะเป็นยังไง" },
  ] as NormalizedChatMessage[],
  latestUserMessage: { role: "user" as const, content: "ปีนี้ความรักจะเป็นยังไง" },
};

describe("getOpenWebUiIntentRouterConfig", () => {
  test("uses the default Gemini Flash model when no intent override is provided", () => {
    expect(getOpenWebUiIntentRouterConfig({ GEMINI_API_KEY: "gemini_test_demo" })).toEqual({
      apiKey: "gemini_test_demo",
      model: DEFAULT_OPEN_WEBUI_INTENT_MODEL,
    });
  });

  test("fails fast with a named config error when the Gemini API key is missing", () => {
    expect(() => getOpenWebUiIntentRouterConfig({})).toThrowError(
      expect.objectContaining<Partial<OpenWebUiIntentRouterError>>({
        code: "intent_router_config_error",
      }),
    );
  });
});

describe("buildOpenWebUiIntentPromptPayload", () => {
  test("builds a short triage transcript from the latest turns only", () => {
    const payload = buildOpenWebUiIntentPromptPayload(readyIntentInput);

    expect(payload.userPrompt).toContain("User: สวัสดีค่ะ");
    expect(payload.userPrompt).toContain("Assistant: สวัสดีค่ะ มีเรื่องไหนอยากดูเป็นพิเศษคะ");
    expect(payload.userPrompt).toContain("Latest user message: ปีนี้ความรักจะเป็นยังไง");
  });

  test("includes domain guidelines for future follow-up re-distillation", () => {
    const payload = buildOpenWebUiIntentPromptPayload(readyIntentInput);

    expect(payload.systemInstruction).toContain("Use wealth for money");
    expect(payload.systemInstruction).toContain("Use love for romance");
    expect(payload.systemInstruction).toContain("Use career for job");
    expect(payload.systemInstruction).toContain("Use health only when the user explicitly asks");
    expect(payload.systemInstruction).toContain("re-distill the chart dynamically");
  });
});

describe("routeOpenWebUiIntent", () => {
  test("returns a typed intent classification from the schema-constrained Gemini response", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        intent: "love",
        requiresBaziConsult: true,
        confidence: 0.94,
      }),
    });

    await expect(routeOpenWebUiIntent(readyIntentInput, {
      env: {
        GEMINI_API_KEY: "gemini_test_demo",
        OPEN_WEBUI_INTENT_MODEL: "gemini-2.5-flash-lite",
      },
      generateContent,
    })).resolves.toEqual({
      intent: "love",
      requiresBaziConsult: true,
      confidence: 0.94,
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash-lite",
      contents: expect.stringContaining("Latest user message: ปีนี้ความรักจะเป็นยังไง"),
      config: expect.objectContaining({
        responseMimeType: "application/json",
        temperature: 0,
      }),
    });
  });

  test("wraps invalid JSON with a named router error", async () => {
    await expect(routeOpenWebUiIntent(readyIntentInput, {
      env: {
        GEMINI_API_KEY: "gemini_test_demo",
      },
      generateContent: vi.fn().mockResolvedValue({
        text: "not-json",
      }),
    })).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiIntentRouterError>>({
        code: "intent_router_invalid_response",
      }),
    );
  });
});
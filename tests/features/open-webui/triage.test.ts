import { describe, expect, test, vi } from "vitest";

import { type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import {
  buildOpenWebUiTriagePromptPayload,
  DEFAULT_OPEN_WEBUI_TRIAGE_MODEL,
  getOpenWebUiTriageConfig,
  normalizeTriageDraft,
  OpenWebUiTriageError,
  runOpenWebUiTriage,
  TRIAGE_TOPIC_IDS,
  topicIdToDomain,
} from "@/features/open-webui/triage";

const colorInput = {
  triageMessages: [
    { role: "user", content: "สวัสดีค่ะ" },
    { role: "assistant", content: "สวัสดีค่ะ อยากดูเรื่องอะไรดีคะ" },
    { role: "user", content: "วันนี้ไปประชุมใส่เสื้อสีอะไรดี" },
  ] as NormalizedChatMessage[],
  latestUserMessage: { role: "user" as const, content: "วันนี้ไปประชุมใส่เสื้อสีอะไรดี" },
};

function draft(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    topicId: "colors_directions",
    requiresBaziConsult: true,
    timeframe: "today",
    confidence: 0.9,
    birthDate: null,
    birthTime: null,
    gender: null,
    province: null,
    ...overrides,
  });
}

describe("triage vocab", () => {
  test("exposes exactly the 15 engine predict topics for routing", () => {
    expect(TRIAGE_TOPIC_IDS).toContain("colors_directions");
    expect(TRIAGE_TOPIC_IDS).toContain("turning_points");
    expect(TRIAGE_TOPIC_IDS).toContain("wealth_and_investment");
    expect(TRIAGE_TOPIC_IDS).not.toContain("calculated_basis");
    expect(TRIAGE_TOPIC_IDS).toHaveLength(15);
  });

  test("collapses fine topics to the coarse truth-packet domain", () => {
    expect(topicIdToDomain("wealth_and_investment")).toBe("wealth");
    expect(topicIdToDomain("love_partner")).toBe("love");
    expect(topicIdToDomain("career_potential")).toBe("career");
    expect(topicIdToDomain("health")).toBe("health");
    expect(topicIdToDomain("turning_points")).toBe("general_reading");
  });
});

describe("getOpenWebUiTriageConfig", () => {
  test("uses the default model when no override is provided", () => {
    expect(getOpenWebUiTriageConfig({ GEMINI_API_KEY: "gemini_test_demo" })).toEqual({
      apiKey: "gemini_test_demo",
      model: DEFAULT_OPEN_WEBUI_TRIAGE_MODEL,
    });
  });

  test("fails fast with a named config error when the key is missing", () => {
    expect(() => getOpenWebUiTriageConfig({})).toThrowError(
      expect.objectContaining<Partial<OpenWebUiTriageError>>({ code: "triage_config_error" }),
    );
  });
});

describe("buildOpenWebUiTriagePromptPayload", () => {
  test("carries the transcript, latest message, topic catalog, timeframe + birth rules", () => {
    const payload = buildOpenWebUiTriagePromptPayload(colorInput);

    expect(payload.userPrompt).toContain("User: สวัสดีค่ะ");
    expect(payload.userPrompt).toContain("Latest user message: วันนี้ไปประชุมใส่เสื้อสีอะไรดี");
    expect(payload.systemInstruction).toContain("colors_directions");
    expect(payload.systemInstruction).toContain("off_topic");
    expect(payload.systemInstruction).toContain("timeframe");
    expect(payload.systemInstruction).toContain("พ.ศ.");
  });
});

describe("normalizeTriageDraft", () => {
  test("coerces requiresBaziConsult=false for off_topic even when the model says true", () => {
    const result = normalizeTriageDraft({
      topicId: "off_topic",
      requiresBaziConsult: true,
      timeframe: "none",
      confidence: 0.4,
      birthDate: null,
      birthTime: null,
      gender: null,
      province: null,
    });

    expect(result.requiresBaziConsult).toBe(false);
    expect(result.classification.intent).toBe("chit_chat");
  });

  test("merges existing birth fields the user did not restate", () => {
    const result = normalizeTriageDraft(
      {
        topicId: "wealth_and_investment",
        requiresBaziConsult: true,
        timeframe: "next_year",
        confidence: 0.8,
        birthDate: null,
        birthTime: null,
        gender: "หญิง",
        province: null,
      },
      { birthDate: "1992-08-12", birthTime: "09:15", province: "Bangkok" },
    );

    expect(result.extraction.fields).toEqual({
      birthDate: "1992-08-12",
      birthTime: "09:15",
      gender: "หญิง",
      province: "Bangkok",
    });
    expect(result.extraction.isComplete).toBe(true);
    expect(result.extraction.rawInput).not.toBeNull();
    expect(result.requiresBaziConsult).toBe(true);
    expect(result.classification.intent).toBe("wealth");
  });
});

describe("runOpenWebUiTriage", () => {
  test("routes a color question to colors_directions in ONE schema-constrained call", async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: draft() });

    const result = await runOpenWebUiTriage(colorInput, {
      env: { GEMINI_API_KEY: "gemini_test_demo", OPEN_WEBUI_TRIAGE_MODEL: "gemini-2.5-flash-lite" },
      generateContent,
    });

    expect(result.topicId).toBe("colors_directions");
    expect(result.timeframe).toBe("today");
    expect(result.requiresBaziConsult).toBe(true);
    expect(result.classification.intent).toBe("general_reading");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith({
      model: "gemini-2.5-flash-lite",
      contents: expect.stringContaining("Latest user message: วันนี้ไปประชุมใส่เสื้อสีอะไรดี"),
      config: expect.objectContaining({
        responseMimeType: "application/json",
        temperature: 0,
      }),
    });
  });

  test("routes a next-year money question to a wealth/timing topic with next_year timeframe", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: draft({ topicId: "wealth_and_investment", timeframe: "next_year" }),
    });

    const result = await runOpenWebUiTriage(
      {
        triageMessages: [{ role: "user", content: "ปีหน้าการเงินเป็นยังไง" }] as NormalizedChatMessage[],
        latestUserMessage: { role: "user", content: "ปีหน้าการเงินเป็นยังไง" },
      },
      { env: { GEMINI_API_KEY: "gemini_test_demo" }, generateContent },
    );

    expect(result.topicId).toBe("wealth_and_investment");
    expect(result.timeframe).toBe("next_year");
    expect(result.requiresBaziConsult).toBe(true);
  });

  test("off-topic coding request refuses consult", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: draft({ topicId: "off_topic", requiresBaziConsult: false, timeframe: "none" }),
    });

    const result = await runOpenWebUiTriage(
      {
        triageMessages: [{ role: "user", content: "ช่วยเขียนโค้ด python ให้หน่อย" }] as NormalizedChatMessage[],
        latestUserMessage: { role: "user", content: "ช่วยเขียนโค้ด python ให้หน่อย" },
      },
      { env: { GEMINI_API_KEY: "gemini_test_demo" }, generateContent },
    );

    expect(result.topicId).toBe("off_topic");
    expect(result.requiresBaziConsult).toBe(false);
  });

  test("wraps invalid JSON with a named triage error", async () => {
    await expect(
      runOpenWebUiTriage(colorInput, {
        env: { GEMINI_API_KEY: "gemini_test_demo" },
        generateContent: vi.fn().mockResolvedValue({ text: "not-json" }),
      }),
    ).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiTriageError>>({ code: "triage_invalid_response" }),
    );
  });

  test("wraps an empty response with a named triage error", async () => {
    await expect(
      runOpenWebUiTriage(colorInput, {
        env: { GEMINI_API_KEY: "gemini_test_demo" },
        generateContent: vi.fn().mockResolvedValue({ text: "   " }),
      }),
    ).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiTriageError>>({ code: "triage_empty_response" }),
    );
  });
});

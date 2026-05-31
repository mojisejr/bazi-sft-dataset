import { describe, expect, test, vi } from "vitest";

import {
  buildOpenWebUiBaziExtractorPromptPayload,
  DEFAULT_OPEN_WEBUI_BAZI_EXTRACTOR_MODEL,
  extractOpenWebUiBaziContext,
  getOpenWebUiBaziExtractorConfig,
  OpenWebUiBaziExtractorError,
} from "@/features/open-webui/bazi-extractor";
import { type NormalizedChatMessage } from "@/features/open-webui/chat-runner";

const fullContextInput = {
  triageMessages: [
    { role: "assistant", content: "สวัสดีค่ะ ขอทราบเพศของคุณก่อนนะคะ" },
    { role: "user", content: "ผมเป็นชายครับ" },
    { role: "assistant", content: "รับทราบค่ะ แล้ววัน เวลา และจังหวัดที่เกิดล่ะคะ" },
    {
      role: "user",
      content: "เกิด 3 มกราคม 2532 เวลา 8:45 น. ที่จังหวัดจันทบุรี",
    },
  ] as NormalizedChatMessage[],
  latestUserMessage: {
    role: "user" as const,
    content: "เกิด 3 มกราคม 2532 เวลา 8:45 น. ที่จังหวัดจันทบุรี",
  },
};

const partialContextInput = {
  triageMessages: [
    { role: "user", content: "ดูดวงให้หน่อย" },
    { role: "assistant", content: "ขอวันเดือนปีเกิดด้วยค่ะ" },
    { role: "user", content: "เกิด 3 มกราคม 2532 ค่ะ" },
  ] as NormalizedChatMessage[],
  latestUserMessage: { role: "user" as const, content: "เกิด 3 มกราคม 2532 ค่ะ" },
};

describe("getOpenWebUiBaziExtractorConfig", () => {
  test("uses the default Gemini Flash model when no override is provided", () => {
    expect(getOpenWebUiBaziExtractorConfig({ GEMINI_API_KEY: "gemini_test_demo" })).toEqual({
      apiKey: "gemini_test_demo",
      model: DEFAULT_OPEN_WEBUI_BAZI_EXTRACTOR_MODEL,
    });
  });

  test("honors OPEN_WEBUI_BAZI_EXTRACTOR_MODEL override", () => {
    expect(
      getOpenWebUiBaziExtractorConfig({
        GEMINI_API_KEY: "gemini_test_demo",
        OPEN_WEBUI_BAZI_EXTRACTOR_MODEL: "gemini-2.5-flash-lite",
      }),
    ).toEqual({
      apiKey: "gemini_test_demo",
      model: "gemini-2.5-flash-lite",
    });
  });

  test("fails fast when the Gemini API key is missing", () => {
    expect(() => getOpenWebUiBaziExtractorConfig({})).toThrowError(
      expect.objectContaining<Partial<OpenWebUiBaziExtractorError>>({
        code: "bazi_extractor_config_error",
      }),
    );
  });
});

describe("buildOpenWebUiBaziExtractorPromptPayload", () => {
  test("includes the transcript and the latest user message", () => {
    const payload = buildOpenWebUiBaziExtractorPromptPayload(fullContextInput);

    expect(payload.userPrompt).toContain("User: ผมเป็นชายครับ");
    expect(payload.userPrompt).toContain(
      "Latest user message: เกิด 3 มกราคม 2532 เวลา 8:45 น. ที่จังหวัดจันทบุรี",
    );
    expect(payload.systemInstruction).toContain("null");
  });
});

describe("extractOpenWebUiBaziContext", () => {
  test("extracts all four fields and exposes a parsed rawInput when complete", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: "ชาย",
        province: "จันทบุรี",
      }),
    });

    const result = await extractOpenWebUiBaziContext(fullContextInput, {
      env: { GEMINI_API_KEY: "gemini_test_demo" },
      generateContent,
    });

    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.fields).toEqual({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "ชาย",
      province: "จันทบุรี",
    });
    expect(result.rawInput).toEqual({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "ชาย",
      province: "จันทบุรี",
    });

    expect(generateContent).toHaveBeenCalledWith({
      model: DEFAULT_OPEN_WEBUI_BAZI_EXTRACTOR_MODEL,
      contents: expect.stringContaining("Latest user message:"),
      config: expect.objectContaining({
        responseMimeType: "application/json",
        temperature: 0,
      }),
    });
  });

  test("reports missing fields and leaves rawInput null when partial data is returned", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        birthDate: "1989-01-03",
        birthTime: null,
        gender: null,
        province: null,
      }),
    });

    const result = await extractOpenWebUiBaziContext(partialContextInput, {
      env: { GEMINI_API_KEY: "gemini_test_demo" },
      generateContent,
    });

    expect(result.isComplete).toBe(false);
    expect(result.rawInput).toBeNull();
    expect(result.missingFields).toEqual(["birthTime", "gender", "province"]);
    expect(result.fields).toEqual({
      birthDate: "1989-01-03",
      birthTime: null,
      gender: null,
      province: null,
    });
  });

  test("merges newly extracted values with previously collected fields", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        birthDate: null,
        birthTime: "08:45",
        gender: null,
        province: "จันทบุรี",
      }),
    });

    const result = await extractOpenWebUiBaziContext(partialContextInput, {
      env: { GEMINI_API_KEY: "gemini_test_demo" },
      generateContent,
      existing: {
        birthDate: "1989-01-03",
        gender: "ชาย",
      },
    });

    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.fields).toEqual({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "ชาย",
      province: "จันทบุรี",
    });
    expect(result.rawInput).toEqual({
      birthDate: "1989-01-03",
      birthTime: "08:45",
      gender: "ชาย",
      province: "จันทบุรี",
    });
  });

  test("throws an empty_response error when Gemini returns no text", async () => {
    await expect(
      extractOpenWebUiBaziContext(partialContextInput, {
        env: { GEMINI_API_KEY: "gemini_test_demo" },
        generateContent: vi.fn().mockResolvedValue({ text: "" }),
      }),
    ).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiBaziExtractorError>>({
        code: "bazi_extractor_empty_response",
      }),
    );
  });

  test("wraps invalid JSON with a named invalid_response error", async () => {
    await expect(
      extractOpenWebUiBaziContext(partialContextInput, {
        env: { GEMINI_API_KEY: "gemini_test_demo" },
        generateContent: vi.fn().mockResolvedValue({ text: "not-json" }),
      }),
    ).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiBaziExtractorError>>({
        code: "bazi_extractor_invalid_response",
      }),
    );
  });

  test("wraps schema-violating JSON with a named invalid_response error", async () => {
    await expect(
      extractOpenWebUiBaziContext(partialContextInput, {
        env: { GEMINI_API_KEY: "gemini_test_demo" },
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            birthDate: 1989,
            birthTime: null,
            gender: null,
            province: null,
          }),
        }),
      }),
    ).rejects.toThrowError(
      expect.objectContaining<Partial<OpenWebUiBaziExtractorError>>({
        code: "bazi_extractor_invalid_response",
      }),
    );
  });
});

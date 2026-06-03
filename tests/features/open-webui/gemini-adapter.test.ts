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
      anchors: [{ key: "careerTenGodHighlights", provenance: "computed_chart_marker" }],
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
  test("includes concise-answer policy while preserving the two-block reasoning contract", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [{ role: "user", content: "ช่วยดูภาพรวมให้หน่อย" }],
      triageMessages: [],
      latestUserMessage: { role: "user", content: "ช่วยดูภาพรวมให้หน่อย" },
      now: new Date("2026-06-02T14:00:00.000Z"),
    });

    expect(MUMATE_PERSONA_INSTRUCTION).toContain("## นโยบายความกระชับของคำตอบ");
    expect(payload.systemInstruction).toContain("2-4 ประโยค");
    expect(payload.systemInstruction).toContain("5-8 บรรทัด");
    expect(payload.systemInstruction).toContain("ส่งออกเป็นสองบล็อกตามลำดับนี้เท่านั้น: <bazi_logic> แล้วตามด้วย <reply>");
    expect(payload.systemInstruction).toContain("ห้ามสลับลำดับ ห้ามละบล็อก และห้ามเพิ่มบล็อกอื่นนอกเหนือจากสองบล็อกนี้");
  });

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
    expect(payload.userPrompt).toContain("Respect the packet provenance markers:");
  });

  test("preserves consult routing context and truth-packet constraints for bazi consults", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [
        { role: "user", content: "ผมเกิด 3 ม.ค. 1989 เวลา 08:45 จันทบุรี ช่วยดูการเงิน" },
        { role: "assistant", content: "<reply>รับข้อมูลแล้วค่ะ</reply>" },
        { role: "user", content: "สรุปเรื่องการเงินให้หน่อย" },
      ],
      triageMessages: [],
      latestUserMessage: { role: "user", content: "สรุปเรื่องการเงินให้หน่อย" },
      executionContext: {
        intentClassification: {
          intent: "wealth",
          requiresBaziConsult: true,
          confidence: 0.94,
        },
        baziConsult: {
          rawInput: {
            birthDate: "1989-01-03",
            birthTime: "08:45",
            gender: "ชาย",
            province: "จันทบุรี",
            calendarSystem: "solar",
            timezone: "Asia/Bangkok",
          },
          truthPacket: '{"intent":"wealth","summary":"ใช้ Truth Packet เท่านั้น"}',
        },
      },
      now: new Date("2026-06-02T14:00:00.000Z"),
    });

    expect(payload.userPrompt).toContain("Intent routing: intent=wealth; requiresBaziConsult=true; confidence=0.94.");
    expect(payload.userPrompt).toContain("Consult mode: bazi_consult.");
    expect(payload.userPrompt).toContain("Verified Bazi consult context:");
    expect(payload.userPrompt).toContain("- Birth date: 1989-01-03");
    expect(payload.userPrompt).toContain("Truth packet:");
    expect(payload.userPrompt).toContain('{"intent":"wealth","summary":"ใช้ Truth Packet เท่านั้น"}');
    expect(payload.userPrompt).toContain("Respect the packet provenance markers:");
    expect(payload.userPrompt).toContain("Use only this narrowed chart context for Bazi-specific claims.");
  });

  test("adds provenance framing rules so profile labels stay profile-level evidence", () => {
    const payload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [
        { role: "user", content: "ดูเรื่องความรักให้หน่อย" },
      ],
      triageMessages: [],
      latestUserMessage: { role: "user", content: "ดูเรื่องความรักให้หน่อย" },
      executionContext: {
        intentClassification: {
          intent: "love",
          requiresBaziConsult: true,
          confidence: 0.93,
        },
        baziConsult: {
          rawInput: sampleExecutionContext.baziConsult!.rawInput,
          truthPacket: JSON.stringify({
            intent: "love",
            anchors: [
              {
                key: "loveCompatibilityProfile",
                provenance: "compatibility_profile",
                value: {
                  entries: [{ label: "เทียนเต็ก" }],
                },
              },
              {
                key: "spousePalace",
                provenance: "computed_chart_marker",
                value: { stem: "己", branch: "巳" },
              },
            ],
          }, null, 2),
        },
      },
    });

    expect(payload.systemInstruction).toContain("compatibility_profile");
    expect(payload.systemInstruction).toContain("computed_chart_marker");
    expect(payload.systemInstruction).toContain("ห้ามนำ label จาก compatibility_profile ไปพูดเหมือนเป็นดาวหรือ marker คำนวณตรง");
    expect(payload.userPrompt).toContain('"provenance": "compatibility_profile"');
    expect(payload.userPrompt).toContain("profile-level evidence only");
  });

  test("constrains Bazi claims to the engine-derived Truth Packet under the mumate doctrine", () => {
    const engineDerivedTruthPacket = JSON.stringify({
      intent: "wealth",
      chartIdentity: {
        dayMaster: "甲",
        fourPillars: {
          day: { stem: "甲", branch: "午" },
        },
      },
      anchors: [
        { key: "elementAnalysis", value: { dominantElements: ["wood"] } },
      ],
      timing: [
        { key: "currentDaYun", value: { influenceGradient: { ratioLabel: "90:10" } } },
      ],
    }, null, 2);
    const payload = buildOpenWebUiGeminiPromptPayload({
      ...readyChatInput,
      executionContext: {
        intentClassification: {
          intent: "wealth",
          requiresBaziConsult: true,
          confidence: 0.92,
        },
        baziConsult: {
          rawInput: sampleExecutionContext.baziConsult!.rawInput,
          truthPacket: engineDerivedTruthPacket,
        },
      },
    });

    expect(payload.systemInstruction).toContain("Truth Packet เท่านั้น");
    expect(payload.systemInstruction).toContain("ห้ามเติมความรู้ปาจื่อจากภายนอก");
    expect(payload.userPrompt).toContain(engineDerivedTruthPacket);
    expect(payload.userPrompt).toContain("Use only this narrowed chart context for Bazi-specific claims");
    expect(payload.userPrompt).not.toContain("external Bazi theory");
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
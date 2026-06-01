import { describe, expect, test } from "vitest";

import {
  MUMATE_PERSONA_INSTRUCTION,
  buildOpenWebUiGeminiPromptPayload,
} from "@/features/open-webui/gemini-adapter";

describe("open webui gemini adapter prompt", () => {
  test("locks the Sinsae reasoning flow and negative prompt constraints", () => {
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("<bazi_logic>");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("<reply>");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("Truth Packet เท่านั้น");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ดิถี (Day Master)");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ตัวถ่ายเทเป็นกริยา (Verb)");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("12 เซงแซ / 12 Qi");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("เส้นแรงความสัมพันธ์");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ห้ามใช้ความรู้ปาจื่อกระแสหลัก");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("ห้ามสร้างข้อสรุปเรื่องร่างกาย");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("กวนซา");
    expect(MUMATE_PERSONA_INSTRUCTION).toContain("เจีย หงเฮ้ง");
  });

  test("builds a payload that keeps the truth packet as the consult source", () => {
    const latestUserMessage = {
      role: "user" as const,
      content: "ดูนิสัยจากดวงนี้ให้หน่อย",
    };
    const promptPayload = buildOpenWebUiGeminiPromptPayload({
      normalizedMessages: [latestUserMessage],
      triageMessages: [latestUserMessage],
      latestUserMessage,
      now: new Date("2026-06-01T14:00:00.000Z"),
      executionContext: {
        intentClassification: {
          intent: "general_reading",
          requiresBaziConsult: true,
          confidence: 0.92,
        },
        baziConsult: {
          rawInput: {
            birthDate: "1990-01-15",
            birthTime: "09:30",
            gender: "female",
            province: "Bangkok",
          },
          truthPacket: "ดิถี=甲; strength=อ่อน; ตัวถ่ายเท=火; 12 Qi=帝旺; เส้นแรง=ถ่ายเทไปหาลาภ",
        },
      },
    });

    expect(promptPayload.systemInstruction).toContain("<bazi_logic>");
    expect(promptPayload.systemInstruction).toContain("Truth Packet เท่านั้น");
    expect(promptPayload.userPrompt).toContain("Consult mode: bazi_consult.");
    expect(promptPayload.userPrompt).toContain("Truth packet:");
    expect(promptPayload.userPrompt).toContain("ดิถี=甲; strength=อ่อน");
    expect(promptPayload.userPrompt).toContain("Use only this narrowed chart context");
  });
});
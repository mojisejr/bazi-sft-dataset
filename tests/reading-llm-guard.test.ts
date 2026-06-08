import { describe, expect, test } from "vitest";

import {
  droppedCriticalMarkers,
  forbiddenInventions,
  generateReadingTopicLlm,
} from "@/lib/bazi/reading-llm";
import { RawInputSchema } from "@/lib/bazi/schema-types";

const ENGINE_TEXT =
  "ดวงนี้ดิถี 癸 ราศีล่างวัน 酉 เข้าวัยจรที่เสายาม 巳 → ทอ ธาตุไฟแข็งแรง";

describe("reading-llm strict marker guard", () => {
  test("droppedCriticalMarkers: flags dropped Chinese chars and ยาม→เวลา", () => {
    // LLM แปลง 酉→ระกา, ตัด 巳, เปลี่ยน ยาม→เวลา
    const bad = "ดวงนี้ดิถี 癸 ราศีล่างวัน ระกา เข้าวัยจรที่เสาเวลา → ทอ ธาตุไฟแข็งแรง";
    const dropped = droppedCriticalMarkers(ENGINE_TEXT, bad);
    expect(dropped).toContain("酉");
    expect(dropped).toContain("巳");
    expect(dropped).toContain("ยาม");
  });

  test("droppedCriticalMarkers: passes when all markers kept (reworded prose)", () => {
    const good =
      "ดวงดิถี 癸 ของคุณ โดยราศีล่างวันคือ 酉 และเมื่อเข้าสู่วัยจรที่เสายาม 巳 (ทอ) ธาตุไฟจะแข็งแรง";
    expect(droppedCriticalMarkers(ENGINE_TEXT, good)).toHaveLength(0);
  });

  test("generateReadingTopicLlm: marker-dropping LLM falls back to engine text", async () => {
    const raw = RawInputSchema.parse({
      birthDate: "1986-09-16",
      birthTime: "14:23",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    });
    // stub LLM ที่ drop อักษรจีน + ยาม ทุกครั้ง → ต้อง fallback เป็น engine text
    const result = await generateReadingTopicLlm(
      {
        topicId: "chart_foundation",
        rawInput: raw,
        calculatedState: {} as never,
        humanKnowledge: ENGINE_TEXT,
        sourceLabel: null,
        engineSignals: [],
        provider: "anthropic",
      },
      { generateContent: async () => ({ text: "ดิถีน้ำของคุณลึกซึ้ง (ตัด marker ทั้งหมด)" }) },
    );
    expect(result.text).toBe(ENGINE_TEXT);
    expect(result.model).toContain("fallback-engine");
  });

  test("forbiddenInventions still catches ดอกท้อ/เสน่ห์ not in excerpt", () => {
    expect(forbiddenInventions(ENGINE_TEXT, "คุณมีเสน่ห์ดอกท้อ")).toEqual(
      expect.arrayContaining(["ดอกท้อ", "เสน่ห์"]),
    );
  });
});

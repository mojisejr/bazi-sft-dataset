import { describe, expect, test } from "vitest";

import {
  cosineSim,
  parseJudgeScore,
  combinedScore,
  createGeminiScorer,
} from "../scripts/lib/reading-similarity";
import { splitGptCaseChapters } from "../scripts/lib/gptcase-cases";

describe("reading-similarity (pure)", () => {
  test("cosineSim: identical=1, orthogonal=0, mismatched length=0", () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosineSim([1, 2, 3], [1, 2])).toBe(0);
    expect(cosineSim([], [])).toBe(0);
  });

  test("parseJudgeScore: clamp 0-100, non-number→0", () => {
    expect(parseJudgeScore({ faithfulness: 150, tone: -5, coverage: 80, overall: 77 })).toEqual({
      faithfulness: 100, tone: 0, coverage: 80, overall: 77,
    });
    expect(parseJudgeScore({ overall: "x" })).toEqual({
      faithfulness: 0, tone: 0, coverage: 0, overall: 0,
    });
  });

  test("combinedScore: cosine-only when judge null; weighted otherwise", () => {
    expect(combinedScore(1, null)).toBeCloseTo(100, 6);
    expect(combinedScore(0.5, null)).toBeCloseTo(50, 6);
    expect(combinedScore(1, 0, 0.5)).toBeCloseTo(50, 6); // 0.5*100 + 0.5*0
  });

  test("createGeminiScorer: ใช้ deps ที่ฉีด (ไม่ยิง network) + cache embedding", async () => {
    let embedCalls = 0;
    const scorer = createGeminiScorer({
      apiKey: "x",
      embed: async (t) => {
        embedCalls += 1;
        return t.includes("a") ? [1, 0] : [0, 1];
      },
      judge: async () => ({ faithfulness: 90, tone: 80, coverage: 70, overall: 85 }),
    });
    const cos = await scorer.embeddingCosine("aaa", "aaa");
    expect(cos).toBeCloseTo(1, 6);
    expect(embedCalls).toBe(1); // cache: "aaa" embed ครั้งเดียว
    const j = await scorer.llmJudge("c", "r");
    expect(j.overall).toBe(85);
  });
});

describe("splitGptCaseChapters", () => {
  test("แตกบทตามคีย์เวิร์ด + เลขบทใด ๆ (รองรับเลขรีเซ็ต)", () => {
    const text = [
      "### 1. พื้นฐานดวงชะตาที่ถูกกำหนด คุณเป็นคนธาตุน้ำ",
      "2. อาชีพ / ธุรกิจ ที่ควรทำ งานน้ำ",
      "1. การเรียนที่ตรงสาย วิชาบัญชี", // เลขรีเซ็ตเป็น 1 แต่ keyword=การเรียน
      "14. สี และทิศมงคล สีฟ้า",
    ].join("\n");
    const ch = splitGptCaseChapters(text);
    expect(Object.keys(ch)).toContain("chart_foundation");
    expect(Object.keys(ch)).toContain("career_potential");
    expect(Object.keys(ch)).toContain("education");
    expect(Object.keys(ch)).toContain("colors_directions");
    expect(ch.chart_foundation).toContain("ธาตุน้ำ");
    expect(ch.education).toContain("วิชาบัญชี");
    expect(ch.colors_directions).toContain("สีฟ้า");
  });
});

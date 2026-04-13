import { describe, expect, test } from "vitest";

import {
  createBaziAssistantResponse,
  createBaziSftJsonlContent,
  createBaziUserPrompt,
  transformReviewedRecordToSftExample,
} from "@/lib/bazi/export-sft-dataset";
import { REQUIRED_ANNOTATION_DIMENSION_NAMES } from "@/lib/bazi/schema-types";

function createReviewedRecord() {
  return {
    id: "4cd31f6d-5d6c-4828-a5ee-b6d4f35eb38a",
    rawInput: {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: {
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        day: { stem: "己", branch: "卯", hiddenStems: ["乙"] },
        hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
      },
      dayMaster: "己土",
      strengthScore: 2.75,
      tenGods: {
        yearStem: "偏财",
        monthStem: "劫财",
        hourStem: "食神",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "病",
        hourBranch: "冠带",
      },
      elementMetaphors: [
        {
          element: "earth",
          metaphor: "fertile cultivated soil that responds well to disciplined care",
        },
      ],
      sixtyJiaziCorePersona: {
        code: "己卯",
        narrative: "Measured earth that grows through patience and timing.",
        precedenceNotes: ["Respect seasonal balance before reading annual timing."],
      },
    },
    intentDomain: "wealth",
    annotationData: {
      version: "1.6",
      reviewSummary: "Balanced wealth reading with caution around overextension.",
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: `Reasoning trace for ${dimensionName}.`,
        final_prediction: `Prediction for ${dimensionName}.`,
        supporting_signals: ["signal-a", "signal-b"],
      })),
    },
    status: "reviewed",
  } as const;
}

describe("phase 4 export transformer", () => {
  test("builds a user prompt from raw input and calculated state", () => {
    const prompt = createBaziUserPrompt(createReviewedRecord());

    expect(prompt).toContain("Intent Domain: wealth");
    expect(prompt).toContain("Raw Input:");
    expect(prompt).toContain("Calculated State:");
    expect(prompt).toContain("Year Pillar");
    expect(prompt).toContain("Sixty Jiazi Core Persona");
  });

  test("builds assistant blocks in schema order with titles and reasoning", () => {
    const assistantResponse = createBaziAssistantResponse(createReviewedRecord());

    expect(assistantResponse).toContain("<review_summary>Balanced wealth reading with caution around overextension.</review_summary>");
    expect(assistantResponse).toContain("<chart_foundation>");
    expect(assistantResponse).toContain("<title>ฐานดวงเดิม และภาพรวม</title>");
    expect(assistantResponse).toContain("<prediction>Prediction for core_prediction.</prediction>");
  });

  test("creates parseable JSONL lines for reviewed records", () => {
    const jsonl = createBaziSftJsonlContent([createReviewedRecord(), createReviewedRecord()]);
    const lines = jsonl.split("\n");

    expect(lines).toHaveLength(2);

    const parsed = lines.map((line) => JSON.parse(line));

    expect(parsed[0].messages).toHaveLength(3);
    expect(parsed[0].messages[0].role).toBe("system");
    expect(parsed[0].messages[1].role).toBe("user");
    expect(parsed[0].messages[2].role).toBe("assistant");
  });

  test("rejects non-reviewed export payloads", () => {
    expect(() =>
      transformReviewedRecordToSftExample({
        ...createReviewedRecord(),
        status: "draft",
      }),
    ).toThrow();
  });
});
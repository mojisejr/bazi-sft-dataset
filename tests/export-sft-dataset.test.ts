import { describe, expect, test } from "vitest";

import {
  createBaziAssistantResponse,
  createBaziSftJsonlContent,
  createBaziUserPrompt,
  transformReviewedRecordToSftExample,
} from "@/lib/bazi/export-sft-dataset";
import {
  CalculatedStateSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
} from "@/lib/bazi/schema-types";
import { computeDomainPower } from "@/lib/bazi/symbolic-engine.domain-power";

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
    calculatedState: CalculatedStateSchema.parse({
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
        hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
      },
      ageSnapshot: {
        referenceDate: "2026-06-15",
        thaiAge: 33,
        chineseAge: 34,
      },
      dayMaster: "己",
      strengthScore: 3.07,
      tenGods: {
        yearStem: "正财",
        monthStem: "劫财",
        hourStem: "食神",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "帝旺",
        hourBranch: "冠带",
      },
      elementAnalysis: {
        visibleCounts: {
          wood: 0,
          fire: 1,
          earth: 1,
          metal: 1,
          water: 1,
        },
        hiddenCounts: {
          wood: 1,
          fire: 1,
          earth: 3,
          metal: 2,
          water: 2,
        },
        totalCounts: {
          wood: 1,
          fire: 2,
          earth: 4,
          metal: 3,
          water: 3,
        },
        missingElements: [],
        dominantElements: ["earth"],
        elementStrengths: [
          { element: "wood", rooted: true, seasonalSupport: "seasonal-drained", strength: "weak" },
          { element: "fire", rooted: true, seasonalSupport: "seasonal-drained", strength: "balanced" },
          { element: "earth", rooted: true, seasonalSupport: "seasonal-drained", strength: "strong" },
          { element: "metal", rooted: true, seasonalSupport: "seasonal-peak", strength: "strong" },
          { element: "water", rooted: true, seasonalSupport: "seasonal-support", strength: "strong" },
        ],
      },
      seasonalInteraction: {
        dayMasterStem: "己",
        dayMasterElement: "earth",
        monthBranch: "申",
        season: "autumn",
        phase: "early",
        seasonLabel: "ต้นฤดูใบไม้ร่วง",
        metaphor: "fertile cultivated soil in early autumn",
      },
      elementMetaphors: [
        {
          element: "earth",
          metaphor: "fertile cultivated soil that responds well to disciplined care",
        },
      ],
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Measured earth that grows through patience and timing.",
        semanticNotes: [
          "โทนธาตุของ 60 กะจื่อวันนี้คือ ไม้",
          "ชั้น 12 เชี่ยงแซของกะจื่อวันอยู่ที่ ตี้อ๋วง",
        ],
        precedenceNotes: ["Respect seasonal balance before reading annual timing."],
        precedenceNoteSignals: [
          {
            key: "SOLAR_TERM_BOUNDARY_NEAR",
            params: {
              hours: "1.50",
              solarTermName: "立秋",
              boundaryAt: "1992-08-21T15:00:00",
            },
          },
        ],
      },
    }),
    intentDomain: "wealth",
    metadata: {
      customerName: "สมบัติ",
      sourceFile: "/tmp/example-cases.csv",
      sourceRow: 2,
    },
    annotationData: {
      version: "1.6",
      reviewSummary: "Balanced wealth reading with caution around overextension.",
      sinsaeProofNote:
        "Reviewed the AI draft, corrected two metaphors, and confirmed the structure is ready for export.",
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
    expect(prompt).toContain("Age Snapshot: thai=33 | chinese=34 | asOf=2026-06-15");
    expect(prompt).toContain("Sixty Jiazi Core Persona");
    expect(prompt).toContain("Seasonal Interaction: season=autumn | phase=early | label=ต้นฤดูใบไม้ร่วง");
    expect(prompt).toContain("Element Strengths: wood=strength:weak,rooted:yes,seasonal:seasonal-drained");
    expect(prompt).toContain("Precedence Note Signals: SOLAR_TERM_BOUNDARY_NEAR(hours=1.50, solarTermName=立秋, boundaryAt=1992-08-21T15:00:00)");
    expect(prompt).not.toContain("สมบัติ");
  });

  test("surfaces domain-power scores in the user prompt when present", () => {
    const record = createReviewedRecord();
    const withPower = {
      ...record,
      calculatedState: {
        ...record.calculatedState,
        domainPower: computeDomainPower({
          year: record.calculatedState.fourPillars.year,
          month: record.calculatedState.fourPillars.month,
          day: record.calculatedState.fourPillars.day,
          hour: record.calculatedState.fourPillars.hour,
        }),
      },
    };

    const prompt = createBaziUserPrompt(withPower);

    expect(prompt).toContain("Domain Power (0-100%):");
    expect(prompt).toMatch(/career=\d/);
    expect(prompt).toMatch(/wealth=\d/);
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

  test("rejects reviewed export payloads when calculated pillars contradict raw input", () => {
    expect(() =>
      transformReviewedRecordToSftExample({
        ...createReviewedRecord(),
        rawInput: {
          birthDate: "1981-03-12",
          birthTime: "05:59",
          gender: "male",
          province: "Bangkok",
          calendarSystem: "solar",
          timezone: "Asia/Bangkok",
        },
        calculatedState: {
          ...createReviewedRecord().calculatedState,
          fourPillars: {
            year: { stem: "辛", branch: "酉", hiddenStems: ["辛"] },
            month: { stem: "辛", branch: "卯", hiddenStems: ["乙"] },
            day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
            hour: { stem: "丁", branch: "卯", hiddenStems: ["乙"] },
          },
          dayMaster: "己",
          tenGods: {
            yearStem: "食神",
            monthStem: "食神",
            hourStem: "偏印",
          },
          twelveQi: {
            yearBranch: "长生",
            monthBranch: "病",
            dayBranch: "帝旺",
            hourBranch: "病",
          },
          sixtyJiaziCorePersona: {
            code: "己巳",
            narrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
            precedenceNotes: ["Near solar-term boundary."],
          },
        },
      }),
    ).toThrow(/己丑 expected, received 己巳/i);
  });
});
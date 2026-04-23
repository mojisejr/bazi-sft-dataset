import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

function normalizeDerivedRecord(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value.replace(/\s+/g, "")]),
  );
}

describe("calculateBaziChart ground-truth fixtures", () => {
  const repository = createTestKnowledgeRepository();

  test("enters red state for the sinsae phase 1 fixture before the engine refactor", async () => {
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "2018-12-08",
        birthTime: "17:13",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect.soft(result.mingGong).toMatchObject({ stem: "庚", branch: "申" });
    expect.soft(result.strengthScore).toBe(4.5);
  });

  test("matches expert case1 with fixed-offset Bangkok normalization", async () => {
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1966-09-29",
        birthTime: "11:44",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars).toEqual({
      year: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
      month: { stem: "丁", branch: "酉", hiddenStems: ["辛"] },
      day: { stem: "辛", branch: "卯", hiddenStems: ["乙"] },
      hour: { stem: "甲", branch: "午", hiddenStems: ["丁", "己"] },
    });
    expect(normalizeDerivedRecord(result.tenGods)).toEqual({
      yearStem: "正官",
      yearBranch: "七杀,偏印",
      monthStem: "七杀",
      monthBranch: "比肩",
      dayStem: "日主",
      dayBranch: "偏财",
      hourStem: "正财",
      hourBranch: "七杀,偏印",
    });
    expect(normalizeDerivedRecord(result.twelveQi)).toEqual({
      yearBranch: "病",
      monthBranch: "临官",
      dayBranch: "绝",
      hourBranch: "病",
    });
    expect(result.elementAnalysis.totalCounts).toEqual({
      wood: 2,
      fire: 4,
      earth: 2,
      metal: 2,
      water: 0,
    });
    expect(result.elementAnalysis.elementStrengths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "fire",
          rooted: true,
          seasonalSupport: "seasonal-drained",
          strength: "strong",
        }),
        expect.objectContaining({
          element: "water",
          rooted: false,
          seasonalSupport: "seasonal-support",
          strength: "missing",
        }),
      ]),
    );
    expect(result.elementAnalysis.dominantElements).toEqual(["fire"]);
    expect(result.elementAnalysis.missingElements).toEqual(["water"]);
    expect(result.seasonalInteraction).toMatchObject({
      dayMasterStem: "辛",
      monthBranch: "酉",
      season: "autumn",
      phase: "peak",
      seasonLabel: "ฤดูใบไม้ร่วง",
      metaphor: "โลหะประณีตในฤดูใบไม้ร่วง",
    });
  });

  test("matches expert case2 and rejects the OCR-hallucinated day pillar", async () => {
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-12",
        birthTime: "05:59",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars).toEqual({
      year: { stem: "辛", branch: "酉", hiddenStems: ["辛"] },
      month: { stem: "辛", branch: "卯", hiddenStems: ["乙"] },
      day: { stem: "己", branch: "丑", hiddenStems: ["己", "癸", "辛"] },
      hour: { stem: "丁", branch: "卯", hiddenStems: ["乙"] },
    });
    expect(`${result.fourPillars.day.stem}${result.fourPillars.day.branch}`).toBe("己丑");
    expect(`${result.fourPillars.day.stem}${result.fourPillars.day.branch}`).not.toBe("己巳");
    expect(normalizeDerivedRecord(result.tenGods)).toEqual({
      yearStem: "食神",
      yearBranch: "食神",
      monthStem: "食神",
      monthBranch: "七杀",
      dayStem: "日主",
      dayBranch: "比肩,偏财,食神",
      hourStem: "偏印",
      hourBranch: "七杀",
    });
    expect(normalizeDerivedRecord(result.twelveQi)).toEqual({
      yearBranch: "长生",
      monthBranch: "病",
      dayBranch: "墓",
      hourBranch: "病",
    });
    expect(result.elementAnalysis.totalCounts).toEqual({
      wood: 2,
      fire: 1,
      earth: 2,
      metal: 4,
      water: 1,
    });
    expect(result.elementAnalysis.elementStrengths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "fire",
          rooted: false,
          seasonalSupport: "seasonal-support",
          strength: "weak",
        }),
        expect.objectContaining({
          element: "metal",
          rooted: true,
          seasonalSupport: "seasonal-drained",
          strength: "strong",
        }),
      ]),
    );
    expect(result.elementAnalysis.dominantElements).toEqual(["metal"]);
    expect(result.elementAnalysis.missingElements).toEqual([]);
    expect(result.seasonalInteraction).toMatchObject({
      dayMasterStem: "己",
      monthBranch: "卯",
      season: "spring",
      phase: "peak",
      seasonLabel: "ฤดูใบไม้ผลิ",
      metaphor: "ดินเพาะปลูกในฤดูใบไม้ผลิ",
    });
  });
});
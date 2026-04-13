import { describe, expect, test } from "vitest";

import { createCalculateBaziHandler } from "@/app/api/bazi/calculate/route";
import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";
import {
  type BaziKnowledgeRepository,
  calculateBaziChart,
} from "@/lib/bazi/symbolic-engine";

function createTestKnowledgeRepository(): BaziKnowledgeRepository {
  const stages = new Map(
    [
      ["戊|卯", { stageNameChinese: "沐浴", stageNameThai: "หมกยก", dayMaster: "戊", branch: "卯" }],
      ["戊|丑", { stageNameChinese: "养", stageNameThai: "เอี้ยง", dayMaster: "戊", branch: "丑" }],
      ["戊|戌", { stageNameChinese: "墓", stageNameThai: "หมอ", dayMaster: "戊", branch: "戌" }],
      ["戊|申", { stageNameChinese: "病", stageNameThai: "แป่", dayMaster: "戊", branch: "申" }],
      ["戊|辰", { stageNameChinese: "冠带", stageNameThai: "กวงตั่ว", dayMaster: "戊", branch: "辰" }],
      ["戊|寅", { stageNameChinese: "长生", stageNameThai: "เชี่ยงแซ", dayMaster: "戊", branch: "寅" }],
      ["己|申", { stageNameChinese: "沐浴", stageNameThai: "หมกยก", dayMaster: "己", branch: "申" }],
      ["己|巳", { stageNameChinese: "帝旺", stageNameThai: "ตี้อ๋วง", dayMaster: "己", branch: "巳" }],
      ["己|未", { stageNameChinese: "冠带", stageNameThai: "กวงตั่ว", dayMaster: "己", branch: "未" }],
    ] as const,
  );

  const personas = new Map(
    [
      [
        "戊|戌",
        {
          dayMasterChinese: "戊",
          branchChinese: "戌",
          elementTone: "earth",
          twelveQiLabel: "墓",
          combinedNarrative: "Acts like a stabilizer under pressure and becomes more useful when responsibility increases.",
        },
      ],
      [
        "己|巳",
        {
          dayMasterChinese: "己",
          branchChinese: "巳",
          elementTone: "fire",
          twelveQiLabel: "帝旺",
          combinedNarrative: "Builds influence patiently, then turns preparation into visible results when timing opens.",
        },
      ],
    ] as const,
  );

  return {
    async findSolarTermBoundaryContext(birthAtHongKong) {
      if (birthAtHongKong.startsWith("2024-02-04")) {
        return {
          previous: {
            label: "2024-02-03-rain-water",
            solarTermName: "大寒",
            boundaryAt: "2024-01-20 22:07:00",
          },
          next: {
            label: "2024-02-04-start-of-spring",
            solarTermName: "立春",
            boundaryAt: "2024-02-04 16:27:07",
          },
        };
      }

      return {
        previous: {
          label: "1992-08-07-start-of-autumn",
          solarTermName: "立秋",
          boundaryAt: "1992-08-07 09:00:00",
        },
        next: {
          label: "1992-08-23-limit-of-heat",
          solarTermName: "处暑",
          boundaryAt: "1992-08-23 04:00:00",
        },
      };
    },
    async findTwelveQiStage(dayMasterChinese, branchChinese) {
      return stages.get(`${dayMasterChinese}|${branchChinese}`) ?? null;
    },
    async findSixtyJiaziPersona(dayMasterChinese, branchChinese) {
      return personas.get(`${dayMasterChinese}|${branchChinese}`) ?? null;
    },
  };
}

describe("calculateBaziChart", () => {
  test("flips the year and month pillars when crossing the start-of-spring boundary", async () => {
    const repository = createTestKnowledgeRepository();
    const before = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "2024-02-04",
        birthTime: "15:20",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      }),
      repository,
    );
    const after = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "2024-02-04",
        birthTime: "16:40",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      }),
      repository,
    );

    expect(before.fourPillars.year).toMatchObject({ stem: "癸", branch: "卯" });
    expect(before.fourPillars.month).toMatchObject({ stem: "乙", branch: "丑" });
    expect(after.fourPillars.year).toMatchObject({ stem: "甲", branch: "辰" });
    expect(after.fourPillars.month).toMatchObject({ stem: "丙", branch: "寅" });
    expect(after.sixtyJiaziCorePersona?.precedenceNotes.some((note) => note.includes("立春"))).toBe(true);
  });

  test("returns a deterministic calculated state for a pinned sample chart", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      }),
      repository,
    );

    expect(result.dayMaster).toBe("己");
    expect(result.strengthScore).toBe(3.07);
    expect(result.tenGods.monthStem).toBe("劫财");
    expect(result.tenGods.hourStem).toBe("食神");
    expect(result.twelveQi.dayBranch).toBe("帝旺");
    expect(result.sixtyJiaziCorePersona).toMatchObject({
      code: "己巳",
      narrative:
        "Builds influence patiently, then turns preparation into visible results when timing opens.",
    });
    expect(result.elementMetaphors).toEqual([
      {
        element: "earth",
        metaphor: "fertile cultivated soil that nurtures, absorbs, and organizes",
      },
      {
        element: "fire",
        metaphor: "fire that bakes the soil into useful ground",
      },
    ]);
  });
});

describe("createCalculateBaziHandler", () => {
  test("returns a schema-valid calculated state payload", async () => {
    const handler = createCalculateBaziHandler({
      repository: createTestKnowledgeRepository(),
    });
    const response = await handler(
      new Request("http://localhost/api/bazi/calculate", {
        method: "POST",
        body: JSON.stringify({
          birthDate: "1992-08-21",
          birthTime: "14:35",
          gender: "female",
          province: "Bangkok",
          calendarSystem: "solar",
          timezone: "Asia/Hong_Kong",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as { calculatedState: unknown };
    expect(() => CalculatedStateSchema.parse(body.calculatedState)).not.toThrow();
  });

  test("returns 400 when the request body is invalid", async () => {
    const handler = createCalculateBaziHandler({
      repository: createTestKnowledgeRepository(),
    });
    const response = await handler(
      new Request("http://localhost/api/bazi/calculate", {
        method: "POST",
        body: JSON.stringify({
          birthDate: "1992/08/21",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    expect(response.status).toBe(400);
  });
});
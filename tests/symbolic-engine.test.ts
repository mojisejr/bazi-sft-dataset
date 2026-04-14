import { describe, expect, test } from "vitest";

import { createCalculateBaziHandler } from "@/app/api/bazi/calculate/route";
import { CalculatedStateSchema, RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

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

  test("keeps historical Bangkok births on fixed regional offsets instead of political DST", async () => {
    const repository = createTestKnowledgeRepository();
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

    expect(result.fourPillars.year).toMatchObject({ stem: "丙", branch: "午" });
    expect(result.fourPillars.month).toMatchObject({ stem: "丁", branch: "酉" });
    expect(result.fourPillars.day).toMatchObject({ stem: "辛", branch: "卯" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "甲", branch: "午" });
  });

  test("keeps Bangkok local time when the hour pillar sits near a two-hour boundary", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1980-04-05",
        birthTime: "08:23",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "庚", branch: "申" });
    expect(result.fourPillars.month).toMatchObject({ stem: "庚", branch: "辰" });
    expect(result.fourPillars.day).toMatchObject({ stem: "戊", branch: "申" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "丙", branch: "辰" });
    expect(`${result.fourPillars.hour.stem}${result.fourPillars.hour.branch}`).toBe("丙辰");
    expect(`${result.fourPillars.hour.stem}${result.fourPillars.hour.branch}`).not.toBe("丁巳");
    expect(result.tenGods.hourStem).toBe("偏印");
    expect(result.twelveQi.hourBranch).toBe("冠带");
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
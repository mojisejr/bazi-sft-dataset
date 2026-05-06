import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("Real-world test case: 24 November 1993, 15:09, Chiang Rai, male", () => {
  test("computes the expected four pillars and weak day-master profile", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1993-11-24",
        birthTime: "15:09",
        gender: "male",
        province: "Chiang Rai",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "癸", branch: "酉" });
    expect(result.fourPillars.month).toMatchObject({ stem: "癸", branch: "亥" });
    expect(result.fourPillars.day).toMatchObject({ stem: "己", branch: "酉" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "壬", branch: "申" });
    expect(result.dayMaster).toBe("己");
    expect(result.strengthScore).toBe(0.25);
    expect(result.dayMasterStrengthProfile).toMatchObject({
      strengthState: "อ่อนแอ",
      displayLabel: "ดิถีอ่อนเกินไป",
    });
  });

  test("freezes the active branch reactions and visible doctrine markers", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1993-11-24",
        birthTime: "15:09",
        gender: "male",
        province: "Chiang Rai",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    expect(reading!.branchInteractionBadges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schoolLabel: "ไห่",
          label: expect.stringContaining("申亥"),
          semanticKind: "branch-harm",
          doctrineKey: "interaction:branch-harm",
          status: "active",
        }),
        expect.objectContaining({
          schoolLabel: "เฮ้ง",
          label: expect.stringContaining("酉酉"),
          semanticKind: "branch-punishment-self",
          doctrineKey: "interaction:branch-punishment-self",
          tier: "tertiary",
        }),
        expect.objectContaining({
          schoolLabel: "ผั่ว",
          label: expect.stringContaining("壬申"),
          semanticKind: "intra-pillar-destruction",
          doctrineKey: "interaction:intra-pillar-destruction",
        }),
      ]),
    );

    const noblemanMarker = reading!.markerBadges.find((badge) => badge.doctrineKey === "marker:nobleman");
    const wenChangMarkers = reading!.markerBadges.filter((badge) => badge.doctrineKey === "marker:wenchang");
    expect(noblemanMarker).toBeDefined();
    expect(wenChangMarkers.length).toBeGreaterThanOrEqual(1);
  });
});

import { describe, expect, test } from "vitest";

import type { PillarValue, ShenShaValue } from "@/lib/bazi/schema-types";
import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";

const samplePillars: Record<"year" | "month" | "day" | "hour", PillarValue> = {
  year: {
    stem: "甲",
    branch: "子",
    hiddenStems: ["癸"],
    tenGod: "正官",
    stemTranslation: "ไม้",
    branchTranslation: "ชวด",
  },
  month: {
    stem: "己",
    branch: "丑",
    hiddenStems: ["己", "癸", "辛"],
    tenGod: "比肩",
    stemTranslation: "ดิน",
    branchTranslation: "ฉลู",
  },
  day: {
    stem: "己",
    branch: "午",
    hiddenStems: ["丁", "己"],
    tenGod: "ดิถี",
    stemTranslation: "ดิน",
    branchTranslation: "มะเมีย",
  },
  hour: {
    stem: "丁",
    branch: "未",
    hiddenStems: ["己", "丁", "乙"],
    tenGod: "偏印",
    stemTranslation: "ไฟ",
    branchTranslation: "มะแม",
  },
};

const sampleMarkers: ShenShaValue[] = [{
  starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
  relatedPillar: "ปี",
  meaning: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
}];

describe("buildBaseChartReading", () => {
  test("builds role badges and neutralizes clashes that lose to combinations", () => {
    const resolution = resolveBranchInteractionEffects(samplePillars);
    const reading = buildBaseChartReading({
      dayMasterStem: "己",
      pillars: samplePillars,
      shenSha: sampleMarkers,
      resolution,
      precedenceSignals: resolution.precedenceSignals,
    });

    expect(reading.roleBadges.length).toBeGreaterThanOrEqual(6);
    expect(reading.markerBadges).toHaveLength(1);

    expect(
      reading.branchInteractionBadges.some(
        (badge) => badge.schoolLabel === "ภาคี" && badge.status === "active",
      ),
    ).toBe(true);
    expect(
      reading.branchInteractionBadges.some(
        (badge) => badge.schoolLabel === "ชง" && badge.status === "neutralized",
      ),
    ).toBe(true);
    expect(reading.roleBadges[0]).toMatchObject({
      semanticKind: "role-stem",
      hierarchyLevel: "day-master",
      doctrineKey: expect.stringMatching(/^ten-god:/),
      readingOrder: 2,
    });
    expect(reading.branchInteractionBadges.find((badge) => badge.schoolLabel === "ภาคี")).toMatchObject({
      semanticKind: "branch-combination",
      doctrineKey: "interaction:branch-combination",
      hierarchyLevel: "interaction",
      readingOrder: 3,
    });
    expect(reading.markerBadges[0]).toMatchObject({
      semanticKind: "marker-nobleman",
      doctrineKey: "marker:nobleman",
      hierarchyLevel: "overlay",
      readingOrder: 4,
    });
    expect(reading.groups.map((group) => group.key)).toEqual([
      "roles",
      "stem-interactions",
      "branch-interactions",
      "markers",
    ]);
    expect(reading.groups.map((group) => group.readingOrder)).toEqual([2, 3, 3, 4]);
  });
});

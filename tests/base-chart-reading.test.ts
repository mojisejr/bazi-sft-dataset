import { describe, expect, test } from "vitest";

import type { DayMasterStrengthProfileValue, PillarValue, ShenShaValue } from "@/lib/bazi/schema-types";
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

const sampleStrengthProfile: DayMasterStrengthProfileValue = {
  dayMaster: "己",
  strengthState: "balanced",
  displayLabel: "สมดุล",
  narrative: "ดิถีอยู่ในจุดที่รับแรงและส่งแรงได้พอประมาณ",
  qiLabel: "ตี้อ๋วง",
};

describe("buildBaseChartReading", () => {
  test("builds role badges and neutralizes clashes that lose to combinations", () => {
    const resolution = resolveBranchInteractionEffects(samplePillars);
    const reading = buildBaseChartReading({
      dayMasterStem: "己",
      pillars: samplePillars,
      shenSha: sampleMarkers,
      resolution,
      precedenceSignals: resolution.precedenceSignals,
      strengthScore: 3.25,
      dayMasterStrengthProfile: sampleStrengthProfile,
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
    expect(reading.groups.map((group) => group.key)).toEqual([
      "roles",
      "stem-interactions",
      "branch-interactions",
      "markers",
    ]);
    expect(reading.strengthGate).toMatchObject({
      title: "กำลังดิถี",
      displayLabel: "สมดุล",
      qiLabel: "ตี้อ๋วง",
      score: 3.25,
    });
    expect(reading.schoolSections.map((section) => section.key)).toEqual([
      "strength-gate",
      "roles",
      "stem-interactions",
      "branch-interactions",
      "markers",
    ]);
    expect(reading.schoolSections[1]).toMatchObject({
      title: "จับซิ้ง / บทบาทต่อดิถี",
      readingOrder: 2,
    });
    expect(reading.readingOrderSteps).toEqual([
      "เริ่มจากดิถีและ ribbon พื้นดวงก่อน",
      "ล็อกกำลังดิถีให้ชัดก่อน ว่าดิถีแข็ง อ่อน หรือสมดุล",
      "อ่านจับซิ้งและบทบาทต่อดิถีของตัวสำคัญ",
      "อ่านปฏิกิริยาชั้นฟ้า แล้วค่อยลงชั้นดินตามลำดับ",
      "ดู marker พิเศษเป็นชั้นเสริมท้ายสุด",
    ]);

    const roleBadge = reading.roleBadges.find((badge) => badge.id === "year-stem-role");
    expect(roleBadge?.semantic).toMatchObject({
      kind: "role",
      sourceKind: "doctrine-role",
      schoolKey: "power",
      flowCycleType: "controlling",
      flowDirection: "inward",
      flowLabel: "พิฆาต",
    });

    expect(reading.markerBadges[0]?.semantic).toMatchObject({
      kind: "marker",
      sourceKind: "canonical-marker",
      schoolKey: "nobleman",
      overlayTier: "visible",
      displayLabel: "กุ้ยนั้ง/อุปถัมภ์ (天乙贵人)",
    });
  });
});

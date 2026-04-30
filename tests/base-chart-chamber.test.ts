import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BaseChartReactionChamber } from "@/components/bazi/BaseChartReactionChamber";
import {
  buildBaseChartChamberModel,
  resolveBaseChartChamberSelection,
} from "@/lib/bazi/base-chart-chamber";
import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { CalculatedStateSchema, type PillarValue, type ShenShaValue } from "@/lib/bazi/schema-types";

const samplePillars: Record<"year" | "month" | "day" | "hour", PillarValue> = {
  year: {
    stem: "甲",
    branch: "子",
    hiddenStems: ["癸"],
    tenGod: "正官",
    stemTranslation: "ไม้",
    branchTranslation: "ชวด",
    upperStageDisplay: "ลิ่มกัว",
    sittingStage: "หมกยก",
    lowerStageDisplay: "หมกยก/ลิ่มกัว",
  },
  month: {
    stem: "己",
    branch: "丑",
    hiddenStems: ["己", "癸", "辛"],
    tenGod: "比肩",
    stemTranslation: "ดิน",
    branchTranslation: "ฉลู",
    upperStageDisplay: "แป่",
    sittingStage: "เจ๊าะ",
    lowerStageDisplay: "เจ๊าะ/แป่",
  },
  day: {
    stem: "己",
    branch: "午",
    hiddenStems: ["丁", "己"],
    tenGod: "ดิถี",
    stemTranslation: "ดิน",
    branchTranslation: "มะเมีย",
    sittingStage: "ตี้อ๋วง",
    lowerStageDisplay: "ตี้อ๋วง/ตี้อ๋วง",
  },
  hour: {
    stem: "丁",
    branch: "未",
    hiddenStems: ["己", "丁", "乙"],
    tenGod: "偏印",
    stemTranslation: "ไฟ",
    branchTranslation: "มะแม",
    upperStageDisplay: "เอี้ยง",
    sittingStage: "กวงตั่ว",
    lowerStageDisplay: "กวงตั่ว/เอี้ยง",
  },
};

const sampleMarkers: ShenShaValue[] = [{
  starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
  relatedPillar: "ปี",
  meaning: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
}];

function createCalculatedState() {
  return CalculatedStateSchema.parse({
    fourPillars: samplePillars,
    mingGong: {
      stem: "壬",
      branch: "寅",
      hiddenStems: ["甲", "丙", "戊"],
      tenGod: "正财",
      stemTranslation: "น้ำ",
      branchTranslation: "ขาล",
      upperStageDisplay: "ลิ่มกัว",
      sittingStage: "หมกยก",
      lowerStageDisplay: "หมกยก/ลิ่มกัว",
    },
    shenSha: sampleMarkers,
    dayMaster: "己",
    strengthScore: 3.07,
    tenGods: {},
    twelveQi: { dayBranch: "ตี้อ๋วง" },
    dayMasterStrengthProfile: {
      dayMaster: "己",
      strengthState: "อ่อนแอ",
      displayBand: "ดวงอ่อน",
      displayLabel: "ดิถีอ่อน",
      narrative: "ดิถีดินหยินกำลังอ่อน",
      qiLabel: "帝旺",
      scoreText: "3.07",
    },
    baseChartReading: buildBaseChartReading({
      dayMasterStem: "己",
      pillars: samplePillars,
      shenSha: sampleMarkers,
      precedenceSignals: [],
    }),
  });
}

describe("buildBaseChartChamberModel", () => {
  test("maps anchors, markers, and default edge selection from base chart reading", () => {
    const calculatedState = createCalculatedState();
    const model = buildBaseChartChamberModel(calculatedState);

    expect(model).not.toBeNull();
    expect(model?.anchors.map((anchor) => anchor.id)).toEqual([
      "ming-gong",
      "hour",
      "day",
      "month",
      "year",
    ]);
    expect(model?.anchors.find((anchor) => anchor.id === "year")?.markerBadges).toHaveLength(1);
    expect(model?.defaultSelection.kind).toBe("edge");

    if (!model) {
      throw new Error("Expected chamber model");
    }

    const resolved = resolveBaseChartChamberSelection(model, model.defaultSelection);
    expect(resolved.kicker).toBe("interaction");
    expect(resolved.title.length).toBeGreaterThan(0);
  });
});

describe("BaseChartReactionChamber", () => {
  test("renders chamber anchors and inspector from the deterministic model", () => {
    const calculatedState = createCalculatedState();
    const html = renderToStaticMarkup(
      createElement(BaseChartReactionChamber, {
        calculatedState,
        onOpenReactionBadge: () => undefined,
        onOpenRouteDetail: () => undefined,
      }),
    );

    expect(html).toContain("Reaction Chamber");
    expect(html).toContain("data-anchor-key=\"day\"");
    expect(html).toContain("reaction chamber inspector");
    expect(html).toContain("ดิถีอ่อน");
  });
});
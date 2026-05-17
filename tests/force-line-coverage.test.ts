import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import { normalizeBranchPairKey } from "@/lib/bazi/symbolic-engine.constants";
import type { PillarValue, ShenShaValue } from "@/lib/bazi/schema-types";

const noMarkers: ShenShaValue[] = [];

function makePillar(stem: string, branch: string): PillarValue {
  return { stem, branch, hiddenStems: [] };
}

function makePillars(config: {
  year?: [string, string];
  month?: [string, string];
  day?: [string, string];
  hour?: [string, string];
  dayMaster?: string;
}) {
  const pillars = {
    year: config.year ? makePillar(...config.year) : makePillar("甲", "子"),
    month: config.month ? makePillar(...config.month) : makePillar("乙", "丑"),
    day: config.day ? makePillar(...config.day) : makePillar("丙", "寅"),
    hour: config.hour ? makePillar(...config.hour) : makePillar("丁", "卯"),
  };
  const dayMaster = config.dayMaster ?? pillars.day.stem;
  return { pillars, dayMaster };
}

function buildReading(config: Parameters<typeof makePillars>[0]) {
  const { pillars, dayMaster } = makePillars(config);
  const resolution = resolveBranchInteractionEffects(pillars);
  const reading = buildBaseChartReading({
    dayMasterStem: dayMaster,
    pillars,
    shenSha: noMarkers,
    resolution,
    precedenceSignals: resolution.precedenceSignals,
  });
  return { reading, resolution, pillars };
}

describe("normalizeBranchPairKey", () => {
  test("produces identical key regardless of argument order for all 66 branch pairs", () => {
    const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

    for (let i = 0; i < branches.length; i += 1) {
      for (let j = i + 1; j < branches.length; j += 1) {
        const a = branches[i];
        const b = branches[j];
        expect(normalizeBranchPairKey(a, b)).toBe(normalizeBranchPairKey(b, a));
      }
    }
  });

  test("uses BRANCH_ORDER canonical ordering", () => {
    expect(normalizeBranchPairKey("午", "卯")).toBe("卯|午");
    expect(normalizeBranchPairKey("卯", "午")).toBe("卯|午");
    expect(normalizeBranchPairKey("子", "丑")).toBe("子|丑");
    expect(normalizeBranchPairKey("丑", "子")).toBe("子|丑");
  });
});

describe("Force-line coverage — 9 interaction families", () => {
  describe("1. Combination (ภาคี)", () => {
    test("子丑 combination is active when both branches present", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "子"],
        month: ["己", "丑"],
        day: ["丙", "寅"],
        hour: ["丁", "卯"],
      });

      expect(resolution.activeCombinations).toContain("子丑");

      const comboBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "ภาคี" && b.label.includes("子丑"),
      );
      expect(comboBadge).toBeDefined();
      expect(comboBadge!.status).toBe("active");
      expect(comboBadge!.participants).toHaveLength(2);
    });
  });

  describe("2. Clash (ชง)", () => {
    test("子午 clash is active when no combination neutralizes it", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "午"],
        day: ["丙", "辰"],
        hour: ["丁", "申"],
      });

      expect(resolution.activeCombinations).toContain("申子辰");
      expect(resolution.activeClashes).toEqual([]);
      expect(resolution.neutralizedClashes).toContain("子午");

      const clashBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "ชง" && b.label.includes("子午"),
      );
      expect(clashBadge).toBeDefined();
      expect(clashBadge!.status).toBe("neutralized");
    });

    test("子午 clash is neutralized when 子丑 combination exists", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "子"],
        month: ["己", "丑"],
        day: ["丙", "午"],
        hour: ["丁", "申"],
      });

      expect(resolution.activeCombinations).toContain("子丑");
      expect(resolution.neutralizedClashes).toContain("子午");

      const clashBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "ชง" && b.label.includes("子午"),
      );
      expect(clashBadge).toBeDefined();
      expect(clashBadge!.status).toBe("neutralized");
    });
  });

  describe("3. Harm (ไห่)", () => {
    test("子未 harm is active when no major conflict on its pillars", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "未"],
        day: ["丙", "寅"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activeHarms).toContain("子未");

      const harmBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "ไห่" && b.label.includes("子未"),
      );
      expect(harmBadge).toBeDefined();
      expect(harmBadge!.status).toBe("active");
    });

    test("子未 harm is supplementary when 子 is in a combination", () => {
      const { reading } = buildReading({
        year: ["甲", "子"],
        month: ["己", "丑"],
        day: ["丙", "未"],
        hour: ["丁", "巳"],
      });

      const harmBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "ไห่" && b.label.includes("子未"),
      );
      expect(harmBadge).toBeDefined();
      expect(harmBadge!.status).toBe("supplementary");
    });
  });

  describe("4. Destruction (ผั่ว)", () => {
    test("子酉 destruction is active when no major conflict on its pillars", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "酉"],
        day: ["丙", "寅"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activeDestructions).toContain("子酉");

      const destructionBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "ผั่ว" && b.label.includes("子酉"),
      );
      expect(destructionBadge).toBeDefined();
      expect(destructionBadge!.status).toBe("active");
    });
  });

  describe("5. Punishment pair (เฮ้งคู่)", () => {
    test("子卯 punishment pair is detected", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "寅"],
        day: ["丙", "卯"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activePunishments).toContain("子卯");

      const punishmentBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "เฮ้ง" && b.label.includes("子卯"),
      );
      expect(punishmentBadge).toBeDefined();
      expect(punishmentBadge!.status).toBe("active");
      expect(punishmentBadge!.participants).toHaveLength(2);
    });
  });

  describe("6. Punishment trio (ซำเฮ้ง)", () => {
    test("寅巳申 trio is NOT suppressed — tier is tertiary", () => {
      const { resolution } = buildReading({
        year: ["甲", "寅"],
        month: ["乙", "巳"],
        day: ["丙", "申"],
        hour: ["丁", "子"],
      });

      expect(resolution.activeCombinations).toContain("巳申");
      expect(resolution.activePunishments).toContain("寅巳申");
      expect(resolution.interactionTiers["punishment-寅巳申"]).toBe("tertiary");
    });

    test("丑未戌 trio is NOT suppressed — tier is tertiary", () => {
      const { resolution } = buildReading({
        year: ["甲", "丑"],
        month: ["乙", "未"],
        day: ["丙", "戌"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activeClashes).toContain("丑未");
      expect(resolution.activePunishments).toContain("丑未戌");
      expect(resolution.interactionTiers["punishment-丑未戌"]).toBe("tertiary");
    });

    test("trio badge exists in reading as tertiary interaction", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "丑"],
        month: ["乙", "未"],
        day: ["丙", "戌"],
        hour: ["丁", "巳"],
      });

      const trioBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "เฮ้ง" && b.label.includes("丑未戌"),
      );
      expect(trioBadge).toBeDefined();
      expect(resolution.interactionTiers["punishment-丑未戌"]).toBe("tertiary");
    });
  });

  describe("7. Self-punishment", () => {
    test("辰辰 self-punishment is detected when 辰 appears >= 2 times", () => {
      const { reading, resolution } = buildReading({
        year: ["甲", "辰"],
        month: ["乙", "辰"],
        day: ["丙", "寅"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activePunishments).toContain("辰辰");

      const selfBadge = reading.branchInteractionBadges.find(
        (b) => b.schoolLabel === "เฮ้ง" && b.label.includes("辰辰"),
      );
      expect(selfBadge).toBeDefined();
      expect(selfBadge!.status).toBe("active");
    });
  });

  describe("8. Stem Combination (ฟ้าภาคี)", () => {
    test("甲己 stem combination is detected and creates badge", () => {
      const { reading } = buildReading({
        year: ["甲", "子"],
        month: ["己", "丑"],
        day: ["丙", "寅"],
        hour: ["丁", "卯"],
      });

      const stemCombo = reading.stemInteractionBadges.find(
        (b) => b.schoolLabel === "ภาคีราศีบน" && b.label.includes("甲己"),
      );
      expect(stemCombo).toBeDefined();
      expect(stemCombo!.status).toBe("active");
      expect(stemCombo!.participants).toHaveLength(2);
      expect(stemCombo!.participants[0].type).toBe("stem");
    });

    test("乙庚 stem combination is detected", () => {
      const { reading } = buildReading({
        year: ["乙", "子"],
        month: ["庚", "丑"],
        day: ["丙", "寅"],
        hour: ["丁", "卯"],
      });

      const stemCombo = reading.stemInteractionBadges.find(
        (b) => b.schoolLabel === "ภาคีราศีบน" && b.label.includes("乙庚"),
      );
      expect(stemCombo).toBeDefined();
    });
  });

  describe("9. Stem Clash (ฟ้าพิฆาต)", () => {
    test("甲戊 stem clash is detected", () => {
      const { reading } = buildReading({
        year: ["甲", "子"],
        month: ["戊", "丑"],
        day: ["丙", "寅"],
        hour: ["丁", "卯"],
      });

      const stemClash = reading.stemInteractionBadges.find(
        (b) => b.schoolLabel === "พิฆาตราศีบน" && b.label.includes("甲戊"),
      );
      expect(stemClash).toBeDefined();
      expect(stemClash!.status).toBe("active");
    });

    test("丙庚 stem clash is detected", () => {
      const { reading } = buildReading({
        year: ["丙", "子"],
        month: ["庚", "丑"],
        day: ["甲", "寅"],
        hour: ["丁", "卯"],
      });

      const stemClash = reading.stemInteractionBadges.find(
        (b) => b.schoolLabel === "พิฆาตราศีบน" && b.label.includes("丙庚"),
      );
      expect(stemClash).toBeDefined();
    });
  });
});

describe("Precedence logic", () => {
  test("combination neutralizes clash on shared pillar", () => {
    const { resolution } = buildReading({
      year: ["甲", "子"],
      month: ["己", "丑"],
      day: ["丙", "午"],
      hour: ["丁", "申"],
    });

    expect(resolution.activeCombinations).toContain("子丑");
    expect(resolution.neutralizedClashes).toContain("子午");
    expect(resolution.activeClashes).toEqual([]);
  });

  test("punishment coexists with clash — tier is tertiary", () => {
    const { resolution } = buildReading({
      year: ["甲", "子"],
      month: ["乙", "午"],
      day: ["丙", "卯"],
      hour: ["丁", "辰"],
    });

    expect(resolution.activeClashes).toContain("子午");
    expect(resolution.activePunishments).toContain("子卯");
    expect(resolution.interactionTiers["punishment-子卯"]).toBe("tertiary");
  });

  test("harm is supplementary when pillar is in active clash", () => {
    const { reading } = buildReading({
      year: ["甲", "子"],
      month: ["乙", "午"],
      day: ["丙", "未"],
      hour: ["丁", "巳"],
    });

    const harmBadge = reading.branchInteractionBadges.find(
      (b) => b.schoolLabel === "ไห่",
    );
    expect(harmBadge).toBeDefined();
    expect(harmBadge!.status).toBe("supplementary");
  });

  describe("Interaction tier annotations", () => {
    test("combination gets tier primary", () => {
      const { resolution } = buildReading({
        year: ["甲", "寅"],
        month: ["乙", "亥"],
        day: ["丙", "子"],
        hour: ["丁", "丑"],
      });

      expect(resolution.activeCombinations).toContain("寅亥");
      expect(resolution.interactionTiers["combination-寅亥"]).toBe("primary");
    });

    test("active clash gets tier primary", () => {
      const { resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "午"],
        day: ["丙", "寅"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activeClashes).toContain("子午");
      expect(resolution.interactionTiers["clash-子午"]).toBe("primary");
    });

    test("neutralized clash gets tier secondary", () => {
      const { resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "丑"],
        day: ["丙", "午"],
        hour: ["丁", "未"],
      });

      expect(resolution.neutralizedClashes).toContain("子午");
      expect(resolution.interactionTiers["clash-子午"]).toBe("secondary");
    });

    test("harm gets tier secondary", () => {
      const { resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "未"],
        day: ["丙", "寅"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activeHarms).toContain("子未");
      expect(resolution.interactionTiers["harm-子未"]).toBe("secondary");
    });

    test("destruction gets tier secondary", () => {
      const { resolution } = buildReading({
        year: ["甲", "子"],
        month: ["乙", "酉"],
        day: ["丙", "寅"],
        hour: ["丁", "巳"],
      });

      expect(resolution.activeDestructions).toContain("子酉");
      expect(resolution.interactionTiers["destruction-子酉"]).toBe("secondary");
    });

    test("all three tiers coexist in complex chart", () => {
      const { resolution } = buildReading({
        year: ["甲", "寅"],
        month: ["乙", "巳"],
        day: ["丙", "申"],
        hour: ["丁", "子"],
      });

      expect(resolution.interactionTiers["combination-巳申"]).toBe("primary");
      expect(resolution.interactionTiers["punishment-寅巳申"]).toBe("tertiary");
    });
  });
});

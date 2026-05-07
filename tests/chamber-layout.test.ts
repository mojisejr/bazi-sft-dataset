import { describe, expect, test } from "vitest";

import { buildBaseChartReading } from "@/lib/bazi/symbolic-engine.base-chart";
import { resolveBranchInteractionEffects } from "@/lib/bazi/symbolic-engine.interactions";
import {
  assignChamberGraphLayout,
  computeChamberLayoutPositions,
  resolveChamberInteractionHandles,
} from "@/lib/bazi/chamber-layout";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";
import type { CalculatedStateValue, PillarValue, ShenShaValue } from "@/lib/bazi/schema-types";

const samplePillars: Record<"year" | "month" | "day" | "hour", PillarValue> = {
  year: {
    stem: "甲",
    branch: "子",
    hiddenStems: ["癸"],
    tenGod: "正官",
    stemTranslation: "ไม้",
    branchTranslation: "ชวด",
    upperStageDisplay: "หมกยก/เชี่ยงแซ",
    sittingStage: "เชี่ยงแซ",
    lowerStageDisplay: "หมกยก/เชี่ยงแซ",
  },
  month: {
    stem: "己",
    branch: "丑",
    hiddenStems: ["己", "癸", "辛"],
    tenGod: "比肩",
    stemTranslation: "ดิน",
    branchTranslation: "ฉลู",
    upperStageDisplay: "เจ๊าะ/แป่",
    sittingStage: "แป่",
    lowerStageDisplay: "หมกยก/แป่",
  },
  day: {
    stem: "己",
    branch: "午",
    hiddenStems: ["丁", "己"],
    tenGod: "ดิถี",
    stemTranslation: "ดิน",
    branchTranslation: "มะเมีย",
    sittingStage: "ตี้อ๋วง",
    lookingStage: "ตี้อ๋วง",
    lowerStageDisplay: "ตี้อ๋วง/ตี้อ๋วง",
  },
  hour: {
    stem: "丁",
    branch: "未",
    hiddenStems: ["己", "丁", "乙"],
    tenGod: "偏印",
    stemTranslation: "ไฟ",
    branchTranslation: "มะแม",
    upperStageDisplay: "เจ๊าะ/เอี้ยง",
    sittingStage: "เอี้ยง",
    lookingStage: "กวงตั่ว",
    lowerStageDisplay: "กวงตั่ว/เอี้ยง",
  },
};

const sampleMarkers: ShenShaValue[] = [
  {
    starName: "ขุนนาง/อุปถัมภ์ (天乙贵人)",
    relatedPillar: "ปี",
    meaning: "มีผู้ใหญ่เข้ามาช่วยเมื่อจังหวะเปิด",
  },
  {
    starName: "ดอกท้อ (桃花)",
    relatedPillar: "เดือน",
    meaning: "เสน่ห์และแรงดึงดูดทางสังคม",
  },
];

function buildStubCalculatedState(): CalculatedStateValue {
  const resolution = resolveBranchInteractionEffects(samplePillars);
  const reading = buildBaseChartReading({
    dayMasterStem: "己",
    pillars: samplePillars,
    shenSha: sampleMarkers,
    resolution,
    precedenceSignals: resolution.precedenceSignals,
  });

  return {
    fourPillars: samplePillars,
    baseChartReading: reading,
  } as unknown as CalculatedStateValue;
}

describe("chamber layout module", () => {
  test("computeChamberLayoutPositions assigns monotonic pillar positions for the same chart", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = computeChamberLayoutPositions(graph);

    const order = ["hour", "day", "month", "year"];
    const stemXValues = order.map((key) => positions.get(`stem:${key}`)?.x ?? 0);
    const branchXValues = order.map((key) => positions.get(`branch:${key}`)?.x ?? 0);

    for (let i = 1; i < stemXValues.length; i += 1) {
      expect(stemXValues[i]).toBeGreaterThan(stemXValues[i - 1]);
    }

    for (let i = 1; i < branchXValues.length; i += 1) {
      expect(branchXValues[i]).toBeGreaterThan(branchXValues[i - 1]);
    }

    for (const key of order) {
      expect(positions.get(`stem:${key}`)?.x).toBe(positions.get(`branch:${key}`)?.x);
    }

    expect((positions.get("stem:day")?.y ?? 0)).toBeLessThan(positions.get("branch:day")?.y ?? 0);
  });

  test("assignChamberGraphLayout mutates graph nodes deterministically", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    const positions = assignChamberGraphLayout(graph);

    expect(graph.nodes.find((node) => node.id === "stem:day")?.position).toEqual(positions.get("stem:day"));
    expect(graph.nodes.find((node) => node.id === "branch:day")?.position).toEqual(positions.get("branch:day"));
  });

  test("resolveChamberInteractionHandles mirrors current far-span top-handle rule", () => {
    expect(resolveChamberInteractionHandles("hour", "year", true, true)).toEqual({
      sourceHandle: "source-top",
      targetHandle: "target-top",
    });

    expect(resolveChamberInteractionHandles("hour", "day", true, true)).toEqual({
      sourceHandle: "source-right",
      targetHandle: "target-left",
    });

    expect(resolveChamberInteractionHandles("day", "day", true, false)).toEqual({
      sourceHandle: "source-bottom",
      targetHandle: "target-top",
    });
  });

  test("reaction-layer parallel offsets stay deterministic after layout extraction", () => {
    const graph = buildSemanticChamberGraph(buildStubCalculatedState());
    assignChamberGraphLayout(graph);

    const reactionEdges = graph.edges.filter((edge) => edge.data.layer === "inter-pillar-reaction");
    const pairGroups = new Map<string, typeof reactionEdges>();

    for (const edge of reactionEdges) {
      const key = `${edge.source}->${edge.target}`;
      const group = pairGroups.get(key);
      if (group) {
        group.push(edge);
      } else {
        pairGroups.set(key, [edge]);
      }
    }

    for (const group of pairGroups.values()) {
      if (group.length === 1) {
        expect(group[0].data.parallelOffset).toBe(0);
      } else {
        for (let index = 0; index < group.length; index += 1) {
          expect(group[index].data.parallelOffset).toBe(index * 18);
        }
      }
    }
  });
});

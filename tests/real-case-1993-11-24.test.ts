import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";

import { REAL_CASE_1993_11_24_GOLDEN_CONTRACT } from "./fixtures/real-case-golden-contracts";
import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("Real-world test case: 24 November 1993, 15:09, Chiang Rai, male", () => {
  test("matches the frozen doctrine baseline for pillars, markers, interactions, and stage surfaces", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.input),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.fourPillars.year);
    expect(result.fourPillars.month).toMatchObject(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.fourPillars.month);
    expect(result.fourPillars.day).toMatchObject(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.fourPillars.day);
    expect(result.fourPillars.hour).toMatchObject(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.fourPillars.hour);
    expect(result.dayMaster).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.dayMaster);
    expect(result.strengthScore).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.strengthScore);

    expect(result.fourPillars.year.upperStageDisplay).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStageDisplays.yearUpper);
    expect(result.fourPillars.month.upperStageDisplay).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStageDisplays.monthUpper);
    expect(result.fourPillars.day.lowerStageDisplay).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStageDisplays.dayLower);
    expect(result.fourPillars.hour.upperStageDisplay).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStageDisplays.hourUpper);
    expect(result.fourPillars.hour.lowerStageDisplay).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStageDisplays.hourLower);

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();
    expect(reading!.strengthGate).toMatchObject({
      title: "กำลังดิถี",
      score: REAL_CASE_1993_11_24_GOLDEN_CONTRACT.strengthScore,
    });
    expect(reading!.schoolSections.map((section) => section.key)).toEqual([
      "strength-gate",
      "roles",
      "stem-interactions",
      "branch-interactions",
      "markers",
    ]);

    const stemClashes = reading!.stemInteractionBadges.filter(
      (badge) => badge.label === REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStemInteractions[0].label
        && badge.schoolLabel === REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStemInteractions[0].schoolLabel,
    );
    expect(stemClashes).toHaveLength(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStemInteractions[0].occurrences);
    stemClashes.forEach((badge) => {
      expect(badge.status).toBe(REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedStemInteractions[0].status);
    });

    REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedBranchInteractions.forEach((expectedBadge) => {
      const badge = reading!.branchInteractionBadges.find(
        (candidate) => candidate.label === expectedBadge.label && candidate.schoolLabel === expectedBadge.schoolLabel,
      );
      expect(badge).toBeDefined();
      expect(badge!.status).toBe(expectedBadge.status);
      expect(badge!.tier).toBe(expectedBadge.tier);
    });

    REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedMarkers.visible.forEach((expectedMarker) => {
      const marker = reading!.markerBadges.find(
        (badge) => badge.schoolLabel === expectedMarker.schoolLabel
          && JSON.stringify(badge.participants.map((participant) => participant.pillarLabel))
            === JSON.stringify(expectedMarker.pillars),
      );
      expect(marker).toBeDefined();
    });

    const graph = buildSemanticChamberGraph(result);
    const graphVisibleLabels = graph.nodes
      .filter((node) => node.type === "chamberMarker" && node.data.kind === "marker")
      .map((node) => node.data.displayLabel);
    REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedMarkers.graphVisible.forEach((label) => {
      expect(graphVisibleLabels).toContain(label);
    });

    expect(graph.hiddenSecondaryOverlays.map((badge) => badge.label)).toEqual(
      REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedMarkers.graphHiddenOverlay,
    );

    const elementFlowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");
    REAL_CASE_1993_11_24_GOLDEN_CONTRACT.expectedElementFlow.forEach((expectedEdge) => {
      const edge = elementFlowEdges.find((candidate) => candidate.id.includes(expectedEdge.edgeIdIncludes));
      expect(edge).toBeDefined();
      expect(edge!.data.flowLabel).toBe(expectedEdge.flowLabel);
      expect(edge!.data.flowElement).toBe(expectedEdge.flowElement);
      expect(edge!.data.flowDirection).toBe(expectedEdge.flowDirection);
    });
  });
});

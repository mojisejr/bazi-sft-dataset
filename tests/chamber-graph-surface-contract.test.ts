import { describe, expect, test } from "vitest";

import {
  CHAMBER_FROZEN_INVARIANTS,
  CHAMBER_GRAPH_SURFACE_INVENTORY,
} from "@/lib/bazi/chamber-graph-surface-contract";
import { buildSemanticChamberGraph, getSemanticDayFocusNodeIds, isFocalSemanticNode } from "@/lib/bazi/semantic-chamber-graph";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("chamber graph surface contract", () => {
  test("only one active graph adapter exists in the chamber boundary inventory", () => {
    const activeGraphAdapters = CHAMBER_GRAPH_SURFACE_INVENTORY.filter(
      (item) => item.name === "active graph adapter" && item.status === "active",
    );

    expect(activeGraphAdapters).toHaveLength(1);
    expect(activeGraphAdapters[0].path).toBe("src/lib/bazi/semantic-chamber-graph.ts");
  });

  test("active session contract is singular and points to the live workspace store", () => {
    const activeSessionContracts = CHAMBER_GRAPH_SURFACE_INVENTORY.filter(
      (item) => item.name === "active session contract" && item.status === "active",
    );

    expect(activeSessionContracts).toHaveLength(1);
    expect(activeSessionContracts[0].path).toBe("src/lib/bazi/bazi-session-store.ts");
  });

  test("dormant surfaces are explicitly marked non-authoritative", () => {
    const dormantItems = CHAMBER_GRAPH_SURFACE_INVENTORY.filter(
      (item) => item.status === "dormant",
    );

    const dormantPaths = dormantItems.map((item) => item.path);

    expect(dormantPaths).toContain("src/lib/bazi/base-chart-chamber-graph.ts");
    expect(dormantPaths).toContain("src/lib/bazi/chamber-session-store.ts");
    expect(dormantPaths).toContain("src/components/bazi/reaction-chamber/ChamberPillarNode.tsx");
  });

  test("graph-first invariants are frozen", () => {
    const invariantIds = CHAMBER_FROZEN_INVARIANTS.map((item) => item.id);

    expect(invariantIds).toContain("graph-first-primary");
    expect(invariantIds).toContain("symbolic-engine-truth");
    expect(invariantIds).toContain("typed-doctrine-first");
    expect(invariantIds).toContain("session-redirect-behavior");
    expect(invariantIds).toContain("support-surfaces-subordinate");
  });

  test("active semantic graph still exposes stable focus ids for the day pillar", async () => {
    const repository = createTestKnowledgeRepository();
    const calculatedState = await calculateBaziChart(
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

    const graph = buildSemanticChamberGraph(calculatedState);
    const focusIds = getSemanticDayFocusNodeIds(graph);

    expect(focusIds).toEqual(["stem:day", "branch:day"]);
    expect(graph.nodes.filter(isFocalSemanticNode).map((node) => node.id)).toEqual(["stem:day", "branch:day"]);
  });

  test("active semantic graph preserves the live node topology baseline for a grounded case", async () => {
    const repository = createTestKnowledgeRepository();
    const calculatedState = await calculateBaziChart(
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

    const graph = buildSemanticChamberGraph(calculatedState);

    const stemNodes = graph.nodes.filter((node) => node.type === "chamberStemNode");
    const branchNodes = graph.nodes.filter((node) => node.type === "chamberBranchNode");
    const markerNodes = graph.nodes.filter((node) => node.type === "chamberMarker");

    expect(stemNodes).toHaveLength(4);
    expect(branchNodes).toHaveLength(4);
    expect(markerNodes.length).toBeGreaterThanOrEqual(1);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.schoolClusters.length).toBeGreaterThan(0);
    expect(graph.hiddenSecondaryOverlays.length).toBeGreaterThanOrEqual(1);
  });
});

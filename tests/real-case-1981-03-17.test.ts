import { describe, expect, test } from "vitest";

import { RawInputSchema } from "@/lib/bazi/schema-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { buildSemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("Real-world test case: 17 March 1981, 10:22, Bangkok, male", () => {
  test("computes the expected four pillars", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    expect(result.fourPillars.year).toMatchObject({ stem: "辛", branch: "酉" });
    expect(result.fourPillars.month).toMatchObject({ stem: "辛", branch: "卯" });
    expect(result.fourPillars.day).toMatchObject({ stem: "甲", branch: "午" });
    expect(result.fourPillars.hour).toMatchObject({ stem: "己", branch: "巳" });
  });

  test("detects stem combination 甲己 (day + hour)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    const comboBadge = reading!.stemInteractionBadges.find(
      (b) => b.schoolLabel === "ภาคีราศีบน" && b.label.includes("甲") && b.label.includes("己"),
    );
    expect(comboBadge).toBeDefined();
    expect(comboBadge!.status).toBe("active");
  });

  test("detects branch clash 卯酉 (month + year)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    const clashBadge = reading!.branchInteractionBadges.find(
      (b) => b.schoolLabel === "ชง" && b.label.includes("卯酉"),
    );
    expect(clashBadge).toBeDefined();
    expect(clashBadge!.status).toBe("active");
  });

  test("detects ซำเฮ้ง 卯午酉 trio in resolution — NOT suppressed, tier is tertiary", async () => {
    const { resolveBranchInteractionEffects } = await import("@/lib/bazi/symbolic-engine.interactions");
    const resolution = resolveBranchInteractionEffects({
      year: { stem: "辛", branch: "酉", hiddenStems: [] },
      month: { stem: "辛", branch: "卯", hiddenStems: [] },
      day: { stem: "甲", branch: "午", hiddenStems: [] },
      hour: { stem: "己", branch: "巳", hiddenStems: [] },
    });

    expect(resolution.activePunishments).toContain("卯午酉");
    expect(resolution.activeClashes).toContain("卯酉");
    expect(resolution.interactionTiers["punishment-卯午酉"]).toBe("tertiary");
  });

  test("detects ซำเฮ้ง 卯午酉 at raw interaction level", async () => {
    const { buildPunishmentInteractions } = await import("@/lib/bazi/symbolic-engine.interactions");
    const interactions = buildPunishmentInteractions({
      year: { stem: "甲", branch: "卯", hiddenStems: [] },
      month: { stem: "乙", branch: "午", hiddenStems: [] },
      day: { stem: "丙", branch: "酉", hiddenStems: [] },
      hour: { stem: "丁", branch: "子", hiddenStems: [] },
    });

    expect(interactions.some((i) => i.label === "卯午酉")).toBe(true);
  });

  test("detects intra-pillar ผั่ว 甲午 (day pillar)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    const puaBadge = reading!.branchInteractionBadges.find(
      (b) => b.schoolLabel === "ผั่ว" && b.label.includes("甲午"),
    );
    expect(puaBadge).toBeDefined();
    expect(puaBadge!.status).toBe("active");
    expect(puaBadge!.participants.some((p) => p.type === "stem" && p.symbol === "甲")).toBe(true);
    expect(puaBadge!.participants.some((p) => p.type === "branch" && p.symbol === "午")).toBe(true);
  });

  test("shows บุ่งเชียง marker on hour pillar", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    const wenChangMarker = reading!.markerBadges.find(
      (b) => b.label.includes("บุ่งเชียง") || b.label.includes("文昌"),
    );
    expect(wenChangMarker).toBeDefined();
    expect(wenChangMarker!.participants.some((p) => p.pillarLabel === "ยาม")).toBe(true);
  });

  test("does NOT show กุ้ยนั้ง markers (no 丑 or 未 in pillars)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const reading = result.baseChartReading;
    expect(reading).toBeDefined();

    const noblemanMarker = reading!.markerBadges.find(
      (b) => b.label.includes("กุ้ยนั้ง") || b.label.includes("天乙") || b.label.includes("ขุนนาง"),
    );
    expect(noblemanMarker).toBeUndefined();
  });

  test("element-flow: 甲(wood) → 己(earth) hour stem = wealth/controlling/outward", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const graph = buildSemanticChamberGraph(result, { quietGraph: false });
    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    const hourStemFlow = flowEdges.find((edge) =>
      edge.id.includes("hour-stem-role"),
    );
    expect(hourStemFlow).toBeDefined();
    expect(hourStemFlow!.data.flowCycleType).toBe("controlling");
    expect(hourStemFlow!.data.flowDirection).toBe("outward");
    expect(hourStemFlow!.data.flowLabel).toBe("โชคลาภ");
    expect(hourStemFlow!.data.flowElement).toBe("earth");
  });

  test("element-flow: 辛(metal) year stem = power/controlling/inward (metal克wood)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const graph = buildSemanticChamberGraph(result, { quietGraph: false });
    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    const yearStemFlow = flowEdges.find((edge) =>
      edge.id.includes("year-stem-role"),
    );
    expect(yearStemFlow).toBeDefined();
    expect(yearStemFlow!.data.flowCycleType).toBe("controlling");
    expect(yearStemFlow!.data.flowDirection).toBe("inward");
    expect(yearStemFlow!.data.flowLabel).toBe("พิฆาต");
    expect(yearStemFlow!.data.flowElement).toBe("metal");
  });

  test("element-flow: no water flow edges (water absent from stems)", async () => {
    const repository = createTestKnowledgeRepository();
    const result = await calculateBaziChart(
      RawInputSchema.parse({
        birthDate: "1981-03-17",
        birthTime: "10:22",
        gender: "male",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Bangkok",
      }),
      repository,
    );

    const graph = buildSemanticChamberGraph(result, { quietGraph: false });
    const flowEdges = graph.edges.filter((edge) => edge.data.layer === "element-flow");

    const stemFlowEdges = flowEdges.filter((edge) => edge.id.includes("-stem-role"));
    const waterEdges = stemFlowEdges.filter((edge) => edge.data.flowElement === "water");
    expect(waterEdges).toHaveLength(0);
  });
});

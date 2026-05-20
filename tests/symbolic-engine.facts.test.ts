import { describe, expect, test, vi } from "vitest";

import {
  ENGINE_DEPENDENCIES,
  EngineFactMapSchema,
} from "@/lib/bazi/knowledge/topic-types";
import { createEngineFactShell, getEngineFactBlueprint, getEngineFactsForDependencies } from "@/lib/bazi/symbolic-engine.facts";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("symbolic-engine fact shell", () => {
  test("creates a deterministic pending shell for every declared engine dependency", () => {
    const shell = createEngineFactShell();

    expect(Object.keys(shell)).toEqual(ENGINE_DEPENDENCIES);
    expect(EngineFactMapSchema.parse(shell)).toEqual(shell);

    for (const dependency of ENGINE_DEPENDENCIES) {
      expect(shell[dependency]).toMatchObject({
        dependency,
        resolved: false,
      });
      expect(shell[dependency].summary).toContain("Pending extractor implementation");
    }
  });

  test("returns extracted dependency facts in the same order as the topic contract", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const chart = await calculateBaziChart(
      {
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      },
      createTestKnowledgeRepository(),
    );

    const facts = getEngineFactsForDependencies(chart, [
      "day_master",
      "useful_god",
      "favorable_elements",
      "wealth_star",
      "clash_matrix",
    ]);

    expect(facts.map((fact) => fact.dependency)).toEqual([
      "day_master",
      "useful_god",
      "favorable_elements",
      "wealth_star",
      "clash_matrix",
    ]);
    expect(facts.every((fact) => fact.resolved === true)).toBe(true);
    expect(facts[0]?.summary).toContain("己");
    expect(facts[0]?.summary).toContain("ดิน");
    expect(facts[1]?.summary).toContain("ไฟ");
    expect(facts[2]?.summary).toContain("ไฟ");
    expect(facts[2]?.summary).toContain("ดิน");
    expect(facts[3]?.summary).toContain("正财");
    expect(facts[4]?.summary.length).toBeGreaterThan(0);
  });

  test("extracts narrative and matrix summaries from existing calculated state without mutating the engine", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const chart = await calculateBaziChart(
      {
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      },
      createTestKnowledgeRepository(),
    );

    const facts = getEngineFactsForDependencies(chart, [
      "day_master_strength",
      "sixty_jiazi_persona",
      "hidden_stems",
      "twelve_qi_profile",
      "dayun_cycles",
    ]);

    expect(facts[0]?.summary).toContain("อ่อนแอ");
    expect(facts[1]?.summary).toContain("己巳");
    expect(facts[1]?.summary).toContain("Builds influence patiently");
    expect(facts[2]?.summary).toContain("year=");
    expect(facts[3]?.summary).toContain("monthBranch");
    expect(facts[4]?.summary).toContain("-");
  });

  test("exposes source-path blueprints for future extractor implementation", () => {
    expect(getEngineFactBlueprint("day_master")).toMatchObject({
      dependency: "day_master",
      label: "Day Master",
      sourcePaths: ["calculatedState.dayMaster"],
    });
    expect(getEngineFactBlueprint("useful_god")).toMatchObject({
      dependency: "useful_god",
      label: "Useful God",
      sourcePaths: [],
    });
  });
});
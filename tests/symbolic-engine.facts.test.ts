import { describe, expect, test, vi } from "vitest";

import {
  ENGINE_DEPENDENCIES,
  EngineFactMapSchema,
} from "@/lib/bazi/knowledge/topic-types";
import {
  createEngineFactShell,
  getEngineFactBlueprint,
  getEngineFactsForDependencies,
} from "@/lib/bazi/symbolic-engine.facts";
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

  test("returns requested dependency shells in the same order as the topic contract", async () => {
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
      "wealth_star",
      "clash_matrix",
    ]);

    expect(facts.map((fact) => fact.dependency)).toEqual([
      "day_master",
      "wealth_star",
      "clash_matrix",
    ]);
    expect(facts.every((fact) => fact.resolved === false)).toBe(true);
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
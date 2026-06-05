import { afterEach, describe, expect, test, vi } from "vitest";

import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import {
  SOURCE1_GOLDEN_REFERENCE_CASE,
} from "@/lib/bazi/source1-operating-system-contract";
import { TRACE_RULE_NAMES, TRACE_STEP_KEYS } from "@/lib/bazi/trace-keys";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

afterEach(() => {
  vi.useRealTimers();
});

describe("calculateBaziFactState", () => {
  test("extracts OS-core facts for the Source 1 golden case without narrative overlays", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);

    expect(factState.structuralState).toMatchObject(SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors);
    expect(factState.fourPillars).toMatchObject(SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars);
    expect(factState.roleOfElementFacts).toMatchObject({
      tenGods: expect.objectContaining({
        yearStem: expect.any(String),
        monthStem: expect.any(String),
        dayStem: expect.any(String),
        hourStem: expect.any(String),
        mingGongStem: expect.any(String),
      }),
      seasonalInteraction: {
        dayMasterStem: "癸",
        dayMasterElement: "water",
        monthBranch: "子",
        season: "winter",
        phase: "peak",
        seasonLabel: "ฤดูหนาว",
        metaphor: expect.any(String),
      },
    });
    expect(factState.twelveQi.raw).toEqual(expect.objectContaining({
      yearBranch: expect.any(String),
      monthBranch: expect.any(String),
      dayBranch: expect.any(String),
      hourBranch: expect.any(String),
      mingGongBranch: expect.any(String),
    }));
    expect(factState.interactionState.outcomes).toEqual(expect.any(Array));
    expect(factState.traceMetadata).toMatchObject({
      mingGong: {
        ruleName: TRACE_RULE_NAMES.mingGong,
        stepKeys: [
          TRACE_STEP_KEYS.mingGong.readBranches,
          TRACE_STEP_KEYS.mingGong.resolveBoundary,
          TRACE_STEP_KEYS.mingGong.finalize,
        ],
      },
      strengthScore: {
        ruleName: TRACE_RULE_NAMES.strengthScore,
        stepKeys: [
          TRACE_STEP_KEYS.strengthScore.weightStages,
          TRACE_STEP_KEYS.strengthScore.addRelations,
          TRACE_STEP_KEYS.strengthScore.applyPenalties,
        ],
      },
    });
    expect(factState).not.toHaveProperty("compatibilityMatrixProfiles");
    expect(factState).not.toHaveProperty("sixtyJiaziCorePersona");
  });

  test("lets calculateBaziChart reconstruct stable structural state from OS-core facts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const repository = createTestKnowledgeRepository();
    const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);
    const calculatedState = await calculateBaziChart(SOURCE1_GOLDEN_REFERENCE_CASE.input, repository);

    expect(calculatedState.fourPillars).toEqual(factState.fourPillars);
    expect(calculatedState.mingGong).toEqual(factState.mingGong);
    expect(calculatedState.daYun).toEqual(factState.daYun);
    expect(calculatedState.liuNian).toEqual(factState.liuNian);
    expect(calculatedState.twelveQi).toEqual(factState.twelveQi.display);
    expect(calculatedState.strengthScore).toBe(factState.strengthScore);
    expect(calculatedState.tenGods).toEqual(factState.roleOfElementFacts.tenGods);
    expect(calculatedState.interactionState).toEqual(factState.interactionState);
    expect(calculatedState.explainable).toEqual(factState.explainable);
  });
});
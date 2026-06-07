import { describe, expect, test } from "vitest";

import {
  BAZI_SOURCE_OVERLAY_SEQUENCE,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  SOURCE4_WEALTH_INVESTMENT_STEP_IDS,
  buildSource4WealthInvestmentDoctrine,
} from "@/lib/bazi/source4-wealth-investment-doctrine";

describe("buildSource4WealthInvestmentDoctrine", () => {
  test("freezes all 6 Source 4 school steps and keeps source-4 immediately after source-6 using only caller-contract packet families", () => {
    const doctrine = buildSource4WealthInvestmentDoctrine();

    expect(doctrine.sourceId).toBe("source-4");
    expect(doctrine.steps.map((step) => step.stepId)).toEqual([...SOURCE4_WEALTH_INVESTMENT_STEP_IDS]);
    expect(BAZI_SOURCE_OVERLAY_SEQUENCE.indexOf("source-4")).toBe(
      BAZI_SOURCE_OVERLAY_SEQUENCE.indexOf("source-6") + 1,
    );
    expect(doctrine.forbidSource7LuckSmuggling).toBe(true);

    for (const step of doctrine.steps) {
      expect(step.source1Reuse.length).toBeGreaterThan(0);
      expect(step.source4LocalLogic.ownerTarget.module.startsWith("source4-")).toBe(true);
      expect(step.source4LocalLogic.ownerTarget.ownerKey).not.toMatch(/prompt|prose/i);
      expect(step.retrievalContextReuse.guardrails.length).toBeGreaterThan(0);
      expect(step.source1Reuse.map((entry) => entry.fieldId)).toEqual(
        expect.arrayContaining(step.source1Reuse.map((entry) => entry.fieldId)),
      );

      for (const fieldId of step.source1Reuse.map((entry) => entry.fieldId)) {
        expect(["weighted-strength", "role-of-element", "timing"]).toContain(fieldId);
      }
    }
  });

  test("covers wealth capacity, storage, leakage, spending, and timing without drifting into Source 7 promises", () => {
    const doctrine = buildSource4WealthInvestmentDoctrine();
    const storageVault = doctrine.terminologyFreeze.find((term) => term.termId === "wealth-storage-vault");
    const outputInvestment = doctrine.terminologyFreeze.find((term) => term.termId === "output-investment-lane");
    const timingWindow = doctrine.terminologyFreeze.find((term) => term.termId === "wealth-timing-window");
    const step3 = doctrine.steps.find((step) => step.stepId === "step-3-money-source-storage-and-leakage");
    const step4 = doctrine.steps.find((step) => step.stepId === "step-4-spending-and-investment-behavior");
    const step6 = doctrine.steps.find((step) => step.stepId === "step-6-wealth-timing-and-risk-window");

    expect(storageVault?.canonicalLabel).toBe("wealth storage vault");
    expect(storageVault?.mustNotBeNamedAs).toContain("career vault");
    expect(outputInvestment?.mustNotBeNamedAs).toContain("source6 business lane");
    expect(timingWindow?.mustNotBeNamedAs).toEqual(
      expect.arrayContaining(["source7 luck cycle", "jackpot promise"]),
    );

    expect(step3?.manualIntent).toContain("รั่วไหล");
    expect(step4?.manualIntent).toContain("Source 6");
    expect(step4?.source1Reuse.map((entry) => entry.fieldId)).toEqual(
      expect.arrayContaining(["role-of-element", "timing"]),
    );
    expect(step6?.source1Reuse.map((entry) => entry.fieldId)).toEqual(
      expect.arrayContaining(["weighted-strength", "role-of-element", "timing"]),
    );
    expect(step6?.manualIntent).toContain("ไม่ให้ Source 7");
  });
});
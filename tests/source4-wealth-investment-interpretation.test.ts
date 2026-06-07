import { describe, expect, test } from "vitest";

import {
  Source4WealthInvestmentInterpretationSchema,
  buildSource4WealthInvestmentInterpretation,
} from "@/lib/bazi/source4-wealth-investment-interpretation";
import { buildSource4WealthInvestmentOverlay } from "@/lib/bazi/source4-wealth-investment-overlay";

import { createGoldenCaseCallerContract } from "./helpers/source-overlay-golden-case";

describe("buildSource4WealthInvestmentInterpretation", () => {
  test("turns Source 4 overlay facts into a wealth reading lane without moving delivery ownership above the overlay", () => {
    const overlay = buildSource4WealthInvestmentOverlay(createGoldenCaseCallerContract());
    const interpretation = buildSource4WealthInvestmentInterpretation(overlay);

    expect(Source4WealthInvestmentInterpretationSchema.parse(interpretation)).toMatchObject({
      sourceId: "source-4",
      routeFrom: "source4-wealth-investment-overlay",
      status: "ready-for-reading",
    });
    expect(interpretation.accumulationProfile.facts).toMatchObject({
      capacityBand: "stable",
      sourceMode: "cashflow-primary",
      storageStatus: "vault-not-manifest",
      leakageSeverity: "high",
    });
    expect(interpretation.timingOutlook.facts).toMatchObject({
      timingWindow: "selective-window",
      riskBoundary: "capital-preservation",
      leakageAdjustmentApplied: true,
    });
    expect(interpretation.investmentRisk.facts.source6ContextRequired).toBe(false);
    expect(interpretation.deliveryContext.topic.sourceRefs[0]).toMatchObject({
      primarySource: "Source4_ การเงินและการลงทุน",
    });
    expect(interpretation.deliveryContext.dictionary.sourceRelativePaths).toContain(
      "Source4_ การเงินและการลงทุน/Source4_ การเงินและการลงทุน.md",
    );
    expect(interpretation.deliveryContext.retrieval).toMatchObject({
      dimensionName: "wealth_and_investment",
      strategy: "dictionary-first",
      coverage: "direct",
      fallbackRequired: false,
    });
    expect(interpretation.deliveryContext.contract.rejectedAssumptions).toContain(
      "career or relationship delivery surfaces can become the primary owner of wealth-risk meaning",
    );
  });

  test("derives wealth reading intent from overlay facts instead of recomputing the chart", () => {
    const overlay = buildSource4WealthInvestmentOverlay(createGoldenCaseCallerContract());
    const mutatedOverlay = structuredClone(overlay);
    const timingStep = mutatedOverlay.steps.find(
      (step) => step.stepId === "step-6-wealth-timing-and-risk-window",
    );

    if (!timingStep || timingStep.result.kind !== "wealth-timing-and-risk-window") {
      throw new Error("Missing Source 4 timing step in the mutated overlay.");
    }

    timingStep.result.riskBoundary = "bounded-opportunity";
    timingStep.result.timingWindow = "favorable-window";

    const originalInterpretation = buildSource4WealthInvestmentInterpretation(overlay);
    const mutatedInterpretation = buildSource4WealthInvestmentInterpretation(mutatedOverlay);

    expect(originalInterpretation.timingOutlook.facts.riskBoundary).toBe("capital-preservation");
    expect(mutatedInterpretation.timingOutlook.facts.riskBoundary).toBe("bounded-opportunity");
    expect(mutatedInterpretation.timingOutlook.readingIntent.timingFrame).toContain("หน้าต่างเงินเปิด");
    expect(mutatedInterpretation.investmentRisk.readingIntent.boundaryFrame).toContain("มีกรอบ");
  });
});
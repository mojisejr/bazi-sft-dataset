import { describe, expect, test } from "vitest";

import {
  Source3HealthInterpretationSchema,
  buildSource3HealthInterpretation,
} from "@/lib/bazi/source3-health-interpretation";
import { buildSource3HealthOverlay } from "@/lib/bazi/source3-health-overlay";

import { createGoldenCaseCallerContract } from "./helpers/source-overlay-golden-case";

describe("buildSource3HealthInterpretation", () => {
  test("turns Source 3 overlay facts into a bounded health reading lane without moving delivery ownership above the overlay", () => {
    const overlay = buildSource3HealthOverlay(createGoldenCaseCallerContract());
    const interpretation = buildSource3HealthInterpretation(overlay);

    expect(Source3HealthInterpretationSchema.parse(interpretation)).toMatchObject({
      sourceId: "source-3",
      routeFrom: "source3-health-overlay",
      status: "ready-for-reading",
    });
    expect(interpretation.deliveryContext.topic.sourceRefs[0]).toMatchObject({
      primarySource: "Source3_ สุขภาพ(พื้นฐาน)",
    });
    expect(interpretation.deliveryContext.dictionary).toMatchObject({
      specKey: "healthOverviewDictionary",
      dimensionName: "health_overview",
    });
    expect(interpretation.deliveryContext.retrieval).toMatchObject({
      dimensionName: "health_overview",
      strategy: "dictionary-first",
      coverage: "direct",
      fallbackRequired: false,
    });
    expect(interpretation.constitutionBaseline.facts).toMatchObject({
      primaryWeakElement: "metal",
      primaryWeakElementLabel: "ทอง",
      organs: ["ปอด", "ลำไส้ใหญ่"],
      careBoundary: "caution-only",
    });
    expect(interpretation.timingSensitiveWeakness.facts).toMatchObject({
      sensitivityLevel: "elevated",
      triggerWindow: "dual-watch",
      cautionTone: "extra-rest-and-monitor",
    });
    expect(interpretation.recoveryCaution.facts).toMatchObject({
      supportVerdict: "rest-first-and-monitor",
      careBoundary: "caution-only",
      requiresTreatmentBoundary: true,
    });
    expect(interpretation.recoveryCaution.readingIntent.boundaryFrame).toMatch(/ไม่ใช่คำรักษา|ไม่ใช่คำวินิจฉัย/u);
  });

  test("derives health reading intent from overlay facts instead of recomputing the chart", () => {
    const overlay = buildSource3HealthOverlay(createGoldenCaseCallerContract());
    const mutatedOverlay = structuredClone(overlay);
    const organRiskStep = mutatedOverlay.steps.find(
      (step) => step.stepId === "step-2-organ-risk-mapping",
    );
    const cautionStep = mutatedOverlay.steps.find(
      (step) => step.stepId === "step-4-bounded-caution-framing",
    );

    if (!organRiskStep || organRiskStep.result.kind !== "health-organ-risk-mapping") {
      throw new Error("Missing Source 3 organ-risk step in the mutated overlay.");
    }

    if (!cautionStep || cautionStep.result.kind !== "bounded-health-caution") {
      throw new Error("Missing Source 3 caution step in the mutated overlay.");
    }

    organRiskStep.result.riskLanes[0] = {
      ...organRiskStep.result.riskLanes[0],
      organs: ["ไต", "กระเพาะปัสสาวะ"],
      bodySystems: ["ระบบสืบพันธุ์"],
      cautionBand: "baseline-watch",
    };
    cautionStep.result.timingSensitivity.sensitivityLevel = "watch";
    cautionStep.result.timingSensitivity.triggerWindow = "da-yun-watch";
    cautionStep.result.cautionTone = "active-watchfulness";

    const originalInterpretation = buildSource3HealthInterpretation(overlay);
    const mutatedInterpretation = buildSource3HealthInterpretation(mutatedOverlay);

    expect(originalInterpretation.constitutionBaseline.facts.organs).toEqual(["ปอด", "ลำไส้ใหญ่"]);
    expect(mutatedInterpretation.constitutionBaseline.facts.organs).toEqual(["ไต", "กระเพาะปัสสาวะ"]);
    expect(mutatedInterpretation.timingSensitiveWeakness.facts.sensitivityLevel).toBe("watch");
    expect(mutatedInterpretation.recoveryCaution.facts.supportVerdict).toBe("cautious-pursuit-only");
  });
});
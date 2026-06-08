import { describe, expect, test } from "vitest";

import {
  BAZI_SOURCE_OVERLAY_SEQUENCE,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  SOURCE3_ALLOWED_CALLER_CONTRACT_PACKET_FAMILIES,
  SOURCE3_HEALTH_STEP_IDS,
  buildSource3HealthDoctrine,
} from "@/lib/bazi/source3-health-doctrine";

describe("buildSource3HealthDoctrine", () => {
  test("freezes all 4 Source 3 manual steps and keeps source-3 immediately after source-4 using only the locked caller-contract packet families", () => {
    const doctrine = buildSource3HealthDoctrine();

    expect(doctrine.sourceId).toBe("source-3");
    expect(doctrine.steps.map((step) => step.stepId)).toEqual([...SOURCE3_HEALTH_STEP_IDS]);
    expect(BAZI_SOURCE_OVERLAY_SEQUENCE.indexOf("source-3")).toBe(
      BAZI_SOURCE_OVERLAY_SEQUENCE.indexOf("source-4") + 1,
    );
    expect(doctrine.allowedCallerContractPacketFamilies).toEqual([
      ...SOURCE3_ALLOWED_CALLER_CONTRACT_PACKET_FAMILIES,
    ]);
    expect(doctrine.forbidDiagnosisClaims).toBe(true);
    expect(doctrine.forbidTreatmentClaims).toBe(true);
    expect(doctrine.forbidSource7RemedyDrift).toBe(true);

    for (const step of doctrine.steps) {
      expect(step.source1Reuse.length).toBeGreaterThan(0);
      expect(step.source3LocalLogic.ownerTarget.module.startsWith("source3-")).toBe(true);
      expect(step.source3LocalLogic.ownerTarget.ownerKey).not.toMatch(/prompt|prose/i);
      expect(step.retrievalContextReuse.guardrails.length).toBeGreaterThan(0);

      for (const fieldId of step.source1Reuse.map((entry) => entry.fieldId)) {
        expect([
          "weighted-strength",
          "role-of-element",
          "twelve-qi-texture",
          "conflict-context",
        ]).toContain(fieldId);
      }
    }
  });

  test("locks health weakness, organ-risk mapping, and bounded caution without diagnosis or Source 7 remedy drift", () => {
    const doctrine = buildSource3HealthDoctrine();
    const baselineWeakness = doctrine.terminologyFreeze.find((term) => term.termId === "baseline-health-weakness");
    const organRisk = doctrine.terminologyFreeze.find((term) => term.termId === "organ-risk-map");
    const recoveryBoundary = doctrine.terminologyFreeze.find((term) => term.termId === "recovery-caution-boundary");
    const step2 = doctrine.steps.find((step) => step.stepId === "step-2-organ-risk-mapping");
    const step3 = doctrine.steps.find((step) => step.stepId === "step-3-conflict-injury-markers");
    const step4 = doctrine.steps.find((step) => step.stepId === "step-4-bounded-caution-framing");

    expect(doctrine.forbiddenClaimContract.contractVerdict).toBe("caution-only");
    expect(doctrine.forbiddenClaimContract.bannedClaimKinds).toEqual(
      expect.arrayContaining(["diagnosis", "treatment-instruction", "source7-remedy-drift"]),
    );
    expect(baselineWeakness?.canonicalLabel).toBe("baseline health weakness");
    expect(baselineWeakness?.mustNotBeNamedAs).toContain("diagnosis");
    expect(organRisk?.mustNotBeNamedAs).toEqual(
      expect.arrayContaining(["medical diagnosis", "confirmed illness"]),
    );
    expect(recoveryBoundary?.mustNotBeNamedAs).toEqual(
      expect.arrayContaining(["treatment instructions", "source7 remedy"]),
    );
    expect(step2?.manualIntent).toContain("อวัยวะ");
    expect(step3?.source1Reuse.map((entry) => entry.fieldId)).toContain("conflict-context");
    expect(step4?.manualIntent).toContain("Source 7");
    expect(step4?.manualIntent).toContain("การวินิจฉัย");
  });
});
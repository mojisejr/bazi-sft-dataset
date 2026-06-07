import { describe, expect, test } from "vitest";

import {
  BAZI_SOURCE_OVERLAY_SEQUENCE,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  SOURCE6_CAREER_BUSINESS_STEP_IDS,
  buildSource6CareerBusinessDoctrine,
} from "@/lib/bazi/source6-career-business-doctrine";

describe("buildSource6CareerBusinessDoctrine", () => {
  test("freezes all 8 Source 6 school steps and keeps source-6 immediately after source-5", () => {
    const doctrine = buildSource6CareerBusinessDoctrine();

    expect(doctrine.sourceId).toBe("source-6");
    expect(doctrine.steps.map((step) => step.stepId)).toEqual([...SOURCE6_CAREER_BUSINESS_STEP_IDS]);
    expect(BAZI_SOURCE_OVERLAY_SEQUENCE.indexOf("source-6")).toBe(
      BAZI_SOURCE_OVERLAY_SEQUENCE.indexOf("source-5") + 1,
    );

    for (const step of doctrine.steps) {
      expect(step.source1Reuse.length).toBeGreaterThan(0);
      expect(step.source6LocalLogic.ownerTarget.module.startsWith("source6-")).toBe(true);
      expect(step.source6LocalLogic.ownerTarget.ownerKey).not.toMatch(/prompt|prose/i);
      expect(step.retrievalContextReuse.guardrails.length).toBeGreaterThan(0);
    }
  });

  test("separates Source 6 career cheingsae from Source 1 texture and locks transition weighting", () => {
    const doctrine = buildSource6CareerBusinessDoctrine();
    const careerCheingsae = doctrine.terminologyFreeze.find((term) => term.termId === "career-12-cheingsae");
    const transitionWeighting = doctrine.terminologyFreeze.find((term) => term.termId === "transition-weighting");
    const step3 = doctrine.steps.find((step) => step.stepId === "step-3-career-status-by-official-star-phase");
    const step4 = doctrine.steps.find((step) => step.stepId === "step-4-job-transition-weighted-timing");
    const step6 = doctrine.steps.find((step) => step.stepId === "step-6-work-location-domestic-vs-international");

    expect(careerCheingsae?.canonicalLabel).toBe("career 12 cheingsae");
    expect(careerCheingsae?.mustNotBeNamedAs).toContain("12 qi");
    expect(transitionWeighting?.meaning).toContain("60%");
    expect(step3?.source1Reuse.map((entry) => entry.fieldId)).not.toContain("twelve-qi-texture");
    expect(step4?.source1Reuse.map((entry) => entry.fieldId)).toEqual(
      expect.arrayContaining(["timing", "four-pillars"]),
    );
    expect(step4?.manualIntent).toContain("60/40");
    expect(step6?.source1Reuse.map((entry) => entry.fieldId)).toContain("conflict-context");
  });
});
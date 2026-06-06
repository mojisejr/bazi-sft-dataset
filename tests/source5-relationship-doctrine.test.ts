import { describe, expect, test } from "vitest";

import {
  SOURCE5_RELATIONSHIP_STEP_IDS,
  buildSource5RelationshipDoctrine,
} from "@/lib/bazi/source5-relationship-doctrine";

describe("buildSource5RelationshipDoctrine", () => {
  test("freezes all 7 Source 5 manual steps with Source 2 limited to flavor-only reuse", () => {
    const doctrine = buildSource5RelationshipDoctrine();

    expect(doctrine.sourceId).toBe("source-5");
    expect(doctrine.steps.map((step) => step.stepId)).toEqual([...SOURCE5_RELATIONSHIP_STEP_IDS]);

    for (const step of doctrine.steps) {
      expect(step.source1Reuse.length).toBeGreaterThan(0);
      expect(step.source2FlavorReuse.mode).toBe("flavor-only");
      expect(step.source2FlavorReuse.guardrails.length).toBeGreaterThan(0);
      expect(step.source5LocalLogic.ownerTarget.module.startsWith("source5-")).toBe(true);
      expect(step.source5LocalLogic.ownerTarget.ownerKey).not.toMatch(/source2/i);
    }
  });

  test("separates relationship 12 cheingsae from Source 1 twelve-qi texture", () => {
    const doctrine = buildSource5RelationshipDoctrine();
    const cheingsae = doctrine.terminologyFreeze.find((term) => term.termId === "relationship-12-cheingsae");
    const twelveQi = doctrine.terminologyFreeze.find((term) => term.termId === "twelve-qi-texture");
    const step4 = doctrine.steps.find((step) => step.stepId === "step-4-relationship-12-cheingsae");

    expect(cheingsae?.canonicalLabel).toBe("relationship 12 cheingsae");
    expect(cheingsae?.mustNotBeNamedAs).toContain("12 qi");
    expect(twelveQi?.canonicalLabel).toBe("12 qi texture");
    expect(twelveQi?.mustNotBeNamedAs).toContain("relationship 12 cheingsae");
    expect(step4?.source1Reuse.map((entry) => entry.fieldId)).not.toContain("twelve-qi-texture");
    expect(step4?.source2FlavorReuse.surfaces).toEqual([]);
  });
});
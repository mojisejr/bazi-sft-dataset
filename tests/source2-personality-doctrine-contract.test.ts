import { describe, expect, test } from "vitest";

import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import {
  buildSource2PersonalityDoctrineContract,
} from "@/lib/bazi/symbolic-engine.persona";
import { SOURCE1_GOLDEN_REFERENCE_CASE } from "@/lib/bazi/source1-operating-system-contract";

describe("buildSource2PersonalityDoctrineContract", () => {
  test("freezes Source 2 manual sections into routing refinement and evidence layers", () => {
    const contract = buildSource2PersonalityDoctrineContract();

    expect(contract.layerSequence).toEqual(["routing", "refinement", "evidence"]);
    expect(contract.preserveSource1Authority).toBe(true);
    expect(contract.recomputeStrength).toBe(false);
    expect(contract.sections).toEqual([
      expect.objectContaining({
        sectionId: "1.1-day-master-strength",
        layerId: "routing",
        contractOutputKey: "dayMasterStrengthProfile",
        requiredSource1FieldIds: ["day-master", "weighted-strength"],
      }),
      expect.objectContaining({
        sectionId: "1.2-day-pillar-60-jiazi",
        layerId: "refinement",
        contractOutputKey: "sixtyJiaziCorePersona",
        requiredSource1FieldIds: ["four-pillars", "day-master"],
      }),
      expect.objectContaining({
        sectionId: "1.2-twelve-qi-tone-advice",
        layerId: "evidence",
        contractOutputKey: "twelveQi",
        requiredSource1FieldIds: ["twelve-qi-texture", "day-master", "four-pillars"],
      }),
    ]);

    const routingSection = contract.sections[0];
    expect(routingSection.ownerSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: "symbolic-engine.repository",
          ownerKey: "findDayMasterStrengthProfile",
        }),
        expect.objectContaining({
          module: "source1-operating-system-contract",
          ownerKey: "buildSource1StrengthContract",
        }),
      ]),
    );
  });

  test("locks the 癸亥 golden case above Source 1 strength without recomputation", () => {
    const contract = buildSource2PersonalityDoctrineContract();
    const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);

    expect(factState.structuralState).toMatchObject(SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors);
    expect(factState.dayMaster).toBe(contract.goldenCase.expectation.routeBy.dayMaster);
    expect(`${factState.structuralState.fourPillars.day.stem}${factState.structuralState.fourPillars.day.branch}`)
      .toBe(contract.goldenCase.expectation.refineWith.dayPillarCode);
    expect(contract.goldenCase.expectation.routeFrom).toBe("dayMasterStrengthProfile");
    expect(contract.goldenCase.expectation.evidenceWith).toEqual({
      fieldId: "twelve-qi-texture",
      role: "tone-advice-modifier",
    });
    expect(contract.goldenCase.expectation.requiredSource1FieldIds).toEqual([
      "day-master",
      "weighted-strength",
      "four-pillars",
      "twelve-qi-texture",
    ]);
    expect(contract.recomputeStrength).toBe(false);
  });
});

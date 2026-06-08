import { describe, expect, test } from "vitest";

import {
  buildSource3KnowledgeOwnership,
  getSource3KnowledgeOwnershipForStep,
} from "@/lib/bazi/source3-knowledge-ownership";

describe("buildSource3KnowledgeOwnership", () => {
  test("makes the health delivery surfaces explicit and rejects topic or retrieval surfaces as primary owners", () => {
    const ownership = buildSource3KnowledgeOwnership();

    expect(ownership.deliverySurfaceContract.topicId).toBe("health_risks");
    expect(ownership.deliverySurfaceContract.annotationDimension).toBe("health_overview");
    expect(ownership.deliverySurfaceContract.dictionarySpec).toBe("healthOverviewDictionary");
    expect(ownership.deliverySurfaceContract.retrievalRegistryDimension).toBe("health_overview");
    expect(ownership.deliverySurfaceContract.contractVerdict).toBe(
      "source-reference-and-delivery-context-only",
    );
    expect(ownership.deliverySurfaceContract.allowedContextSteps).toEqual([
      "step-1-weak-element-routing",
      "step-4-bounded-caution-framing",
    ]);
    expect(ownership.deliverySurfaceContract.rejectedAssumptions).toEqual(
      expect.arrayContaining([
        "topic registry owns weak-element routing or organ-risk selection",
        "dictionary source paths own organ-risk or conflict-injury rules",
        "hybrid retrieval may widen health caution into diagnosis, treatment, or Source 7 remedy guidance",
      ]),
    );
  });

  test("locks cross-source boundaries and keeps organ, conflict, and caution owners separate", () => {
    const ownership = buildSource3KnowledgeOwnership();
    const source2 = ownership.crossSourceQualityContract.find((contract) => contract.sourceId === "source-2");
    const source4 = ownership.crossSourceQualityContract.find((contract) => contract.sourceId === "source-4");
    const source7 = ownership.crossSourceQualityContract.find((contract) => contract.sourceId === "source-7");
    const step2 = getSource3KnowledgeOwnershipForStep("step-2-organ-risk-mapping");
    const step3 = getSource3KnowledgeOwnershipForStep("step-3-conflict-injury-markers");
    const step4 = getSource3KnowledgeOwnershipForStep("step-4-bounded-caution-framing");

    expect(source2?.allowedRole).toBe("delivery-flavor-only");
    expect(source2?.forbiddenDrift).toContain(
      "routing narrative becoming the owner of weakness or organ-risk meaning",
    );
    expect(source4?.allowedRole).toBe("context-only");
    expect(source4?.forbiddenDrift).toContain(
      "money-risk language becoming the default explanation for body strain",
    );
    expect(source7?.allowedRole).toBe("not-used");
    expect(source7?.mustPreserve).toContain(
      "Source 3 stops at bounded caution, watchfulness, and recovery boundary wording",
    );

    expect(step2.currentSurfaceReuse.verdict).toBe("insufficient-as-primary-owner");
    expect(step3.currentSurfaceReuse.verdict).toBe("insufficient-as-primary-owner");
    expect(step4.currentSurfaceReuse.verdict).toBe("context-only");

    expect(step2.phase2RuntimeOwner.ownerKey).toBe("resolveHealthOrganRiskMap");
    expect(step3.phase2RuntimeOwner.ownerKey).toBe("resolveHealthConflictInjuryMarkers");
    expect(step4.phase2RuntimeOwner.ownerKey).toBe("interpretBoundedHealthCaution");

    expect(step2.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source3_element_organ_risk_lookup",
    ]);
    expect(step3.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source3_conflict_injury_rules",
    ]);

    expect(step2.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 2 must remain distinct from Step 3 conflict-injury escalation",
      ]),
    );
    expect(step4.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 4 must remain distinct from Source 7 remedy and treatment advice",
      ]),
    );
  });
});
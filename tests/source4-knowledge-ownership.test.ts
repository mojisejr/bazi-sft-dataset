import { describe, expect, test } from "vitest";

import {
  buildSource4KnowledgeOwnership,
  getSource4KnowledgeOwnershipForStep,
} from "@/lib/bazi/source4-knowledge-ownership";

describe("buildSource4KnowledgeOwnership", () => {
  test("makes the wealth delivery surfaces explicit and rejects topic or neighboring overlays as primary owners", () => {
    const ownership = buildSource4KnowledgeOwnership();

    expect(ownership.deliverySurfaceContract.topicId).toBe("wealth_luck");
    expect(ownership.deliverySurfaceContract.annotationDimension).toBe("wealth_and_investment");
    expect(ownership.deliverySurfaceContract.dictionarySpec).toBe("wealthAndInvestmentDictionary");
    expect(ownership.deliverySurfaceContract.retrievalRegistryDimension).toBe("wealth_and_investment");
    expect(ownership.deliverySurfaceContract.contractVerdict).toBe("source-reference-and-delivery-context-only");
    expect(ownership.deliverySurfaceContract.allowedContextSteps).toEqual([
      "step-1-wealth-capacity-routing",
      "step-3-money-source-storage-and-leakage",
      "step-4-spending-and-investment-behavior",
      "step-6-wealth-timing-and-risk-window",
    ]);
    expect(ownership.deliverySurfaceContract.rejectedAssumptions).toEqual(
      expect.arrayContaining([
        "topic registry owns wealth element, storage, or destroyer lookup",
        "dictionary source paths own money-source, storage, or leakage rules",
        "career or relationship delivery surfaces can become the primary owner of wealth-risk meaning",
      ]),
    );
  });

  test("locks cross-source quality gates for Source 2, 5, and 6 while keeping core Source 4 lanes separate", () => {
    const ownership = buildSource4KnowledgeOwnership();
    const source2 = ownership.crossSourceQualityContract.find((contract) => contract.sourceId === "source-2");
    const source5 = ownership.crossSourceQualityContract.find((contract) => contract.sourceId === "source-5");
    const source6 = ownership.crossSourceQualityContract.find((contract) => contract.sourceId === "source-6");
    const step2 = getSource4KnowledgeOwnershipForStep("step-2-wealth-element-storage-destroyer-lookup");
    const step4 = getSource4KnowledgeOwnershipForStep("step-4-spending-and-investment-behavior");
    const step6 = getSource4KnowledgeOwnershipForStep("step-6-wealth-timing-and-risk-window");

    expect(source2?.allowedRole).toBe("delivery-flavor-only");
    expect(source2?.forbiddenDrift).toContain("routing narrative becoming the owner of wealth interpretation");
    expect(source5?.allowedRole).toBe("context-only");
    expect(source5?.mustPreserve).toContain(
      "relationship output may comment on partner money only after Source 4 resolves the base money lane",
    );
    expect(source6?.allowedRole).toBe("context-only");
    expect(source6?.forbiddenDrift).toContain("job-switch timing replacing wealth timing risk windows");

    expect(step2.currentSurfaceReuse.verdict).toBe("insufficient-as-primary-owner");
    expect(step4.currentSurfaceReuse.verdict).toBe("context-only");
    expect(step6.currentSurfaceReuse.verdict).toBe("context-only");

    expect(step2.phase2RuntimeOwner.ownerKey).toBe("resolveWealthElementAndStorageLookup");
    expect(step4.phase2RuntimeOwner.ownerKey).toBe("interpretSpendingAndInvestmentBehavior");
    expect(step6.phase2RuntimeOwner.ownerKey).toBe("interpretWealthTimingWindow");

    expect(step2.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source4_wealth_storage_lookup",
    ]);
    expect(step4.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source4_output_investment_profiles",
    ]);
    expect(step6.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source4_timing_risk_rules",
    ]);

    expect(step4.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 4 must remain distinct from Source 6 operational business fit even when both mention investment",
      ]),
    );
    expect(step6.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 6 must remain distinct from Source 7 lucky-period promises",
      ]),
    );
  });
});
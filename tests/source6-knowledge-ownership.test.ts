import { describe, expect, test } from "vitest";

import {
  buildSource6KnowledgeOwnership,
  getSource6KnowledgeOwnershipForStep,
} from "@/lib/bazi/source6-knowledge-ownership";

describe("buildSource6KnowledgeOwnership", () => {
  test("makes the career delivery surfaces explicit and rejects retrieval as the primary owner", () => {
    const ownership = buildSource6KnowledgeOwnership();

    expect(ownership.deliverySurfaceContract.topicId).toBe("suitable_career");
    expect(ownership.deliverySurfaceContract.annotationDimension).toBe("career_potential");
    expect(ownership.deliverySurfaceContract.dictionarySpec).toBe("careerPotentialDictionary");
    expect(ownership.deliverySurfaceContract.retrievalRegistryDimension).toBe("career_potential");
    expect(ownership.deliverySurfaceContract.contractVerdict).toBe("source-reference-and-delivery-context-only");
    expect(ownership.deliverySurfaceContract.allowedContextSteps).toEqual([
      "step-1-career-element-routing",
      "step-5-career-growth-grouping",
      "step-7-business-nature-and-investment",
    ]);
    expect(ownership.deliverySurfaceContract.rejectedAssumptions).toEqual(
      expect.arrayContaining([
        "topic registry owns career element routing",
        "hybrid retrieval owns official-star lookup or career 12 cheingsae status logic",
        "dictionary source paths own transition weighting, location inversion, or customer-profile rules",
      ]),
    );
  });

  test("keeps official-star, transition, business, and customer lanes on separate owners", () => {
    const step2 = getSource6KnowledgeOwnershipForStep("step-2-official-star-lookup");
    const step4 = getSource6KnowledgeOwnershipForStep("step-4-job-transition-weighted-timing");
    const step7 = getSource6KnowledgeOwnershipForStep("step-7-business-nature-and-investment");
    const step8 = getSource6KnowledgeOwnershipForStep("step-8-customer-analysis");

    expect(step2.currentSurfaceReuse.verdict).toBe("insufficient-as-primary-owner");
    expect(step4.currentSurfaceReuse.verdict).toBe("not-used");
    expect(step7.currentSurfaceReuse.verdict).toBe("context-only");
    expect(step8.currentSurfaceReuse.verdict).toBe("not-used");

    expect(step2.phase2RuntimeOwner.ownerKey).toBe("resolveOfficialStarLane");
    expect(step4.phase2RuntimeOwner.ownerKey).toBe("interpretJobTransitionTiming");
    expect(step7.phase2RuntimeOwner.ownerKey).toBe("interpretBusinessNatureAndInvestment");
    expect(step8.phase2RuntimeOwner.ownerKey).toBe("interpretCustomerProfile");

    expect(step2.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source6_official_star_lookup",
    ]);
    expect(step7.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source6_wealth_business_rules",
      "bazi_source6_output_investment_rules",
    ]);
    expect(step8.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_source6_customer_phase_rules",
    ]);

    expect(step4.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 4 weighting must stay separate from Step 5 growth grouping",
      ]),
    );
    expect(step7.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 7 must remain distinct from Step 6 output-based location logic even when both reuse role-of-element packets",
      ]),
    );
    expect(step8.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 8 must remain distinct from Step 7 month-base business reasoning",
      ]),
    );
  });
});
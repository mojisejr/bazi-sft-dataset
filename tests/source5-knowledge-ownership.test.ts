import { describe, expect, test } from "vitest";

import {
  buildSource5KnowledgeOwnership,
  getSource5KnowledgeOwnershipForStep,
} from "@/lib/bazi/source5-knowledge-ownership";

describe("buildSource5KnowledgeOwnership", () => {
  test("makes the repository contract explicit and rejects the love-matrix-owns-everything assumption", () => {
    const ownership = buildSource5KnowledgeOwnership();

    expect(ownership.repositoryContract.repositoryMethod).toBe("findDomainMatrixRows");
    expect(ownership.repositoryContract.schemaTable).toBe("bazi_domain_matrices");
    expect(ownership.repositoryContract.matrixDomain).toBe("love");
    expect(ownership.repositoryContract.contractVerdict).toBe("generic-love-matrix-only");
    expect(ownership.repositoryContract.allowedContextSteps).toEqual([
      "step-1-relationship-potential",
      "step-5-conflict-and-interaction",
    ]);
    expect(ownership.repositoryContract.rejectedAssumptions).toEqual(
      expect.arrayContaining([
        "love matrix owns spouse-element lookup",
        "love matrix owns relationship 12 cheingsae quality",
        "love matrix owns special relationship rules or spouse profile mapping",
      ]),
    );
  });

  test("keeps Step 3, Step 4, and Step 7 on explicitly separate ownership lanes", () => {
    const step3 = getSource5KnowledgeOwnershipForStep("step-3-spouse-element-lookup");
    const step4 = getSource5KnowledgeOwnershipForStep("step-4-relationship-12-cheingsae");
    const step7 = getSource5KnowledgeOwnershipForStep("step-7-special-rules-and-spouse-profile");

    expect(step3.currentRepositoryReuse.verdict).toBe("insufficient-as-primary-owner");
    expect(step4.currentRepositoryReuse.verdict).toBe("insufficient-as-primary-owner");
    expect(step7.currentRepositoryReuse.verdict).toBe("insufficient-as-primary-owner");

    expect(step3.phase3RuntimeOwner.ownerKey).toBe("resolveSpouseElement");
    expect(step4.phase3RuntimeOwner.ownerKey).toBe("interpretRelationshipTwelveCheingsae");
    expect(step7.phase3RuntimeOwner.ownerKey).toBe("evaluateSpecialRelationshipRules");

    expect(step3.requiresNewCanonicalOwners).toEqual([]);
    expect(step4.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_relationship_twelve_cheingsae_rules",
    ]);
    expect(step7.requiresNewCanonicalOwners.map((owner) => owner.tableName)).toEqual([
      "bazi_relationship_special_rules",
      "bazi_spouse_profile_signatures",
    ]);

    expect(step4.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 4 must remain distinct from Source 1 twelve-qi texture",
      ]),
    );
    expect(step7.ownerSeparation).toEqual(
      expect.arrayContaining([
        "Step 7 must remain distinct from Step 5 conflict-context mapping",
      ]),
    );
  });
});
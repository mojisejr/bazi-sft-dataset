import { describe, expect, test } from "vitest";

import {
  Source4WealthInvestmentStepResultSchema,
  buildSource4WealthInvestmentStepResult,
} from "@/lib/bazi/source4-wealth-investment-rules";

import {
  createGoldenCaseCallerContract,
  getSource4SupportingPackets,
} from "./helpers/source-overlay-golden-case";

describe("buildSource4WealthInvestmentStepResult", () => {
  test("routes wealth element, storage vault, destroyer pressure, and leakage deterministically from Source 1 packet truth", () => {
    const contract = createGoldenCaseCallerContract();
    const packets = getSource4SupportingPackets(contract);
    const step2 = buildSource4WealthInvestmentStepResult(
      "step-2-wealth-element-storage-destroyer-lookup",
      packets,
      contract,
    );
    const step3 = buildSource4WealthInvestmentStepResult(
      "step-3-money-source-storage-and-leakage",
      packets,
      contract,
    );

    expect(Source4WealthInvestmentStepResultSchema.parse(step2.result)).toMatchObject({
      kind: "wealth-element-storage-destroyer-lookup",
      wealthLane: {
        role: "wealth",
        element: "fire",
      },
      storageVault: {
        branch: "戌",
        presenceMode: "absent",
      },
      destroyerPolicy: {
        directDestroyerStem: "戊",
      },
      destroyerMatches: {
        directVisible: [{ symbol: "戊" }],
      },
    });
    expect(Source4WealthInvestmentStepResultSchema.parse(step3.result)).toMatchObject({
      kind: "money-source-storage-and-leakage",
      sourceMode: "cashflow-primary",
      storageStatus: "vault-not-manifest",
      leakageSeverity: "high",
      partnerMoneyDefaultApplied: false,
    });
    expect(step3.packetFamilies).toEqual(["role-of-element", "timing"]);
    expect(step3.result.notes[0]).toContain("partner-money claims");
  });

  test("keeps timing and risk windows bounded without windfall or partner-money shortcuts", () => {
    const contract = createGoldenCaseCallerContract();
    const packets = getSource4SupportingPackets(contract);
    const step6 = buildSource4WealthInvestmentStepResult(
      "step-6-wealth-timing-and-risk-window",
      packets,
      contract,
    );

    expect(Source4WealthInvestmentStepResultSchema.parse(step6.result)).toMatchObject({
      kind: "wealth-timing-and-risk-window",
      windowNeed: {
        family: "maintain-circulation",
        preferredElements: ["wood", "fire"],
      },
      riskBoundary: "capital-preservation",
    });
    expect(step6.result.forbiddenClaims).toEqual(
      expect.arrayContaining(["no-windfall-promise", "no-guaranteed-rich-year", "no-partner-money-shortcut"]),
    );
    expect(step6.packetFamilies).toEqual(["strength", "role-of-element", "timing"]);
  });
});
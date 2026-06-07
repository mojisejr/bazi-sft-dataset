import { describe, expect, test } from "vitest";

import {
  Source4WealthInvestmentOverlaySchema,
  buildSource4WealthInvestmentOverlay,
} from "@/lib/bazi/source4-wealth-investment-overlay";

import { createGoldenCaseCallerContract } from "./helpers/source-overlay-golden-case";

describe("buildSource4WealthInvestmentOverlay", () => {
  test("turns all 6 Source 4 steps green with deterministic caller-contract routing, leakage guards, and bounded timing facts", () => {
    const contract = createGoldenCaseCallerContract();
    const overlay = buildSource4WealthInvestmentOverlay(contract);
    const step1 = overlay.steps.find((step) => step.stepId === "step-1-wealth-capacity-routing");
    const step2 = overlay.steps.find((step) => step.stepId === "step-2-wealth-element-storage-destroyer-lookup");
    const step3 = overlay.steps.find((step) => step.stepId === "step-3-money-source-storage-and-leakage");
    const step6 = overlay.steps.find((step) => step.stepId === "step-6-wealth-timing-and-risk-window");

    expect(Source4WealthInvestmentOverlaySchema.parse(overlay)).toMatchObject({
      sourceId: "source-4",
      status: "all-steps-green",
    });
    expect(overlay.packetContract.allowedPacketFamilies).toEqual(["strength", "role-of-element", "timing"]);
    expect(overlay.packetContract.supportingPackets.map((packet) => packet.family)).toEqual([
      "strength",
      "role-of-element",
      "timing",
    ]);
    expect(overlay.steps).toHaveLength(6);
    expect(
      overlay.steps.every((step) => (
        step.provenance.routeFrom === "caller-contract"
        && step.provenance.sourceFieldIds.length > 0
        && step.provenance.source1OwnerKeys.length > 0
        && step.provenance.knowledgeOwnership.primaryOwnerKeys.length > 0
        && step.status === "green"
      )),
    ).toBe(true);
    expect(step1?.result).toMatchObject({
      kind: "wealth-capacity-routing",
      strengthBandId: "balanced",
      capacityBand: "stable",
    });
    expect(step2?.runtimeOwner).toMatchObject({
      ownerKey: "resolveWealthElementAndStorageLookup",
      phase2RuntimeOwnerKey: "resolveWealthElementAndStorageLookup",
    });
    expect(step3?.result).toMatchObject({
      kind: "money-source-storage-and-leakage",
      sourceMode: "cashflow-primary",
      partnerMoneyDefaultApplied: false,
      leakageSeverity: "high",
    });
    expect(step6?.result).toMatchObject({
      kind: "wealth-timing-and-risk-window",
      riskBoundary: "capital-preservation",
    });
    expect(step6?.result.forbiddenClaims).toEqual(
      expect.arrayContaining(["no-windfall-promise", "no-guaranteed-rich-year", "no-partner-money-shortcut"]),
    );
  });

  test("stays independent from unrelated conflict and twelve-qi packets because Source 4 only routes through its allowed packet families", () => {
    const contract = createGoldenCaseCallerContract();
    const mutatedContract = structuredClone(contract);
    const texturePacket = mutatedContract.sharedPacketSpine.packets.find((packet) => packet.family === "twelve-qi-texture");
    const conflictPacket = mutatedContract.sharedPacketSpine.packets.find((packet) => packet.family === "conflict-context");

    if (!texturePacket || texturePacket.family !== "twelve-qi-texture") {
      throw new Error("Golden case is missing the twelve-qi-texture packet.");
    }

    if (!conflictPacket || conflictPacket.family !== "conflict-context") {
      throw new Error("Golden case is missing the conflict-context packet.");
    }

    texturePacket.sections.texture.value.display.dayBranch = "เจ๊าะ-ปลอม";
    texturePacket.sections.texture.value.raw.dayBranch = "fake-day-branch";
    conflictPacket.sections.resolution.value.activeClashes = ["fake-clash"];
    conflictPacket.sections.resolution.value.activePunishments = ["fake-punishment"];

    expect(buildSource4WealthInvestmentOverlay(mutatedContract)).toEqual(
      buildSource4WealthInvestmentOverlay(contract),
    );
  });
});
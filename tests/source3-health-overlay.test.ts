import { describe, expect, test } from "vitest";

import {
  Source3HealthOverlaySchema,
  buildSource3HealthOverlay,
} from "@/lib/bazi/source3-health-overlay";

import { createGoldenCaseCallerContract } from "./helpers/source-overlay-golden-case";

describe("buildSource3HealthOverlay", () => {
  test("turns all 4 Source 3 steps green with deterministic weak-element, organ-risk, conflict, and bounded caution facts", () => {
    const contract = createGoldenCaseCallerContract();
    const overlay = buildSource3HealthOverlay(contract);
    const step1 = overlay.steps.find((step) => step.stepId === "step-1-weak-element-routing");
    const step2 = overlay.steps.find((step) => step.stepId === "step-2-organ-risk-mapping");
    const step4 = overlay.steps.find((step) => step.stepId === "step-4-bounded-caution-framing");

    expect(Source3HealthOverlaySchema.parse(overlay)).toMatchObject({
      sourceId: "source-3",
      status: "all-steps-green",
    });
    expect(overlay.packetContract.allowedPacketFamilies).toEqual([
      "strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
    ]);
    expect(overlay.packetContract.supportingPackets.map((packet) => packet.family)).toEqual([
      "strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
    ]);
    expect(overlay.steps).toHaveLength(4);
    expect(
      overlay.steps.every((step) => (
        step.provenance.routeFrom === "caller-contract"
        && step.provenance.sourceFieldIds.length > 0
        && step.provenance.source1OwnerKeys.length > 0
        && step.provenance.knowledgeOwnership.primaryOwnerKeys.length > 0
        && step.status === "green"
      )),
    ).toBe(true);
    expect(step1?.runtimeOwner).toMatchObject({
      ownerKey: "step1-weak-element-routing",
      phase2RuntimeOwnerKey: "resolveHealthWeakElementLane",
    });
    expect(step2?.result).toMatchObject({
      kind: "health-organ-risk-mapping",
      primaryWeakElement: "metal",
    });
    expect(step4?.result).toMatchObject({
      kind: "bounded-health-caution",
      timingSensitivity: {
        sensitivityLevel: "elevated",
        triggerWindow: "dual-watch",
      },
    });
    expect(step4?.result.forbiddenClaims).toEqual([
      "no-diagnosis",
      "no-treatment-instruction",
      "no-source7-remedy",
    ]);
  });

  test("stays independent from the timing packet because Source 3 only routes through its locked packet families", () => {
    const contract = createGoldenCaseCallerContract();
    const mutatedContract = structuredClone(contract);
    const timingPacket = mutatedContract.sharedPacketSpine.packets.find((packet) => packet.family === "timing");

    if (!timingPacket || timingPacket.family !== "timing") {
      throw new Error("Golden case is missing the timing packet.");
    }

    timingPacket.sections.currentWindow.value.currentDaYun = {
      ...timingPacket.sections.currentWindow.value.currentDaYun,
      stem: "辛",
      branch: "酉",
      lowerStageDisplay: "เจ๊าะ-ปลอม",
    };
    timingPacket.sections.currentWindow.value.liuNian.lowerStageDisplay = "ปลอม";

    expect(buildSource3HealthOverlay(mutatedContract)).toEqual(buildSource3HealthOverlay(contract));
  });
});
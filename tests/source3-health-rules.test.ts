import { describe, expect, test } from "vitest";

import {
  Source3HealthStepResultSchema,
  buildSource3HealthStepResult,
} from "@/lib/bazi/source3-health-rules";

import { createGoldenCaseCallerContract } from "./helpers/source-overlay-golden-case";

function getSource3SupportingPackets() {
  const contract = createGoldenCaseCallerContract();
  const packets = contract.sharedPacketSpine.packets.filter((packet) => (
    packet.family === "strength"
      || packet.family === "role-of-element"
      || packet.family === "twelve-qi-texture"
      || packet.family === "conflict-context"
  ));

  return { contract, packets };
}

describe("buildSource3HealthStepResult", () => {
  test("routes weak health elements and organ-risk lanes deterministically from Source 1 packet truth", () => {
    const { contract, packets } = getSource3SupportingPackets();
    const step1 = buildSource3HealthStepResult("step-1-weak-element-routing", packets, contract);
    const step2 = buildSource3HealthStepResult("step-2-organ-risk-mapping", packets, contract);

    expect(Source3HealthStepResultSchema.parse(step1.result)).toMatchObject({
      kind: "health-weak-element-routing",
      strengthBandId: "balanced",
      primaryWeakElement: "metal",
      weakElements: [
        {
          element: "metal",
          sourceStrength: "missing",
          weaknessBand: "priority-watch",
        },
        {
          element: "fire",
          sourceStrength: "weak",
        },
      ],
    });
    expect(step1.packetFamilies).toEqual(["strength", "role-of-element", "twelve-qi-texture"]);

    expect(Source3HealthStepResultSchema.parse(step2.result)).toMatchObject({
      kind: "health-organ-risk-mapping",
      primaryWeakElement: "metal",
      riskLanes: [
        {
          element: "metal",
          organs: ["ปอด", "ลำไส้ใหญ่"],
          cautionBand: "priority-watch",
        },
        {
          element: "fire",
          organs: ["หัวใจ", "ลำไส้เล็ก"],
        },
      ],
      careBoundary: "caution-only",
    });
    expect(step2.packetFamilies).toEqual(["role-of-element", "twelve-qi-texture"]);
  });

  test("keeps conflict injury markers and timing-sensitive caution bounded to watchfulness without diagnosis or Source 7 remedy drift", () => {
    const { contract, packets } = getSource3SupportingPackets();
    const step3 = buildSource3HealthStepResult("step-3-conflict-injury-markers", packets, contract);
    const step4 = buildSource3HealthStepResult("step-4-bounded-caution-framing", packets, contract);

    expect(Source3HealthStepResultSchema.parse(step3.result)).toMatchObject({
      kind: "health-conflict-injury-markers",
      activeConflictKinds: expect.arrayContaining(["punishment", "destruction"]),
      pressureLevel: "heightened-watch",
    });
    expect(step3.result.markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conflictType: "punishment",
          relationLabel: "辰辰",
          targetedAreas: expect.arrayContaining(["ม้าม", "หน้าอก"]),
        }),
      ]),
    );
    expect(step3.packetFamilies).toEqual(["conflict-context", "twelve-qi-texture"]);

    expect(Source3HealthStepResultSchema.parse(step4.result)).toMatchObject({
      kind: "bounded-health-caution",
      baselineWeakness: {
        primaryWeakElement: "metal",
        weakElementCount: 2,
      },
      timingSensitivity: {
        currentDaYunStage: {
          raw: "养",
          signal: "mixed",
        },
        currentLiuNianStage: {
          raw: "绝",
          signal: "fragile",
        },
        sensitivityLevel: "elevated",
        triggerWindow: "dual-watch",
      },
      cautionTone: "extra-rest-and-monitor",
      forbiddenClaims: ["no-diagnosis", "no-treatment-instruction", "no-source7-remedy"],
      guardrail: "no-diagnosis-or-remedy",
    });
    expect(step4.result.guidanceNotes.join(" ")).not.toMatch(/วินิจฉัย|diagnosis|remedy|ทำบุญ|แก้เคล็ด/i);
    expect(step4.packetFamilies).toEqual(["strength", "role-of-element", "twelve-qi-texture", "conflict-context"]);
  });
});
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  BAZI_SHARED_PACKET_FAMILIES,
  buildBaziSharedPacketSpine,
} from "@/lib/bazi/symbolic-engine.shared-packets";
import { calculateBaziFactState } from "@/lib/bazi/symbolic-engine.os-core";
import { SOURCE1_GOLDEN_REFERENCE_CASE } from "@/lib/bazi/source1-operating-system-contract";

afterEach(() => {
  vi.useRealTimers();
});

function findPacket<TFamily extends (typeof BAZI_SHARED_PACKET_FAMILIES)[number]>(
  family: TFamily,
  packets: ReturnType<typeof buildBaziSharedPacketSpine>["packets"],
) {
  const packet = packets.find((entry) => entry.family === family);

  expect(packet).toBeDefined();

  return packet!;
}

describe("buildBaziSharedPacketSpine", () => {
  test("builds the full bounded shared packet spine from OS-core facts for the Source 1 golden case", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);
    const spine = buildBaziSharedPacketSpine(factState, {
      families: [...BAZI_SHARED_PACKET_FAMILIES],
      timingLookaheadCount: 2,
    });

    expect(spine.selection.families).toEqual(BAZI_SHARED_PACKET_FAMILIES);
    expect(spine.chartIdentity).toMatchObject({
      gender: "male",
      dayMaster: "癸",
      fourPillars: SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors.fourPillars,
    });

    const strengthPacket = findPacket("strength", spine.packets);
    expect(strengthPacket.sections.profile).toMatchObject({
      provenance: "source1_contract",
      sourceFieldIds: ["weighted-strength"],
      value: {
        dayMaster: "癸",
        score: factState.strengthScore,
        bandId: expect.any(String),
        semanticId: expect.any(String),
        sourceState: expect.any(String),
        lookupState: expect.any(String),
        repositoryLookupState: expect.any(String),
        displayLabel: expect.any(String),
      },
    });

    const conflictPacket = findPacket("conflict-context", spine.packets);
    expect(conflictPacket.sections.resolution.value.precedenceNotes.length).toBeLessThanOrEqual(6);
    expect(conflictPacket.sections.contextMap.value.length).toBeLessThanOrEqual(12);
    expect(conflictPacket.sections.contextMap.value[0]).toEqual(expect.objectContaining({
      relationId: expect.any(String),
      pillars: expect.any(Array),
      participants: expect.any(Array),
    }));

    const timingPacket = findPacket("timing", spine.packets);
    expect(timingPacket.sections.currentWindow).toMatchObject({
      provenance: "computed_fact_state",
      sourceFieldIds: ["timing"],
      value: {
        ageSnapshot: factState.ageSnapshot,
        isForwardDirection: factState.isForwardDirection,
      },
    });
    expect(timingPacket.sections.nextWindows.value.length).toBeLessThanOrEqual(2);

    const readinessPacket = findPacket("useful-god-master-key-readiness", spine.packets);
    expect(readinessPacket.sections.gates).toEqual({
      provenance: "source1_contract",
      sourceFieldIds: [
        "weighted-strength",
        "role-of-element",
        "twelve-qi-texture",
        "conflict-context",
        "timing",
      ],
      value: {
        status: "ready-for-overlay",
        readyFieldIds: [
          "weighted-strength",
          "role-of-element",
          "twelve-qi-texture",
          "conflict-context",
          "timing",
        ],
        pendingOverlayOutputs: ["useful-god-judgment", "master-key-judgment"],
      },
    });
    expect(JSON.stringify(spine)).not.toContain("compatibilityMatrixProfiles");
    expect(JSON.stringify(spine)).not.toContain("sixtyJiaziCorePersona");
  });

  test("stays opt-in and shell-neutral when only selected packet families are requested", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const factState = calculateBaziFactState(SOURCE1_GOLDEN_REFERENCE_CASE.input);
    const spine = buildBaziSharedPacketSpine(factState, {
      families: ["strength", "timing", "strength"],
      timingLookaheadCount: 1,
    });

    expect(spine.selection.families).toEqual(["strength", "timing"]);
    expect(spine.packets.map((packet) => packet.family)).toEqual(["strength", "timing"]);
    expect(findPacket("timing", spine.packets).sections.nextWindows.value.length).toBeLessThanOrEqual(1);
  });
});
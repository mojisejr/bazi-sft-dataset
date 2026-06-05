import { describe, expect, test } from "vitest";

import { calculateBaziStructuralState } from "@/lib/bazi/symbolic-engine";
import {
  buildSource1OperatingSystemContract,
  buildSource1StrengthContract,
  SOURCE1_CONTRACT_FIELDS,
  SOURCE1_GOLDEN_REFERENCE_CASE,
  SOURCE1_DEPENDENCY_BUCKETS,
} from "@/lib/bazi/source1-operating-system-contract";
import { buildDayMasterStrengthVocabulary } from "@/lib/bazi/strength-state-vocabulary";

describe("Source 1 operating system contract", () => {
  test("freezes the canonical Source 1 contract map with the required pillars", () => {
    const contract = buildSource1OperatingSystemContract();

    expect(contract.fieldIds).toEqual([
      "four-pillars",
      "day-master",
      "gender",
      "weighted-strength",
      "role-of-element",
      "twelve-qi-texture",
      "conflict-context",
      "timing",
      "useful-god-master-key-readiness",
    ]);
    expect(contract.referenceCase).toMatchObject({
      label: "1989-01-03 08:45 male Bangkok",
      input: {
        birthDate: "1989-01-03",
        birthTime: "08:45",
        gender: "male",
        province: "Bangkok",
      },
      structuralAnchors: {
        dayMaster: "癸",
        fourPillars: {
          year: { stem: "戊", branch: "辰" },
          month: { stem: "甲", branch: "子" },
          day: { stem: "癸", branch: "亥" },
          hour: { stem: "丙", branch: "辰" },
        },
      },
    });
  });

  test("classifies the Source 1 surface into the five approved dependency buckets", () => {
    const contract = buildSource1OperatingSystemContract();

    expect(contract.bucketSummary.map((entry) => entry.bucket)).toEqual(SOURCE1_DEPENDENCY_BUCKETS);
    expect(contract.bucketSummary).toEqual([
      {
        bucket: "base-structure",
        fieldIds: ["four-pillars", "day-master", "gender", "weighted-strength"],
      },
      {
        bucket: "role-of-element",
        fieldIds: ["role-of-element"],
      },
      {
        bucket: "table-interaction",
        fieldIds: ["twelve-qi-texture", "conflict-context"],
      },
      {
        bucket: "timing",
        fieldIds: ["timing"],
      },
      {
        bucket: "narrative-overlay",
        fieldIds: ["useful-god-master-key-readiness"],
      },
    ]);
    expect(contract.engineTruthIds).toEqual(contract.fieldIds);
    expect(contract.narrativeTruthIds).toEqual([]);
  });

  test("preserves 5-band strength semantics before collapsing to canonical lookup states", () => {
    expect(buildSource1StrengthContract(1.75)).toMatchObject({
      bandId: "very-weak",
      semanticId: "reinforce-max",
      sourceState: "อ่อนเกินไป",
      lookupState: "อ่อนแอ",
      repositoryLookupState: "อ่อนแอ",
      displayLabel: "ดิถีอ่อนเกินไป",
    });
    expect(buildSource1StrengthContract(2.25)).toMatchObject({
      bandId: "weak",
      semanticId: "reinforce",
      sourceState: "ดวงอ่อน",
      lookupState: "อ่อนแอ",
      repositoryLookupState: "อ่อนแอ",
      displayLabel: "ดิถีอ่อน",
    });
    expect(buildSource1StrengthContract(4)).toMatchObject({
      bandId: "balanced",
      semanticId: "circulate",
      sourceState: "สมดุล",
      lookupState: "แข็งแรง/สมดุล",
      repositoryLookupState: "แข็งแรง/สมดุล",
      displayLabel: "ดิถีสมดุล",
    });
    expect(buildSource1StrengthContract(5.75)).toMatchObject({
      bandId: "strong",
      semanticId: "channel",
      sourceState: "ดวงแข็ง",
      lookupState: "แข็งแรง/สมดุล",
      repositoryLookupState: "แข็งแรง/สมดุล",
      displayLabel: "ดิถีแข็ง",
    });
    expect(buildSource1StrengthContract(7)).toMatchObject({
      bandId: "very-strong",
      semanticId: "disperse-max",
      sourceState: "แข็งเกินไป",
      lookupState: "แข็งแรงมากเกินไป",
      repositoryLookupState: "แข็งแรงมากเกินไป",
      displayLabel: "ดิถีแข็งเกินไป",
    });
  });

  test("keeps the exported strength vocabulary aligned with Source 1 band semantics", () => {
    expect(buildDayMasterStrengthVocabulary(5.75)).toMatchObject({
      bandId: "strong",
      semanticId: "channel",
      sourceState: "ดวงแข็ง",
      displayBand: "ดวงแข็ง",
      displayLabel: "ดิถีแข็ง",
      lookupState: "แข็งแรง/สมดุล",
      repositoryLookupState: "แข็งแรง/สมดุล",
    });
  });

  test("pins the Source 1 strength knowledge boundary to explicit owners", () => {
    expect(buildSource1StrengthContract(5.75).knowledgeBoundary).toEqual({
      bandSemantics: "constants/operator-strength",
      compiledLookupSemantics: "strength-state-vocabulary",
      compiledCorpusTable: "canonical-knowledge.dayMasterStrengthStates",
      repositoryLookup: "symbolic-engine.repository.findDayMasterStrengthProfile",
    });
    expect(SOURCE1_CONTRACT_FIELDS.find((field) => field.id === "weighted-strength")?.runtimeOwner).toBe("symbolic-engine.strength");
  });

  test("pins the 1989 golden case to stable Source 1 structural anchors", () => {
    const structuralState = calculateBaziStructuralState(SOURCE1_GOLDEN_REFERENCE_CASE.input);

    expect(structuralState).toMatchObject(SOURCE1_GOLDEN_REFERENCE_CASE.structuralAnchors);
  });
});
import { describe, it, expect } from "vitest";

import {
  SCHOOL_LEXICON_RELATION,
  SCHOOL_LEXICON_INTERACTION,
  SCHOOL_LEXICON_FAMILY_KEY,
  PRIORITY_MAP,
  OUTCOME_STATUS_MAP,
  DAY_MASTER_EFFECT_MAP,
  FLOW_CYCLE_MAP,
  FLOW_DIRECTION_MAP,
  BADGE_FAMILY_MAP,
  PILLAR_CONTEXT_SHORT,
  PILLAR_LABEL_MAP,
  OUTCOME_DETAIL_MAP,
  REVIEW_STATE_MAP,
  ANNOTATOR_BADGE_MAP,
  CHAMBER_RELATION_TYPE_MAP,
  BUNDLE_DIRECTION_MAP,
  INTERACTION_NARRATIVE_MAP,
  UI_KICKER_MAP,
  getSchoolLexiconFamilyKey,
  translatePriority,
  translateOutcomeStatus,
  translateDayMasterEffect,
  translateReviewState,
  translateRelationType,
  translateBundleDirection,
  translateOutcomeDetail,
} from "@/lib/bazi/lexicon/school-lexicon";

const ALL_MAPS: [string, Record<string, string>][] = [
  ["SCHOOL_LEXICON_RELATION", SCHOOL_LEXICON_RELATION],
  ["SCHOOL_LEXICON_INTERACTION", SCHOOL_LEXICON_INTERACTION],
  ["SCHOOL_LEXICON_FAMILY_KEY", SCHOOL_LEXICON_FAMILY_KEY],
  ["PRIORITY_MAP", PRIORITY_MAP],
  ["OUTCOME_STATUS_MAP", OUTCOME_STATUS_MAP],
  ["DAY_MASTER_EFFECT_MAP", DAY_MASTER_EFFECT_MAP],
  ["FLOW_CYCLE_MAP", FLOW_CYCLE_MAP],
  ["FLOW_DIRECTION_MAP", FLOW_DIRECTION_MAP],
  ["BADGE_FAMILY_MAP", BADGE_FAMILY_MAP],
  ["PILLAR_CONTEXT_SHORT", PILLAR_CONTEXT_SHORT],
  ["PILLAR_LABEL_MAP", PILLAR_LABEL_MAP],
  ["OUTCOME_DETAIL_MAP", OUTCOME_DETAIL_MAP],
  ["REVIEW_STATE_MAP", REVIEW_STATE_MAP],
  ["ANNOTATOR_BADGE_MAP", ANNOTATOR_BADGE_MAP],
  ["CHAMBER_RELATION_TYPE_MAP", CHAMBER_RELATION_TYPE_MAP],
  ["BUNDLE_DIRECTION_MAP", BUNDLE_DIRECTION_MAP],
  ["INTERACTION_NARRATIVE_MAP", INTERACTION_NARRATIVE_MAP],
  ["UI_KICKER_MAP", UI_KICKER_MAP],
];

describe("school-lexicon maps", () => {
  it("every map value is a non-empty string", () => {
    for (const [name, map] of ALL_MAPS) {
      for (const [key, value] of Object.entries(map)) {
        expect(typeof value, `${name}["${key}"] should be string`).toBe("string");
        expect(value.length > 0, `${name}["${key}"] should not be empty`).toBe(true);
      }
    }
  });

  it("every map has at least one entry", () => {
    for (const [name, map] of ALL_MAPS) {
      expect(Object.keys(map).length, `${name} should have entries`).toBeGreaterThan(0);
    }
  });
});

describe("school-lexicon helpers return [engine: ...] for unmapped keys", () => {
  it("getSchoolLexiconFamilyKey falls back to [engine: ...]", () => {
    const result = getSchoolLexiconFamilyKey("totally-fake-key");
    expect(result).toBe("[engine: totally-fake-key]");
  });

  it("translatePriority falls back to [engine: ...]", () => {
    expect(translatePriority("nonexistent")).toBe("[engine: nonexistent]");
  });

  it("translateOutcomeStatus falls back to [engine: ...]", () => {
    expect(translateOutcomeStatus("nonexistent")).toBe("[engine: nonexistent]");
  });

  it("translateDayMasterEffect falls back to [engine: ...]", () => {
    expect(translateDayMasterEffect("nonexistent")).toBe("[engine: nonexistent]");
  });

  it("translateReviewState falls back to [engine: ...]", () => {
    expect(translateReviewState("nonexistent")).toBe("[engine: nonexistent]");
  });

  it("translateRelationType falls back to [engine: ...]", () => {
    expect(translateRelationType("nonexistent")).toBe("[engine: nonexistent]");
  });

  it("translateBundleDirection falls back to [engine: ...]", () => {
    expect(translateBundleDirection("nonexistent")).toBe("[engine: nonexistent]");
  });

  it("translateOutcomeDetail falls back to [engine: ...]", () => {
    expect(translateOutcomeDetail("nonexistent")).toBe("[engine: nonexistent]");
  });
});

describe("school-lexicon helpers return correct Thai for known keys", () => {
  it("translateReviewState maps known states", () => {
    expect(translateReviewState("active")).toBe("ปกติ");
    expect(translateReviewState("stale")).toBe("ต้องตรวจซ้ำ");
  });

  it("translateRelationType maps chamber relation types", () => {
    expect(translateRelationType("ten-god-flow")).toBe("กระแสสิบเทพ");
    expect(translateRelationType("element-interaction")).toBe("ปฏิกิริยาธาตุ");
  });

  it("translateBundleDirection maps directions", () => {
    expect(translateBundleDirection("outward")).toBe("ส่งออก");
    expect(translateBundleDirection("mutual")).toBe("สองทิศ");
  });

  it("translateOutcomeDetail maps element transforms", () => {
    expect(translateOutcomeDetail("fire")).toBe("หลอมรวมเป็นธาตุไฟ");
    expect(translateOutcomeDetail("water")).toBe("หลอมรวมเป็นธาตุน้ำ");
  });
});

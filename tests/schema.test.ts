import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import {
  baziCanonicalRawRows,
  baziCanonicalSources,
  baziDatasetRecords,
  baziDayMasterProfiles,
  baziDomainMatrices,
  baziFaqTaxonomies,
  baziReferenceDocuments,
  baziSixtyJiaziNarratives,
  baziTimeSolarTerms,
  datasetStatusEnum,
  intentDomainEnum,
  reviewedDatasetContentCheckName,
} from "@/db/schema";
import {
  AnnotationDataSchema,
  CalculatedStateSchema,
  DraftAnnotationDataSchema,
  InteractionStateSchema,
  RejectedAnnotationDataSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
} from "@/lib/bazi/schema-types";

describe("baziDatasetRecords", () => {
  test("exposes the phase 1 dataset columns required by the blueprint", () => {
    expect(Object.keys(getTableColumns(baziDatasetRecords))).toEqual([
      "id",
      "rawInput",
      "calculatedState",
      "intentDomain",
      "annotationData",
      "status",
      "annotatorId",
      "metadata",
      "createdAt",
      "updatedAt",
    ]);
  });

  test("locks dataset status and intent domains to the supported phase 1 values", () => {
    expect(datasetStatusEnum.enumValues).toEqual([
      "draft",
      "reviewed",
      "rejected",
      "exported",
    ]);

    expect(intentDomainEnum.enumValues).toEqual([
      "general",
      "work",
      "study",
      "wealth",
      "love",
      "health",
      "family",
      "other",
      "timing",
    ]);
  });

  test("keeps the reviewed content check constraint attached to the table", () => {
    const tableConfig = getTableConfig(baziDatasetRecords);

    expect(tableConfig.checks.map((entry) => entry.name)).toContain(
      reviewedDatasetContentCheckName,
    );
  });

  test("enforces the phase 1.6 annotation contract with all 15 dimensions", () => {
    const parsed = AnnotationDataSchema.parse({
      version: "1.6",
      sinsaeProofNote: "Adjusted the final tone to match orthodox reading language.",
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: `Reasoning for ${dimensionName}`,
        final_prediction: `Prediction for ${dimensionName}`,
      })),
    });

    expect(parsed.dimensions).toHaveLength(15);
  });

  test("rejects duplicate annotation dimensions", () => {
    expect(() =>
      AnnotationDataSchema.parse({
        version: "1.6",
        sinsaeProofNote: "Proof note",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map(() => ({
          dimension_name: "chart_foundation",
          thought_process: "Reasoning",
          final_prediction: "Prediction",
        })),
      }),
    ).toThrow(/duplicate dimensions/i);
  });

  test("requires sinsae proof note for reviewed annotation data", () => {
    expect(() =>
      AnnotationDataSchema.parse({
        version: "1.6",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
          dimension_name: dimensionName,
          thought_process: `Reasoning for ${dimensionName}`,
          final_prediction: `Prediction for ${dimensionName}`,
        })),
      }),
    ).toThrow(/sinsaeProofNote/i);
  });

  test("allows draft annotation data with partial text while preserving all 15 dimensions", () => {
    const parsed = DraftAnnotationDataSchema.parse({
      version: "1.6",
      dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
        dimension_name: dimensionName,
        thought_process: dimensionName === "chart_foundation" ? "Has draft" : "",
        final_prediction: "",
      })),
    });

    expect(parsed.dimensions).toHaveLength(15);
  });

  test("requires sinsae proof note when a record is rejected", () => {
    expect(() =>
      RejectedAnnotationDataSchema.parse({
        version: "1.6",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
          dimension_name: dimensionName,
          thought_process: dimensionName === "chart_foundation" ? "AI reason" : "",
          final_prediction: "",
        })),
      }),
    ).toThrow(/sinsaeProofNote/i);
  });
});

describe("phase 1.5 canonical tables", () => {
  test("exposes the canonical knowledge tables required for online lookup", () => {
    expect(getTableColumns(baziCanonicalSources)).toHaveProperty("relativePath");
    expect(getTableColumns(baziReferenceDocuments)).toHaveProperty("content");
    expect(getTableColumns(baziCanonicalRawRows)).toHaveProperty("cells");
    expect(getTableColumns(baziTimeSolarTerms)).toHaveProperty("label");
    expect(getTableColumns(baziFaqTaxonomies)).toHaveProperty("intentDomains");
    expect(getTableColumns(baziDayMasterProfiles)).toHaveProperty("combinedNarrative");
    expect(getTableColumns(baziSixtyJiaziNarratives)).toHaveProperty("combinedNarrative");
    expect(getTableColumns(baziDomainMatrices)).toHaveProperty("rawCells");
  });
});

describe("generalized interaction contract", () => {
  test("encodes generalized interaction entities, relations, outcomes, and qualifiers without semantic collision", () => {
    const parsed = InteractionStateSchema.parse({
      version: "v3-phase-1",
      entities: [
        {
          id: "branch-year-申",
          type: "branch",
          pillarKey: "year",
          symbol: "申",
          element: "metal",
        },
        {
          id: "branch-month-子",
          type: "branch",
          pillarKey: "month",
          symbol: "子",
          element: "water",
        },
        {
          id: "branch-day-辰",
          type: "branch",
          pillarKey: "day",
          symbol: "辰",
          element: "earth",
        },
      ],
      relations: [
        {
          id: "relation-san-he-shen-zi-chen",
          familyKey: "earthly-branch-san-he",
          type: "branch-combination",
          participantEntityIds: ["branch-year-申", "branch-month-子", "branch-day-辰"],
          label: "申子辰",
          transformElement: "water",
        },
        {
          id: "relation-ban-san-he-zi-chen",
          familyKey: "earthly-branch-ban-san-he",
          type: "branch-combination",
          participantEntityIds: ["branch-month-子", "branch-day-辰"],
          label: "子辰",
          transformElement: "water",
        },
      ],
      outcomes: [
        {
          relationId: "relation-san-he-shen-zi-chen",
          status: "transformed",
          precedence: "primary",
          transformElement: "water",
          supportReasons: ["season-support", "full-triad"],
          dayMasterEffect: "beneficial",
        },
        {
          relationId: "relation-ban-san-he-zi-chen",
          status: "detected",
          precedence: "secondary",
          supportReasons: ["partial-triad"],
          dayMasterEffect: "neutral",
        },
      ],
      qualifiers: [
        {
          id: "qualifier-day-qi",
          lane: "twelve-qi",
          qualifierKey: "twelve-qi-stage",
          entityId: "branch-day-辰",
          value: "长生",
          display: "เชี่ยงแซ",
        },
      ],
    });

    expect(parsed.relations).toHaveLength(2);
    expect(parsed.outcomes[0]).toMatchObject({
      relationId: "relation-san-he-shen-zi-chen",
      status: "transformed",
      transformElement: "water",
    });
    expect(parsed.qualifiers[0]).toMatchObject({
      lane: "twelve-qi",
      qualifierKey: "twelve-qi-stage",
      value: "长生",
    });
  });

  test("accepts calculated state payloads with optional generalized interaction state while preserving legacy shape", () => {
    const parsed = CalculatedStateSchema.parse({
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "甲", branch: "子", hiddenStems: ["癸"] },
        day: { stem: "癸", branch: "辰", hiddenStems: ["戊", "乙", "癸"] },
        hour: { stem: "丙", branch: "午", hiddenStems: ["丁", "己"] },
      },
      dayMaster: "癸",
      strengthScore: 2.5,
      tenGods: {
        yearStem: "劫财",
        yearBranch: "正印,劫财,正官",
        monthStem: "伤官",
        monthBranch: "比肩",
        dayStem: "ดิถี",
        dayBranch: "正官,食神,比肩",
        hourStem: "正财",
        hourBranch: "偏财,七杀",
      },
      twelveQi: {
        yearBranch: "เชี่ยงแซ",
        monthBranch: "ตี้อ๋วง",
        dayBranch: "เชี่ยงแซ",
        hourBranch: "ไท้",
      },
      interactionState: {
        version: "v3-phase-1",
        entities: [
          {
            id: "branch-month-子",
            type: "branch",
            pillarKey: "month",
            symbol: "子",
            element: "water",
          },
        ],
        relations: [
          {
            id: "relation-half-he-zi-chen",
            familyKey: "earthly-branch-ban-san-he",
            type: "branch-combination",
            participantEntityIds: ["branch-month-子"],
            label: "子辰",
          },
        ],
        outcomes: [
          {
            relationId: "relation-half-he-zi-chen",
            status: "detected",
          },
        ],
        qualifiers: [],
      },
      elementMetaphors: [],
    });

    expect(parsed.interactionState?.version).toBe("v3-phase-1");
    expect(parsed.compatibilityMatrixProfiles).toEqual([]);
    expect(parsed.explainable).toEqual({});
  });
});

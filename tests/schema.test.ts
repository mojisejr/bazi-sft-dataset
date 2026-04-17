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
  DraftAnnotationDataSchema,
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
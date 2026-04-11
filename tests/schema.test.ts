import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "vitest";

import {
  baziDatasetRecords,
  datasetStatusEnum,
  intentDomainEnum,
  reviewedDatasetContentCheckName,
} from "@/db/schema";

describe("baziDatasetRecords", () => {
  test("exposes the phase 1 dataset columns required by the blueprint", () => {
    expect(Object.keys(getTableColumns(baziDatasetRecords))).toEqual([
      "id",
      "rawInput",
      "calculatedState",
      "intentDomain",
      "chainOfThought",
      "targetOutput",
      "status",
      "createdAt",
      "updatedAt",
    ]);
  });

  test("locks dataset status and intent domains to the supported phase 1 values", () => {
    expect(datasetStatusEnum.enumValues).toEqual([
      "draft",
      "reviewed",
      "exported",
    ]);

    expect(intentDomainEnum.enumValues).toEqual([
      "general",
      "work",
      "wealth",
      "love",
      "health",
      "family",
      "timing",
    ]);
  });

  test("keeps the reviewed content check constraint attached to the table", () => {
    const tableConfig = getTableConfig(baziDatasetRecords);

    expect(tableConfig.checks.map((entry) => entry.name)).toContain(
      reviewedDatasetContentCheckName,
    );
  });
});
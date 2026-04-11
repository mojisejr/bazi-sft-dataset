import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { scaffoldMetadata, scaffoldStageEnum } from "@/db/schema";

describe("scaffoldMetadata", () => {
  test("exposes the scaffold-only columns needed for infra validation", () => {
    expect(Object.keys(getTableColumns(scaffoldMetadata))).toEqual([
      "id",
      "projectSlug",
      "status",
      "notes",
      "createdAt",
      "updatedAt",
    ]);
  });

  test("locks the infra status enum to scaffold stages", () => {
    expect(scaffoldStageEnum.enumValues).toEqual([
      "scaffolded",
      "phase_1_pending",
    ]);
  });
});
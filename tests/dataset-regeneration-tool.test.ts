import { describe, expect, test } from "vitest";

import {
  buildDatasetRegenerationPlan,
  createDatasetRegenerationReceipt,
  createSupersededDatasetMetadata,
  type DatasetRegenerationRecord,
} from "@/lib/bazi/dataset-regeneration";
import { CalculatedStateSchema } from "@/lib/bazi/schema-types";

function createRecord(
  overrides: Partial<DatasetRegenerationRecord> = {},
): DatasetRegenerationRecord {
  return {
    id: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
    rawInput: {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: CalculatedStateSchema.parse({
      fourPillars: {
        year: { stem: "壬", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        month: { stem: "戊", branch: "申", hiddenStems: ["庚", "壬", "戊"] },
        day: { stem: "己", branch: "巳", hiddenStems: ["丙", "庚", "戊"] },
        hour: { stem: "辛", branch: "未", hiddenStems: ["己", "丁", "乙"] },
      },
      dayMaster: "己",
      strengthScore: 3.07,
      tenGods: {
        yearStem: "正财",
        monthStem: "劫财",
        hourStem: "食神",
      },
      twelveQi: {
        yearBranch: "沐浴",
        monthBranch: "沐浴",
        dayBranch: "帝旺",
        hourBranch: "冠带",
      },
      sixtyJiaziCorePersona: {
        code: "己巳",
        narrative: "Measured earth that grows through patience and timing.",
      },
    }),
    annotationData: {
      version: "1.6",
      dimensions: [],
    },
    status: "draft",
    metadata: {
      customerName: "สมบัติ",
      sourceFile: "/tmp/example-cases.csv",
      generation: {
        source: "csv",
        model: "gemini-3-flash-preview",
        promptVersion: "v1",
        engineVersion: "engine-1",
        generatedAt: "2026-04-24T12:00:00.000Z",
      },
    },
    updatedAt: "2026-04-24T12:05:00.000Z",
    ...overrides,
  };
}

describe("dataset regeneration planning", () => {
  test("selects stale active drafts for rewrite", () => {
    const [entry] = buildDatasetRegenerationPlan([createRecord()], {
      fingerprint: {
        model: "gemini-3-flash-preview",
        promptVersion: "v2",
      },
      onlyStale: true,
    });

    expect(entry.status).toBe("rewrite_draft");
    expect(entry.selected).toBe(true);
    expect(entry.staleReasons).toEqual(["prompt-version-mismatch"]);
  });

  test("skips historical reviewed records unless include-reviewed-as-revision is enabled", () => {
    const [entry] = buildDatasetRegenerationPlan(
      [
        createRecord({
          status: "reviewed",
        }),
      ],
      {
        fingerprint: {
          model: "gemini-3-flash-preview",
          promptVersion: "v2",
        },
        includeReviewedAsRevision: false,
      },
    );

    expect(entry.status).toBe("skipped_clean");
    expect(entry.reason).toBe("historical-record-needs-include-reviewed-as-revision");
  });

  test("selects historical reviewed records for revision cloning when enabled", () => {
    const [entry] = buildDatasetRegenerationPlan(
      [
        createRecord({
          status: "reviewed",
        }),
      ],
      {
        fingerprint: {
          model: "gemini-3-flash-preview",
          promptVersion: "v2",
        },
        includeReviewedAsRevision: true,
      },
    );

    expect(entry.status).toBe("cloned_revision");
    expect(entry.selected).toBe(true);
  });

  test("skips exported records even when stale filtering is enabled", () => {
    const [entry] = buildDatasetRegenerationPlan(
      [
        createRecord({
          status: "exported",
        }),
      ],
      {
        fingerprint: {
          model: "gemini-3-flash-preview",
          promptVersion: "v2",
        },
        onlyStale: true,
        includeReviewedAsRevision: true,
      },
    );

    expect(entry.status).toBe("skipped_exported");
    expect(entry.selected).toBe(false);
  });

  test("groups revisions by raw input and keeps only the latest effective record", () => {
    const supersededRecord = createRecord({
      metadata: createSupersededDatasetMetadata(
        createRecord().metadata,
        "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
      ),
      updatedAt: "2026-04-24T12:06:00.000Z",
    });
    const activeRevision = createRecord({
      id: "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
      metadata: {
        ...createRecord().metadata,
        revision: {
          supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          revisionRootRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          latestEffectiveRecordId: "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
        },
      },
      updatedAt: "2026-04-24T12:12:00.000Z",
    });

    const entries = buildDatasetRegenerationPlan([supersededRecord, activeRevision], {
      fingerprint: {
        model: "gemini-3-flash-preview",
        promptVersion: "v2",
      },
      onlyStale: true,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.record.id).toBe("ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27");
  });

  test("summarizes receipt counts from the deterministic plan", () => {
    const entries = buildDatasetRegenerationPlan(
      [
        createRecord(),
        createRecord({
          id: "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
          status: "reviewed",
          rawInput: {
            birthDate: "1995-01-10",
            birthTime: "09:10",
            gender: "male",
            province: "Bangkok",
            calendarSystem: "solar",
            timezone: "Asia/Bangkok",
          },
        }),
        createRecord({
          id: "b2c3d4e5-fd33-4f84-b3a8-b13f0d4d4d27",
          status: "exported",
          rawInput: {
            birthDate: "2000-03-01",
            birthTime: "21:15",
            gender: "female",
            province: "Bangkok",
            calendarSystem: "solar",
            timezone: "Asia/Bangkok",
          },
        }),
      ],
      {
        fingerprint: {
          model: "gemini-3-flash-preview",
          promptVersion: "v2",
        },
        onlyStale: true,
        includeReviewedAsRevision: true,
      },
    );

    expect(createDatasetRegenerationReceipt(entries, 1)).toEqual({
      totalCandidates: 3,
      selectedCount: 2,
      rewrittenCount: 1,
      clonedRevisionCount: 1,
      skippedExportedCount: 1,
      skippedCleanCount: 0,
      failedCount: 1,
    });
  });
});
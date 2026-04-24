import { describe, expect, test } from "vitest";

import {
  collectDatasetStaleReasons,
  createRevisionDraftSaveRequest,
  createSupersededDatasetMetadata,
  resolveDatasetRevisionAction,
  resolveLatestEffectiveDatasetRecord,
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
      generation: {
        source: "csv",
        model: "gemini-3-flash-preview",
        promptVersion: "v1",
        engineVersion: "engine-1",
        calculatedStateHash: "calc-1",
        generatedAt: "2026-04-24T12:00:00.000Z",
      },
    },
    updatedAt: "2026-04-24T12:05:00.000Z",
    ...overrides,
  };
}

describe("dataset regeneration lifecycle", () => {
  test("marks active drafts as direct rewrite targets", () => {
    expect(resolveDatasetRevisionAction(createRecord())).toEqual({
      action: "rewrite-draft",
      targetRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
      reason: "draft-is-active",
    });
  });

  test("marks reviewed records for revision cloning instead of overwrite", () => {
    expect(
      resolveDatasetRevisionAction(
        createRecord({
          status: "reviewed",
        }),
      ),
    ).toEqual({
      action: "clone-revision",
      targetRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
      reason: "historical-records-are-immutable",
    });
  });

  test("skips exported records from regeneration writes", () => {
    expect(
      resolveDatasetRevisionAction(
        createRecord({
          status: "exported",
        }),
      ),
    ).toEqual({
      action: "skip-exported",
      targetRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
      reason: "exported-records-are-immutable",
    });
  });

  test("creates revision draft payloads that preserve history and request re-proof", () => {
    const request = createRevisionDraftSaveRequest(
      createRecord({
        status: "reviewed",
      }),
      {
        source: "revision-regeneration",
        model: "gemini-3-flash-preview",
        promptVersion: "v2",
        engineVersion: "engine-2",
        generatedAt: "2026-04-24T12:10:00.000Z",
      },
      ["engine-version-mismatch"],
    );

    expect(request.recordId).toBeUndefined();
    expect(request.status).toBe("draft");
    expect(request.metadata).toMatchObject({
      customerName: "สมบัติ",
      generation: {
        promptVersion: "v2",
        engineVersion: "engine-2",
      },
      revision: {
        supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
        revisionRootRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
      },
      reviewLifecycle: {
        state: "needs-reproof",
        staleReason: "engine-version-mismatch",
      },
    });
  });

  test("resolves stale reasons from generation fingerprint mismatches", () => {
    expect(
      collectDatasetStaleReasons(createRecord().metadata, {
        promptVersion: "v2",
        engineVersion: "engine-2",
      }),
    ).toEqual(["prompt-version-mismatch", "engine-version-mismatch"]);
  });

  test("resolves the latest effective record by ignoring superseded history", () => {
    const superseded = createRecord({
      metadata: createSupersededDatasetMetadata(
        createRecord().metadata,
        "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
      ),
      updatedAt: "2026-04-24T12:06:00.000Z",
    });
    const activeRevision = createRecord({
      id: "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
      status: "draft",
      metadata: {
        ...createRecord().metadata,
        revision: {
          supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          revisionRootRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          latestEffectiveRecordId: "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
        },
        reviewLifecycle: {
          state: "active",
        },
      },
      updatedAt: "2026-04-24T12:12:00.000Z",
    });

    expect(resolveLatestEffectiveDatasetRecord([superseded, activeRevision])?.id).toBe(
      "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
    );
  });
});
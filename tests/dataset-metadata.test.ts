import { describe, expect, test } from "vitest";

import {
  createDatasetRecordMetadata,
  mergeDatasetRecordMetadata,
} from "@/lib/bazi/dataset-metadata";

describe("dataset metadata contract", () => {
  test("keeps legacy metadata parseable", () => {
    expect(
      createDatasetRecordMetadata({
        customerName: "สมบัติ",
        caseNote: "เสียชีวิต",
        sourceFile: "/tmp/example-cases.csv",
        sourceRow: 2,
      }),
    ).toEqual({
      customerName: "สมบัติ",
      caseNote: "เสียชีวิต",
      sourceFile: "/tmp/example-cases.csv",
      sourceRow: 2,
    });
  });

  test("accepts extended provenance and revision metadata", () => {
    expect(
      createDatasetRecordMetadata({
        customerName: "สมบัติ",
        generation: {
          source: "csv",
          model: "gemini-3-flash-preview",
          promptVersion: "v2",
          promptHash: "prompt-hash-001",
          referencePackVersion: "ref-pack-2026-04-24",
          engineVersion: "engine-2026-04-24",
          calculatedStateHash: "calc-hash-001",
          queueBatchId: "batch-01",
          queueSeed: 20260424,
          generatedAt: "2026-04-24T12:00:00.000Z",
          composition: {
            layer: "proof-dimension-composer",
            version: "v1",
            strategies: ["direct-topic-dimension", "shared-legacy-dimension"],
            directCount: 9,
            sharedCount: 3,
            unmappedCount: 3,
          },
        },
        revision: {
          supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          revisionRootRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          latestEffectiveRecordId: "ad1c1cc9-fd33-4f84-b3a8-b13f0d4d4d27",
        },
        reviewLifecycle: {
          state: "needs-reproof",
          staleReason: "engine-version-mismatch",
          staleAt: "2026-04-24T12:01:00.000Z",
        },
      }),
    ).toMatchObject({
      customerName: "สมบัติ",
      generation: {
        source: "csv",
        model: "gemini-3-flash-preview",
        composition: {
          layer: "proof-dimension-composer",
          directCount: 9,
        },
      },
      revision: {
        supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
      },
      reviewLifecycle: {
        state: "needs-reproof",
      },
    });
  });

  test("merges nested metadata without dropping legacy fields", () => {
    expect(
      mergeDatasetRecordMetadata(
        {
          customerName: "สมบัติ",
          caseNote: "เสียชีวิต",
          sourceFile: "/tmp/example-cases.csv",
          generation: {
            source: "csv",
            model: "gemini-3-flash-preview",
            composition: {
              layer: "proof-dimension-composer",
              directCount: 9,
            },
          },
        },
        {
          generation: {
            composition: {
              version: "v1",
              sharedCount: 3,
              unmappedCount: 3,
            },
          },
          revision: {
            supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
          },
          reviewLifecycle: {
            state: "stale",
          },
        },
      ),
    ).toEqual({
      customerName: "สมบัติ",
      caseNote: "เสียชีวิต",
      sourceFile: "/tmp/example-cases.csv",
      generation: {
        source: "csv",
        model: "gemini-3-flash-preview",
        composition: {
          layer: "proof-dimension-composer",
          directCount: 9,
          version: "v1",
          sharedCount: 3,
          unmappedCount: 3,
        },
      },
      revision: {
        supersedesRecordId: "8d4c63f0-c0d6-4c02-b520-c34074e6b7aa",
      },
      reviewLifecycle: {
        state: "stale",
      },
    });
  });
});
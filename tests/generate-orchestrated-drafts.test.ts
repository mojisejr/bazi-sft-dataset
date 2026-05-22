import { describe, expect, test, vi } from "vitest";

import {
  parseCliOptions,
  runGeneration,
} from "../scripts/generate-orchestrated-drafts";
import type {
  PendingDraftDatasetRecord,
  ProofDatasetRecord,
} from "@/lib/bazi/dataset-records";

function createPendingRecord(id: string): PendingDraftDatasetRecord {
  return {
    id,
    birthDate: "1992-08-21",
    birthTime: "14:35",
    dayMaster: "己",
    intentDomain: "love",
    customerName: "คุณทดสอบ",
    caseNote: "phase2 script",
    queueBatchId: "batch-001",
    reviewState: "active",
    staleReason: null,
    supersedesRecordId: null,
    latestEffectiveRecordId: id,
    sourceRow: 1,
    annotatorId: null,
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:10:00.000Z",
  };
}

function createProofRecord(id: string): ProofDatasetRecord {
  return {
    id,
    rawInput: {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Bangkok",
    },
    calculatedState: {
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
    } as ProofDatasetRecord["calculatedState"],
    intentDomain: "love",
    annotationData: null,
    status: "draft",
    annotatorId: null,
    metadata: {
      customerName: "คุณทดสอบ",
      generation: {
        source: "queue",
        queueBatchId: "batch-001",
      },
      reviewLifecycle: {
        state: "active",
      },
    },
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:10:00.000Z",
  };
}

describe("generate orchestrated drafts script", () => {
  test("parses scaffold and phase2 cli flags", () => {
    expect(parseCliOptions(["--limit=2", "--runName=nightly", "--concurrency=3"]))
      .toEqual({
        limit: 2,
        runName: "nightly",
        concurrency: 3,
        help: false,
      });
  });

  test("selects active draft records and rewrites them through the orchestrated seam", async () => {
    const listDraftRecords = vi.fn().mockResolvedValue([
      createPendingRecord("11111111-1111-4111-8111-111111111111"),
      createPendingRecord("22222222-2222-4222-8222-222222222222"),
    ]);
    const getRecordById = vi.fn().mockResolvedValue(
      createProofRecord("11111111-1111-4111-8111-111111111111"),
    );
    const generateDraft = vi.fn().mockResolvedValue({
      savedRecord: {
        recordId: "11111111-1111-4111-8111-111111111111",
        status: "draft",
        updatedAt: "2026-05-22T05:30:00.000Z",
      },
      annotationData: { version: "1.6", dimensions: [] },
      draftByTopic: {},
      completedChunkIds: ["baseline"],
      model: "gemini-3-flash-preview",
      generationSeed: 123,
    });

    const summary = await runGeneration(
      {
        limit: 1,
        runName: "nightly",
        concurrency: 2,
        help: false,
      },
      {
        listDraftRecords,
        getRecordById,
        generateDraft,
        now: () => new Date("2026-05-22T05:29:00.000Z"),
      },
    );

    expect(listDraftRecords).toHaveBeenCalledTimes(1);
    expect(getRecordById).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "11111111-1111-4111-8111-111111111111",
        annotatorId: "agent_orchestrator",
        intentDomain: "love",
        metadata: expect.objectContaining({
          generation: expect.objectContaining({
            source: "queue",
            queueBatchId: "batch-001",
            generatedAt: "2026-05-22T05:29:00.000Z",
          }),
          reviewLifecycle: {
            state: "active",
            staleReason: undefined,
            staleAt: undefined,
          },
        }),
      }),
    );
    expect(summary).toEqual({
      status: "completed",
      runName: "nightly",
      selectedCount: 1,
      processedCount: 1,
      failedCount: 0,
      limit: 1,
      concurrency: 2,
      results: [
        {
          recordId: "11111111-1111-4111-8111-111111111111",
          savedRecordId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-05-22T05:30:00.000Z",
          model: "gemini-3-flash-preview",
          completedChunkCount: 1,
        },
      ],
    });
  });
});
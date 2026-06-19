import { describe, expect, test, vi } from "vitest";

import {
  generateAndSaveOrchestratedDraft,
  type DatasetRecordRepository,
} from "@/lib/bazi/dataset-records";
import { BAZI_ORCHESTRATOR_CHUNK_IDS } from "@/lib/bazi/orchestrator/chunk-manager";
import { BAZI_TOPIC_IDS } from "@/lib/bazi/knowledge/topic-types";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("orchestrated draft persistence", () => {
  test("generates, maps, validates, and saves a draft through the repository seam", async () => {
    const rawInput = {
      birthDate: "1992-08-21",
      birthTime: "14:35",
      gender: "female",
      province: "Bangkok",
      calendarSystem: "solar",
      timezone: "Asia/Hong_Kong",
    } as const;
    const calculatedState = await calculateBaziChart(rawInput, createTestKnowledgeRepository());
    const repository: DatasetRecordRepository = {
      saveRecord: vi.fn().mockResolvedValue({
        recordId: "6b0ce9ba-0af7-4f80-a4ea-df2a3b0447df",
        status: "draft",
        updatedAt: "2026-05-22T00:30:00.000Z",
      }),
    };

    const result = await generateAndSaveOrchestratedDraft({
      rawInput,
      calculatedState,
      annotatorId: "agent_orchestrator",
      intentDomain: "love",
      metadata: {
        customerName: "คุณทดสอบ",
        caseNote: "phase3 persistence seam",
      },
      dependencies: {
        repository,
        generateTopicDraft: async () => ({
          draftByTopic: Object.fromEntries(
            BAZI_TOPIC_IDS.map((topicId) => [topicId, `${topicId}:draft`]),
          ) as Record<(typeof BAZI_TOPIC_IDS)[number], string>,
          chunkResults: [],
          model: "gemini-3-flash-preview",
          generationSeed: 12345,
          completedChunkIds: [...BAZI_ORCHESTRATOR_CHUNK_IDS],
        }),
      },
    });

    expect(repository.saveRecord).toHaveBeenCalledTimes(1);
    expect(repository.saveRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        intentDomain: "love",
        status: "draft",
        metadata: expect.objectContaining({
          customerName: "คุณทดสอบ",
          caseNote: "phase3 persistence seam",
          generation: expect.objectContaining({
            source: "queue",
            model: "gemini-3-flash-preview",
            composition: expect.objectContaining({
              layer: "proof-dimension-composer",
              version: "v1",
              sharedCount: 3,
              unmappedCount: 3,
            }),
          }),
        }),
      }),
      "agent_orchestrator",
    );
    const savedPayload = vi.mocked(repository.saveRecord).mock.calls[0]?.[0];

    expect(savedPayload?.annotationData.dimensions).toHaveLength(15);
    expect(
      savedPayload?.annotationData.dimensions.find(
        (dimension) => dimension.dimension_name === "personality_psychology",
      )?.thought_process,
    ).toContain("ยึดดิถี");
    expect(
      savedPayload?.annotationData.dimensions.find(
        (dimension) => dimension.dimension_name === "personality_psychology",
      )?.final_prediction,
    ).toBe("personality_baseline:draft");
    expect(result.savedRecord.recordId).toBe("6b0ce9ba-0af7-4f80-a4ea-df2a3b0447df");
    expect(result.completedChunkIds).toEqual(BAZI_ORCHESTRATOR_CHUNK_IDS);
  });
});
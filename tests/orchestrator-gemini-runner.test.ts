import { describe, expect, test, vi } from "vitest";

import { BAZI_ORCHESTRATOR_CHUNK_IDS } from "@/lib/bazi/orchestrator/chunk-manager";
import { generateChunkedTopicDraft } from "@/lib/bazi/orchestrator/gemini-runner";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

const rawInput = {
  birthDate: "1992-08-21",
  birthTime: "14:35",
  gender: "female",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Hong_Kong",
} as const;

let cachedChart: Awaited<ReturnType<typeof calculateBaziChart>> | null = null;

async function getChart() {
  cachedChart ??= await calculateBaziChart(rawInput, createTestKnowledgeRepository());

  return cachedChart;
}

describe("orchestrator gemini runner", () => {
  test("executes all chunks sequentially and aggregates a full 15-topic draft object", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const chart = await getChart();
    const seenChunkIds: string[] = [];

    const result = await generateChunkedTopicDraft({
      rawInput,
      calculatedState: chart,
      executeChunk: async (request) => {
        seenChunkIds.push(request.chunkId);

        return JSON.stringify(
          Object.fromEntries(
            request.promptBundle.responseSchemaKeys.map((key) => [
              key,
              `${request.chunkId}:${key}:draft`,
            ]),
          ),
        );
      },
    });

    expect(seenChunkIds).toEqual(BAZI_ORCHESTRATOR_CHUNK_IDS);
    expect(result.completedChunkIds).toEqual(BAZI_ORCHESTRATOR_CHUNK_IDS);
    expect(Object.keys(result.draftByTopic)).toHaveLength(15);
    expect(result.draftByTopic.personality_baseline).toBe("core_profile:personality_baseline:draft");
    expect(result.draftByTopic.major_luck_cycles).toBe("life_path:major_luck_cycles:draft");
    expect(result.draftByTopic.fortune_enhancement).toBe("wellbeing_balance:fortune_enhancement:draft");
  });

  test("retries a chunk after invalid json and succeeds with validated keys", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const chart = await getChart();
    let shouldFailFirstAttempt = true;
    const executeChunk = vi.fn(async (request: { promptBundle: { responseSchemaKeys: string[] } }) => {
      if (shouldFailFirstAttempt) {
        shouldFailFirstAttempt = false;

        return "{";
      }

      return JSON.stringify(
        Object.fromEntries(
          request.promptBundle.responseSchemaKeys.map((key) => [key, `${key}:ok`]),
        ),
      );
    });

    const pending = generateChunkedTopicDraft({
      rawInput,
      calculatedState: chart,
      retry: {
        maxAttempts: 2,
        initialDelayMs: 1,
      },
      executeChunk,
    });

    await vi.runAllTimersAsync();
    const result = await pending;

    expect(executeChunk).toHaveBeenCalledTimes(5);
    expect(result.completedChunkIds).toEqual(BAZI_ORCHESTRATOR_CHUNK_IDS);
    expect(result.draftByTopic).toMatchObject({
      personality_baseline: "personality_baseline:ok",
      patrons_support: "patrons_support:ok",
      talents: "talents:ok",
      suitable_career: "suitable_career:ok",
      major_luck_cycles: "major_luck_cycles:ok",
    });
  });
});
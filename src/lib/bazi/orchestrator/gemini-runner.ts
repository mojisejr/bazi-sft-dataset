import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getGeminiApiKey } from "@/lib/env";
import {
  BAZI_ORCHESTRATOR_CHUNK_IDS,
  FullTopicDraftSchema,
  type OrchestratorChunkId,
} from "@/lib/bazi/orchestrator/chunk-manager";
import {
  buildChunkPromptBundle,
  type ChunkPromptBundle,
} from "@/lib/bazi/orchestrator/prompt-builder";
import { type CalculatedStateValue, type RawInputValue } from "@/lib/bazi/schema-types";
import {
  EMPTY_OVERLAY,
  type KnowledgeOverlay,
} from "@/lib/bazi/knowledge/knowledge-overlay";

const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_MAX_ATTEMPTS = 6;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1_500;

export const ChunkDraftSchema = z.record(z.string().trim().min(1), z.string().trim().min(1));

export const ChunkExecutionResultSchema = z.object({
  chunkId: z.string().trim().min(1),
  topicIds: z.array(z.string().trim().min(1)).min(1),
  responseSchemaKeys: z.array(z.string().trim().min(1)).min(1),
  rawResponseText: z.string().trim().min(1),
  parsedDraft: ChunkDraftSchema,
});

export type ChunkExecutionResult = z.infer<typeof ChunkExecutionResultSchema> & {
  promptBundle: ChunkPromptBundle;
};

export type ChunkRunnerRequest = {
  model: string;
  chunkId: OrchestratorChunkId;
  generationSeed: number;
  promptBundle: ChunkPromptBundle;
};

export type GenerateChunkedTopicDraftOptions = {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  model?: string;
  apiKey?: string;
  chunkIds?: readonly OrchestratorChunkId[];
  retry?: {
    maxAttempts?: number;
    initialDelayMs?: number;
  };
  executeChunk?: (request: ChunkRunnerRequest) => Promise<string>;
  /** overlay องค์ความรู้ของซินแส (logicRules/sourceFocus) — ทับลง prompt; ไม่ส่ง = ไม่ทับ */
  knowledgeOverlay?: KnowledgeOverlay;
};

export type GenerateChunkedTopicDraftResult = {
  draftByTopic: z.infer<typeof FullTopicDraftSchema>;
  chunkResults: ChunkExecutionResult[];
  model: string;
  generationSeed: number;
  completedChunkIds: OrchestratorChunkId[];
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildStableGenerationSeed(rawInput: RawInputValue) {
  const digest = createHash("sha256")
    .update(JSON.stringify(rawInput))
    .digest();

  return digest.readUInt32BE(0) % 2_147_483_647;
}

function createChunkResponseJsonSchema(keys: readonly string[]) {
  return {
    type: "object",
    properties: Object.fromEntries(
      keys.map((key) => [key, { type: "string" }]),
    ),
    required: [...keys],
    additionalProperties: false,
  } as const;
}

function createChunkDraftValidationSchema(keys: readonly string[]) {
  return z.object(
    Object.fromEntries(
      keys.map((key) => [key, z.string().trim().min(1)]),
    ) as Record<string, z.ZodString>,
  ).strict();
}

function parseChunkDraftResponse(rawResponseText: string, bundle: ChunkPromptBundle) {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawResponseText) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON for chunk ${bundle.chunkId}: ${error instanceof Error ? error.message : "unknown JSON parse error"}`,
    );
  }

  const schema = createChunkDraftValidationSchema(bundle.responseSchemaKeys);

  try {
    return schema.parse(parsedJson);
  } catch (error) {
    throw new Error(
      `Chunk response validation failed for ${bundle.chunkId}: ${error instanceof Error ? error.message : "unknown validation error"}`,
    );
  }
}

function isRetryableChunkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("429")
    || message.includes("quota")
    || message.includes("rate limit")
    || message.includes("503")
    || message.includes("500")
    || message.includes("timeout")
    || message.includes("invalid json")
    || message.includes("unexpected end of json")
    || message.includes("chunk response validation failed")
    || message.includes("empty response")
  );
}

function getRetryDelayMs(error: unknown, fallbackMs: number) {
  if (!(error instanceof Error)) {
    return fallbackMs;
  }

  const retrySecondsMatch = error.message.match(/retry in\s+([0-9.]+)s/i);

  if (!retrySecondsMatch) {
    return fallbackMs;
  }

  const retrySeconds = Number(retrySecondsMatch[1]);

  if (!Number.isFinite(retrySeconds) || retrySeconds <= 0) {
    return fallbackMs;
  }

  return Math.max(fallbackMs, Math.ceil(retrySeconds * 1000));
}

async function executeChunkWithGemini(
  apiKey: string,
  request: ChunkRunnerRequest,
) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: request.model,
    contents: request.promptBundle.userPrompt,
    config: {
      systemInstruction: request.promptBundle.systemInstruction,
      temperature: 0.55,
      responseMimeType: "application/json",
      responseJsonSchema: createChunkResponseJsonSchema(request.promptBundle.responseSchemaKeys),
      seed: request.generationSeed,
    },
  });

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error(`Gemini returned an empty response body for chunk ${request.chunkId}.`);
  }

  return responseText;
}

async function runSingleChunk(
  request: ChunkRunnerRequest,
  options: {
    apiKey: string;
    executeChunk?: (request: ChunkRunnerRequest) => Promise<string>;
    maxAttempts: number;
    initialRetryDelayMs: number;
  },
) {
  let lastError: unknown;
  let retryDelayMs = options.initialRetryDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const rawResponseText = options.executeChunk
        ? await options.executeChunk(request)
        : await executeChunkWithGemini(options.apiKey, request);
      const parsedDraft = parseChunkDraftResponse(rawResponseText, request.promptBundle);

      return ChunkExecutionResultSchema.parse({
        chunkId: request.chunkId,
        topicIds: request.promptBundle.topicIds,
        responseSchemaKeys: request.promptBundle.responseSchemaKeys,
        rawResponseText,
        parsedDraft,
      });
    } catch (error) {
      lastError = error;

      if (attempt === options.maxAttempts || !isRetryableChunkError(error)) {
        break;
      }

      retryDelayMs = getRetryDelayMs(error, retryDelayMs);
      await sleep(retryDelayMs);
      retryDelayMs *= 2;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Chunk execution failed for ${request.chunkId}.`);
}

export async function generateChunkedTopicDraft(
  options: GenerateChunkedTopicDraftOptions,
): Promise<GenerateChunkedTopicDraftResult> {
  const model = options.model?.trim() || DEFAULT_MODEL;
  const apiKey = options.executeChunk ? (options.apiKey ?? "") : (options.apiKey ?? getGeminiApiKey());
  const chunkIds = options.chunkIds?.length ? [...options.chunkIds] : [...BAZI_ORCHESTRATOR_CHUNK_IDS];
  const generationSeed = buildStableGenerationSeed(options.rawInput);
  const maxAttempts = options.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialRetryDelayMs = options.retry?.initialDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
  const chunkResults: ChunkExecutionResult[] = [];
  const knowledgeOverlay = options.knowledgeOverlay ?? EMPTY_OVERLAY;

  for (const chunkId of chunkIds) {
    const promptBundle = buildChunkPromptBundle(
      options.rawInput,
      options.calculatedState,
      chunkId,
      knowledgeOverlay,
    );
    const result = await runSingleChunk(
      {
        model,
        chunkId,
        generationSeed,
        promptBundle,
      },
      {
        apiKey,
        executeChunk: options.executeChunk,
        maxAttempts,
        initialRetryDelayMs,
      },
    );

    chunkResults.push({
      ...result,
      promptBundle,
    });
  }

  const aggregatedDraft = Object.assign({}, ...chunkResults.map((result) => result.parsedDraft));
  const draftByTopic = FullTopicDraftSchema.parse(aggregatedDraft);

  return {
    draftByTopic,
    chunkResults,
    model,
    generationSeed,
    completedChunkIds: chunkResults.map((result) => result.chunkId as OrchestratorChunkId),
  };
}
import { z } from "zod";

import { type CalculatedStateValue, type RawInputValue } from "@/lib/bazi/schema-types";
import { buildSystemInstruction } from "@/lib/bazi/gemini-draft-generator";
import {
  type EngineDependency,
  type EngineFactDTO,
  type TopicId,
} from "@/lib/bazi/knowledge/topic-types";
import {
  getTopicChunk,
  getTopicChunkDraftSchema,
  type OrchestratorChunkId,
} from "@/lib/bazi/orchestrator/chunk-manager";
import { getEngineFactsForDependencies } from "@/lib/bazi/symbolic-engine.facts";

export const ChunkPromptFactSchema = z.object({
  dependency: z.string().trim().min(1),
  label: z.string().trim().min(1),
  summary: z.string().trim().min(1),
});

export const ChunkPromptTopicSchema = z.object({
  topicId: z.string().trim().min(1),
  thaiLabel: z.string().trim().min(1),
  annotationDimension: z.string().trim().min(1),
  reasoningFocus: z.array(z.string().trim().min(1)).min(1),
  sinsaeLogicRules: z.array(z.string().trim().min(1)).min(1),
  facts: z.array(ChunkPromptFactSchema).min(1),
});

export const ChunkPromptBundleSchema = z.object({
  chunkId: z.string().trim().min(1),
  chunkThaiLabel: z.string().trim().min(1),
  topicIds: z.array(z.string().trim().min(1)).min(1),
  systemInstruction: z.string().trim().min(1),
  userPrompt: z.string().trim().min(1),
  responseSchemaKeys: z.array(z.string().trim().min(1)).min(1),
  topics: z.array(ChunkPromptTopicSchema).min(1),
});

export type ChunkPromptFact = z.infer<typeof ChunkPromptFactSchema>;
export type ChunkPromptTopic = z.infer<typeof ChunkPromptTopicSchema>;
export type ChunkPromptBundle = z.infer<typeof ChunkPromptBundleSchema>;

function dedupeDependencies(dependencies: readonly EngineDependency[]) {
  return [...new Set(dependencies)];
}

function indexFactsByDependency(facts: readonly EngineFactDTO[]) {
  return new Map(facts.map((fact) => [fact.dependency, fact]));
}

function buildChunkTopicPayloads(
  chunkId: OrchestratorChunkId,
  calculatedState: CalculatedStateValue,
) {
  const chunk = getTopicChunk(chunkId);
  const dependencies = dedupeDependencies(chunk.topics.flatMap((topic) => topic.engineDependencies));
  const facts = getEngineFactsForDependencies(calculatedState, dependencies);
  const factsByDependency = indexFactsByDependency(facts);

  return chunk.topics.map((topic) =>
    ChunkPromptTopicSchema.parse({
      topicId: topic.id,
      thaiLabel: topic.thaiLabel,
      annotationDimension: topic.annotationDimension,
      reasoningFocus: topic.sourceRefs.map((sourceRef) => sourceRef.reasoningFocus),
      sinsaeLogicRules: topic.sinsaeLogicRules,
      facts: topic.engineDependencies.map((dependency) => {
        const fact = factsByDependency.get(dependency);

        if (!fact) {
          throw new Error(`Missing engine fact for dependency: ${dependency}`);
        }

        return ChunkPromptFactSchema.parse({
          dependency: fact.dependency,
          label: fact.label,
          summary: fact.summary,
        });
      }),
    }),
  );
}

export function buildChunkSystemInstruction(chunkId: OrchestratorChunkId) {
  const chunk = getTopicChunk(chunkId);

  return [
    buildSystemInstruction(),
    `You are now writing only the ${chunk.thaiLabel} chunk for the Mumate Bazi orchestration pipeline.`,
    `Chunk id: ${chunk.id}.`,
    "Return one JSON object whose keys exactly match the requested topic ids for this chunk.",
    "Do not add extra keys, markdown, commentary, or wrapper fields.",
    "For each topic, write polished Thai reading text grounded only in the provided sinsae logic rules and engine facts.",
    "If a fact is absent, say only what the provided facts safely support; never fabricate missing chart detail.",
  ].join(" ");
}

function buildUserPromptHeader(rawInput: RawInputValue, chunkId: OrchestratorChunkId) {
  const chunk = getTopicChunk(chunkId);

  return [
    `Create Thai draft readings for chunk: ${chunk.thaiLabel}`,
    `Chunk id: ${chunk.id}`,
    `Expected topic ids: ${chunk.topicIds.join(", ")}`,
    "Use only the deterministic facts and rules below.",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
  ].join("\n");
}

function buildTopicBlock(topic: ChunkPromptTopic) {
  return [
    `Topic: ${topic.topicId}`,
    `Thai label: ${topic.thaiLabel}`,
    `Annotation dimension: ${topic.annotationDimension}`,
    `Reasoning focus: ${topic.reasoningFocus.join(" | ")}`,
    "Sinsae logic rules:",
    ...topic.sinsaeLogicRules.map((rule, index) => `${index + 1}. ${rule}`),
    "Engine facts:",
    ...topic.facts.map((fact) => `- ${fact.dependency} (${fact.label}): ${fact.summary}`),
  ].join("\n");
}

export function buildChunkUserPrompt(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  chunkId: OrchestratorChunkId,
) {
  const topics = buildChunkTopicPayloads(chunkId, calculatedState);

  return [
    buildUserPromptHeader(rawInput, chunkId),
    "",
    "Chunk topics:",
    topics.map((topic) => buildTopicBlock(topic)).join("\n\n"),
  ].join("\n");
}

export function buildChunkPromptBundle(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  chunkId: OrchestratorChunkId,
) {
  const chunk = getTopicChunk(chunkId);
  const topics = buildChunkTopicPayloads(chunkId, calculatedState);
  const responseSchema = getTopicChunkDraftSchema(chunkId);
  const responseSchemaKeys = Object.keys(responseSchema.shape) as TopicId[];

  return ChunkPromptBundleSchema.parse({
    chunkId: chunk.id,
    chunkThaiLabel: chunk.thaiLabel,
    topicIds: chunk.topicIds,
    systemInstruction: buildChunkSystemInstruction(chunkId),
    userPrompt: buildChunkUserPrompt(rawInput, calculatedState, chunkId),
    responseSchemaKeys,
    topics,
  });
}
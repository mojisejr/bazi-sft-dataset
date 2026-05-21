import { z } from "zod";

import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";
import {
  BaziTopicDefinitionSchema,
  TopicChunkGroupSchema,
  TopicIdSchema,
  type BaziTopicDefinition,
  type TopicChunkGroup,
  type TopicId,
} from "@/lib/bazi/knowledge/topic-types";

export const BAZI_ORCHESTRATOR_CHUNK_IDS = [
  "core_profile",
  "life_path",
  "relationships",
  "wellbeing_balance",
] as const;

export const OrchestratorChunkIdSchema = z.enum(BAZI_ORCHESTRATOR_CHUNK_IDS);

export type OrchestratorChunkId = z.infer<typeof OrchestratorChunkIdSchema>;

const CHUNK_BLUEPRINTS = {
  core_profile: {
    sequence: 1,
    thaiLabel: "แกนดวงและตัวตน",
    sourceGroup: "core_fate",
  },
  life_path: {
    sequence: 2,
    thaiLabel: "เส้นทางชีวิตและโอกาส",
    sourceGroup: "life_path",
  },
  relationships: {
    sequence: 3,
    thaiLabel: "ความสัมพันธ์รอบตัว",
    sourceGroup: "relationships",
  },
  wellbeing_balance: {
    sequence: 4,
    thaiLabel: "สมดุล สุขภาพ และการเสริมดวง",
    sourceGroup: "misc",
  },
} satisfies Record<
  OrchestratorChunkId,
  {
    sequence: number;
    thaiLabel: string;
    sourceGroup: TopicChunkGroup;
  }
>;

const GROUP_TO_CHUNK_ID = Object.freeze(
  Object.fromEntries(
    Object.entries(CHUNK_BLUEPRINTS).map(([chunkId, blueprint]) => [
      blueprint.sourceGroup,
      chunkId,
    ]),
  ) as Record<TopicChunkGroup, OrchestratorChunkId>,
);

export const BaziTopicChunkSchema = z.object({
  id: OrchestratorChunkIdSchema,
  sequence: z.number().int().positive(),
  thaiLabel: z.string().trim().min(1),
  sourceGroup: TopicChunkGroupSchema,
  topicIds: z.array(TopicIdSchema).min(1),
  topics: z.array(BaziTopicDefinitionSchema).min(1),
});

export type BaziTopicChunk = z.infer<typeof BaziTopicChunkSchema>;

function createChunkDraftShape(topicIds: readonly TopicId[]) {
  return Object.fromEntries(
    topicIds.map((topicId) => [topicId, z.string().trim().min(1)]),
  ) as Record<TopicId, z.ZodString>;
}

export function createTopicChunkDraftSchema(topicIds: readonly TopicId[]) {
  return z.object(createChunkDraftShape(topicIds)).strict();
}

export function buildTopicChunks(registry: readonly BaziTopicDefinition[] = BAZI_TOPIC_REGISTRY) {
  const topicsByChunk = new Map<OrchestratorChunkId, BaziTopicDefinition[]>();

  for (const topic of registry) {
    const chunkId = GROUP_TO_CHUNK_ID[topic.chunkGroup];
    const nextTopics = topicsByChunk.get(chunkId) ?? [];

    nextTopics.push(topic);
    topicsByChunk.set(chunkId, nextTopics);
  }

  return BAZI_ORCHESTRATOR_CHUNK_IDS.map((chunkId) => {
    const topics = [...(topicsByChunk.get(chunkId) ?? [])].sort(
      (left, right) => left.sequence - right.sequence,
    );
    const blueprint = CHUNK_BLUEPRINTS[chunkId];

    return BaziTopicChunkSchema.parse({
      id: chunkId,
      sequence: blueprint.sequence,
      thaiLabel: blueprint.thaiLabel,
      sourceGroup: blueprint.sourceGroup,
      topicIds: topics.map((topic) => topic.id),
      topics,
    });
  });
}

export const BAZI_TOPIC_CHUNKS = buildTopicChunks();

export const BAZI_TOPIC_CHUNKS_BY_ID = Object.freeze(
  Object.fromEntries(BAZI_TOPIC_CHUNKS.map((chunk) => [chunk.id, chunk])) as Record<
    OrchestratorChunkId,
    BaziTopicChunk
  >,
);

export const FullTopicDraftSchema = createTopicChunkDraftSchema(
  BAZI_TOPIC_REGISTRY.map((topic) => topic.id),
);

export function getTopicChunk(chunkId: OrchestratorChunkId) {
  return BAZI_TOPIC_CHUNKS_BY_ID[chunkId];
}

export function getChunkForTopic(topicId: TopicId) {
  return BAZI_TOPIC_CHUNKS.find((chunk) => chunk.topicIds.includes(topicId));
}

export function getTopicChunkDraftSchema(chunkId: OrchestratorChunkId) {
  return createTopicChunkDraftSchema(getTopicChunk(chunkId).topicIds);
}
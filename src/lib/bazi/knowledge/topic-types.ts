import { z } from "zod";

import {
  AnnotationDimensionNameSchema,
  type AnnotationDimensionName,
} from "@/lib/bazi/schema-types";

export const BAZI_TOPIC_IDS = [
  "personality_baseline",
  "suitable_career",
  "wealth_luck",
  "patrons_support",
  "talents",
  "family_dynamics",
  "love_life",
  "allies_and_rivals",
  "partnerships",
  "solo_vs_teamwork",
  "subordinates",
  "study_path",
  "major_luck_cycles",
  "health_risks",
  "fortune_enhancement",
] as const;

export const TopicIdSchema = z.enum(BAZI_TOPIC_IDS);

export const TOPIC_CHUNK_GROUPS = [
  "core_fate",
  "relationships",
  "life_path",
  "misc",
] as const;

export const TopicChunkGroupSchema = z.enum(TOPIC_CHUNK_GROUPS);

export const ENGINE_DEPENDENCIES = [
  "day_master",
  "day_master_strength",
  "sixty_jiazi_persona",
  "hidden_stems",
  "element_balance",
  "useful_god",
  "favorable_elements",
  "unfavorable_elements",
  "wealth_star",
  "power_star",
  "resource_star",
  "output_star",
  "peer_star",
  "pillar_relations",
  "month_branch_relations",
  "day_branch_relations",
  "hour_branch_relations",
  "clash_matrix",
  "combination_matrix",
  "harm_matrix",
  "punishment_matrix",
  "twelve_qi_profile",
  "dayun_cycles",
  "health_signals",
] as const;

export const EngineDependencySchema = z.enum(ENGINE_DEPENDENCIES);

export const TopicSourceReferenceSchema = z.object({
  directoryLabel: z.string().trim().min(1),
  primarySource: z.string().trim().min(1),
  supportingSources: z.array(z.string().trim().min(1)).default([]),
  sourceRoot: z.string().trim().min(1).default(".tmp/p-pol/Mootech AI/all_distilled"),
  reasoningFocus: z.string().trim().min(1),
});

export const BaziTopicDefinitionSchema = z.object({
  id: TopicIdSchema,
  sequence: z.number().int().positive(),
  thaiLabel: z.string().trim().min(1),
  chunkGroup: TopicChunkGroupSchema,
  annotationDimension: AnnotationDimensionNameSchema,
  engineDependencies: z.array(EngineDependencySchema).min(1),
  sinsaeLogicRules: z.array(z.string().trim().min(1)).min(1),
  sourceRefs: z.array(TopicSourceReferenceSchema).min(1),
});

export type TopicId = z.infer<typeof TopicIdSchema>;
export type TopicChunkGroup = z.infer<typeof TopicChunkGroupSchema>;
export type EngineDependency = z.infer<typeof EngineDependencySchema>;
export type TopicSourceReference = z.infer<typeof TopicSourceReferenceSchema>;
export type TopicSourceReferenceDraft = z.input<typeof TopicSourceReferenceSchema>;
export type BaziTopicDefinition = z.infer<typeof BaziTopicDefinitionSchema>;
export type BaziTopicDefinitionDraft = z.input<typeof BaziTopicDefinitionSchema>;
export type TopicAnnotationDimension = AnnotationDimensionName;

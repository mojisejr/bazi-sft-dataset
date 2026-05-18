import type { AnnotationDimensionName } from "@/lib/bazi/schema-types";
import { getHybridDictionarySpec } from "@/lib/bazi/dictionaries";

export type HybridRetrievalTier = "TierA" | "TierB" | "TierC";
export type HybridRetrievalStrategy =
  | "dictionary-first"
  | "folder-merge"
  | "ai-fallback";
export type HybridRetrievalCoverage = "direct" | "merge" | "missing";

export type HybridRetrievalRegistryEntry = {
  dimensionName: AnnotationDimensionName;
  tier: HybridRetrievalTier;
  strategy: HybridRetrievalStrategy;
  coverage: HybridRetrievalCoverage;
  sourceRelativePaths: readonly string[];
  fallbackRequired: boolean;
};

const TIER_B_SOURCE_PATHS = {
  chart_foundation: [
    "Step การอ่านดวง/Step การอ่านดวง.md",
    "Source1_ Step การอ่านดวง/Source1_ Step การอ่านดวง.md",
    "เกณฑ์ความแข็งอ่อน_ดวง5แบบ/2026-04-23_strength-evaluation-step.md",
  ],
  balance_element: [
    "Step การอ่านดวง/Step การอ่านดวง.md",
    "ตารางปฏิกิริยาธาตุ/ตารางปฏิกิริยาธาตุ.md",
    "อธิบายวงจรธาตุ/อธิบายวงจรธาตุ.md",
  ],
  annual_star_energy: [
    "12สี่ซิ้ง/12สี่ซิ้ง.md",
    "ตำราโหราศาสตร์เคี้ยงคุง/ตำราโหราศาสตร์เคี้ยงคุง.md",
  ],
  red_flags: [
    "ตารางชงเฮ้งไห่ผั่ว/ตารางชงเฮ้งไห่ผั่ว.md",
    "สุขภาพ(พื้นฐาน)/สุขภาพ(พื้นฐาน).md",
    "12สี่ซิ้ง/12สี่ซิ้ง.md",
  ],
  actionable_advice: [
    "Source7_ การเสริมดวง/Source7_ การเสริมดวง.md",
    "สุขภาพ(พื้นฐาน)/สุขภาพ(พื้นฐาน).md",
    "Stepพิจารณาดวงแข็งเกินไป-แข็งแรง-อ่อนแอ-อ่อนแอเกินไป.md",
  ],
  core_prediction: [
    "Step การอ่านดวง/Step การอ่านดวง.md",
    "Source7_ การเสริมดวง/Source7_ การเสริมดวง.md",
    "ตำรา24สารท/ตำรา24สารท.md",
  ],
} as const;

export const HYBRID_RETRIEVAL_REGISTRY: Record<AnnotationDimensionName, HybridRetrievalRegistryEntry> = {
  chart_foundation: {
    dimensionName: "chart_foundation",
    tier: "TierB",
    strategy: "folder-merge",
    coverage: "merge",
    sourceRelativePaths: TIER_B_SOURCE_PATHS.chart_foundation,
    fallbackRequired: true,
  },
  balance_element: {
    dimensionName: "balance_element",
    tier: "TierB",
    strategy: "folder-merge",
    coverage: "merge",
    sourceRelativePaths: TIER_B_SOURCE_PATHS.balance_element,
    fallbackRequired: true,
  },
  ten_gods_reaction: {
    dimensionName: "ten_gods_reaction",
    tier: "TierC",
    strategy: "ai-fallback",
    coverage: "missing",
    sourceRelativePaths: [],
    fallbackRequired: true,
  },
  twelve_qi_cycle: {
    dimensionName: "twelve_qi_cycle",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("twelve_qi_cycle")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  pillar_relations: {
    dimensionName: "pillar_relations",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("pillar_relations")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  health_overview: {
    dimensionName: "health_overview",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("health_overview")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  career_potential: {
    dimensionName: "career_potential",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("career_potential")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  wealth_and_investment: {
    dimensionName: "wealth_and_investment",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("wealth_and_investment")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  love_and_family: {
    dimensionName: "love_and_family",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("love_and_family")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  personality_psychology: {
    dimensionName: "personality_psychology",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("personality_psychology")?.sourceRelativePaths ?? [],
    fallbackRequired: false,
  },
  major_luck_cycles: {
    dimensionName: "major_luck_cycles",
    tier: "TierA",
    strategy: "dictionary-first",
    coverage: "direct",
    sourceRelativePaths: getHybridDictionarySpec("major_luck_cycles")?.sourceRelativePaths ?? [],
    fallbackRequired: true,
  },
  annual_star_energy: {
    dimensionName: "annual_star_energy",
    tier: "TierB",
    strategy: "folder-merge",
    coverage: "merge",
    sourceRelativePaths: TIER_B_SOURCE_PATHS.annual_star_energy,
    fallbackRequired: true,
  },
  red_flags: {
    dimensionName: "red_flags",
    tier: "TierB",
    strategy: "folder-merge",
    coverage: "merge",
    sourceRelativePaths: TIER_B_SOURCE_PATHS.red_flags,
    fallbackRequired: true,
  },
  actionable_advice: {
    dimensionName: "actionable_advice",
    tier: "TierB",
    strategy: "folder-merge",
    coverage: "merge",
    sourceRelativePaths: TIER_B_SOURCE_PATHS.actionable_advice,
    fallbackRequired: true,
  },
  core_prediction: {
    dimensionName: "core_prediction",
    tier: "TierB",
    strategy: "folder-merge",
    coverage: "merge",
    sourceRelativePaths: TIER_B_SOURCE_PATHS.core_prediction,
    fallbackRequired: true,
  },
};

export function getHybridRetrievalRegistryEntry(dimensionName: AnnotationDimensionName) {
  return HYBRID_RETRIEVAL_REGISTRY[dimensionName];
}

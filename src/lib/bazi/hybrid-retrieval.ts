import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { getHybridDictionarySpec } from "@/lib/bazi/dictionaries";
import {
  getHybridRetrievalRegistryEntry,
  type HybridRetrievalCoverage,
  type HybridRetrievalStrategy,
  type HybridRetrievalTier,
} from "@/lib/bazi/hybrid-retrieval-registry";
import type {
  AnnotationDimensionName,
  CalculatedStateValue,
} from "@/lib/bazi/schema-types";

const ALL_DISTILLED_SEGMENTS = [
  ".tmp",
  "p-pol",
  "Mootech AI",
  "all_distilled",
] as const;
const MAX_EXCERPT_CHARS = 900;

export type HybridRetrievalEvidence = {
  title: string;
  sourcePath: string;
  excerpt: string;
  matchedKeywords: string[];
};

export type HybridRetrievalPacket = {
  dimensionName: AnnotationDimensionName;
  tier: HybridRetrievalTier;
  strategy: HybridRetrievalStrategy;
  coverage: HybridRetrievalCoverage;
  fallbackRequired: boolean;
  evidence: HybridRetrievalEvidence[];
  notes: string[];
};

function pushUniqueString(target: string[], value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized || target.includes(normalized)) {
    return;
  }

  target.push(normalized);
}

function normalizeContent(content: string) {
  return content
    .replace(/\r/g, "")
    .replace(/^\| ---.*$/gm, "")
    .replace(/^---$/gm, "")
    .replace(/\t/g, " ");
}

function extractExcerpt(content: string, keywords: readonly string[]) {
  const normalized = normalizeContent(content);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const loweredKeywords = keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword) => keyword.length > 0);
  const matchedIndex = loweredKeywords.length === 0
    ? -1
    : lines.findIndex((line) => loweredKeywords.some((keyword) => line.toLowerCase().includes(keyword)));
  const excerptLines = matchedIndex >= 0
    ? lines.slice(Math.max(0, matchedIndex - 2), matchedIndex + 4)
    : lines.slice(0, 8);

  return excerptLines.join("\n").slice(0, MAX_EXCERPT_CHARS);
}

async function readEvidenceSource(relativePath: string, keywords: readonly string[], repoRoot: string) {
  const sourcePath = resolveAllDistilledFile(relativePath, repoRoot);
  const content = await readFile(sourcePath, "utf8");
  const excerpt = extractExcerpt(content, keywords);
  const matchedKeywords = keywords.filter((keyword) => excerpt.includes(keyword)).slice(0, 8);

  return {
    title: path.basename(relativePath),
    sourcePath,
    excerpt,
    matchedKeywords,
  } satisfies HybridRetrievalEvidence;
}

function buildFolderKeywords(
  dimensionName: AnnotationDimensionName,
  calculatedState: CalculatedStateValue,
) {
  const keywords: string[] = [];

  pushUniqueString(keywords, calculatedState.dayMaster);
  pushUniqueString(keywords, calculatedState.dayMasterStrengthProfile?.strengthState);
  pushUniqueString(keywords, calculatedState.dayMasterStrengthProfile?.qiLabel);
  pushUniqueString(keywords, calculatedState.baseChartReading?.readingOrderSteps[0]);

  for (const pillar of Object.values(calculatedState.fourPillars)) {
    pushUniqueString(keywords, pillar.stem);
    pushUniqueString(keywords, pillar.branch);
  }

  for (const stage of Object.values(calculatedState.twelveQi)) {
    pushUniqueString(keywords, stage);
  }

  for (const element of calculatedState.elementAnalysis.dominantElements) {
    pushUniqueString(keywords, element);
  }

  if (dimensionName === "chart_foundation") {
    pushUniqueString(keywords, "ดิถี");
    pushUniqueString(keywords, "ความแข็ง");
    pushUniqueString(keywords, "Step");
  }

  if (dimensionName === "balance_element") {
    pushUniqueString(keywords, "ธาตุ");
    pushUniqueString(keywords, "ปฏิกิริยา");
    pushUniqueString(keywords, "ย่งซิ้ง");
  }

  if (dimensionName === "annual_star_energy") {
    pushUniqueString(keywords, "ปีจร");
    pushUniqueString(keywords, "สี่ซิ้ง");
  }

  if (dimensionName === "red_flags") {
    pushUniqueString(keywords, "ชง");
    pushUniqueString(keywords, "ไห่");
    pushUniqueString(keywords, "ผั่ว");
    pushUniqueString(keywords, "เจ๊าะ");
  }

  if (dimensionName === "actionable_advice") {
    pushUniqueString(keywords, "ทำบุญ");
    pushUniqueString(keywords, "การเสริมดวง");
  }

  if (dimensionName === "core_prediction") {
    pushUniqueString(keywords, "สรุป");
    pushUniqueString(keywords, "ภาพรวม");
  }

  return keywords;
}

export function resolveAllDistilledRoot(repoRoot = process.cwd()) {
  return path.resolve(repoRoot, "../..", ...ALL_DISTILLED_SEGMENTS);
}

// repo-local mirror สำหรับ source ที่แตกจาก docx ใน repo (เช่น 12 เชี่ยงแซ)
// ใช้เมื่อ external distilled corpus ไม่อยู่บนเครื่องนี้ → hybrid-retrieval ยังทำงานได้
const DISTILLED_MIRROR_SEGMENTS = ["knownlage", "distilled"] as const;

export function resolveDistilledMirrorFile(relativePath: string, repoRoot = process.cwd()) {
  return path.join(repoRoot, ...DISTILLED_MIRROR_SEGMENTS, relativePath);
}

export function resolveAllDistilledFile(relativePath: string, repoRoot = process.cwd()) {
  const externalPath = path.join(resolveAllDistilledRoot(repoRoot), relativePath);
  if (existsSync(externalPath)) {
    return externalPath;
  }
  // fallback: ใช้ md ที่แตกไว้ใน repo ถ้า external corpus ไม่มีไฟล์นี้
  const mirrorPath = resolveDistilledMirrorFile(relativePath, repoRoot);
  if (existsSync(mirrorPath)) {
    return mirrorPath;
  }
  // final fallback: repo-local mirror ที่ process.cwd() — มิเรอร์เดินทางมากับโค้ด
  // ไม่ผูกกับ repoRoot ที่ผู้เรียกส่งเข้ามา (เช่นเทสต์ที่ส่ง repoRoot ปลอมชี้ external corpus ที่หาย)
  const cwdMirrorPath = resolveDistilledMirrorFile(relativePath, process.cwd());
  if (cwdMirrorPath !== mirrorPath && existsSync(cwdMirrorPath)) {
    return cwdMirrorPath;
  }
  // คงพฤติกรรมเดิม: คืน external path เพื่อให้ error message ชี้ corpus ต้นทาง
  return externalPath;
}

async function retrieveDictionaryEvidencePacket(
  dimensionName: AnnotationDimensionName,
  calculatedState: CalculatedStateValue,
  repoRoot: string,
): Promise<HybridRetrievalPacket> {
  const registryEntry = getHybridRetrievalRegistryEntry(dimensionName);
  const dictionarySpec = getHybridDictionarySpec(dimensionName);

  if (!dictionarySpec) {
    throw new Error(`No hybrid dictionary spec registered for ${dimensionName}`);
  }

  const keywords = dictionarySpec.buildKeywords(calculatedState);
  const evidence = await Promise.all(
    dictionarySpec.sourceRelativePaths.map((relativePath) =>
      readEvidenceSource(relativePath, keywords, repoRoot)
    ),
  );

  return {
    dimensionName,
    tier: registryEntry.tier,
    strategy: registryEntry.strategy,
    coverage: registryEntry.coverage,
    fallbackRequired: registryEntry.fallbackRequired,
    evidence,
    notes: dictionarySpec.buildNotes?.(calculatedState) ?? [],
  };
}

async function retrieveFolderEvidencePacket(
  dimensionName: AnnotationDimensionName,
  calculatedState: CalculatedStateValue,
  repoRoot: string,
): Promise<HybridRetrievalPacket> {
  const registryEntry = getHybridRetrievalRegistryEntry(dimensionName);
  const keywords = buildFolderKeywords(dimensionName, calculatedState);
  const evidence = await Promise.all(
    registryEntry.sourceRelativePaths.map((relativePath) =>
      readEvidenceSource(relativePath, keywords, repoRoot)
    ),
  );

  return {
    dimensionName,
    tier: registryEntry.tier,
    strategy: registryEntry.strategy,
    coverage: registryEntry.coverage,
    fallbackRequired: registryEntry.fallbackRequired,
    evidence,
    notes: [
      "Direct-folder retrieval is support evidence only and must not override engine truth.",
      "These sources remain intentionally unnormalized in Phase 2.",
    ],
  };
}

function createFallbackPacket(
  dimensionName: AnnotationDimensionName,
): HybridRetrievalPacket {
  const registryEntry = getHybridRetrievalRegistryEntry(dimensionName);

  return {
    dimensionName,
    tier: registryEntry.tier,
    strategy: registryEntry.strategy,
    coverage: registryEntry.coverage,
    fallbackRequired: registryEntry.fallbackRequired,
    evidence: [],
    notes: [
      "No canonical direct retrieval packet is registered for this dimension in Phase 2.",
      "Defer to constrained AI fallback in Phase 3.",
    ],
  };
}

export async function retrieveHybridEvidencePacket(
  dimensionName: AnnotationDimensionName,
  calculatedState: CalculatedStateValue,
  repoRoot = process.cwd(),
): Promise<HybridRetrievalPacket> {
  const registryEntry = getHybridRetrievalRegistryEntry(dimensionName);

  if (registryEntry.tier === "TierA") {
    return retrieveDictionaryEvidencePacket(dimensionName, calculatedState, repoRoot);
  }

  if (registryEntry.tier === "TierB") {
    return retrieveFolderEvidencePacket(dimensionName, calculatedState, repoRoot);
  }

  return createFallbackPacket(dimensionName);
}

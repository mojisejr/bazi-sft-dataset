import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseCsv } from "csv-parse/sync";

import {
  CompiledKnowledgeArtifactSchema,
  type CompiledKnowledgeArtifact,
  type CompiledKnowledgeDocument,
  type TopicSourceReference,
} from "@/lib/bazi/knowledge/topic-types";
import { BAZI_TOPIC_REGISTRY } from "@/lib/bazi/knowledge/topic-registry";

const WORKSPACE_DISTILLED_SEGMENTS = [
  ".tmp",
  "p-pol",
  "Mootech AI",
  "all_distilled",
] as const;

const OUTPUT_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "bazi",
  "knowledge",
  "compiled-knowledge.json",
);

const SOURCE_LABEL_ALIASES = new Map<string, string>([
  ["คุ่สมพงษ์(การงาน)", "คู่สมพงษ์(การงาน)"],
]);

type CorpusFileRecord = {
  absolutePath: string;
  relativePath: string;
  relativeDir: string;
  fileName: string;
  fileBaseName: string;
  sourceFormat: "markdown" | "csv";
};

function resolveRepoRoot(repoRoot = process.cwd()) {
  return repoRoot;
}

export function resolveDistilledCorpusRoot(repoRoot = process.cwd()) {
  return path.resolve(resolveRepoRoot(repoRoot), "..", "..", ...WORKSPACE_DISTILLED_SEGMENTS);
}

export function resolveCompiledKnowledgeOutputPath(repoRoot = process.cwd()) {
  return path.resolve(resolveRepoRoot(repoRoot), OUTPUT_RELATIVE_PATH);
}

function normalizeLookupKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFC")
    .replace(/\.[a-z0-9.]+$/iu, "")
    .replace(/[\s_.(),\-\/]+/gu, "")
    .trim();
}

function listFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    if (entry === ".DS_Store") {
      continue;
    }

    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
      continue;
    }

    if (/\.(md|csv)$/iu.test(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function buildCorpusIndex(corpusRoot: string): CorpusFileRecord[] {
  return listFiles(corpusRoot).map((absolutePath) => {
    const relativePath = path.relative(corpusRoot, absolutePath).replace(/\\/g, "/");
    const fileName = path.basename(absolutePath);
    const fileBaseName = fileName.replace(/\.[^.]+$/u, "");

    return {
      absolutePath,
      relativePath,
      relativeDir: path.dirname(relativePath).replace(/\\/g, "/"),
      fileName,
      fileBaseName,
      sourceFormat: relativePath.toLowerCase().endsWith(".csv") ? "csv" : "markdown",
    };
  });
}

function uniqueByPath(records: CorpusFileRecord[]) {
  return Array.from(new Map(records.map((record) => [record.absolutePath, record])).values());
}

function resolveDirectoryBundle(label: string, index: CorpusFileRecord[]) {
  const targetKey = normalizeLookupKey(label);
  const matches = index.filter((record) => {
    const relativeDirKey = normalizeLookupKey(record.relativeDir);
    const baseDirKey = normalizeLookupKey(path.basename(record.relativeDir));

    return relativeDirKey === targetKey || baseDirKey === targetKey;
  });

  return uniqueByPath(matches);
}

function resolveFileMatches(label: string, preferredDirectoryLabel: string, index: CorpusFileRecord[]) {
  const normalizedLabel = normalizeLookupKey(SOURCE_LABEL_ALIASES.get(label) ?? label);
  const normalizedPreferredDir = normalizeLookupKey(preferredDirectoryLabel);

  const preferredMatches = index.filter((record) => {
    const baseKey = normalizeLookupKey(record.fileBaseName);
    const relativeKey = normalizeLookupKey(record.relativePath);
    const relativeDirKey = normalizeLookupKey(record.relativeDir);

    return relativeDirKey.includes(normalizedPreferredDir)
      && (baseKey === normalizedLabel || relativeKey.includes(normalizedLabel));
  });

  if (preferredMatches.length > 0) {
    return uniqueByPath(preferredMatches);
  }

  const broadMatches = index.filter((record) => {
    const baseKey = normalizeLookupKey(record.fileBaseName);
    const relativeKey = normalizeLookupKey(record.relativePath);

    return baseKey === normalizedLabel || relativeKey.includes(normalizedLabel);
  });

  return uniqueByPath(broadMatches);
}

function stripMarkdown(content: string) {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/u, "")
    .replace(/^#{1,6}\s*/gmu, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, "$1")
    .replace(/^>\s*/gmu, "")
    .replace(/`{1,3}/gu, "")
    .replace(/\|/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeCsvContent(content: string) {
  const rows = parseCsv(content, {
    relaxColumnCount: true,
    skipEmptyLines: true,
  }) as string[][];

  return rows
    .map((row) => row.map((cell) => cell.trim()).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function compileDocument(label: string, file: CorpusFileRecord): CompiledKnowledgeDocument {
  const rawContent = readFileSync(file.absolutePath, "utf8");
  const normalizedContent = file.sourceFormat === "csv"
    ? normalizeCsvContent(rawContent)
    : stripMarkdown(rawContent);

  return {
    requestedLabel: label,
    matchedPath: file.absolutePath,
    relativePath: file.relativePath,
    sourceFormat: file.sourceFormat,
    title: file.fileBaseName,
    contentHash: createHash("sha256").update(rawContent).digest("hex"),
    lineCount: rawContent.split(/\r?\n/u).length,
    rawContent,
    normalizedContent,
  };
}

function compileSourceReference(sourceRef: TopicSourceReference, index: CorpusFileRecord[]) {
  const labels = [sourceRef.primarySource, ...sourceRef.supportingSources];
  const resolvedDocuments = labels.flatMap((label) => {
    const directoryBundleMatches = resolveDirectoryBundle(label, index);

    if (directoryBundleMatches.length > 0) {
      return directoryBundleMatches.map((file) => compileDocument(label, file));
    }

    const fileMatches = resolveFileMatches(label, sourceRef.directoryLabel, index);

    if (fileMatches.length === 0) {
      throw new Error(`Unable to resolve source label \"${label}\" for directory \"${sourceRef.directoryLabel}\".`);
    }

    return fileMatches.map((file) => compileDocument(label, file));
  });

  const uniqueDocuments = Array.from(
    new Map(resolvedDocuments.map((document) => [document.matchedPath, document])).values(),
  );

  return {
    directoryLabel: sourceRef.directoryLabel,
    primarySource: sourceRef.primarySource,
    supportingSources: sourceRef.supportingSources,
    reasoningFocus: sourceRef.reasoningFocus,
    sourceRoot: sourceRef.sourceRoot,
    documents: uniqueDocuments,
    combinedNormalizedContent: uniqueDocuments
      .map((document) => `${document.title}\n${document.normalizedContent}`.trim())
      .join("\n\n")
      .trim(),
  };
}

export function buildCompiledKnowledgeArtifact(repoRoot = process.cwd()): CompiledKnowledgeArtifact {
  const corpusRoot = resolveDistilledCorpusRoot(repoRoot);

  if (!existsSync(corpusRoot)) {
    throw new Error(`Distilled corpus root not found: ${corpusRoot}`);
  }

  const corpusIndex = buildCorpusIndex(corpusRoot);

  const artifact = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    sourceRoot: ".tmp/p-pol/Mootech AI/all_distilled",
    topicCount: BAZI_TOPIC_REGISTRY.length,
    topics: BAZI_TOPIC_REGISTRY.map((topic) => ({
      id: topic.id,
      sequence: topic.sequence,
      thaiLabel: topic.thaiLabel,
      chunkGroup: topic.chunkGroup,
      annotationDimension: topic.annotationDimension,
      engineDependencies: topic.engineDependencies,
      sinsaeLogicRules: topic.sinsaeLogicRules,
      sourceBundles: topic.sourceRefs.map((sourceRef) => compileSourceReference(sourceRef, corpusIndex)),
    })),
  };

  return CompiledKnowledgeArtifactSchema.parse(artifact);
}

export function writeCompiledKnowledgeArtifact(repoRoot = process.cwd()) {
  const artifact = buildCompiledKnowledgeArtifact(repoRoot);
  const outputPath = resolveCompiledKnowledgeOutputPath(repoRoot);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  return outputPath;
}

function isMainModule() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

  return currentFilePath === executedPath;
}

if (isMainModule()) {
  const outputPath = writeCompiledKnowledgeArtifact(resolveRepoRoot());
  console.log(`Compiled knowledge written to ${outputPath}`);
}
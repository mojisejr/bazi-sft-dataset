import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { parse as parseCsv } from "csv-parse/sync";

import { buildGeneratedSolarTermRows } from "./solar-terms";
import {
  buildDayMasterStrengthSource2Metadata,
  buildSixtyJiaziSource2Metadata,
} from "./source2-knowledge-ownership";
import {
  DAY_MASTER_STRENGTH_KNOWLEDGE_BOUNDARY,
  resolveCanonicalDayMasterStrengthState,
} from "./strength-state-vocabulary";

const DISTILLED_CORPUS_SEGMENTS = [
  ".tmp",
  "p-pol",
  "Mootech AI",
  "all_distilled",
] as const;

const RAW_CORPUS_SEGMENTS = [".tmp", "p-pol", "Mootech AI"] as const;

type KnowledgeDomain =
  | "general"
  | "work"
  | "study"
  | "wealth"
  | "love"
  | "health"
  | "family"
  | "other"
  | "timing";
type MatrixDomain = "love" | "work";
type SourceRoot = "distilled" | "raw";
type SourceFormat = "csv" | "markdown" | "docx" | "xlsx";

type CanonicalSourceRecord = {
  relativePath: string;
  sourceRoot: SourceRoot;
  sourceFormat: SourceFormat;
  title: string;
  domain: KnowledgeDomain;
  normalizedTable: string | null;
  metadata: Record<string, unknown>;
};

type ReferenceDocumentRecord = {
  sourcePath: string;
  slug: string;
  title: string;
  domain: KnowledgeDomain;
  content: string;
  headings: string[];
  metadata: Record<string, unknown>;
};

type CanonicalRawRowRecord = {
  sourcePath: string;
  sourceGroup: string;
  rowOrder: number;
  primaryValue: string | null;
  secondaryValue: string | null;
  cells: string[];
  metadata: Record<string, unknown>;
};

type TimeSolarTermRecord = {
  sourcePath: string | null;
  label: string;
  solarTermName: string | null;
  boundaryAt: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

type FaqTaxonomyRecord = {
  sourcePath: string;
  rowGroup: number;
  questionOrder: number;
  rawTypeLabel: string;
  primaryIntent: KnowledgeDomain;
  intentDomains: string[];
  questionText: string;
  normalizedQuestion: string;
  metadata: Record<string, unknown>;
};

type ElementInteractionRecord = {
  sourcePath: string;
  sourceTable: string;
  dayMaster: string | null;
  leftSymbol: string;
  rightSymbol: string | null;
  relationType: string;
  qiLabel: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
};

type TwelveQiStageRecord = {
  sourcePath: string;
  stageOrder: number;
  stageNameChinese: string;
  stageNameThai: string;
  dayMaster: string;
  branch: string;
  metadata: Record<string, unknown>;
};

type DayMasterProfileRecord = {
  sourcePath: string;
  recordNumber: number | null;
  dayMasterCode: string;
  branchCode: string;
  dayMasterChinese: string | null;
  branchChinese: string | null;
  baselineOriginal: string | null;
  dayMasterTrait: string | null;
  mergedBaseline: string | null;
  interpretedProfile: string | null;
  conciseProfile: string | null;
  combinedNarrative: string | null;
  metadata: Record<string, unknown>;
};

type DayMasterStrengthStateRecord = {
  sourcePath: string;
  sourceVariant: string;
  dayMasterCode: string | null;
  dayMasterChinese: string | null;
  strengthState: string | null;
  scoreText: string | null;
  qiLabel: string | null;
  narrativeSummary: string | null;
  rowOrder: number;
  rawCells: string[];
  metadata: Record<string, unknown>;
};

type SixtyJiaziNarrativeRecord = {
  sourcePath: string;
  rowGroup: number;
  dayMasterCode: string;
  dayMasterChinese: string;
  branchCode: string;
  branchChinese: string;
  elementTone: string | null;
  twelveQiLabel: string | null;
  dayMasterNarrative: string | null;
  branchNarrative: string | null;
  combinedNarrative: string | null;
  rawCells: string[];
  metadata: Record<string, unknown>;
};

type DomainMatrixRecord = {
  sourcePath: string;
  domain: MatrixDomain;
  sourceVariant: string;
  pairKey: string | null;
  rowOrder: number;
  code: string | null;
  label: string | null;
  scoreText: string | null;
  narrative: string | null;
  rawCells: string[];
  metadata: Record<string, unknown>;
};

type MarkdownTable = {
  heading: string;
  headers: string[];
  rows: string[][];
};

export type BaziCanonicalKnowledgeDataset = {
  sources: CanonicalSourceRecord[];
  referenceDocuments: ReferenceDocumentRecord[];
  canonicalRawRows: CanonicalRawRowRecord[];
  timeSolarTerms: TimeSolarTermRecord[];
  faqTaxonomies: FaqTaxonomyRecord[];
  elementInteractions: ElementInteractionRecord[];
  twelveQiStages: TwelveQiStageRecord[];
  dayMasterProfiles: DayMasterProfileRecord[];
  dayMasterStrengthStates: DayMasterStrengthStateRecord[];
  sixtyJiaziNarratives: SixtyJiaziNarrativeRecord[];
  domainMatrices: DomainMatrixRecord[];
  warnings: string[];
};

function toRelativeWorkspacePath(fullPath: string, workspaceRoot: string) {
  return path.relative(workspaceRoot, fullPath).replace(/\\/g, "/");
}

function listFiles(root: string, predicate: (entry: string) => boolean): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath, predicate));
      continue;
    }

    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function resolveCorpusRoot(repoRoot = process.cwd()) {
  return path.resolve(repoRoot, "../..", ...DISTILLED_CORPUS_SEGMENTS);
}

function resolveRawCorpusRoot(repoRoot = process.cwd()) {
  return path.resolve(repoRoot, "../..", ...RAW_CORPUS_SEGMENTS);
}

function detectDomain(relativePath: string): KnowledgeDomain {
  const lowered = relativePath.toLowerCase();

  if (lowered.includes("faq")) {
    return "other";
  }

  if (relativePath.includes("การงาน") || relativePath.includes("work")) {
    return "work";
  }

  if (relativePath.includes("ความรัก") || relativePath.includes("love")) {
    return "love";
  }

  if (relativePath.includes("การเงิน") || relativePath.includes("wealth")) {
    return "wealth";
  }

  if (relativePath.includes("สุขภาพ") || relativePath.includes("health")) {
    return "health";
  }

  if (relativePath.includes("ศึกษา") || relativePath.includes("study")) {
    return "study";
  }

  return "general";
}

function detectFormat(fullPath: string): SourceFormat {
  const extension = path.extname(fullPath).toLowerCase();

  if (extension === ".csv") {
    return "csv";
  }

  if (extension === ".md") {
    return "markdown";
  }

  if (extension === ".docx") {
    return "docx";
  }

  return "xlsx";
}

function titleFromPath(fullPath: string) {
  return path.basename(fullPath, path.extname(fullPath));
}

function stableSlug(prefix: string, relativePath: string) {
  const hash = createHash("sha1").update(relativePath).digest("hex").slice(0, 8);
  const base = titleFromPath(relativePath)
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return `${prefix}-${base || "source"}-${hash}`;
}

function cleanCell(cell: unknown) {
  if (typeof cell !== "string") {
    return "";
  }

  return cell.replace(/\r/g, "").trim();
}

function parseCsvRows(filePath: string) {
  const content = readFileSync(filePath, "utf8");

  return parseCsv(content, {
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: false,
  }).map((row: unknown) =>
    Array.isArray(row) ? row.map((cell) => cleanCell(cell)) : [],
  ) as string[][];
}

function firstMeaningfulCell(cells: string[]) {
  return cells.find((cell) => cell.length > 0) ?? null;
}

function secondMeaningfulCell(cells: string[]) {
  const meaningful = cells.filter((cell) => cell.length > 0);
  return meaningful[1] ?? null;
}

function findNarrativeCell(cells: string[]) {
  return (
    cells.find(
      (cell) =>
        cell.length > 24 &&
        !cell.startsWith("UPDATE ") &&
        !/^[-\d.]+$/.test(cell) &&
        !/^[A-Z]\d+$/.test(cell),
    ) ?? null
  );
}

function parseMarkdownTables(content: string) {
  const lines = content.split("\n");
  const fallbackTables: MarkdownTable[] = [];
  let fallbackHeading = "Document";
  let currentRow: string[] = [];
  let currentRows: string[][] = [];

  const flushCurrentRow = () => {
    if (currentRow.length > 0) {
      currentRows.push(currentRow.map((cell) => cell.replace(/\\-/g, "-")));
      currentRow = [];
    }
  };

  const flushCurrentTable = () => {
    flushCurrentRow();

    if (currentRows.length >= 2) {
      fallbackTables.push({
        heading: fallbackHeading,
        headers: currentRows[0],
        rows: currentRows.slice(1),
      });
    }

    currentRows = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^#+\s+/.test(line)) {
      flushCurrentTable();
      fallbackHeading = line.replace(/^#+\s+/, "").trim();
      continue;
    }

    if (line.startsWith("| ---")) {
      flushCurrentRow();
      continue;
    }

    if (line === "" || line === "|" || line === "| " || line === "|") {
      continue;
    }

    if (line.startsWith("|")) {
      continue;
    }

    currentRow.push(line);
  }

  flushCurrentTable();

  return fallbackTables;
}

function extractHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#+\s+/.test(line))
    .map((line) => line.replace(/^#+\s+/, "").trim());
}

function normalizeIntentLabel(rawLabel: string) {
  const lowered = rawLabel.toLowerCase();

  if (lowered.includes("work")) {
    return "work";
  }

  if (lowered.includes("study")) {
    return "study";
  }

  if (lowered.includes("love")) {
    return "love";
  }

  if (lowered.includes("wealth")) {
    return "wealth";
  }

  if (lowered.includes("health")) {
    return "health";
  }

  if (lowered.includes("time")) {
    return "timing";
  }

  if (lowered.includes("other")) {
    return "other";
  }

  return "general";
}

function normalizeIntentDomains(rawLabel: string) {
  return rawLabel
    .split(",")
    .map((token) => cleanCell(token.replace(/"/g, "")))
    .filter(Boolean)
    .map(normalizeIntentLabel);
}

function extractFilenameDayMaster(filePath: string) {
  const match = filePath.match(/_([^_]+)_([^/.]+)\.csv$/u);

  if (!match) {
    return {
      chinese: null,
      code: null,
    };
  }

  return {
    chinese: match[1]?.trim() || null,
    code: match[2]?.trim() || null,
  };
}

function buildCanonicalSources(
  workspaceRoot: string,
  distilledRoot: string,
  rawRoot: string,
): CanonicalSourceRecord[] {
  const distilledFiles = listFiles(distilledRoot, (entry) => /\.(csv|md)$/i.test(entry));
  const rawFiles = listFiles(rawRoot, (entry) => /\.(docx|xlsx|xls)$/i.test(entry));

  return [
    ...distilledFiles.map((fullPath) => {
      const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);

      return {
        relativePath,
        sourceRoot: "distilled" as const,
        sourceFormat: detectFormat(fullPath),
        title: titleFromPath(fullPath),
        domain: detectDomain(relativePath),
        normalizedTable: null,
        metadata: {
          sourceKind: "normalized",
        },
      };
    }),
    ...rawFiles.map((fullPath) => {
      const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);

      return {
        relativePath,
        sourceRoot: "raw" as const,
        sourceFormat: detectFormat(fullPath),
        title: titleFromPath(fullPath),
        domain: detectDomain(relativePath),
        normalizedTable: null,
        metadata: {
          sourceKind: "raw",
        },
      };
    }),
  ];
}

function buildReferenceDocuments(
  workspaceRoot: string,
  distilledRoot: string,
): ReferenceDocumentRecord[] {
  const markdownFiles = listFiles(distilledRoot, (entry) => entry.endsWith(".md"));

  return markdownFiles.map((fullPath) => {
    const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
    const content = readFileSync(fullPath, "utf8");

    return {
      sourcePath: relativePath,
      slug: stableSlug("doc", relativePath),
      title: titleFromPath(fullPath),
      domain: detectDomain(relativePath),
      content,
      headings: extractHeadings(content),
      metadata: {
        normalizedFrom: path.extname(fullPath).slice(1),
      },
    };
  });
}

function buildCanonicalRawRows(
  workspaceRoot: string,
  distilledRoot: string,
): CanonicalRawRowRecord[] {
  const csvFiles = listFiles(distilledRoot, (entry) => entry.endsWith(".csv"));

  return csvFiles.flatMap((fullPath) => {
    const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
    const rows = parseCsvRows(fullPath);
    const sourceGroup = path.basename(path.dirname(fullPath));

    return rows
      .map((cells, rowIndex) => ({ cells, rowIndex }))
      .filter(({ cells }) => cells.some((cell) => cell.length > 0))
      .map(({ cells, rowIndex }) => ({
        sourcePath: relativePath,
        sourceGroup,
        rowOrder: rowIndex + 1,
        primaryValue: firstMeaningfulCell(cells),
        secondaryValue: secondMeaningfulCell(cells),
        cells,
        metadata: {
          columnCount: cells.length,
        },
      }));
  });
}

function buildFaqTaxonomies(
  workspaceRoot: string,
  distilledRoot: string,
): FaqTaxonomyRecord[] {
  const faqPath = path.join(distilledRoot, "FAQ by Mootech AI", "FAQ by Mootech AI - Sheet1.csv");
  const relativePath = toRelativeWorkspacePath(faqPath, workspaceRoot);
  const rows = parseCsvRows(faqPath);

  return rows.slice(1).flatMap((row, rowIndex) => {
    const rawTypeLabel = row[0] ?? "General";
    const intents = normalizeIntentDomains(rawTypeLabel);
    const questionCells = row.slice(1).filter((cell) => cell.length > 0);

    return questionCells.map((questionText, questionIndex) => ({
      sourcePath: relativePath,
      rowGroup: rowIndex + 2,
      questionOrder: questionIndex + 1,
      rawTypeLabel,
      primaryIntent: (intents[0] ?? "general") as KnowledgeDomain,
      intentDomains: intents,
      questionText,
      normalizedQuestion: questionText.replace(/\s+/g, " ").trim(),
      metadata: {
        multiIntent: intents.length > 1,
      },
    }));
  });
}

function buildElementInteractions(
  workspaceRoot: string,
  distilledRoot: string,
): ElementInteractionRecord[] {
  const sourceFiles = [
    path.join(distilledRoot, "ตารางปฏิกิริยาธาตุ", "ตารางปฏิกิริยาธาตุ.md"),
    path.join(distilledRoot, "ตารางชงเฮ้งไห่ผั่ว", "ตารางชงเฮ้งไห่ผั่ว.md"),
  ];

  return sourceFiles.flatMap((fullPath) => {
    const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
    const content = readFileSync(fullPath, "utf8");
    const tables = parseMarkdownTables(content);

    return tables.flatMap((table) =>
      table.rows
        .filter((row) => row.some((cell) => cell.length > 0))
        .map((row) => {
          const headers = table.headers.map((header) => header.replace(/\s+/g, " ").trim());

          if (headers[0] === "ดิถี") {
            return {
              sourcePath: relativePath,
              sourceTable: table.heading,
              dayMaster: row[0] || null,
              leftSymbol: row[1] || row[2] || row[0],
              rightSymbol: row[2] || row[1] || null,
              relationType: row[3] || "unknown",
              qiLabel: row[4] || null,
              note: row[5] || null,
              metadata: {
                tableKind: "element-reaction",
              },
            };
          }

          return {
            sourcePath: relativePath,
            sourceTable: table.heading,
            dayMaster: null,
            leftSymbol: row[0] || "unknown",
            rightSymbol: row[1] || null,
            relationType: row[2] || "unknown",
            qiLabel: row[3] || null,
            note: row[4] || null,
            metadata: {
              tableKind: "conflict-reaction",
            },
          };
        }),
    );
  });
}

function buildTwelveQiStages(
  workspaceRoot: string,
  distilledRoot: string,
): TwelveQiStageRecord[] {
  const fullPath = path.join(distilledRoot, "ตาราง 12 เชี่ยงแซ", "ตาราง 12 เชี่ยงแซ.md");
  const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
  const content = readFileSync(fullPath, "utf8");
  const table = parseMarkdownTables(content)[0];
  const dayMasters = table.headers.slice(2);

  return table.rows.flatMap((row, rowIndex) => {
    const stageNameChinese = row[0] || "";
    const stageNameThai = row[1] || "";

    return dayMasters.map((dayMaster, dayMasterIndex) => ({
      sourcePath: relativePath,
      stageOrder: rowIndex + 1,
      stageNameChinese,
      stageNameThai,
      dayMaster,
      branch: row[dayMasterIndex + 2] || "",
      metadata: {},
    }));
  });
}

function buildDayMasterProfiles(
  workspaceRoot: string,
  distilledRoot: string,
): DayMasterProfileRecord[] {
  const fullPath = path.join(
    distilledRoot,
    "ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร",
    "ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร - ข้อมูลช่องนิสัย.csv",
  );
  const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
  const rows = parseCsvRows(fullPath);

  return rows.slice(1).flatMap((row) => {
    if (!row[1] || !row[2]) {
      return [];
    }

    return [
      {
        sourcePath: relativePath,
        recordNumber: Number.isFinite(Number(row[0])) ? Number(row[0]) : null,
        dayMasterCode: row[1],
        branchCode: row[2],
        dayMasterChinese: row[3] || null,
        branchChinese: row[4] || null,
        baselineOriginal: row[5] || null,
        dayMasterTrait: row[6] || null,
        mergedBaseline: row[7] || null,
        interpretedProfile: row[8] || null,
        conciseProfile: row[9] || null,
        combinedNarrative: row[10] || null,
        metadata: {},
      },
    ];
  });
}

function buildDayMasterStrengthStates(
  workspaceRoot: string,
  distilledRoot: string,
): DayMasterStrengthStateRecord[] {
  const root = path.join(distilledRoot, "ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร");
  const files = listFiles(root, (entry) => entry.endsWith(".csv") && !entry.endsWith("ข้อมูลช่องนิสัย.csv"));

  return files.flatMap((fullPath) => {
    const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
    const { code, chinese } = extractFilenameDayMaster(fullPath);
    const sourceVariant = titleFromPath(fullPath);
    const rows = parseCsvRows(fullPath);

    return rows
      .map((rawCells, rowIndex) => ({ rawCells, rowIndex }))
      .filter(({ rawCells }) => rawCells.some((cell) => cell.length > 0))
      .map(({ rawCells, rowIndex }) => {
        const strengthState = rawCells[0] || null;
        const scoreText = rawCells.find((cell) => /^\d+(\.\d+)?$/.test(cell)) ?? null;
        const narrativeSummary = findNarrativeCell(rawCells);
        const resolvedStrength = resolveCanonicalDayMasterStrengthState(strengthState ?? scoreText);

        return {
          sourcePath: relativePath,
          sourceVariant,
          dayMasterCode: code,
          dayMasterChinese: chinese,
          strengthState,
          scoreText,
          qiLabel: rawCells.find((cell) => /เชี่ยงแซ|หมกยก|ลิ่มกัว|ตี้อ๋วง|ซวย|แป่|ซี่|หมอ|เจ๊าะ|ทอ|เอี้ยง|กวงตั่ว/u.test(cell)) ?? null,
          narrativeSummary,
          rowOrder: rowIndex + 1,
          rawCells,
          metadata: {
            folder: path.basename(path.dirname(fullPath)),
            knowledgeBoundary: DAY_MASTER_STRENGTH_KNOWLEDGE_BOUNDARY,
            repositoryLookupState: resolvedStrength?.repositoryLookupState ?? null,
            bandCoverage: resolvedStrength?.bandCoverage ?? [],
            semanticCoverage: resolvedStrength?.semanticCoverage ?? [],
            source2Knowledge: buildDayMasterStrengthSource2Metadata({
              sourcePath: relativePath,
              rowOrder: rowIndex + 1,
              narrativeSummary,
            }),
          },
        };
      });
  });
}

function buildSixtyJiaziNarratives(
  workspaceRoot: string,
  distilledRoot: string,
): SixtyJiaziNarrativeRecord[] {
  const fullPath = path.join(
    distilledRoot,
    "ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ",
    "ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ - นิสัยราศีบน,ล่าง,เซี่ยงแซ.csv",
  );
  const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
  const rows = parseCsvRows(fullPath).filter((row) => row[0]?.length > 0);
  const payloadRows = rows.slice(1);
  const records: SixtyJiaziNarrativeRecord[] = [];

  for (let index = 0; index + 2 < payloadRows.length; index += 3) {
    const dayMasterRow = payloadRows[index];
    const branchRow = payloadRows[index + 1];
    const combinedRow = payloadRows[index + 2];
    const rowGroup = records.length + 1;
    const combinedNarrative = combinedRow[3] || null;

    if (!dayMasterRow?.[0] || !branchRow?.[0]) {
      continue;
    }

    records.push({
      sourcePath: relativePath,
      rowGroup,
      dayMasterCode: dayMasterRow[0],
      dayMasterChinese: dayMasterRow[1] || dayMasterRow[0],
      branchCode: branchRow[0],
      branchChinese: branchRow[1] || branchRow[0],
      elementTone: combinedRow[0] || null,
      twelveQiLabel: combinedRow[1] || null,
      dayMasterNarrative: dayMasterRow[3] || null,
      branchNarrative: branchRow[3] || null,
      combinedNarrative,
      rawCells: [...dayMasterRow, ...branchRow, ...combinedRow],
      metadata: {
        source2Knowledge: buildSixtyJiaziSource2Metadata({
          sourcePath: relativePath,
          rowGroup,
          combinedNarrative,
        }),
      },
    });
  }

  return records;
}

function buildDomainMatrices(
  workspaceRoot: string,
  distilledRoot: string,
): DomainMatrixRecord[] {
  const directories: Array<{ name: string; domain: MatrixDomain }> = [
    { name: "คู่สมพงษ์(ความรัก)", domain: "love" },
    { name: "คู่สมพงษ์(การงาน)", domain: "work" },
  ];

  return directories.flatMap(({ name, domain }) => {
    const folder = path.join(distilledRoot, name);
    const files = listFiles(folder, (entry) => entry.endsWith(".csv"));

    return files.flatMap((fullPath) => {
      const relativePath = toRelativeWorkspacePath(fullPath, workspaceRoot);
      const rows = parseCsvRows(fullPath);
      const sourceVariant = titleFromPath(fullPath);
      const pairKey = sourceVariant.split(" - ")[1] ?? sourceVariant;

      return rows
        .map((rawCells, rowIndex) => ({ rawCells, rowIndex }))
        .filter(({ rawCells }) => rawCells.some((cell) => cell.length > 0))
        .map(({ rawCells, rowIndex }) => ({
          sourcePath: relativePath,
          domain,
          sourceVariant,
          pairKey,
          rowOrder: rowIndex + 1,
          code: firstMeaningfulCell(rawCells),
          label: secondMeaningfulCell(rawCells),
          scoreText: rawCells.find((cell) => /^\d+(\.\d+)?$/.test(cell)) ?? null,
          narrative: findNarrativeCell(rawCells),
          rawCells,
          metadata: {
            folder: name,
          },
        }));
    });
  });
}

export function buildCanonicalKnowledgeDataset(repoRoot = process.cwd()): BaziCanonicalKnowledgeDataset {
  const workspaceRoot = path.resolve(repoRoot, "../..");
  const distilledRoot = resolveCorpusRoot(repoRoot);
  const rawRoot = resolveRawCorpusRoot(repoRoot);

  if (!existsSync(distilledRoot)) {
    throw new Error(`Distilled Bazi corpus not found at ${distilledRoot}`);
  }

  const warnings: string[] = [];
  let timeSolarTerms: TimeSolarTermRecord[] = [];

  try {
    timeSolarTerms = buildGeneratedSolarTermRows();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`time-solar-term-generation-failed:${message}`);
  }

  return {
    sources: buildCanonicalSources(workspaceRoot, distilledRoot, rawRoot),
    referenceDocuments: buildReferenceDocuments(workspaceRoot, distilledRoot),
    canonicalRawRows: buildCanonicalRawRows(workspaceRoot, distilledRoot),
    timeSolarTerms,
    faqTaxonomies: buildFaqTaxonomies(workspaceRoot, distilledRoot),
    elementInteractions: buildElementInteractions(workspaceRoot, distilledRoot),
    twelveQiStages: buildTwelveQiStages(workspaceRoot, distilledRoot),
    dayMasterProfiles: buildDayMasterProfiles(workspaceRoot, distilledRoot),
    dayMasterStrengthStates: buildDayMasterStrengthStates(workspaceRoot, distilledRoot),
    sixtyJiaziNarratives: buildSixtyJiaziNarratives(workspaceRoot, distilledRoot),
    domainMatrices: buildDomainMatrices(workspaceRoot, distilledRoot),
    warnings,
  };
}
import path from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { ANNOTATION_DIMENSION_META } from "@/lib/bazi/annotation-dimension-meta";
import {
  getElementRootLabel,
  getElementSeasonalSupportLabel,
  getElementStrengthLabel,
  localizeContextRuleNotes,
} from "@/lib/bazi/context-dictionary";
import {
  addAnnotationDimensionIssues,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type CalculatedStateValue,
  type DraftAnnotationDataValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";
import { ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

const DEFAULT_MODEL = "gemini-3-flash-preview";
const MAX_REFERENCE_EXCERPT_CHARS = 1_100;
const MAX_GENERATION_ATTEMPTS = 6;
const INITIAL_RETRY_DELAY_MS = 1_500;

export const DEFAULT_REFERENCE_CASE_PATHS = [
  path.resolve(
    "/Users/non/dev/opilot/.tmp/p-pol/Mootech AI/extracted_pdf/case1.md",
  ),
  path.resolve(
    "/Users/non/dev/opilot/.tmp/p-pol/Mootech AI/extracted_pdf/case2.md",
  ),
  path.resolve(
    "/Users/non/dev/opilot/.tmp/p-pol/Mootech AI/extracted_pdf/case3.md",
  ),
] as const;

const GeneratedDraftDimensionSchema = z.object({
  dimension_name: z.enum(REQUIRED_ANNOTATION_DIMENSION_NAMES),
  thought_process: z.string().trim().min(1),
  final_prediction: z.string().trim().min(1),
  supporting_signals: z.array(z.string().trim().min(1)).default([]),
  confidence_note: z.string().trim().min(1).optional(),
});

export const GeneratedDraftAnnotationDataSchema = z
  .object({
    version: z.literal("1.6"),
    dimensions: z.array(GeneratedDraftDimensionSchema)
      .min(1)
      .max(REQUIRED_ANNOTATION_DIMENSION_NAMES.length),
    reviewSummary: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    addAnnotationDimensionIssues(value, context);
  });

type ReferenceCaseExample = {
  filePath: string;
  excerpt: string;
};

type LooseRecord = Record<string, unknown>;

const DIMENSION_NAME_ALIAS_MAP = new Map<string, (typeof REQUIRED_ANNOTATION_DIMENSION_NAMES)[number]>(
  ANNOTATION_DIMENSION_META.flatMap((dimension) => [
    [dimension.dimensionName, dimension.dimensionName],
    [dimension.dimensionName.replace(/_/g, " "), dimension.dimensionName],
    [dimension.title, dimension.dimensionName],
  ]),
);

type GenerateGeminiDraftAnnotationOptions = {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  model?: string;
  referenceCasePaths?: readonly string[];
  useReferenceCases?: boolean;
  apiKey?: string;
};

type GenerateGeminiDraftAnnotationResult = {
  annotationData: DraftAnnotationDataValue;
  referenceCasePaths: string[];
  model: string;
};

const GENERATED_DRAFT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    version: {
      type: "string",
    },
    reviewSummary: {
      type: "string",
    },
    dimensions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension_name: {
            type: "string",
          },
          thought_process: {
            type: "string",
          },
          final_prediction: {
            type: "string",
          },
          supporting_signals: {
            type: "array",
            items: {
              type: "string",
            },
          },
          confidence_note: {
            type: "string",
          },
        },
        required: [
          "dimension_name",
          "thought_process",
          "final_prediction",
          "supporting_signals",
        ],
      },
    },
  },
  required: ["version", "reviewSummary", "dimensions"],
} as const;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function normalizeString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function normalizeSupportingSignals(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeString(entry))
      .filter((entry) => entry.length > 0);
  }

  const textValue = normalizeString(value);

  return textValue ? [textValue] : [];
}

function normalizeDimensionEntries(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  const record = getRecord(value);

  if (!record) {
    return [];
  }

  return Object.entries(record).map(([dimensionName, entry]) => {
    const nextRecord = getRecord(entry);

    return {
      dimension_name: dimensionName,
      ...(nextRecord ?? {}),
    };
  });
}

function normalizeDimensionName(value: unknown, index: number) {
  const rawValue = normalizeString(value);

  if (REQUIRED_ANNOTATION_DIMENSION_NAMES.includes(
    rawValue as (typeof REQUIRED_ANNOTATION_DIMENSION_NAMES)[number],
  )) {
    return rawValue as (typeof REQUIRED_ANNOTATION_DIMENSION_NAMES)[number];
  }

  const compactKey = rawValue.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  const aliased = DIMENSION_NAME_ALIAS_MAP.get(rawValue) ?? DIMENSION_NAME_ALIAS_MAP.get(compactKey);

  if (aliased) {
    return aliased;
  }

  return REQUIRED_ANNOTATION_DIMENSION_NAMES[index] ?? rawValue;
}

function normalizeGeneratedDraftPayload(value: unknown) {
  const record = getRecord(value);

  if (!record) {
    return value;
  }

  return {
    version: "1.6",
    reviewSummary:
      normalizeString(record.reviewSummary)
      || normalizeString(record.summary)
      || normalizeString(record.review_summary),
    dimensions: normalizeDimensionEntries(record.dimensions).map((entry, index) => {
      const dimensionRecord = getRecord(entry) ?? {};

      return {
        dimension_name: normalizeDimensionName(
          normalizeString(dimensionRecord.dimension_name)
            || normalizeString(dimensionRecord.dimensionName),
          index,
        ),
        thought_process:
          normalizeString(dimensionRecord.thought_process)
          || normalizeString(dimensionRecord.thoughtProcess)
          || normalizeString(dimensionRecord.reasoning),
        final_prediction:
          normalizeString(dimensionRecord.final_prediction)
          || normalizeString(dimensionRecord.finalPrediction)
          || normalizeString(dimensionRecord.prediction),
        supporting_signals:
          normalizeSupportingSignals(dimensionRecord.supporting_signals)
          || normalizeSupportingSignals(dimensionRecord.supportingSignals)
          || normalizeSupportingSignals(dimensionRecord.signals),
        confidence_note:
          normalizeString(dimensionRecord.confidence_note)
          || normalizeString(dimensionRecord.confidenceNote)
          || undefined,
      };
    }),
  };
}

function sanitizeReferenceMarkdown(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\r/g, "")
    .replace(/^---$/gm, "")
    .replace(/^ดวงจีน#case\d+$/gm, "")
    .replace(/^\d+ of \d+$/gim, "")
    .replace(/^หน้า\s+\d+$/gm, "")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^[-:| ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractReferenceCaseExcerpt(
  markdown: string,
  maxChars = MAX_REFERENCE_EXCERPT_CHARS,
) {
  const sanitized = sanitizeReferenceMarkdown(markdown);
  const stopMatch = sanitized.search(/\n(?:##|#)\s+สภาพธรรมชาติ/);
  const relevantSlice = stopMatch > 0 ? sanitized.slice(0, stopMatch) : sanitized;
  const normalized = relevantSlice
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxChars);
  const boundary = clipped.lastIndexOf("\n");

  return `${clipped.slice(0, boundary > 0 ? boundary : maxChars).trim()}\n...`;
}

function buildStableReferenceSelectorSeed(rawInput: RawInputValue) {
  const digest = createHash("sha256")
    .update(JSON.stringify(rawInput))
    .digest();

  return digest.readUInt32BE(0) % 2_147_483_647;
}

export function selectReferenceCaseExamplePaths(
  rawInput: RawInputValue,
  availablePaths: readonly string[] = DEFAULT_REFERENCE_CASE_PATHS,
) {
  if (availablePaths.length <= 2) {
    return [...availablePaths];
  }

  const seed = buildStableReferenceSelectorSeed(rawInput);
  const startIndex = seed % availablePaths.length;
  const orderedPaths = Array.from({ length: availablePaths.length }, (_, offset) => {
    const nextIndex = (startIndex + offset) % availablePaths.length;

    return availablePaths[nextIndex] ?? availablePaths[0] ?? "";
  }).filter((entry, index, array) => entry.length > 0 && array.indexOf(entry) === index);

  return orderedPaths.slice(0, 2);
}

async function loadReferenceCaseExamples(filePaths: readonly string[]) {
  const examples = await Promise.all(
    filePaths.map(async (filePath) => {
      const markdown = await readFile(filePath, "utf8");

      return {
        filePath,
        excerpt: extractReferenceCaseExcerpt(markdown),
      } satisfies ReferenceCaseExample;
    }),
  );

  return examples;
}

export function buildSystemInstruction() {
  return [
    "You are a senior Thai Bazi master from the Mumate (สำนักมูเมท) school creating professional draft annotations for a human sinsae review workflow.",
    "Write every field in Thai.",
    "Use only the provided raw_input and calculated_state summary. Reference cases, if present, are style hints only and must never override chart truth.",
    "Do not invent new chart facts, ages, or stars that are absent from calculated_state.",
    "Read the chart through the Mumate lens: elemental DNA, season, life timing, and psychologically precise Thai language.",
    "Treat the truth hierarchy as strict precedence: dayMasterStrengthProfile first, baseChartReading second, interactionSignals third, sixtyJiaziCorePersona fourth, elementAnalysis and seasonalInteraction after that.",
    "When dayMasterStrengthProfile is present, use it as the canonical summary of strength and balance. Do not re-derive the main strength story from counts alone.",
    "When baseChartReading is present, follow its readingOrderSteps and summary as the canonical reading sequence.",
    "When interactionSignals are present, treat them as the canonical source for clash, combination, harm, punishment, and resolved interaction logic.",
    "When elementAnalysis or seasonalInteraction are present, use them as the canonical source instead of re-inferring elemental balance from scratch.",
    "When ageSnapshot, currentDaYun, currentDaYunPhase, or liuNian are present, anchor present-life timing to those values instead of guessing the client's age or current cycle.",
    "When thaiContextSignals are present, use them as the human-readable Thai bridge for element strength, seasonal context, and rule notes.",
    "Do not reduce elemental balance to counts alone when structured strength labels, rooted state, or seasonal support are available.",
    "When precedenceNoteSignals or thaiContextSignals.contextRuleNotes are present, cite those rule notes as the canonical context order instead of inventing alternate interaction stories.",
    "The tone must feel like a private Mumate report: direct, concrete, compassionate, metaphor-rich, emotionally sharp, and never generic marketing copy.",
    "When seasonalInteraction, elementMetaphors, or dayMaster context are present, express the reading through vivid but disciplined metaphors such as the client's elemental material, pressure, climate, and hidden value.",
    "Every thought_process and final_prediction must be complete, specific, and non-empty.",
    "supporting_signals must contain short factual strings derived from the chart.",
    "Return JSON only.",
  ].join(" ");
}

function buildDimensionBriefs() {
  return ANNOTATION_DIMENSION_META.map(
    (dimension) =>
      `${dimension.step}. ${dimension.dimensionName} | ${dimension.title} | ${dimension.guidance}`,
  ).join("\n");
}

function buildThaiContextSignals(calculatedState: CalculatedStateValue) {
  const precedenceNoteSignals = calculatedState.sixtyJiaziCorePersona?.precedenceNoteSignals ?? [];
  const precedenceNotes = calculatedState.sixtyJiaziCorePersona?.precedenceNotes ?? [];

  return {
    seasonalInteraction: calculatedState.seasonalInteraction
      ? {
          seasonLabel: calculatedState.seasonalInteraction.seasonLabel,
          metaphor: calculatedState.seasonalInteraction.metaphor,
        }
      : null,
    dominantElements: calculatedState.elementAnalysis.dominantElements.map((element) => ({
      element,
      elementLabelThai: ELEMENT_LABELS_TH[element],
    })),
    missingElements: calculatedState.elementAnalysis.missingElements.map((element) => ({
      element,
      elementLabelThai: ELEMENT_LABELS_TH[element],
    })),
    elementStrengths: calculatedState.elementAnalysis.elementStrengths.map((entry) => ({
      element: entry.element,
      elementLabelThai: ELEMENT_LABELS_TH[entry.element],
      totalCount: calculatedState.elementAnalysis.totalCounts[entry.element],
      strength: entry.strength,
      strengthLabelThai: getElementStrengthLabel(entry.strength),
      rooted: entry.rooted,
      rootLabelThai: getElementRootLabel(entry.rooted),
      seasonalSupport: entry.seasonalSupport,
      seasonalSupportLabelThai: getElementSeasonalSupportLabel(entry.seasonalSupport),
    })),
    contextRuleNotes:
      precedenceNoteSignals.length > 0
        ? localizeContextRuleNotes(precedenceNoteSignals, precedenceNotes)
        : precedenceNotes,
  };
}

function buildInteractionSignals(calculatedState: CalculatedStateValue) {
  return {
    relations: (calculatedState.interactionState?.relations ?? []).map((relation) => ({
      id: relation.id,
      label: relation.label,
      familyKey: relation.familyKey,
      type: relation.type,
      participantEntityIds: relation.participantEntityIds,
      elementInteractionType: relation.elementInteractionType ?? null,
      transformElement: relation.transformElement ?? null,
    })),
    outcomes: (calculatedState.interactionState?.outcomes ?? []).map((outcome) => ({
      relationId: outcome.relationId,
      status: outcome.status,
      precedence: outcome.precedence ?? null,
      transformElement: outcome.transformElement ?? null,
      supportReasons: outcome.supportReasons,
      dayMasterEffect: outcome.dayMasterEffect ?? null,
      blockedByRelationIds: outcome.blockedByRelationIds,
    })),
    qualifiers: (calculatedState.interactionState?.qualifiers ?? []).map((qualifier) => ({
      id: qualifier.id,
      lane: qualifier.lane,
      qualifierKey: qualifier.qualifierKey,
      entityId: qualifier.entityId,
      value: qualifier.value,
      display: qualifier.display ?? null,
    })),
  };
}

function buildBaseChartReadingSignals(calculatedState: CalculatedStateValue) {
  const reading = calculatedState.baseChartReading;

  if (!reading) {
    return null;
  }

  return {
    summary: reading.readingOrderSteps[0] ?? null,
    readingOrderSteps: reading.readingOrderSteps,
    badges: [
      ...reading.roleBadges,
      ...reading.stemInteractionBadges,
      ...reading.branchInteractionBadges,
      ...reading.markerBadges,
    ].slice(0, 8).map((badge) => ({
      title: badge.shortLabel ?? badge.label,
      family: badge.family,
      priority: badge.priority,
      description: badge.meaningShort,
    })),
    groups: reading.groups.slice(0, 6).map((group) => ({
      title: group.title,
      description: group.description ?? null,
      badgeCount: group.badges.length,
    })),
  };
}

export function buildCompactCalculatedState(calculatedState: CalculatedStateValue) {
  const currentDaYun =
    calculatedState.daYun.find((entry) => entry.isCurrent)
    ?? calculatedState.daYun[0]
    ?? null;

  return {
    fourPillars: calculatedState.fourPillars,
    ageSnapshot: calculatedState.ageSnapshot ?? null,
    mingGong: calculatedState.mingGong ?? null,
    dayMaster: calculatedState.dayMaster,
    strengthScore: calculatedState.strengthScore,
    dayMasterStrengthProfile: calculatedState.dayMasterStrengthProfile ?? null,
    tenGods: calculatedState.tenGods,
    twelveQi: calculatedState.twelveQi,
    shenSha: calculatedState.shenSha.map((entry) => ({
      starName: entry.starName,
      relatedPillar: entry.relatedPillar,
      meaning: entry.meaning,
    })),
    elementMetaphors: calculatedState.elementMetaphors,
    elementAnalysis: calculatedState.elementAnalysis,
    seasonalInteraction: calculatedState.seasonalInteraction ?? null,
    thaiContextSignals: buildThaiContextSignals(calculatedState),
    currentDaYun,
    currentDaYunPhase: currentDaYun?.currentPhase
      ? currentDaYun.currentPhase === "upper"
        ? currentDaYun.upperPhase
        : currentDaYun.lowerPhase
      : null,
    upcomingDaYun: calculatedState.daYun.slice(0, 4).map((entry) => ({
      startAge: entry.startAge,
      endAge: entry.endAge,
      stem: entry.stem,
      branch: entry.branch,
      upperPhase: entry.upperPhase ?? null,
      lowerPhase: entry.lowerPhase ?? null,
      currentPhase: entry.currentPhase ?? null,
      isCurrent: entry.isCurrent ?? false,
    })),
    liuNian: calculatedState.liuNian ?? null,
    sixtyJiaziCorePersona: calculatedState.sixtyJiaziCorePersona ?? null,
    interactionSignals: buildInteractionSignals(calculatedState),
    baseChartReading: buildBaseChartReadingSignals(calculatedState),
    compatibilityMatrixProfiles: calculatedState.compatibilityMatrixProfiles.map((profile) => ({
      domain: profile.domain,
      pairKey: profile.pairKey,
    })),
  };
}

function buildUserPrompt(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
  referenceCaseExamples: readonly ReferenceCaseExample[],
) {
  const serializedExamples = referenceCaseExamples.map((example, index) => ({
    example_number: index + 1,
    source_path: example.filePath,
    excerpt: example.excerpt,
  }));

  return [
    "Create one complete Thai draft annotation payload for the following Bazi case.",
    "Focus on the 15 required dimensions only.",
    "Do not mention JSON, schema, model names, prompts, or AI.",
    "Keep thought_process analytical and evidence-led, then keep final_prediction clear enough to show to a client after human review.",
    "reviewSummary should be a short Thai summary of the whole reading.",
    "Open from the engine truth first: strength axis, reading order, interaction logic, and timing. Only then express it in polished Thai sinsae language.",
    "If reference excerpts are present, copy only the tone discipline, not their claims, structure, or conclusions.",
    "If calculated_state includes ageSnapshot or current luck-cycle fields, use them when discussing the client's current stage of life instead of speaking vaguely.",
    "",
    "Dimension briefs:",
    buildDimensionBriefs(),
    "",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
    "",
    "Calculated state summary:",
    JSON.stringify(buildCompactCalculatedState(calculatedState), null, 2),
    ...(serializedExamples.length > 0
      ? [
          "",
          "Reference style excerpts:",
          serializedExamples
            .map(
              (example) =>
                `Example ${example.example_number} | ${example.source_path}\n${example.excerpt}`,
            )
            .join("\n\n"),
        ]
      : []),
  ].join("\n");
}

function isRetryableGenerationError(error: unknown) {
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
    || message.includes("annotation_data")
    || message.includes("dimensions")
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

export async function generateGeminiDraftAnnotation(
  options: GenerateGeminiDraftAnnotationOptions,
): Promise<GenerateGeminiDraftAnnotationResult> {
  const model = options.model?.trim() || DEFAULT_MODEL;
  const apiKey = options.apiKey ?? getGeminiApiKey();
  const useReferenceCases = options.useReferenceCases ?? true;
  const referenceCasePaths = useReferenceCases
    ? (
        options.referenceCasePaths?.length
          ? [...options.referenceCasePaths]
          : selectReferenceCaseExamplePaths(options.rawInput)
      ).map((entry) => path.resolve(entry))
    : [];
  const referenceCaseExamples = useReferenceCases && referenceCasePaths.length > 0
    ? await loadReferenceCaseExamples(referenceCasePaths)
    : [];
  const ai = new GoogleGenAI({ apiKey });
  const generationSeed = buildStableReferenceSelectorSeed(options.rawInput);
  const prompt = buildUserPrompt(
    options.rawInput,
    options.calculatedState,
    referenceCaseExamples,
  );

  let lastError: unknown;
  let retryDelayMs = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: buildSystemInstruction(),
          temperature: 0.55,
          responseMimeType: "application/json",
          responseJsonSchema: GENERATED_DRAFT_RESPONSE_JSON_SCHEMA,
          seed: generationSeed,
        },
      });
      const responseText = response.text?.trim();

      if (!responseText) {
        throw new Error("Gemini returned an empty response body.");
      }

      const parsedJson = JSON.parse(responseText) as unknown;
      const normalizedPayload = normalizeGeneratedDraftPayload(parsedJson);
      const annotationData = GeneratedDraftAnnotationDataSchema.parse(normalizedPayload);

      return {
        annotationData,
        referenceCasePaths,
        model,
      };
    } catch (error) {
      lastError = error;

      if (attempt === MAX_GENERATION_ATTEMPTS || !isRetryableGenerationError(error)) {
        break;
      }

      retryDelayMs = getRetryDelayMs(error, retryDelayMs);
      console.warn(
        `Gemini generation attempt ${attempt} failed for model ${model}. Waiting ${Math.ceil(retryDelayMs / 1000)}s before retry.`,
      );
      await sleep(retryDelayMs);
      retryDelayMs *= 2;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini draft generation failed for an unknown reason.");
}

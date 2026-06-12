import { z } from "zod";

import { ANNOTATION_DIMENSION_TITLE_MAP } from "@/lib/bazi/annotation-dimension-meta";
import { collectCalculatedStateIntegrityIssues } from "@/lib/bazi/calculated-state-integrity";
import {
  AnnotationDataSchema,
  CalculatedStateSchema,
  RawInputSchema,
  type AnnotationDataValue,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

export const ExportIntentDomainSchema = z.enum([
  "general",
  "work",
  "study",
  "wealth",
  "love",
  "health",
  "family",
  "other",
  "timing",
]);

export const ExportDatasetStatusSchema = z.enum(["reviewed", "exported"]);

export const BaziSftExportRecordSchema = z.object({
  id: z.string().uuid(),
  rawInput: RawInputSchema,
  calculatedState: CalculatedStateSchema,
  intentDomain: ExportIntentDomainSchema,
  annotationData: AnnotationDataSchema,
  status: ExportDatasetStatusSchema,
}).superRefine((value, context) => {
  const integrityIssues = collectCalculatedStateIntegrityIssues(
    value.rawInput,
    value.calculatedState,
  );

  for (const issue of integrityIssues) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: issue,
      path: ["calculatedState"],
    });
  }
});

export const BaziSftMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1),
});

export const BaziSftTrainingExampleSchema = z.object({
  messages: z.tuple([
    BaziSftMessageSchema.extend({ role: z.literal("system") }),
    BaziSftMessageSchema.extend({ role: z.literal("user") }),
    BaziSftMessageSchema.extend({ role: z.literal("assistant") }),
  ]),
});

export type BaziSftExportRecord = z.infer<typeof BaziSftExportRecordSchema>;
export type BaziSftTrainingExample = z.infer<typeof BaziSftTrainingExampleSchema>;

function formatPillar(label: string, pillar: CalculatedStateValue["fourPillars"]["year"]) {
  const hiddenStems = pillar.hiddenStems?.length
    ? ` | hidden: ${pillar.hiddenStems.join(", ")}`
    : "";

  return `- ${label}: ${pillar.stem}${pillar.branch}${hiddenStems}`;
}

function formatRawInput(rawInput: RawInputValue) {
  const lines = [
    `- Birth Date: ${rawInput.birthDate}`,
    `- Birth Time: ${rawInput.birthTime}`,
    `- Gender: ${rawInput.gender}`,
    `- Province: ${rawInput.province}`,
  ];

  if (rawInput.calendarSystem) {
    lines.push(`- Calendar System: ${rawInput.calendarSystem}`);
  }

  if (rawInput.timezone) {
    lines.push(`- Timezone: ${rawInput.timezone}`);
  }

  return lines.join("\n");
}

function formatElementCounts(
  label: string,
  counts: CalculatedStateValue["elementAnalysis"]["totalCounts"],
) {
  return `${label}: ${Object.entries(counts)
    .map(([element, value]) => `${element}=${value}`)
    .join(", ")}`;
}

function formatElementStrengths(calculatedState: CalculatedStateValue) {
  const strengths = calculatedState.elementAnalysis?.elementStrengths;

  if (!strengths?.length) {
    return "none";
  }

  return strengths
    .map(({ element, strength, rooted, seasonalSupport }) => (
      `${element}=strength:${strength},rooted:${rooted ? "yes" : "no"},seasonal:${seasonalSupport}`
    ))
    .join(" | ");
}

function formatPrecedenceNoteSignals(calculatedState: CalculatedStateValue) {
  const signals = calculatedState.sixtyJiaziCorePersona?.precedenceNoteSignals;

  if (!signals?.length) {
    return "none";
  }

  return signals
    .map(({ key, params }) => {
      const formattedParams = Object.entries(params)
        .map(([paramKey, value]) => `${paramKey}=${value}`)
        .join(", ");

      return formattedParams.length > 0 ? `${key}(${formattedParams})` : key;
    })
    .join(" | ");
}

function formatDomainPower(calculatedState: CalculatedStateValue) {
  const power = calculatedState.domainPower;
  if (!power) {
    return "none";
  }
  const part = (label: string, score: { score: number; band: string; approximate?: boolean }) =>
    `${label}=${score.score}% (${score.band}${score.approximate ? ", approx" : ""})`;
  return [
    part("career", power.career),
    part("learning", power.learning),
    part("friends", power.friends),
    part("wealth", power.wealth),
  ].join(" | ");
}

function formatCalculatedState(calculatedState: CalculatedStateValue) {
  const tenGods = Object.entries(calculatedState.tenGods)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const twelveQi = Object.entries(calculatedState.twelveQi)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const metaphors = calculatedState.elementMetaphors.length
    ? calculatedState.elementMetaphors
        .map(({ element, metaphor }) => `${element}: ${metaphor}`)
        .join(" | ")
    : "none";
  const persona = calculatedState.sixtyJiaziCorePersona
    ? [
        calculatedState.sixtyJiaziCorePersona.code,
        calculatedState.sixtyJiaziCorePersona.narrative,
        calculatedState.sixtyJiaziCorePersona.precedenceNotes.length
          ? `notes=${calculatedState.sixtyJiaziCorePersona.precedenceNotes.join("; ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ")
    : "none";
  const seasonalInteraction = calculatedState.seasonalInteraction
    ? [
        `season=${calculatedState.seasonalInteraction.season}`,
        `phase=${calculatedState.seasonalInteraction.phase}`,
        `label=${calculatedState.seasonalInteraction.seasonLabel}`,
        `metaphor=${calculatedState.seasonalInteraction.metaphor}`,
      ].join(" | ")
    : "none";
  const dominantElements = calculatedState.elementAnalysis?.dominantElements.length
    ? calculatedState.elementAnalysis.dominantElements.join(", ")
    : "none";
  const missingElements = calculatedState.elementAnalysis?.missingElements.length
    ? calculatedState.elementAnalysis.missingElements.join(", ")
    : "none";
  const semanticNotes = calculatedState.sixtyJiaziCorePersona?.semanticNotes?.length
    ? calculatedState.sixtyJiaziCorePersona.semanticNotes.join(" | ")
    : "none";
  const ageSnapshot = calculatedState.ageSnapshot
    ? `thai=${calculatedState.ageSnapshot.thaiAge} | chinese=${calculatedState.ageSnapshot.chineseAge} | asOf=${calculatedState.ageSnapshot.referenceDate}`
    : "none";

  return [
    formatPillar("Year Pillar", calculatedState.fourPillars.year),
    formatPillar("Month Pillar", calculatedState.fourPillars.month),
    formatPillar("Day Pillar", calculatedState.fourPillars.day),
    formatPillar("Hour Pillar", calculatedState.fourPillars.hour),
    `- Day Master: ${calculatedState.dayMaster}`,
    `- Strength Score: ${calculatedState.strengthScore}`,
    `- Domain Power (0-100%): ${formatDomainPower(calculatedState)}`,
    `- Age Snapshot: ${ageSnapshot}`,
    `- Ten Gods: ${tenGods}`,
    `- Twelve Qi: ${twelveQi}`,
    `- Element Metaphors: ${metaphors}`,
    `- Seasonal Interaction: ${seasonalInteraction}`,
    calculatedState.elementAnalysis
      ? `- ${formatElementCounts("Visible Element Counts", calculatedState.elementAnalysis.visibleCounts)}`
      : "- Visible Element Counts: none",
    calculatedState.elementAnalysis
      ? `- ${formatElementCounts("Hidden Element Counts", calculatedState.elementAnalysis.hiddenCounts)}`
      : "- Hidden Element Counts: none",
    calculatedState.elementAnalysis
      ? `- ${formatElementCounts("Total Element Counts", calculatedState.elementAnalysis.totalCounts)}`
      : "- Total Element Counts: none",
    `- Dominant Elements: ${dominantElements}`,
    `- Missing Elements: ${missingElements}`,
    `- Element Strengths: ${formatElementStrengths(calculatedState)}`,
    `- Sixty Jiazi Core Persona: ${persona}`,
    `- Semantic Notes: ${semanticNotes}`,
    `- Precedence Note Signals: ${formatPrecedenceNoteSignals(calculatedState)}`,
  ].join("\n");
}

function formatDimension(dimension: AnnotationDataValue["dimensions"][number]) {
  const title = ANNOTATION_DIMENSION_TITLE_MAP[dimension.dimension_name];
  const blocks = [
    `<${dimension.dimension_name}>`,
    `<title>${title}</title>`,
    `<thought>${dimension.thought_process}</thought>`,
  ];

  if (dimension.supporting_signals.length > 0) {
    blocks.push(
      `<supporting_signals>${dimension.supporting_signals.join(" | ")}</supporting_signals>`,
    );
  }

  if (dimension.confidence_note) {
    blocks.push(`<confidence_note>${dimension.confidence_note}</confidence_note>`);
  }

  blocks.push(`<prediction>${dimension.final_prediction}</prediction>`);
  blocks.push(`</${dimension.dimension_name}>`);

  return blocks.join("\n");
}

export function createBaziSystemPrompt() {
  return [
    "You are a master Bazi astrologer who explains charts with disciplined reasoning.",
    "Base every conclusion only on the supplied raw input, calculated state, and annotation evidence.",
    "Always answer in the exact XML-like block structure shown by the assistant sample.",
  ].join(" ");
}

export function createBaziUserPrompt(record: BaziSftExportRecord) {
  return [
    "Analyze this Bazi chart using the supplied symbolic engine truth.",
    "",
    `Intent Domain: ${record.intentDomain}`,
    "",
    "Raw Input:",
    formatRawInput(record.rawInput),
    "",
    "Calculated State:",
    formatCalculatedState(record.calculatedState),
    "",
    "Return one XML-like block per annotation dimension in schema order.",
  ].join("\n");
}

export function createBaziAssistantResponse(record: BaziSftExportRecord) {
  const blocks: string[] = [];

  if (record.annotationData.reviewSummary) {
    blocks.push(`<review_summary>${record.annotationData.reviewSummary}</review_summary>`);
  }

  blocks.push(...record.annotationData.dimensions.map(formatDimension));

  return blocks.join("\n\n");
}

export function transformReviewedRecordToSftExample(
  input: unknown,
): BaziSftTrainingExample {
  const record = BaziSftExportRecordSchema.parse(input);

  return BaziSftTrainingExampleSchema.parse({
    messages: [
      {
        role: "system",
        content: createBaziSystemPrompt(),
      },
      {
        role: "user",
        content: createBaziUserPrompt(record),
      },
      {
        role: "assistant",
        content: createBaziAssistantResponse(record),
      },
    ],
  });
}

export function createBaziSftJsonlContent(records: readonly unknown[]) {
  return records
    .map((record) => JSON.stringify(transformReviewedRecordToSftExample(record)))
    .join("\n");
}
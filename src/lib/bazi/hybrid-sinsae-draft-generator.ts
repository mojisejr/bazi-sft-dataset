import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { ANNOTATION_DIMENSION_META } from "@/lib/bazi/annotation-dimension-meta";
import {
  buildCompactCalculatedState,
} from "@/lib/bazi/gemini-draft-generator";
import {
  retrieveHybridEvidencePacket,
  type HybridRetrievalPacket,
} from "@/lib/bazi/hybrid-retrieval";
import {
  DraftAnnotationDataSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type CalculatedStateValue,
  type DraftAnnotationDataValue,
  type DraftDimensionValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";

const DEFAULT_MODEL = "gemini-3-flash-preview";
const MAX_GENERATION_ATTEMPTS = 6;
const INITIAL_RETRY_DELAY_MS = 1_500;
const MAX_EXCERPT_SUMMARY_CHARS = 180;

const HybridDimensionAiResponseSchema = z.object({
  thought_process: z.string().trim().min(1),
  final_prediction: z.string().trim().min(1),
  supporting_signals: z.array(z.string().trim().min(1)).min(1),
  confidence_note: z.string().trim().min(1).optional(),
});

export type HybridDimensionSource = "retrieval-template" | "ai-fallback";

export type HybridDimensionPlan = {
  dimensionName: AnnotationDimensionName;
  retrievalPacket: HybridRetrievalPacket;
  source: HybridDimensionSource;
};

export type GenerateHybridSinsaeDraftDependencies = {
  retrieveEvidencePacket?: (
    dimensionName: AnnotationDimensionName,
    calculatedState: CalculatedStateValue,
    repoRoot?: string,
  ) => Promise<HybridRetrievalPacket>;
  generateFallbackDimension?: (input: {
    rawInput: RawInputValue;
    calculatedState: CalculatedStateValue;
    retrievalPacket: HybridRetrievalPacket;
    model: string;
    apiKey?: string;
  }) => Promise<DraftDimensionValue>;
};

export type GenerateHybridSinsaeDraftOptions = {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  model?: string;
  apiKey?: string;
  repoRoot?: string;
  dependencies?: GenerateHybridSinsaeDraftDependencies;
};

export type GenerateHybridSinsaeDraftResult = {
  annotationData: DraftAnnotationDataValue;
  model: string;
  dimensionPlans: HybridDimensionPlan[];
};

const HYBRID_DIMENSION_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    thought_process: { type: "string" },
    final_prediction: { type: "string" },
    supporting_signals: {
      type: "array",
      items: { type: "string" },
    },
    confidence_note: { type: "string" },
  },
  required: ["thought_process", "final_prediction", "supporting_signals"],
} as const;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildSeed(rawInput: RawInputValue, dimensionName: AnnotationDimensionName) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ rawInput, dimensionName }))
    .digest();

  return digest.readUInt32BE(0) % 2_147_483_647;
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

function summarizeExcerpt(excerpt: string) {
  const flattened = excerpt
    .replace(/\s+/g, " ")
    .trim();

  if (flattened.length <= MAX_EXCERPT_SUMMARY_CHARS) {
    return flattened;
  }

  return `${flattened.slice(0, MAX_EXCERPT_SUMMARY_CHARS).trim()}...`;
}

function buildCoreSignals(calculatedState: CalculatedStateValue) {
  const signals = [
    `ดิถี=${calculatedState.dayMaster}`,
  ];

  const strengthLabel = calculatedState.dayMasterStrengthProfile?.displayLabel
    ?? calculatedState.dayMasterStrengthProfile?.strengthState;

  if (strengthLabel) {
    signals.push(`กำลังดิถี=${strengthLabel}`);
  }

  if (calculatedState.elementAnalysis.dominantElements.length > 0) {
    signals.push(`ธาตุเด่น=${calculatedState.elementAnalysis.dominantElements.join(", ")}`);
  }

  if (calculatedState.ageSnapshot) {
    signals.push(`อายุจีน=${calculatedState.ageSnapshot.chineseAge}`);
  }

  if (calculatedState.liuNian?.stem && calculatedState.liuNian?.branch) {
    signals.push(`ปีจร=${calculatedState.liuNian.stem}${calculatedState.liuNian.branch}`);
  }

  return signals;
}

function buildRetrievalTemplateDimension(
  dimensionName: AnnotationDimensionName,
  retrievalPacket: HybridRetrievalPacket,
  calculatedState: CalculatedStateValue,
): DraftDimensionValue {
  const meta = ANNOTATION_DIMENSION_META.find((entry) => entry.dimensionName === dimensionName);

  if (!meta) {
    throw new Error(`Missing annotation metadata for ${dimensionName}`);
  }

  const evidence = retrievalPacket.evidence.slice(0, 2);
  const evidenceTitles = evidence.map((entry) => entry.title).join(" และ ");
  const evidenceSummary = evidence
    .map((entry) => summarizeExcerpt(entry.excerpt))
    .join(" | ");
  const supportingSignals = [
    ...buildCoreSignals(calculatedState),
    ...evidence.map((entry) => `source=${entry.title}`),
  ].slice(0, 6);

  return {
    dimension_name: dimensionName,
    thought_process: [
      `มิตินี้อ่านตามกรอบ ${meta.title} โดยยึด engine truth ของดวงก่อน แล้วค่อยประกบเอกสารซินแสที่ตรงมิตินี้โดยตรง.`,
      `หลักฐานที่ใช้คือ ${evidenceTitles}.`,
      `สัญญาณข้อความที่หยิบได้คือ ${evidenceSummary}.`,
    ].join(" "),
    final_prediction: `สำหรับ${meta.title} ให้ตั้งต้นการ proof จากหลักฐาน ${evidenceTitles} และอ่านร่วมกับแกนดวงจริงของเจ้าชะตา โดยยังไม่ควรตีความเกินกว่าสัญญาณที่เอกสารรองรับไว้ว่า ${evidenceSummary}`,
    supporting_signals: supportingSignals,
    confidence_note: `retrieval-first ${retrievalPacket.tier} packet with ${retrievalPacket.evidence.length} evidence source(s)`,
  };
}

function buildFallbackSystemInstruction() {
  return [
    "You are a senior Thai Bazi master writing one dimension for a human sinsae review workflow.",
    "Write every field in Thai.",
    "Use only the provided raw_input, compact_calculated_state, and retrieval_packet.",
    "Calculation truth belongs only to compact_calculated_state. Never invent stems, branches, ages, stars, luck cycles, or hidden chart facts.",
    "retrieval_packet is support evidence only. Use it when present, but do not let it override chart facts.",
    "If support evidence is thin, say less instead of inventing.",
    "thought_process must explain the causal chain like a sinsae, not like a developer.",
    "final_prediction must be specific and ready for human proof editing.",
    "supporting_signals must be short factual Thai lines grounded in the provided data.",
    "Do not mention JSON, prompts, models, or AI.",
    "Return JSON only.",
  ].join(" ");
}

function buildFallbackUserPrompt(input: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  retrievalPacket: HybridRetrievalPacket;
}) {
  const meta = ANNOTATION_DIMENSION_META.find(
    (entry) => entry.dimensionName === input.retrievalPacket.dimensionName,
  );

  if (!meta) {
    throw new Error(`Missing annotation metadata for ${input.retrievalPacket.dimensionName}`);
  }

  return [
    `เขียนมิติเดียว: ${meta.dimensionName} (${meta.title})`,
    `เป้าหมาย: ${meta.guidance}`,
    `คำถามหลัก: ${meta.thoughtPrompt}`,
    `คำตอบปลายทาง: ${meta.predictionPrompt}`,
    "ห้ามเขียนมิติอื่นและห้ามสร้างข้อเท็จจริงนอก compact_calculated_state.",
    "หาก retrieval_packet ไม่มีหลักฐานมากพอ ให้ใช้เฉพาะแกนจากดวงจริงและเขียนแบบระมัดระวัง.",
    "Raw input:",
    JSON.stringify(input.rawInput, null, 2),
    "",
    "Compact calculated state:",
    JSON.stringify(buildCompactCalculatedState(input.calculatedState), null, 2),
    "",
    "Retrieval packet:",
    JSON.stringify(input.retrievalPacket, null, 2),
  ].join("\n");
}

async function generateFallbackDimensionWithGemini(input: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  retrievalPacket: HybridRetrievalPacket;
  model: string;
  apiKey?: string;
}): Promise<DraftDimensionValue> {
  const apiKey = input.apiKey ?? getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildFallbackUserPrompt(input);
  let lastError: unknown;
  let retryDelayMs = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: input.model,
        contents: prompt,
        config: {
          systemInstruction: buildFallbackSystemInstruction(),
          temperature: 0.4,
          responseMimeType: "application/json",
          responseJsonSchema: HYBRID_DIMENSION_RESPONSE_JSON_SCHEMA,
          seed: buildSeed(input.rawInput, input.retrievalPacket.dimensionName),
        },
      });
      const responseText = response.text?.trim();

      if (!responseText) {
        throw new Error("Hybrid fallback returned an empty response body.");
      }

      const parsed = HybridDimensionAiResponseSchema.parse(JSON.parse(responseText) as unknown);

      return {
        dimension_name: input.retrievalPacket.dimensionName,
        ...parsed,
      };
    } catch (error) {
      lastError = error;

      if (attempt === MAX_GENERATION_ATTEMPTS || !isRetryableGenerationError(error)) {
        break;
      }

      retryDelayMs = getRetryDelayMs(error, retryDelayMs);
      await sleep(retryDelayMs);
      retryDelayMs *= 2;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Hybrid fallback generation failed for an unknown reason.");
}

export async function resolveHybridDimensionPlans(
  calculatedState: CalculatedStateValue,
  options?: {
    repoRoot?: string;
    retrieveEvidencePacket?: GenerateHybridSinsaeDraftDependencies["retrieveEvidencePacket"];
  },
): Promise<HybridDimensionPlan[]> {
  const retrieveEvidencePacket = options?.retrieveEvidencePacket ?? retrieveHybridEvidencePacket;
  const repoRoot = options?.repoRoot;

  return Promise.all(
    REQUIRED_ANNOTATION_DIMENSION_NAMES.map(async (dimensionName) => {
      const retrievalPacket = await retrieveEvidencePacket(dimensionName, calculatedState, repoRoot);
      const source: HybridDimensionSource = retrievalPacket.fallbackRequired
        || retrievalPacket.evidence.length === 0
        ? "ai-fallback"
        : "retrieval-template";

      return {
        dimensionName,
        retrievalPacket,
        source,
      } satisfies HybridDimensionPlan;
    }),
  );
}

function buildReviewSummary(dimensions: DraftDimensionValue[]) {
  return dimensions.find((dimension) => dimension.dimension_name === "core_prediction")?.final_prediction
    || dimensions.find((dimension) => dimension.dimension_name === "chart_foundation")?.final_prediction
    || "สรุปการอ่านดวงจาก engine truth และ retrieval support พร้อมสำหรับซินแส proof ต่อ";
}

export async function generateHybridSinsaeDraft(
  options: GenerateHybridSinsaeDraftOptions,
): Promise<GenerateHybridSinsaeDraftResult> {
  const model = options.model?.trim() || DEFAULT_MODEL;
  const dimensionPlans = await resolveHybridDimensionPlans(options.calculatedState, {
    repoRoot: options.repoRoot,
    retrieveEvidencePacket: options.dependencies?.retrieveEvidencePacket,
  });
  const generateFallbackDimension = options.dependencies?.generateFallbackDimension
    ?? generateFallbackDimensionWithGemini;
  const dimensions: DraftDimensionValue[] = [];

  for (const plan of dimensionPlans) {
    if (plan.source === "retrieval-template") {
      dimensions.push(
        buildRetrievalTemplateDimension(
          plan.dimensionName,
          plan.retrievalPacket,
          options.calculatedState,
        ),
      );
      continue;
    }

    dimensions.push(
      await generateFallbackDimension({
        rawInput: options.rawInput,
        calculatedState: options.calculatedState,
        retrievalPacket: plan.retrievalPacket,
        model,
        apiKey: options.apiKey,
      }),
    );
  }

  const annotationData = DraftAnnotationDataSchema.parse({
    version: "1.6",
    reviewSummary: buildReviewSummary(dimensions),
    dimensions,
  });

  return {
    annotationData,
    model,
    dimensionPlans,
  };
}

import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  DraftAnnotationDataSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type CalculatedStateValue,
  type DraftAnnotationDataValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_PERSONALITY_POC_MODEL = "gemini-3-flash-preview";

const TARGET_DIMENSION = "personality_psychology" as const;

export const PERSONALITY_TRUTH_HIERARCHY = [
  "dayMasterStrengthProfile",
  "sixtyJiaziCorePersona",
  "elementAnalysis",
  "seasonalInteraction",
] as const;

export const PersonalityPocResponseSchema = z.object({
  reviewSummary: z.string().trim().min(1),
  personality: z.object({
    thought_process: z.string().trim().min(1),
    final_prediction: z.string().trim().min(1),
    supporting_signals: z.array(z.string().trim().min(1)).min(1),
    confidence_note: z.string().trim().min(1).optional(),
  }),
});

export type PersonalityPocResponse = z.infer<typeof PersonalityPocResponseSchema>;

export type PersonalityFocusPayload = ReturnType<typeof buildPersonalityFocusPayload>;

const PERSONALITY_POC_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    reviewSummary: {
      type: "string",
    },
    personality: {
      type: "object",
      properties: {
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
      required: ["thought_process", "final_prediction", "supporting_signals"],
    },
  },
  required: ["reviewSummary", "personality"],
} as const;

function buildSeed(rawInput: RawInputValue) {
  const digest = createHash("sha256")
    .update(JSON.stringify(rawInput))
    .digest();

  return digest.readUInt32BE(0) % 2_147_483_647;
}

export function buildPersonalityFocusPayload(calculatedState: CalculatedStateValue) {
  return {
    dayMasterStrengthProfile: calculatedState.dayMasterStrengthProfile ?? null,
    sixtyJiaziCorePersona: calculatedState.sixtyJiaziCorePersona ?? null,
    elementAnalysis: calculatedState.elementAnalysis,
    seasonalInteraction: calculatedState.seasonalInteraction ?? null,
  };
}

export function buildPersonalityPocSystemInstruction() {
  return [
    "You are a senior Thai Bazi master writing only the 'นิสัยพื้นฐาน' dimension for human sinsae review.",
    "Write every field in Thai.",
    "Treat the truth hierarchy as strict precedence: dayMasterStrengthProfile first, sixtyJiaziCorePersona second, elementAnalysis third, seasonalInteraction fourth.",
    "Never let seasonal mood or elemental counts override the primary personality axis from dayMasterStrengthProfile.",
    "Use sixtyJiaziCorePersona as temperament color only when it supports the primary axis.",
    "Use elementAnalysis and seasonalInteraction only as context modifiers, not as replacement identity.",
    "Ignore interactionState, current events, and annual timing for this task.",
    "thought_process must explain why the hierarchy led to the final reading.",
    "final_prediction must read like a real sinsae talking to a client about temperament, inner drive, blind spots, and emotional patterning.",
    "supporting_signals must be short factual strings copied from the provided payload.",
    "Return JSON only.",
  ].join(" ");
}

export function buildPersonalityPocUserPrompt(
  rawInput: RawInputValue,
  calculatedState: CalculatedStateValue,
) {
  return [
    "Create one Thai reading for the personality_psychology dimension only.",
    "Do not produce the other 14 dimensions.",
    "Do not mention JSON, prompt, model, or AI.",
    "If an upstream signal is absent, say less instead of inventing.",
    "The reading must stay faithful to this order: dayMasterStrengthProfile -> sixtyJiaziCorePersona -> elementAnalysis -> seasonalInteraction.",
    "",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
    "",
    "Focused personality payload:",
    JSON.stringify(buildPersonalityFocusPayload(calculatedState), null, 2),
  ].join("\n");
}

export function buildDraftAnnotationDataFromPersonality(
  response: PersonalityPocResponse,
): DraftAnnotationDataValue {
  return DraftAnnotationDataSchema.parse({
    version: "1.6",
    reviewSummary: response.reviewSummary,
    dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => (
      dimensionName === TARGET_DIMENSION
        ? {
            dimension_name: dimensionName,
            thought_process: response.personality.thought_process,
            final_prediction: response.personality.final_prediction,
            supporting_signals: response.personality.supporting_signals,
            confidence_note: response.personality.confidence_note,
          }
        : {
            dimension_name: dimensionName,
            thought_process: "",
            final_prediction: "",
            supporting_signals: [],
          }
    )),
  });
}

export async function generatePersonalityPromptPoc(options: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  apiKey?: string;
  model?: string;
}) {
  const apiKey = options.apiKey ?? getGeminiApiKey();
  const model = options.model?.trim() || DEFAULT_PERSONALITY_POC_MODEL;
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPersonalityPocUserPrompt(options.rawInput, options.calculatedState);
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: buildPersonalityPocSystemInstruction(),
      responseMimeType: "application/json",
      responseJsonSchema: PERSONALITY_POC_RESPONSE_JSON_SCHEMA,
      temperature: 0.45,
      seed: buildSeed(options.rawInput),
    },
  });
  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error("Gemini returned an empty personality POC response.");
  }

  const parsed = PersonalityPocResponseSchema.parse(JSON.parse(responseText) as unknown);

  return {
    model,
    focusPayload: buildPersonalityFocusPayload(options.calculatedState),
    response: parsed,
    annotationData: buildDraftAnnotationDataFromPersonality(parsed),
  };
}

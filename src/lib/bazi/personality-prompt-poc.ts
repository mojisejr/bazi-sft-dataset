import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  getElementRootLabel,
  getElementSeasonalSupportLabel,
  getElementStrengthLabel,
  localizeContextRuleNotes,
} from "@/lib/bazi/context-dictionary";
import {
  DraftAnnotationDataSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type CalculatedStateValue,
  type DraftAnnotationDataValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";
import { ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";

export const DEFAULT_PERSONALITY_POC_MODEL = "gemini-3-flash-preview";

const TARGET_DIMENSION = "personality_psychology" as const;

const FORBIDDEN_REPORT_TERMS = [
  "payload",
  "schema",
  "json",
  "model",
  "ai",
  "missing:",
  "dominant:",
  "day master",
  "ครับ",
  "ค่ะ",
] as const;

export const PERSONALITY_TRUTH_HIERARCHY = [
  "dayMasterStrengthProfile",
  "sixtyJiaziCorePersona",
  "elementAnalysis",
  "seasonalInteraction",
] as const;

const PersonalityBridgeBlockSchema = z.object({
  title: z.string().trim().min(1),
  signal: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  personality_impact: z.string().trim().min(1),
});

export const PersonalityPocResponseSchema = z.object({
  reviewSummary: z.string().trim().min(1),
  personality: z.object({
    thought_process: z.string().trim().min(1),
    bridge_blocks: z.array(PersonalityBridgeBlockSchema).min(3).max(4),
    final_prediction: z.string().trim().min(1),
    supporting_signals: z.array(z.string().trim().min(1)).min(1),
    confidence_note: z.string().trim().min(1).optional(),
  }),
}).superRefine((response, context) => {
  const reportFields = [
    response.reviewSummary,
    response.personality.thought_process,
    response.personality.final_prediction,
    ...response.personality.supporting_signals,
    ...(response.personality.confidence_note ? [response.personality.confidence_note] : []),
    ...response.personality.bridge_blocks.flatMap((block) => [
      block.title,
      block.signal,
      block.explanation,
      block.personality_impact,
    ]),
  ];

  for (const field of reportFields) {
    const normalizedField = field.toLowerCase();

    for (const forbiddenTerm of FORBIDDEN_REPORT_TERMS) {
      if (normalizedField.includes(forbiddenTerm)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Forbidden report term detected: ${forbiddenTerm}`,
        });
      }
    }
  }
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
        bridge_blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
              },
              signal: {
                type: "string",
              },
              explanation: {
                type: "string",
              },
              personality_impact: {
                type: "string",
              },
            },
            required: ["title", "signal", "explanation", "personality_impact"],
          },
          minItems: 3,
          maxItems: 4,
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
      required: ["thought_process", "bridge_blocks", "final_prediction", "supporting_signals"],
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
    "You own the interpretation and the sinsae wording. Do not leave semantic expansion to the caller.",
    "thought_process must explain the causal chain in sinsae language, not technical language.",
    "Return 3-4 bridge_blocks. Each bridge block is mandatory.",
    "Each bridge block must contain a short Thai title, a human-readable signal line grounded in the payload, a sinsae explanation, and the personality impact it creates.",
    "Each bridge block should move in this flow: what the chart shows, what it means, and what kind of temperament it creates.",
    "final_prediction must read like a real sinsae talking to a client about temperament, inner drive, blind spots, and emotional patterning.",
    "Do not use gendered polite particles such as ครับ or ค่ะ in the generated report.",
    "supporting_signals must be short Thai factual lines that a human reader can understand immediately from the provided payload.",
    "Do not write developer language such as payload, schema, JSON, model, AI, missing:, dominant:, or Day Master.",
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
    "Write the reasoning in a sinsae flow such as: คุณเป็นคน... / พอมาเจอ... / จึงทำให้...",
    "Return exactly 3 or 4 bridge_blocks so the explanation is already expanded before any formatter sees it.",
    "Each bridge block must include title, signal, explanation, and personality_impact.",
    "Write supporting_signals as Thai evidence lines, not enum-style fragments.",
    "Never write terms like missing: metal, dominant: water, payload, schema, JSON, model, AI, or Day Master.",
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

function formatThaiGender(gender: string) {
  return gender === "female" ? "หญิง" : gender === "male" ? "ชาย" : gender;
}

function formatThaiProvince(province: string) {
  return province === "Bangkok" ? "กรุงเทพมหานคร" : province;
}

function formatElementList(elements: string[]) {
  if (elements.length === 0) {
    return "ไม่มีจุดเด่นเฉพาะ";
  }

  return elements
    .map((element) => ELEMENT_LABELS_TH[element as keyof typeof ELEMENT_LABELS_TH] ?? element)
    .join(", ");
}

function buildTruthAnchorLines(rawInput: RawInputValue, focusPayload: PersonalityFocusPayload) {
  const strengthProfile = focusPayload.dayMasterStrengthProfile;
  const sixtyJiazi = focusPayload.sixtyJiaziCorePersona;

  return [
    `- วันเกิด: ${rawInput.birthDate} เวลา ${rawInput.birthTime} ${formatThaiGender(rawInput.gender)}`,
    `- สถานที่: ${formatThaiProvince(rawInput.province)}`,
    `- ดิถี: ${strengthProfile?.dayMaster ?? "ไม่ทราบ"}`,
    `- กำลังดิถี: ${strengthProfile?.displayLabel ?? strengthProfile?.strengthState ?? "ไม่ทราบ"}`,
    `- 60 กะจื่อ: ${sixtyJiazi?.code ?? "ไม่ทราบ"}`,
    `- ธาตุเด่น: ${formatElementList(focusPayload.elementAnalysis.dominantElements)}`,
    `- ธาตุขาด: ${formatElementList(focusPayload.elementAnalysis.missingElements)}`,
  ];
}

function buildSignalLines(focusPayload: PersonalityFocusPayload) {
  const strengthProfile = focusPayload.dayMasterStrengthProfile;
  const sixtyJiazi = focusPayload.sixtyJiaziCorePersona;
  const strongestElements = focusPayload.elementAnalysis.elementStrengths
    .filter((entry) => entry.strength === "strong" || entry.strength === "balanced")
    .map((entry) => {
      const label = ELEMENT_LABELS_TH[entry.element];
      const strengthLabel = getElementStrengthLabel(entry.strength);
      const rootLabel = getElementRootLabel(entry.rooted);
      const seasonalSupportLabel = getElementSeasonalSupportLabel(entry.seasonalSupport);

      return `${label} (${strengthLabel}, ${rootLabel}, ${seasonalSupportLabel})`;
    });
  const precedenceNotes = sixtyJiazi?.precedenceNoteSignals?.length
    ? localizeContextRuleNotes(sixtyJiazi.precedenceNoteSignals, sixtyJiazi.precedenceNotes)
    : (sixtyJiazi?.precedenceNotes ?? []);

  return [
    `- ดิถีและกำลังดวง: ${strengthProfile?.narrative ?? "ไม่มีคำอธิบายเพิ่ม"}`,
    `- ฐานวัน 60 กะจื่อ: ${sixtyJiazi?.narrative ?? "ไม่มีคำอธิบายเพิ่ม"}`,
    `- น้ำหนักธาตุรวม: ธาตุเด่นคือ ${formatElementList(focusPayload.elementAnalysis.dominantElements)}; ธาตุขาดคือ ${formatElementList(focusPayload.elementAnalysis.missingElements)}`,
    `- ธาตุที่พยุงภาพนิสัย: ${strongestElements.length > 0 ? strongestElements.join(", ") : "ยังไม่มีตัวเด่นชัด"}`,
    ...(focusPayload.seasonalInteraction
      ? [`- บริบทฤดูกาล: ${focusPayload.seasonalInteraction.seasonLabel} — ${focusPayload.seasonalInteraction.metaphor}`]
      : ["- บริบทฤดูกาล: เคสนี้ไม่มีตัวแต้มฤดูกาลเพิ่มเติม จึงยืนบนแกนดิถีและกะจื่อวันเป็นหลัก"]),
    ...(precedenceNotes.length > 0
      ? [`- หมายเหตุการจัดลำดับ: ${precedenceNotes.join(" | ")}`]
      : []),
  ];
}

function buildBridgeBlockLines(response: PersonalityPocResponse) {
  return response.personality.bridge_blocks.flatMap((block, index) => [
    `${index + 1}. ${block.title}`,
    `   สัญญาณ: ${block.signal}`,
    `   ${block.explanation}`,
    `   จึงทำให้: ${block.personality_impact}`,
  ]);
}

export function formatPersonalityPocPreflightReport(options: {
  rawInput: RawInputValue;
  focusPayload: PersonalityFocusPayload;
}) {
  return [
    "=== รายงานเตรียมอ่านนิสัยพื้นฐาน ===",
    "",
    "แกนหลักของดวง",
    ...buildTruthAnchorLines(options.rawInput, options.focusPayload),
    "",
    "ลำดับการอ่าน",
    "- ดิถีและกำลังดวง -> 60 กะจื่อ -> น้ำหนักธาตุรวม -> บริบทฤดูกาล",
    "",
    "สัญญาณที่ใช้ในการอ่าน",
    ...buildSignalLines(options.focusPayload),
    "",
    "หมายเหตุ",
    "- โหมดนี้ยังไม่เรียก Gemini ใช้สำหรับตรวจว่าข้อมูลจาก engine พร้อมและเรียงลำดับถูกต้องแล้ว",
  ].join("\n");
}

export function formatPersonalityPocGeneratedReport(options: {
  rawInput: RawInputValue;
  focusPayload: PersonalityFocusPayload;
  response: PersonalityPocResponse;
  model: string;
}) {
  return [
    "=== รายงานนิสัยพื้นฐานแบบซินแส ===",
    "",
    "ข้อมูลเคสทดลอง",
    ...buildTruthAnchorLines(options.rawInput, options.focusPayload),
    "",
    "สัญญาณที่ใช้ในการอ่าน",
    ...buildSignalLines(options.focusPayload),
    ...(options.response.personality.supporting_signals.length > 0
      ? ["", "สัญญาณประกอบที่ยึดในการอ่าน", ...options.response.personality.supporting_signals.map((signal) => `- ${signal}`)]
      : []),
    "",
    "คำอธิบายแบบซินแส",
    ...buildBridgeBlockLines(options.response),
    "",
    "สรุปย่อ",
    options.response.reviewSummary,
    "",
    "คำทำนายพร้อมส่งลูกค้า",
    options.response.personality.final_prediction,
    ...(options.response.personality.confidence_note
      ? ["", "หมายเหตุความมั่นใจ", options.response.personality.confidence_note]
      : []),
    "",
    "ภาคผนวกเทคนิค",
    `- รุ่นที่ใช้: ${options.model}`,
  ].join("\n");
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

import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  getElementRootLabel,
  getElementSeasonalSupportLabel,
  getElementStrengthLabel,
  localizeContextRuleNotes,
} from "@/lib/bazi/context-dictionary";
import { createDbKnowledgeRepository } from "@/lib/bazi/symbolic-engine.repository";
import {
  DraftAnnotationDataSchema,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type DraftAnnotationDataValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  buildBaziCallerContractFromRawInput,
} from "@/lib/bazi/symbolic-engine.caller-contract";
import {
  SOURCE2_DOWNSTREAM_READINESS,
  buildSource2PersonalityOverlay,
  type Source2PersonalityOverlay,
  type Source2PersonalityOverlayRepository,
} from "@/lib/bazi/source2-personality-overlay";
import { getGeminiApiKey } from "@/lib/env";
import { ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import type {
  BaziSharedPacket,
} from "@/lib/bazi/symbolic-engine.shared-packets";

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
  "ตี้อ๋วง",
  "ลิ่มกัว",
] as const;

export const PERSONALITY_TRUTH_HIERARCHY = [
  "source2.routing",
  "source2.refinement",
  "source2.evidence",
  "source2.supportingPackets",
] as const;

const OWNERSHIP_CERTAINTY_LABELS = {
  authored: "ยืนยันจากข้อความหลักของตำรา",
  "shared-granularity": "ใช้เป็นบริบทเสริมเท่านั้น",
  "classified-gap": "ห้ามขยายความเพิ่มจากช่องว่างนี้",
} as const;

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

function getRoleOfElementPacket(
  focusPayload: PersonalityFocusPayload,
): Extract<BaziSharedPacket, { family: "role-of-element" }> | null {
  return focusPayload.supportingPackets.find((packet) => packet.family === "role-of-element") ?? null;
}

function getTwelveQiTexturePacket(
  focusPayload: PersonalityFocusPayload,
): Extract<BaziSharedPacket, { family: "twelve-qi-texture" }> | null {
  return focusPayload.supportingPackets.find((packet) => packet.family === "twelve-qi-texture") ?? null;
}

function getElementBalance(focusPayload: PersonalityFocusPayload) {
  return getRoleOfElementPacket(focusPayload)?.sections.elementBalance.value ?? null;
}

function getSeasonalInteraction(focusPayload: PersonalityFocusPayload) {
  return getRoleOfElementPacket(focusPayload)?.sections.roles.value.seasonalInteraction ?? null;
}

function getTwelveQiTextureDisplay(focusPayload: PersonalityFocusPayload) {
  return getTwelveQiTexturePacket(focusPayload)?.sections.texture.value.display ?? null;
}

function formatOverlayAdviceText(text: string | null, fallback: string | null | undefined) {
  return text ?? fallback ?? "ไม่มีคำอธิบายเพิ่ม";
}

function formatOwnershipCertaintyLabel(status: keyof typeof OWNERSHIP_CERTAINTY_LABELS) {
  return OWNERSHIP_CERTAINTY_LABELS[status];
}

function buildLaneGuardrailLines(focusPayload: PersonalityFocusPayload) {
  return [
    `- routing owner: ${formatOwnershipCertaintyLabel(focusPayload.source2Overlay.routing.narrative.ownership.status)}; เขียนเป็นแกนนิสัยหลักได้`,
    `- refinement owner: ${formatOwnershipCertaintyLabel(focusPayload.source2Overlay.refinement.dayPillarAdvice.ownership.status)}; ใช้เป็นสีของอารมณ์และบุคลิกย่อยเท่านั้น`,
    `- evidence owner: ${formatOwnershipCertaintyLabel(focusPayload.source2Overlay.evidence.twelveQi.advice.ownership.status)}; ต้องใช้คำอย่าง "มีแนวโน้ม", "อาจ", หรือ "ควรระวัง" แทนคำฟันธง`,
    "- ถ้าข้อความเตือนอยู่ใน refinement หรือ evidence ห้ามยกระดับเป็นตัวตนหลักของเจ้าชะตา",
    "- ห้ามเพิ่มศัพท์เทคนิคจีนหรือชื่อดาวที่ไม่ได้ปรากฏตรง ๆ ใน payload",
    "- ห้ามเดาเรื่องความรัก เพศสัมพันธ์ สถานะทางสังคม หรือโชคชะตาด้านอื่น ถ้า routing ไม่ได้ยืนยันตรง ๆ",
    "- ถ้าสัญญาณรองขัดกับ routing ให้ยึด routing แล้วลดน้ำหนักสัญญาณรองทันที",
  ];
}

function buildPromptPayload(focusPayload: PersonalityFocusPayload) {
  const elementBalance = getElementBalance(focusPayload);
  const seasonalInteraction = getSeasonalInteraction(focusPayload);
  const twelveQiTexture = getTwelveQiTextureDisplay(focusPayload);

  return {
    routing: {
      role: "แกนนิสัยหลัก",
      certainty: formatOwnershipCertaintyLabel(focusPayload.source2Overlay.routing.narrative.ownership.status),
      text: formatOverlayAdviceText(
        focusPayload.source2Overlay.routing.narrative.text,
        focusPayload.dayMasterStrengthProfile?.narrative,
      ),
    },
    refinement: {
      role: "สีบุคลิกย่อย",
      certainty: formatOwnershipCertaintyLabel(focusPayload.source2Overlay.refinement.dayPillarAdvice.ownership.status),
      text: formatOverlayAdviceText(
        focusPayload.source2Overlay.refinement.dayPillarAdvice.text,
        focusPayload.sixtyJiaziCorePersona?.narrative,
      ),
    },
    evidence: {
      role: "บริบทเสริมและข้อควรระวัง",
      certainty: formatOwnershipCertaintyLabel(focusPayload.source2Overlay.evidence.twelveQi.advice.ownership.status),
      text: formatOverlayAdviceText(
        focusPayload.source2Overlay.evidence.twelveQi.advice.text,
        twelveQiTexture?.dayBranch ?? focusPayload.evidence.twelveQi.toneLabel,
      ),
    },
    supportingContext: {
      dominantElements: elementBalance?.dominantElements ?? [],
      missingElements: elementBalance?.missingElements ?? [],
      season: seasonalInteraction?.seasonLabel ?? null,
      seasonalMetaphor: seasonalInteraction?.metaphor ?? null,
    },
  };
}

export function buildPersonalityFocusPayload(source2Overlay: Source2PersonalityOverlay) {
  return {
    source2Overlay,
    dayMasterStrengthProfile: source2Overlay.routing.strengthProfile,
    sixtyJiaziCorePersona: source2Overlay.refinement.corePersona,
    evidence: source2Overlay.evidence,
    supportingPackets: source2Overlay.evidence.supportingPackets,
  };
}

export async function buildPersonalityFocusPayloadFromCalculatedState(options: {
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  repository?: Source2PersonalityOverlayRepository;
}) {
  const repository = options.repository ?? createDbKnowledgeRepository();
  const callerContract = buildBaziCallerContractFromRawInput(
    options.rawInput,
    options.calculatedState,
  );
  const source2Overlay = await buildSource2PersonalityOverlay(callerContract, repository);

  return buildPersonalityFocusPayload(source2Overlay);
}

export function buildPersonalityPocSystemInstruction() {
  return [
    "You are a senior Thai Bazi master writing only the 'นิสัยพื้นฐาน' dimension for human sinsae review.",
    "Write every field in Thai.",
    "Treat the truth hierarchy as strict precedence: Source 2 routing first, Source 2 refinement second, Source 2 evidence third, Source 2 supporting packets fourth.",
    "Stable-trait claims may come only from Source 2 routing.",
    "Never let refinement, evidence, or packet context override the primary personality axis from Source 2 routing.",
    "Use Source 2 refinement as temperament color only when it supports the routing axis.",
    "Use Source 2 evidence and supporting packets only as context modifiers, not as replacement identity.",
    "When refinement or evidence contain warnings, phrase them as tendencies or cautions, never as fixed identity.",
    "If a lane is not authored, reduce certainty immediately and write with softer language such as มีแนวโน้ม, อาจ, or ควรระวัง.",
    "Do not introduce Chinese technical labels, star names, or stage names unless they already appear explicitly in the payload text that the human can read.",
    "Do not infer romance, sexuality, fame, social rank, or life-domain destiny unless the routing text states it directly.",
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
  focusPayload: PersonalityFocusPayload,
) {
  return [
    "Create one Thai reading for the personality_psychology dimension only.",
    "Do not produce the other 14 dimensions.",
    "Do not mention JSON, prompt, model, or AI.",
    "If an upstream signal is absent, say less instead of inventing.",
    "The reading must stay faithful to this order: source2.routing -> source2.refinement -> source2.evidence -> source2.supportingPackets.",
    "Write the reasoning in a sinsae flow such as: คุณเป็นคน... / พอมาเจอ... / จึงทำให้...",
    "Return exactly 3 or 4 bridge_blocks so the explanation is already expanded before any formatter sees it.",
    "Each bridge block must include title, signal, explanation, and personality_impact.",
    "Write supporting_signals as Thai evidence lines, not enum-style fragments.",
    "Never write terms like missing: metal, dominant: water, payload, schema, JSON, model, AI, or Day Master.",
    "Use routing as the only lane that can speak in definite personality language.",
    "Use refinement and evidence only as tendency, texture, caution, or context.",
    "Do not turn side warnings into identity labels.",
    "",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
    "",
    "Curated Source 2 personality payload:",
    JSON.stringify(buildPromptPayload(focusPayload), null, 2),
    "",
    "Lane guardrails:",
    ...buildLaneGuardrailLines(focusPayload),
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
  const elementBalance = getElementBalance(focusPayload);

  return [
    `- วันเกิด: ${rawInput.birthDate} เวลา ${rawInput.birthTime} ${formatThaiGender(rawInput.gender)}`,
    `- สถานที่: ${formatThaiProvince(rawInput.province)}`,
    `- ดิถี: ${strengthProfile?.dayMaster ?? "ไม่ทราบ"}`,
    `- กำลังดิถี: ${strengthProfile?.displayLabel ?? strengthProfile?.strengthState ?? "ไม่ทราบ"}`,
    `- 60 กะจื่อ: ${sixtyJiazi?.code ?? "ไม่ทราบ"}`,
    `- ธาตุเด่น: ${formatElementList(elementBalance?.dominantElements ?? [])}`,
    `- ธาตุขาด: ${formatElementList(elementBalance?.missingElements ?? [])}`,
  ];
}

function buildSignalLines(focusPayload: PersonalityFocusPayload) {
  const strengthProfile = focusPayload.dayMasterStrengthProfile;
  const sixtyJiazi = focusPayload.sixtyJiaziCorePersona;
  const elementBalance = getElementBalance(focusPayload);
  const seasonalInteraction = getSeasonalInteraction(focusPayload);
  const twelveQiTexture = getTwelveQiTextureDisplay(focusPayload);
  const strongestElements = (elementBalance?.elementStrengths ?? [])
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
    `- Source 2 routing (แกนนิสัยหลัก): ${formatOverlayAdviceText(focusPayload.source2Overlay.routing.narrative.text, strengthProfile?.narrative)}`,
    `- Source 2 refinement (สีบุคลิกย่อย): ${formatOverlayAdviceText(focusPayload.source2Overlay.refinement.dayPillarAdvice.text, sixtyJiazi?.narrative)}`,
    `- น้ำหนักธาตุรวม: ธาตุเด่นคือ ${formatElementList(elementBalance?.dominantElements ?? [])}; ธาตุขาดคือ ${formatElementList(elementBalance?.missingElements ?? [])}`,
    `- ธาตุที่พยุงภาพนิสัย: ${strongestElements.length > 0 ? strongestElements.join(", ") : "ยังไม่มีตัวเด่นชัด"}`,
    ...(seasonalInteraction
      ? [`- บริบทฤดูกาล: ${seasonalInteraction.seasonLabel} — ${seasonalInteraction.metaphor}`]
      : ["- บริบทฤดูกาล: เคสนี้ไม่มีตัวแต้มฤดูกาลเพิ่มเติม จึงยืนบนแกน Source 2 routing เป็นหลัก"]),
    `- หลักฐาน 12 ชี่ (ใช้เป็นบริบทเสริม): ${formatOverlayAdviceText(focusPayload.evidence.twelveQi.advice.text, twelveQiTexture?.dayBranch ?? focusPayload.evidence.twelveQi.toneLabel)}`,
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

function buildDownstreamReadinessLines() {
  return [
    `- ${SOURCE2_DOWNSTREAM_READINESS.nextOverlay} ใช้ Source 2 routing เป็นแกนนิสัยหลักได้แล้ว`,
    "- Source 2 refinement ใช้เป็นสีอารมณ์และบุคลิกย่อยได้เมื่อยังยืนบน routing เดิม",
    "- Source 2 evidence และ supporting packets ใช้เป็นบริบทเสริมได้ แต่ห้ามแทนตัวตนหลัก",
    `- ขอบเขต local ของ Source 2: ${SOURCE2_DOWNSTREAM_READINESS.source2LocalOnly.join(", ")}`,
    `- Guardrails: ${SOURCE2_DOWNSTREAM_READINESS.guardrails.join(" | ")}`,
  ];
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
    "- Source 2 routing -> Source 2 refinement -> Source 2 evidence -> supporting packets",
    "",
    "สัญญาณที่ใช้ในการอ่าน",
    ...buildSignalLines(options.focusPayload),
    "",
    "ความพร้อมส่งต่อ",
    ...buildDownstreamReadinessLines(),
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
  repository?: Source2PersonalityOverlayRepository;
}) {
  const apiKey = options.apiKey ?? getGeminiApiKey();
  const model = options.model?.trim() || DEFAULT_PERSONALITY_POC_MODEL;
  const ai = new GoogleGenAI({ apiKey });
  const focusPayload = await buildPersonalityFocusPayloadFromCalculatedState({
    rawInput: options.rawInput,
    calculatedState: options.calculatedState,
    repository: options.repository,
  });
  const prompt = buildPersonalityPocUserPrompt(options.rawInput, focusPayload);
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
    focusPayload,
    response: parsed,
    annotationData: buildDraftAnnotationDataFromPersonality(parsed),
  };
}

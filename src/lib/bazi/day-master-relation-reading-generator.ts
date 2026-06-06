import { z } from "zod";

import {
  type DayMasterRelationBrief,
} from "@/lib/bazi/day-master-relation-reading-interpretation";
import {
  type RawInputValue,
} from "@/lib/bazi/schema-types";

export const DEFAULT_DAY_MASTER_RELATION_POC_MODEL = "gemini-3-flash-preview";

const FORBIDDEN_READING_TERMS = [
  "payload",
  "schema",
  "json",
  "model",
  "ai",
  "enum",
  "debug",
  "assistant",
  "analysis",
  "ครับ",
  "ค่ะ",
] as const;
const ENGLISH_SCENE_KEY_PATTERN = /[A-Za-z_]/;
const READING_STEP_ORDER = [1, 2, 3, 4, 5, 6] as const;

const StepReadingSchema = z.object({
  step_number: z.number().int().min(1).max(6),
  heading_thai: z.string().trim().min(1),
  teacher_reading: z.string().trim().min(1),
  life_meaning: z.string().trim().min(1),
  caution: z.string().trim().min(1),
  evidence_refs: z.array(z.string().trim().min(1)).min(1),
});

export const RelationReadingResponseSchema = z.object({
  openingSummary: z.string().trim().min(1),
  step_readings: z.array(StepReadingSchema).length(6),
  closing_reading: z.string().trim().min(1),
}).superRefine((response, context) => {
  const fields = [
    response.openingSummary,
    response.closing_reading,
    ...response.step_readings.flatMap((step) => [
      step.heading_thai,
      step.teacher_reading,
      step.life_meaning,
      step.caution,
      ...step.evidence_refs,
    ]),
  ];

  for (const field of fields) {
    const normalized = field.toLowerCase();
    for (const forbiddenTerm of FORBIDDEN_READING_TERMS) {
      if (normalized.includes(forbiddenTerm)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Forbidden reading term detected: ${forbiddenTerm}`,
        });
      }
    }
  }

  const seenStepNumbers = new Set<number>();
  response.step_readings.forEach((step, index) => {
    if (ENGLISH_SCENE_KEY_PATTERN.test(step.heading_thai)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["step_readings", index, "heading_thai"],
        message: "Step heading must stay Thai-only on the visible surface.",
      });
    }

    if (seenStepNumbers.has(step.step_number)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["step_readings", index, "step_number"],
        message: "Each reading step must appear exactly once.",
      });
    }
    seenStepNumbers.add(step.step_number);
  });

  for (const requiredStep of READING_STEP_ORDER) {
    if (!seenStepNumbers.has(requiredStep)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Missing required reading step: ${requiredStep}`,
      });
    }
  }
});

export const RELATION_READING_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    openingSummary: { type: "string" },
    step_readings: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          step_number: { type: "integer" },
          heading_thai: { type: "string" },
          teacher_reading: { type: "string" },
          life_meaning: { type: "string" },
          caution: { type: "string" },
          evidence_refs: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
        required: ["step_number", "heading_thai", "teacher_reading", "life_meaning", "caution", "evidence_refs"],
      },
    },
    closing_reading: { type: "string" },
  },
  required: ["openingSummary", "step_readings", "closing_reading"],
} as const;

export type RelationReadingResponse = z.infer<typeof RelationReadingResponseSchema>;

export function buildDayMasterRelationPocSystemInstruction() {
  return [
    "You are a senior Thai Bazi master writing a six-step reading from a deterministic brief.",
    "Write every visible field in Thai.",
    "You must never invent or recalculate facts beyond the brief.",
    "Respect this exact six-step order only: step 1 balance/core, step 2 day pillar identity, step 3 standard energies/actions, step 4 result and wealth, step 5 context mapping, step 6 advanced analytics.",
    "Each step_reading must contain one Thai heading, one teacher_reading, one life_meaning line, one caution line, and evidence_refs that exist in the brief.",
    "Use school wording first, then plain Thai explanation second.",
    "Keep visible headings Thai-only. Never use English words, transliteration, snake_case, or section codes.",
    "If evidence is thin, say less instead of inventing.",
    "Do not mention JSON, schema, payload, model, AI, enum, debug language, or generic assistant framing.",
    "Do not use polite particles such as ครับ or ค่ะ.",
    "Return JSON only.",
  ].join(" ");
}

export function buildDayMasterRelationPocUserPrompt(rawInput: RawInputValue, brief: DayMasterRelationBrief) {
  return [
    "Create one Thai Bazi reading from the deterministic brief below.",
    "Keep the opening and closing concise, but make each of the 6 steps read like a real sinsae teaching through the chart.",
    "Do not break the Step 1-6 order.",
    "Do not leak English scene identifiers, snake_case labels, or generic assistant wording onto the visible surface.",
    "Do not invent health, timing, marriage, or money claims unless the brief directly supports them.",
    "evidence_refs must reuse only the ids already present in the brief.",
    "Return exactly the JSON shape requested by the system instruction.",
    "",
    "Raw input:",
    JSON.stringify(rawInput, null, 2),
    "",
    "Stepwise reading brief:",
    JSON.stringify(brief, null, 2),
  ].join("\n");
}

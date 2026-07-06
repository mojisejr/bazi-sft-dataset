// Unified triage (Phase 1 of #bazi-chat-enhance): ONE Gemini call that replaces the old
// two-call flow (intent-router + bazi-extractor). It classifies the user's latest message into
// one of the 15 canonical reading topics (NL routing, not just a chip) OR off_topic / chit_chat,
// detects the asked timeframe (today..in_n_years..period), and extracts the four birth fields —
// all in a single schema-constrained response. Downstream consumers keep their existing contracts
// via the derived `classification` (coarse 5-domain intent for the truth-packet fallback) and
// `extraction` (birth fields + completeness) carried on the result.
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import { RawInputSchema, type RawInputValue } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_TRIAGE_MODEL = "gemini-3.1-flash-lite";

// ───────────────────────────── Topic + timeframe vocab (engine-synced) ─────────────────────────
// The 15 routable reading topics come straight from the engine's TOPIC_PATH (kind === "predict"),
// so this list can never drift from the reading engine.
export const TRIAGE_TOPIC_IDS: readonly string[] = TOPIC_PATH
  .filter((topic) => topic.kind === "predict")
  .map((topic) => topic.id);

export const TRIAGE_ROUTE_VALUES: readonly string[] = [
  ...TRIAGE_TOPIC_IDS,
  "off_topic",
  "chit_chat",
];

export type TriageRoute = string;

export const TRIAGE_TIMEFRAMES = [
  "today",
  "tomorrow",
  "this_month",
  "this_year",
  "next_year",
  "in_n_years",
  "period",
  "none",
] as const;

export type TriageTimeframe = (typeof TRIAGE_TIMEFRAMES)[number];

// Coarse 5-domain intent retained ONLY for the deterministic truth-packet fallback, which slices
// the chart by domain. The primary answer always comes from the grounded reading, not this.
export type OpenWebUiTruthPacketDomain =
  | "wealth"
  | "love"
  | "career"
  | "health"
  | "general_reading"
  | "chit_chat";

// Back-compat alias: the truth-packet still types its input as a {intent,...} classification.
export type OpenWebUiIntentClassification = {
  intent: OpenWebUiTruthPacketDomain;
  requiresBaziConsult: boolean;
  confidence: number;
};

// Collapse a fine topicId to the coarse domain the fallback truth-packet understands.
const TOPIC_TO_DOMAIN: Record<string, OpenWebUiTruthPacketDomain> = {
  wealth_and_investment: "wealth",
  partnership: "wealth",
  subordinates: "wealth",
  love_partner: "love",
  family: "love",
  career_potential: "career",
  talent: "career",
  education: "career",
  benefactor: "career",
  friends_foes: "career",
  health: "health",
  chart_foundation: "general_reading",
  turning_points: "general_reading",
  colors_directions: "general_reading",
  guardian_deities: "general_reading",
};

export function topicIdToDomain(topicId: TriageRoute): OpenWebUiTruthPacketDomain {
  return TOPIC_TO_DOMAIN[topicId] ?? "general_reading";
}

// ───────────────────────────── Birth extraction shape (folded from bazi-extractor) ─────────────
export type BaziExtractionFieldKey = "birthDate" | "birthTime" | "gender" | "province";

const BAZI_EXTRACTION_FIELD_KEYS: readonly BaziExtractionFieldKey[] = [
  "birthDate",
  "birthTime",
  "gender",
  "province",
];

export type OpenWebUiBaziExtraction = {
  fields: {
    birthDate: string | null;
    birthTime: string | null;
    gender: string | null;
    province: string | null;
  };
  missingFields: BaziExtractionFieldKey[];
  isComplete: boolean;
  rawInput: RawInputValue | null;
};

// ───────────────────────────── Unified triage result ───────────────────────────────────────────
export type OpenWebUiTriageResult = {
  /** One of the 15 reading topic ids, or "off_topic" / "chit_chat". */
  topicId: TriageRoute;
  requiresBaziConsult: boolean;
  timeframe: TriageTimeframe;
  confidence: number;
  extraction: OpenWebUiBaziExtraction;
  /** Coarse-domain classification for downstream back-compat (truth-packet, adapter). */
  classification: OpenWebUiIntentClassification;
  /** โทเคน+โมเดลของการเรียก triage — ไว้ log ต้นทุน (route เป็นผู้บันทึก) */
  usage?: { model: string; inTokens: number; outTokens: number };
};

// ───────────────────────────── Zod / JSON schema for the single call ────────────────────────────
const nullableTrimmedString = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  });

const OpenWebUiTriageDraftSchema = z.object({
  topicId: z.enum(TRIAGE_ROUTE_VALUES as [string, ...string[]]),
  requiresBaziConsult: z.boolean(),
  timeframe: z.enum(TRIAGE_TIMEFRAMES),
  confidence: z.number().min(0).max(1),
  birthDate: nullableTrimmedString,
  birthTime: nullableTrimmedString,
  gender: nullableTrimmedString,
  province: nullableTrimmedString,
});

type OpenWebUiTriageDraft = z.infer<typeof OpenWebUiTriageDraftSchema>;

const OPEN_WEBUI_TRIAGE_JSON_SCHEMA = {
  type: "object",
  required: [
    "topicId",
    "requiresBaziConsult",
    "timeframe",
    "confidence",
    "birthDate",
    "birthTime",
    "gender",
    "province",
  ],
  additionalProperties: false,
  properties: {
    topicId: { type: "string", enum: [...TRIAGE_ROUTE_VALUES] },
    requiresBaziConsult: { type: "boolean" },
    timeframe: { type: "string", enum: [...TRIAGE_TIMEFRAMES] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    birthDate: { type: ["string", "null"] },
    birthTime: { type: ["string", "null"] },
    gender: { type: ["string", "null"] },
    province: { type: ["string", "null"] },
  },
} as const;

type OpenWebUiTriageConfig = {
  apiKey: string;
  model: string;
};

type OpenWebUiTriagePromptPayload = {
  systemInstruction: string;
  userPrompt: string;
};

type GeminiTriageGenerateContentRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
    responseMimeType: "application/json";
    responseJsonSchema: typeof OPEN_WEBUI_TRIAGE_JSON_SCHEMA;
    seed: number;
  };
};

type GeminiTriageGenerateContentResponse = {
  text?: string | null;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
};

export type GeminiTriageGenerateContent = (
  request: GeminiTriageGenerateContentRequest,
) => Promise<GeminiTriageGenerateContentResponse>;

export class OpenWebUiTriageError extends Error {
  constructor(
    readonly code:
      | "triage_config_error"
      | "triage_upstream_error"
      | "triage_empty_response"
      | "triage_invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "OpenWebUiTriageError";
  }
}

function formatTriageLine(message: NormalizedChatMessage) {
  const label = message.role === "assistant" ? "Assistant" : "User";

  return `${label}: ${message.content}`;
}

function buildStableSeed(messages: readonly NormalizedChatMessage[]) {
  const source = messages.map((message) => `${message.role}:${message.content}`).join("\n");
  let hash = 0;

  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;
  }

  return hash || 17;
}

// Compact topic catalog the classifier routes against. Kept terse to protect the token budget.
const TOPIC_CATALOG_LINES = [
  "chart_foundation = นิสัย/ตัวตน/พื้นฐานดวง/การสื่อสาร (และคำขอดูดวงรวมแบบกว้างไม่เจาะหัวข้อ)",
  "career_potential = อาชีพ/ธุรกิจที่ควรทำ/ความก้าวหน้างาน/เจ้านาย-หัวหน้า/ตำแหน่ง",
  "wealth_and_investment = การเงิน/โชคลาภ/รายได้/ลงทุน/ลูกค้า/การขาย/ยอดขาย",
  "benefactor = ผู้อุปถัมภ์/คนช่วยเหลือ/ผู้ใหญ่หนุน/ครูบาอาจารย์",
  "talent = พรสวรรค์/ความถนัด/จุดเด่นของตัวเอง",
  "family = ครอบครัว/พ่อแม่/ญาติ/ลูก",
  "love_partner = ความรัก/คู่ครอง/แฟน/แต่งงาน/เนื้อคู่",
  "friends_foes = เพื่อน/ศัตรู/คนรอบข้าง/มิตร-คู่แข่ง",
  "partnership = หุ้นส่วน/ร่วมทุน/ทำธุรกิจร่วมกัน",
  "subordinates = ลูกน้อง/บริวาร/ทีมงาน",
  "education = การเรียน/การศึกษา/สายที่ควรเรียน",
  "turning_points = ช่วงเวลา/ปีจร/วัยจร/ช่วงดี-ช่วงต้องระวัง/อนาคต/ดวงปีนี้-ปีหน้า",
  "health = สุขภาพ/โรค/การดูแลร่างกาย",
  "colors_directions = สีมงคล/ทิศมงคล/สีเสื้อ/สีรถ/สีกระเป๋า",
  "guardian_deities = องค์เทพ/สิ่งศักดิ์สิทธิ์ที่คุ้มครอง/ไหว้อะไรดี",
];

export function buildOpenWebUiTriagePromptPayload(
  input: Pick<ChatRunnerSuccess, "triageMessages" | "latestUserMessage">,
): OpenWebUiTriagePromptPayload {
  const triageTranscript = input.triageMessages
    .filter((message) => message.role !== "system")
    .map(formatTriageLine)
    .join("\n\n");

  return {
    systemInstruction: [
      "You triage the user's latest message for a Thai Bazi (ปาจื่อ) fortune assistant.",
      "Return ONLY JSON matching the provided schema. Every field must be present.",
      "",
      "## topicId — route the question to ONE reading topic, or refuse/smalltalk:",
      ...TOPIC_CATALOG_LINES,
      "off_topic = คำถามที่ไม่เกี่ยวกับการดูดวงปาจื่อเลย (เช่น เขียนโค้ด, ข่าว, ความรู้ทั่วไป, คำนวณเลข, แปลภาษา) — ตั้ง requiresBaziConsult=false.",
      "chit_chat = ทักทาย/คุยเล่น/ขอบคุณ/ถามว่าคุยอะไรได้บ้าง — ตั้ง requiresBaziConsult=false.",
      "Routing hints: ลูกค้า/การขาย→wealth_and_investment; เจ้านาย/หัวหน้า→career_potential; สีเสื้อ/สีรถ/สีมงคล→colors_directions; อนาคต/ปีนี้/ปีหน้า/ช่วงนี้→turning_points.",
      "requiresBaziConsult=true for any of the 15 reading topics; false only for off_topic/chit_chat.",
      "",
      "## timeframe — when is the user asking about:",
      "today=วันนี้, tomorrow=พรุ่งนี้, this_month=เดือนนี้, this_year=ปีนี้, next_year=ปีหน้า, in_n_years=อีกหลายปี/ปีเฉพาะข้างหน้า, period=ช่วงวัย/วัยจร/ช่วงนี้แบบกว้าง, none=ไม่ระบุเวลา.",
      "",
      "## birth fields — extract ONLY what the user explicitly stated; never guess:",
      "If a field is not stated, set it null.",
      "Normalize birthDate to ISO YYYY-MM-DD (Buddhist year พ.ศ. → Gregorian by subtracting 543).",
      "Normalize birthTime to 24-hour HH:mm.",
      "gender = the user's stated gender exactly (e.g. 'ชาย','หญิง','male','female').",
      "province = Thai province as written; do not append 'จังหวัด'.",
      "",
      "confidence = your certainty (0..1) in the topicId routing.",
    ].join("\n"),
    userPrompt: [
      "Triage the latest user message using this short transcript for context.",
      triageTranscript,
      `Latest user message: ${input.latestUserMessage.content}`,
    ].join("\n\n"),
  };
}

export function getOpenWebUiTriageConfig(
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): OpenWebUiTriageConfig {
  let apiKey: string;

  try {
    apiKey = getGeminiApiKey(raw);
  } catch (error) {
    throw new OpenWebUiTriageError(
      "triage_config_error",
      error instanceof Error ? error.message : "GEMINI_API_KEY is required for the Open WebUI triage.",
    );
  }

  const model = raw.OPEN_WEBUI_TRIAGE_MODEL?.trim() || DEFAULT_OPEN_WEBUI_TRIAGE_MODEL;

  if (!model) {
    throw new OpenWebUiTriageError(
      "triage_config_error",
      "OPEN_WEBUI_TRIAGE_MODEL must be a non-empty string when provided.",
    );
  }

  return { apiKey, model };
}

function createTriageGenerateContent(config: OpenWebUiTriageConfig): GeminiTriageGenerateContent {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return async (request) => ai.models.generateContent(request);
}

function mergeBirthFields(
  draft: OpenWebUiTriageDraft,
  existing?: Partial<OpenWebUiBaziExtraction["fields"]>,
): OpenWebUiBaziExtraction["fields"] {
  const pick = (key: BaziExtractionFieldKey) => {
    const drafted = draft[key];

    if (drafted !== null) {
      return drafted;
    }

    const existingValue = existing?.[key];

    if (typeof existingValue === "string") {
      const trimmed = existingValue.trim();

      return trimmed.length === 0 ? null : trimmed;
    }

    return null;
  };

  return {
    birthDate: pick("birthDate"),
    birthTime: pick("birthTime"),
    gender: pick("gender"),
    province: pick("province"),
  };
}

export function buildBaziExtractionResult(
  fields: OpenWebUiBaziExtraction["fields"],
): OpenWebUiBaziExtraction {
  const missingFields = BAZI_EXTRACTION_FIELD_KEYS.filter((key) => fields[key] === null);
  const isComplete = missingFields.length === 0;
  let rawInput: RawInputValue | null = null;

  if (isComplete) {
    rawInput = RawInputSchema.parse({
      birthDate: fields.birthDate,
      birthTime: fields.birthTime,
      gender: fields.gender,
      province: fields.province,
    });
  }

  return { fields, missingFields, isComplete, rawInput };
}

// Normalize the raw model draft into the coherent unified result (consult flag follows topicId).
export function normalizeTriageDraft(
  draft: OpenWebUiTriageDraft,
  existing?: Partial<OpenWebUiBaziExtraction["fields"]>,
): OpenWebUiTriageResult {
  const isReadingTopic = draft.topicId !== "off_topic" && draft.topicId !== "chit_chat";
  const requiresBaziConsult = isReadingTopic && draft.requiresBaziConsult !== false;
  const extraction = buildBaziExtractionResult(mergeBirthFields(draft, existing));
  const domain: OpenWebUiTruthPacketDomain = isReadingTopic
    ? topicIdToDomain(draft.topicId)
    : "chit_chat";

  return {
    topicId: draft.topicId,
    requiresBaziConsult,
    timeframe: draft.timeframe,
    confidence: draft.confidence,
    extraction,
    classification: {
      intent: domain,
      requiresBaziConsult,
      confidence: draft.confidence,
    },
  };
}

export async function runOpenWebUiTriage(
  input: Pick<ChatRunnerSuccess, "triageMessages" | "latestUserMessage">,
  options: {
    env?: Partial<NodeJS.ProcessEnv>;
    generateContent?: GeminiTriageGenerateContent;
    existing?: Partial<OpenWebUiBaziExtraction["fields"]>;
  } = {},
): Promise<OpenWebUiTriageResult> {
  const config = getOpenWebUiTriageConfig(options.env);
  const promptPayload = buildOpenWebUiTriagePromptPayload(input);
  const generateContent = options.generateContent ?? createTriageGenerateContent(config);

  let draft: OpenWebUiTriageDraft;
  let usage: OpenWebUiTriageResult["usage"];

  try {
    const response = await generateContent({
      model: config.model,
      contents: promptPayload.userPrompt,
      config: {
        systemInstruction: promptPayload.systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: OPEN_WEBUI_TRIAGE_JSON_SCHEMA,
        seed: buildStableSeed(input.triageMessages),
      },
    });

    const u = response.usageMetadata;
    usage = {
      model: config.model,
      inTokens: u?.promptTokenCount ?? 0,
      outTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
    };

    const responseText = response.text?.trim();

    if (!responseText) {
      throw new OpenWebUiTriageError(
        "triage_empty_response",
        "Gemini returned an empty triage response for Open WebUI chat.",
      );
    }

    draft = OpenWebUiTriageDraftSchema.parse(JSON.parse(responseText) as unknown);
  } catch (error) {
    if (error instanceof OpenWebUiTriageError) {
      throw error;
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new OpenWebUiTriageError("triage_invalid_response", error.message);
    }

    throw new OpenWebUiTriageError(
      "triage_upstream_error",
      error instanceof Error ? error.message : "Gemini request failed for Open WebUI triage.",
    );
  }

  return { ...normalizeTriageDraft(draft, options.existing), usage };
}

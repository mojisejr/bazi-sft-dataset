import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import { RawInputSchema, type RawInputValue } from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_BAZI_EXTRACTOR_MODEL = "gemini-3.1-flash-lite";

const OPEN_WEBUI_BAZI_EXTRACTOR_JSON_SCHEMA = {
  type: "object",
  required: ["birthDate", "birthTime", "gender", "province"],
  additionalProperties: false,
  properties: {
    birthDate: {
      type: ["string", "null"],
    },
    birthTime: {
      type: ["string", "null"],
    },
    gender: {
      type: ["string", "null"],
    },
    province: {
      type: ["string", "null"],
    },
  },
} as const;

const nullableTrimmedString = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  });

export const BaziExtractionDraftSchema = z.object({
  birthDate: nullableTrimmedString,
  birthTime: nullableTrimmedString,
  gender: nullableTrimmedString,
  province: nullableTrimmedString,
});

export type BaziExtractionDraft = z.infer<typeof BaziExtractionDraftSchema>;

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

type OpenWebUiBaziExtractorConfig = {
  apiKey: string;
  model: string;
};

type OpenWebUiBaziExtractorPromptPayload = {
  systemInstruction: string;
  userPrompt: string;
};

type GeminiBaziExtractorGenerateContentRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
    responseMimeType: "application/json";
    responseJsonSchema: typeof OPEN_WEBUI_BAZI_EXTRACTOR_JSON_SCHEMA;
    seed: number;
  };
};

type GeminiBaziExtractorGenerateContentResponse = {
  text?: string | null;
};

export type GeminiBaziExtractorGenerateContent = (
  request: GeminiBaziExtractorGenerateContentRequest,
) => Promise<GeminiBaziExtractorGenerateContentResponse>;

export class OpenWebUiBaziExtractorError extends Error {
  constructor(
    readonly code:
      | "bazi_extractor_config_error"
      | "bazi_extractor_upstream_error"
      | "bazi_extractor_empty_response"
      | "bazi_extractor_invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "OpenWebUiBaziExtractorError";
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

export function getOpenWebUiBaziExtractorConfig(
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): OpenWebUiBaziExtractorConfig {
  let apiKey: string;

  try {
    apiKey = getGeminiApiKey(raw);
  } catch (error) {
    throw new OpenWebUiBaziExtractorError(
      "bazi_extractor_config_error",
      error instanceof Error
        ? error.message
        : "GEMINI_API_KEY is required for the Open WebUI Bazi extractor.",
    );
  }

  const model = raw.OPEN_WEBUI_BAZI_EXTRACTOR_MODEL?.trim() || DEFAULT_OPEN_WEBUI_BAZI_EXTRACTOR_MODEL;

  if (!model) {
    throw new OpenWebUiBaziExtractorError(
      "bazi_extractor_config_error",
      "OPEN_WEBUI_BAZI_EXTRACTOR_MODEL must be a non-empty string when provided.",
    );
  }

  return { apiKey, model };
}

export function buildOpenWebUiBaziExtractorPromptPayload(
  input: Pick<ChatRunnerSuccess, "triageMessages" | "latestUserMessage">,
): OpenWebUiBaziExtractorPromptPayload {
  const triageTranscript = input.triageMessages
    .filter((message) => message.role !== "system")
    .map(formatTriageLine)
    .join("\n\n");

  return {
    systemInstruction: [
      "You extract Bazi birth context from a short chat transcript between a user and a Thai astrology assistant.",
      "Return ONLY JSON that matches the provided schema. Every field must be present.",
      "If a field is not explicitly stated by the user, set it to null. Never guess, infer, or invent values.",
      "Accept Thai or English input.",
      "Normalize birthDate to ISO format YYYY-MM-DD when the user gives a real calendar date (Buddhist year พ.ศ. must be converted to Gregorian by subtracting 543).",
      "Normalize birthTime to 24-hour HH:mm format when the user gives a real clock time.",
      "gender should be the user's stated gender exactly as given (e.g. 'ชาย', 'หญิง', 'male', 'female').",
      "province should be the Thai province name as the user wrote it (or romanized if the user wrote it that way). Do not append the word 'จังหวัด'.",
    ].join(" "),
    userPrompt: [
      "Extract the user's Bazi birth context from this transcript.",
      triageTranscript,
      `Latest user message: ${input.latestUserMessage.content}`,
    ].join("\n\n"),
  };
}

function createBaziExtractorGenerateContent(
  config: OpenWebUiBaziExtractorConfig,
): GeminiBaziExtractorGenerateContent {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return async (request) => ai.models.generateContent(request);
}

function mergeExtraction(
  extracted: BaziExtractionDraft,
  existing?: Partial<OpenWebUiBaziExtraction["fields"]>,
): OpenWebUiBaziExtraction["fields"] {
  const merge = (key: BaziExtractionFieldKey) => {
    const extractedValue = extracted[key];

    if (extractedValue !== null) {
      return extractedValue;
    }

    const existingValue = existing?.[key];

    if (typeof existingValue === "string") {
      const trimmed = existingValue.trim();

      return trimmed.length === 0 ? null : trimmed;
    }

    return null;
  };

  return {
    birthDate: merge("birthDate"),
    birthTime: merge("birthTime"),
    gender: merge("gender"),
    province: merge("province"),
  };
}

function buildExtractionResult(
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

  return {
    fields,
    missingFields,
    isComplete,
    rawInput,
  };
}

export async function extractOpenWebUiBaziContext(
  input: Pick<ChatRunnerSuccess, "triageMessages" | "latestUserMessage">,
  options: {
    env?: Partial<NodeJS.ProcessEnv>;
    generateContent?: GeminiBaziExtractorGenerateContent;
    existing?: Partial<OpenWebUiBaziExtraction["fields"]>;
  } = {},
): Promise<OpenWebUiBaziExtraction> {
  const config = getOpenWebUiBaziExtractorConfig(options.env);
  const promptPayload = buildOpenWebUiBaziExtractorPromptPayload(input);
  const generateContent = options.generateContent ?? createBaziExtractorGenerateContent(config);

  let extracted: BaziExtractionDraft;

  try {
    const response = await generateContent({
      model: config.model,
      contents: promptPayload.userPrompt,
      config: {
        systemInstruction: promptPayload.systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: OPEN_WEBUI_BAZI_EXTRACTOR_JSON_SCHEMA,
        seed: buildStableSeed(input.triageMessages),
      },
    });

    const responseText = response.text?.trim();

    if (!responseText) {
      throw new OpenWebUiBaziExtractorError(
        "bazi_extractor_empty_response",
        "Gemini returned an empty Bazi extractor response for Open WebUI chat.",
      );
    }

    extracted = BaziExtractionDraftSchema.parse(JSON.parse(responseText) as unknown);
  } catch (error) {
    if (error instanceof OpenWebUiBaziExtractorError) {
      throw error;
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new OpenWebUiBaziExtractorError(
        "bazi_extractor_invalid_response",
        error.message,
      );
    }

    throw new OpenWebUiBaziExtractorError(
      "bazi_extractor_upstream_error",
      error instanceof Error ? error.message : "Gemini request failed for Open WebUI Bazi extraction.",
    );
  }

  const mergedFields = mergeExtraction(extracted, options.existing);

  return buildExtractionResult(mergedFields);
}

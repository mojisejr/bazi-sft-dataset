import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_INTENT_MODEL = "gemini-3.1-flash-lite";

const OPEN_WEBUI_INTENT_JSON_SCHEMA = {
  type: "object",
  required: ["intent", "requiresBaziConsult", "confidence"],
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ["wealth", "love", "career", "health", "general_reading", "chit_chat"],
    },
    requiresBaziConsult: {
      type: "boolean",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
  },
} as const;

const OpenWebUiIntentSchema = z.object({
  intent: z.enum(["wealth", "love", "career", "health", "general_reading", "chit_chat"]),
  requiresBaziConsult: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type OpenWebUiIntentClassification = z.infer<typeof OpenWebUiIntentSchema>;

type OpenWebUiIntentRouterConfig = {
  apiKey: string;
  model: string;
};

type OpenWebUiIntentPromptPayload = {
  systemInstruction: string;
  userPrompt: string;
};

type GeminiIntentGenerateContentRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
    responseMimeType: "application/json";
    responseJsonSchema: typeof OPEN_WEBUI_INTENT_JSON_SCHEMA;
    seed: number;
  };
};

type GeminiIntentGenerateContentResponse = {
  text?: string | null;
};

export type GeminiIntentGenerateContent = (
  request: GeminiIntentGenerateContentRequest,
) => Promise<GeminiIntentGenerateContentResponse>;

export class OpenWebUiIntentRouterError extends Error {
  constructor(
    readonly code:
      | "intent_router_config_error"
      | "intent_router_upstream_error"
      | "intent_router_empty_response"
      | "intent_router_invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "OpenWebUiIntentRouterError";
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

export function getOpenWebUiIntentRouterConfig(
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): OpenWebUiIntentRouterConfig {
  let apiKey: string;

  try {
    apiKey = getGeminiApiKey(raw);
  } catch (error) {
    throw new OpenWebUiIntentRouterError(
      "intent_router_config_error",
      error instanceof Error ? error.message : "GEMINI_API_KEY is required for the Open WebUI intent router.",
    );
  }

  const model = raw.OPEN_WEBUI_INTENT_MODEL?.trim() || DEFAULT_OPEN_WEBUI_INTENT_MODEL;

  if (!model) {
    throw new OpenWebUiIntentRouterError(
      "intent_router_config_error",
      "OPEN_WEBUI_INTENT_MODEL must be a non-empty string when provided.",
    );
  }

  return { apiKey, model };
}

export function buildOpenWebUiIntentPromptPayload(
  input: Pick<ChatRunnerSuccess, "triageMessages" | "latestUserMessage">,
): OpenWebUiIntentPromptPayload {
  const triageTranscript = input.triageMessages
    .filter((message) => message.role !== "system")
    .map(formatTriageLine)
    .join("\n\n");

  return {
    systemInstruction: [
      "You classify the user's latest chat intent for a Bazi assistant.",
      "Return only JSON that matches the provided schema.",
      "Set requiresBaziConsult to true only when the user is asking for a Bazi reading, forecast, or interpretation.",
      "Use chit_chat for greetings, small talk, tooling questions, or requests that do not need Bazi analysis.",
      "Use general_reading when the user wants a broad Bazi reading without a narrower topic.",
    ].join(" "),
    userPrompt: [
      "Classify the latest user intent from this short transcript.",
      triageTranscript,
      `Latest user message: ${input.latestUserMessage.content}`,
    ].join("\n\n"),
  };
}

function createIntentGenerateContent(config: OpenWebUiIntentRouterConfig): GeminiIntentGenerateContent {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return async (request) => ai.models.generateContent(request);
}

export async function routeOpenWebUiIntent(
  input: Pick<ChatRunnerSuccess, "triageMessages" | "latestUserMessage">,
  options: {
    env?: Partial<NodeJS.ProcessEnv>;
    generateContent?: GeminiIntentGenerateContent;
  } = {},
): Promise<OpenWebUiIntentClassification> {
  const config = getOpenWebUiIntentRouterConfig(options.env);
  const promptPayload = buildOpenWebUiIntentPromptPayload(input);
  const generateContent = options.generateContent ?? createIntentGenerateContent(config);

  try {
    const response = await generateContent({
      model: config.model,
      contents: promptPayload.userPrompt,
      config: {
        systemInstruction: promptPayload.systemInstruction,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: OPEN_WEBUI_INTENT_JSON_SCHEMA,
        seed: buildStableSeed(input.triageMessages),
      },
    });
    const responseText = response.text?.trim();

    if (!responseText) {
      throw new OpenWebUiIntentRouterError(
        "intent_router_empty_response",
        "Gemini returned an empty intent router response for Open WebUI chat.",
      );
    }

    return OpenWebUiIntentSchema.parse(JSON.parse(responseText) as unknown);
  } catch (error) {
    if (error instanceof OpenWebUiIntentRouterError) {
      throw error;
    }

    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new OpenWebUiIntentRouterError(
        "intent_router_invalid_response",
        error.message,
      );
    }

    throw new OpenWebUiIntentRouterError(
      "intent_router_upstream_error",
      error instanceof Error ? error.message : "Gemini request failed for Open WebUI intent routing.",
    );
  }
}
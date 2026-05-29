import { GoogleGenAI } from "@google/genai";

import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION = [
  "You are the Bazi assistant inside an Open WebUI-compatible chat route.",
  "Reply helpfully and directly to the user's latest message.",
].join(" ");

type GeminiGenerateContentRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
  };
};

type GeminiGenerateContentResponse = {
  text?: string | null;
};

export type GeminiGenerateContent = (
  request: GeminiGenerateContentRequest,
) => Promise<GeminiGenerateContentResponse>;

export type OpenWebUiGeminiPromptPayload = {
  systemInstruction: string;
  userPrompt: string;
};

export type OpenWebUiGeminiConfig = {
  apiKey: string;
  model: string;
};

export type OpenWebUiGeminiReply = {
  model: string;
  text: string;
};

export class OpenWebUiGeminiError extends Error {
  constructor(
    readonly code: "gemini_config_error" | "gemini_upstream_error" | "gemini_empty_response",
    message: string,
  ) {
    super(message);
    this.name = "OpenWebUiGeminiError";
  }
}

function formatConversationLine(message: NormalizedChatMessage) {
  const label = message.role === "assistant"
    ? "Assistant"
    : message.role === "system"
      ? "System"
      : "User";

  return `${label}: ${message.content}`;
}

export function getOpenWebUiGeminiConfig(
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): OpenWebUiGeminiConfig {
  let apiKey: string;

  try {
    apiKey = getGeminiApiKey(raw);
  } catch (error) {
    throw new OpenWebUiGeminiError(
      "gemini_config_error",
      error instanceof Error ? error.message : "GEMINI_API_KEY is required for Open WebUI Gemini access.",
    );
  }

  const model = raw.OPEN_WEBUI_GEMINI_MODEL?.trim() || DEFAULT_OPEN_WEBUI_GEMINI_MODEL;

  if (!model) {
    throw new OpenWebUiGeminiError(
      "gemini_config_error",
      "OPEN_WEBUI_GEMINI_MODEL must be a non-empty string when provided.",
    );
  }

  return { apiKey, model };
}

export function buildOpenWebUiGeminiPromptPayload(
  input: Pick<ChatRunnerSuccess, "normalizedMessages" | "triageMessages" | "latestUserMessage">,
): OpenWebUiGeminiPromptPayload {
  const systemMessages = input.normalizedMessages
    .filter((message) => message.role === "system")
    .map((message) => message.content);
  const conversationTranscript = input.normalizedMessages
    .filter((message) => message.role !== "system")
    .map(formatConversationLine)
    .join("\n\n");

  return {
    systemInstruction: systemMessages.join("\n\n") || DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION,
    userPrompt: [
      "Continue the conversation from this transcript.",
      conversationTranscript,
      `Latest user message: ${input.latestUserMessage.content}`,
      "Respond as the assistant.",
    ].join("\n\n"),
  };
}

function createGeminiGenerateContent(config: OpenWebUiGeminiConfig): GeminiGenerateContent {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return async (request) => ai.models.generateContent(request);
}

export async function generateGeminiAssistantReply(
  input: Pick<ChatRunnerSuccess, "normalizedMessages" | "triageMessages" | "latestUserMessage">,
  options: {
    env?: Partial<NodeJS.ProcessEnv>;
    generateContent?: GeminiGenerateContent;
  } = {},
): Promise<OpenWebUiGeminiReply> {
  const config = getOpenWebUiGeminiConfig(options.env);
  const promptPayload = buildOpenWebUiGeminiPromptPayload(input);
  const generateContent = options.generateContent ?? createGeminiGenerateContent(config);

  try {
    const response = await generateContent({
      model: config.model,
      contents: promptPayload.userPrompt,
      config: {
        systemInstruction: promptPayload.systemInstruction,
        temperature: 0.4,
      },
    });
    const text = response.text?.trim();

    if (!text) {
      throw new OpenWebUiGeminiError(
        "gemini_empty_response",
        "Gemini returned an empty assistant response for Open WebUI chat.",
      );
    }

    return {
      model: config.model,
      text,
    };
  } catch (error) {
    if (error instanceof OpenWebUiGeminiError) {
      throw error;
    }

    throw new OpenWebUiGeminiError(
      "gemini_upstream_error",
      error instanceof Error ? error.message : "Gemini request failed for Open WebUI chat.",
    );
  }
}
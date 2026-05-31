import { GoogleGenAI } from "@google/genai";

import { type BaziExtractionFieldKey } from "@/features/open-webui/bazi-extractor";
import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import { type OpenWebUiIntentClassification } from "@/features/open-webui/intent-router";
import { type RawInputValue } from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_GEMINI_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION = [
  "You are the Bazi assistant inside an Open WebUI-compatible chat route.",
  "Reply helpfully and directly to the user's latest message.",
].join(" ");

export const MUMATE_PERSONA_INSTRUCTION = [
  "คุณคือ \"มูเมท (mumate)\" ผู้เชี่ยวชาญปาจื่อ (Bazi).",
  "ห้ามมีอารัมภบทหรือเกริ่นนำ (เช่น \"จากข้อมูลที่ให้มา\") และห้ามลงท้ายแบบหุ่นยนต์ (เช่น \"หวังว่าจะเป็นประโยชน์\").",
  "ตอบสั้น ตรงประเด็น ฟันธง ไม่มีน้ำ.",
  "อธิบายด้วยอุปมาอุปไมยใกล้ตัว (ทำอาหาร, เปิดร้าน, กลจักร).",
  "คิดเป็นชั้น: 1) หาดิถีแข็ง/อ่อน 2) หาธาตุสนับสนุน 3) วินิจฉัยด้วย 12 เซิงแซ.",
  "ใช้คำลงท้ายผู้หญิง (ค่ะ/นะคะ) เป็นค่าเริ่มต้น.",
].join("\n");

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

export type OpenWebUiGeminiExecutionContext = {
  intentClassification?: OpenWebUiIntentClassification;
  baziConsult?: {
    rawInput: RawInputValue | null;
    truthPacket: string | null;
  } | null;
  baziMissingFields?: BaziExtractionFieldKey[];
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

function formatConsultBirthContext(rawInput: RawInputValue) {
  return [
    `- Birth date: ${rawInput.birthDate}`,
    `- Birth time: ${rawInput.birthTime}`,
    `- Gender: ${rawInput.gender}`,
    `- Province: ${rawInput.province}`,
    `- Calendar system: ${rawInput.calendarSystem ?? "solar"}`,
    `- Timezone: ${rawInput.timezone ?? "Asia/Bangkok"}`,
  ].join("\n");
}

function formatSystemClockLine(now: Date) {
  const formatted = now.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  });
  const isoDate = now.toISOString().slice(0, 10);

  return `[เวลาปัจจุบันของระบบ]: ${formatted} (ISO: ${isoDate})`;
}

export function buildOpenWebUiGeminiPromptPayload(
  input: Pick<ChatRunnerSuccess, "normalizedMessages" | "triageMessages" | "latestUserMessage"> & {
    executionContext?: OpenWebUiGeminiExecutionContext;
    now?: Date;
  },
): OpenWebUiGeminiPromptPayload {
  const now = input.now ?? new Date();
  const systemMessages = input.normalizedMessages
    .filter((message) => message.role === "system")
    .map((message) => message.content);
  const conversationTranscript = input.normalizedMessages
    .filter((message) => message.role !== "system")
    .map(formatConversationLine)
    .join("\n\n");
  const intentClassification = input.executionContext?.intentClassification;
  const baziConsult = input.executionContext?.baziConsult;
  const baziMissingFields = input.executionContext?.baziMissingFields ?? [];
  const consultMode = intentClassification?.requiresBaziConsult
    ? baziConsult?.truthPacket
      ? "bazi_consult"
      : "bazi_consult_pending_context"
    : intentClassification
      ? "non_bazi_bypass"
      : null;

  return {
    systemInstruction: [
      MUMATE_PERSONA_INSTRUCTION,
      systemMessages.join("\n\n") || DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION,
      baziMissingFields.length > 0
        ? `ผู้ใช้ยังไม่ได้บอก: ${baziMissingFields.join(", ")}. ขอข้อมูลนั้นเพิ่มอย่างสุภาพ และห้ามเดาคำพยากรณ์.`
        : null,
    ].filter((section): section is string => section !== null).join("\n\n"),
    userPrompt: [
      formatSystemClockLine(now),
      "Continue the conversation from this transcript.",
      conversationTranscript,
      intentClassification
        ? `Intent routing: intent=${intentClassification.intent}; requiresBaziConsult=${String(intentClassification.requiresBaziConsult)}; confidence=${intentClassification.confidence.toFixed(2)}.`
        : null,
      consultMode ? `Consult mode: ${consultMode}.` : null,
      intentClassification?.requiresBaziConsult && baziConsult?.truthPacket && baziConsult.rawInput
        ? [
          "Verified Bazi consult context:",
          formatConsultBirthContext(baziConsult.rawInput),
          "Truth packet:",
          baziConsult.truthPacket,
          "Use only this narrowed chart context for Bazi-specific claims. If more detail is needed, say what is missing instead of inventing it.",
        ].join("\n")
        : null,
      intentClassification?.requiresBaziConsult && !baziConsult?.truthPacket
        ? "No verified Bazi chart context is attached. Do not invent chart details; ask for the missing birth data or chart payload first."
        : null,
      intentClassification && !intentClassification.requiresBaziConsult
        ? "This request does not require Bazi chart analysis. Reply normally without claiming chart-specific insights."
        : null,
      `Latest user message: ${input.latestUserMessage.content}`,
      "Respond as the assistant.",
    ].filter((section): section is string => section !== null).join("\n\n"),
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
    executionContext?: OpenWebUiGeminiExecutionContext;
    now?: Date;
  } = {},
): Promise<OpenWebUiGeminiReply> {
  const config = getOpenWebUiGeminiConfig(options.env);
  const promptPayload = buildOpenWebUiGeminiPromptPayload({
    ...input,
    executionContext: options.executionContext,
    now: options.now,
  });
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
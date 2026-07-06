import { GoogleGenAI } from "@google/genai";

import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import {
  type BaziExtractionFieldKey,
  type OpenWebUiIntentClassification,
  type TriageRoute,
  type TriageTimeframe,
} from "@/features/open-webui/triage";
import { type RawInputValue } from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_GEMINI_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION = [
  "You are the Bazi assistant inside an Open WebUI-compatible chat route.",
  "Reply helpfully and directly to the user's latest message.",
].join(" ");

// Token discipline (Phase 3): a ซินแส verdict is a few sentences, not a report. Cap the answer,
// cap how much chat history we replay into the compose call, and truncate the grounded reading we
// inject so the model answers from it instead of re-summarizing the whole chapter (double-injection).
export const OPEN_WEBUI_MAX_OUTPUT_TOKENS = 512;
export const OPEN_WEBUI_MAX_COMPOSE_MESSAGES = 8;
const MAX_GROUNDED_READING_CHARS = 2200;
// Anchored Expert (v2): drift is fenced by prompt STRUCTURE (engine = the only source of chart
// facts), not by starving the sampler. v1's 0.2 killed the ซินแส warmth and read "แข็งกระด้าง";
// temperature is the mood knob, so restore it to a natural conversational 0.6 while the fact-lock
// lives in the persona + grounding rules. Answer length unchanged.
export const OPEN_WEBUI_TEMPERATURE = 0.6;
export const OPEN_WEBUI_TOP_P = 0.95;

// Timeframes finer than the engine's real resolution (year / da-yun). Same-day & monthly questions
// must be answered as an honest disposition-plus-period trend, never as literal daily precision.
const SUB_YEAR_TIMEFRAMES = new Set(["today", "tomorrow", "this_month"]);

// Single source of truth for the same-day honest-precision reframe. The compose prompt uses it to
// inject the reframe instruction; the Glass Box trace uses it to report whether the filter fired.
export function isHonestPrecisionReframe(
  requiresBaziConsult: boolean | undefined,
  timeframe: TriageTimeframe | string | null | undefined,
): boolean {
  return Boolean(requiresBaziConsult)
    && typeof timeframe === "string"
    && SUB_YEAR_TIMEFRAMES.has(timeframe);
}

function truncateGroundedReading(reading: string): string {
  if (reading.length <= MAX_GROUNDED_READING_CHARS) {
    return reading;
  }
  return `${reading.slice(0, MAX_GROUNDED_READING_CHARS).trimEnd()}\n…(ตัดเพื่อความกระชับ — ตอบจากแก่นที่เกี่ยวกับคำถามพอ)`;
}

// Keep only the last N conversational turns for the compose call instead of replaying the whole
// transcript (unbounded history was a real token sink on long chats).
function selectRecentConversation(messages: readonly NormalizedChatMessage[]): NormalizedChatMessage[] {
  const conversational = messages.filter((message) => message.role !== "system");
  return conversational.slice(-OPEN_WEBUI_MAX_COMPOSE_MESSAGES);
}

export const MUMATE_PERSONA_INSTRUCTION = [
  "คุณคือ \"มูเมท\" — ซินแสปาจื่อที่อบอุ่น คม และเข้าใจคน คุยกับลูกดวงอย่างเป็นธรรมชาติเหมือนคนนั่งตรงหน้า ไม่ใช่หุ่นยนต์ส่งรายงาน",
  "",
  "## แหล่งความจริงของดวง (กฎเดียวที่ห้ามฝ่าฝืน)",
  "- \"ผลวินิจฉัยจาก engine\" ที่แนบมา คือแหล่งความจริงเดียวสำหรับ \"ข้อมูลเฉพาะดวงคนนี้\" — ธาตุ เสา สัญลักษณ์ ปี อายุ การปะทะ ทิศ สี อาชีพ คำทำนาย",
  "- ห้ามกุข้อมูลเฉพาะดวงใหม่ที่ไม่มีในผลอ่าน ถ้าผลอ่านไม่ครอบคลุมสิ่งที่ถาม ให้บอกตรงๆ ว่าข้อมูลไม่พอ ไม่ต้องเดา",
  "- แต่ \"วิธีพูด\" เป็นของคุณเต็มที่ — ความเข้าใจคน ภาษาอบอุ่น อุปมา การอธิบายให้เข้าใจง่าย ใช้ได้เต็มที่ ตราบใดที่มันรับใช้การสื่อผลอ่าน ไม่ใช่แทนที่ด้วย fact ใหม่",
  "",
  "## รูปแบบคำตอบ: สนทนาแบบคน ไม่ใช่โครงสร้างรายงาน",
  "- ห้ามใช้หัวข้อรายงาน (เช่น \"สรุป:\", \"วิเคราะห์:\", \"จากข้อมูลที่ให้มา\")",
  "- เขียนเป็นย่อหน้าพูดคุยธรรมชาติ ไม่บังคับใช้ bullet points",
  "- ห้ามลงท้ายแบบหุ่นยนต์ (เช่น \"หวังว่าจะเป็นประโยชน์\")",
  "- ความยาวคำตอบแปรผัน: ถามสั้นตอบสั้น ถามลึกค่อยขยายความ",
  "",
  "## ภาษาซินแซ: คำศัพท์แท้ + อธิบายง่าย",
  "- ใช้เฉพาะศัพท์/สัญลักษณ์ปาจื่อที่ปรากฏในผลอ่าน (เช่น 官杀, 子午冲, ดิถี) ตามด้วยคำอธิบายสั้นๆ ให้คนทั่วไปเข้าใจ — ห้ามหยิบศัพท์/สัญลักษณ์ที่ไม่มีในผลอ่านมาเอง",
  "- ฟันธงตรงประเด็น ไม่อ้อมค้อม ไม่มีน้ำเยิ่ม",
  "",
  "## อุปมาอุปไมย: ใช้เฉพาะจุดสำคัญ 1-2 จุด",
  "- ใช้อุปมาเมื่อช่วยให้เข้าใจง่าย ไม่สาดทุกย่อหน้า",
  "- หลีกเลี่ยงการใช้อุปมาซ้ำซากหรือไม่จำเป็น",
  "",
  "## น้ำเสียง",
  "ใช้คำลงท้ายผู้หญิง (ค่ะ/นะคะ) เป็นค่าเริ่มต้น อบอุ่นแต่มั่นใจ ฟันธงได้",
].join("\n");

type GeminiGenerateContentRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
    topP?: number;
    maxOutputTokens: number;
  };
};

type GeminiGenerateContentResponse = {
  text?: string | null;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
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
  /** Precise reading topic the triage routed to (or off_topic/chit_chat). Phase 3 consumes this. */
  topicId?: TriageRoute;
  /** Asked timeframe (today..in_n_years..period..none). Phase 3 consumes this. */
  timeframe?: TriageTimeframe;
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
  /** โทเคนของการเรียกตอบหลัก — ไว้ log ต้นทุน (thinking รวมใน outTokens แล้ว) */
  usage?: { inTokens: number; outTokens: number };
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
  const conversationTranscript = selectRecentConversation(input.normalizedMessages)
    .map(formatConversationLine)
    .join("\n\n");
  const intentClassification = input.executionContext?.intentClassification;
  const topicId = input.executionContext?.topicId;
  const timeframe = input.executionContext?.timeframe;
  const baziConsult = input.executionContext?.baziConsult;
  const baziMissingFields = input.executionContext?.baziMissingFields ?? [];
  const isOffTopic = topicId === "off_topic";
  const consultMode = intentClassification?.requiresBaziConsult
    ? baziConsult?.truthPacket
      ? "bazi_consult"
      : "bazi_consult_pending_context"
    : intentClassification
      ? isOffTopic
        ? "off_topic_refusal"
        : "non_bazi_bypass"
      : null;
  // Same-day / monthly questions: the engine has no 流日/流月; answer as an honest trend.
  const honestPrecisionReframe = isHonestPrecisionReframe(
    intentClassification?.requiresBaziConsult,
    timeframe,
  );

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
        ? `Routing: topic=${topicId ?? intentClassification.intent}; timeframe=${timeframe ?? "none"}; requiresBaziConsult=${String(intentClassification.requiresBaziConsult)}; confidence=${intentClassification.confidence.toFixed(2)}.`
        : null,
      consultMode ? `Consult mode: ${consultMode}.` : null,
      intentClassification?.requiresBaziConsult && baziConsult?.truthPacket && baziConsult.rawInput
        ? [
          "ข้อมูลวันเกิดที่ยืนยันแล้ว:",
          formatConsultBirthContext(baziConsult.rawInput),
          "ผลวินิจฉัยจาก engine (นี่คือแหล่งความจริงเดียวเรื่องดวงของคุณ — เรียบเรียงเป็นภาษาคนแบบฟันธงได้ แต่ห้ามเพิ่ม/เปลี่ยน/ตัด fact):",
          truncateGroundedReading(baziConsult.truthPacket),
          [
            "วิธีตอบแบบซินแส:",
            "- ข้อเท็จจริงเฉพาะดวง (ธาตุ/ปี/อายุ/สัญลักษณ์/อักษรจีน/ทิศ/สี/อาชีพ/คำทำนาย) ต้องมาจากผลวินิจฉัยด้านบน ห้ามแต่งใหม่. ส่วนวิธีอธิบาย ความอบอุ่น อุปมา พูดได้เต็มที่.",
            "- ฟันธงตอบคำถามตรงๆ เป็นข้อสรุปจากดวง ไม่ใช่ \"สรุปผลอ่าน\" และไม่เล่าผลอ่านทั้งบท",
            "- สั้น กระชับ ไม่กี่ประโยค ตรงประเด็นที่ถาม — ห้ามใส่หัวข้อรายงาน ห้ามดั้มผลอ่านลงมาหมด",
            "- อิงหลักสำนักตรงไปตรงมา ไม่อ้อมค้อม ไม่ปลอบใจลอยๆ ไม่ใช่คำตอบเชิงจิตวิทยา",
            "- ห้ามเพิ่มคำทำนายที่ไม่มีในผลอ่าน และห้ามเปลี่ยน/ตัดสัญลักษณ์ ธาตุ ยาม หรืออักษรจีน",
            "- ถ้าผลอ่านไม่ครอบคลุมสิ่งที่ถาม ให้บอกตรงๆ ว่าข้อมูลไม่พอ ห้ามแต่งเพิ่ม",
          ].join("\n"),
        ].join("\n")
        : null,
      honestPrecisionReframe
        ? "ความแม่นเรื่องเวลา: ผู้ใช้ถามเจาะจงระดับวัน/เดือน แต่ปาจื่อดูแม่นที่สุดได้แค่ระดับปี (ปีจร) และช่วงวัย (วัยจร) เท่านั้น. ให้ตอบเป็นแนวโน้มจากดวง + ช่วงเวลาปัจจุบันอย่างซื่อสัตย์ ห้ามรับปากความแม่นระดับวัน และห้ามแต่งดวงรายวันขึ้นมา."
        : null,
      intentClassification?.requiresBaziConsult && !baziConsult?.truthPacket
        ? "No verified Bazi chart context is attached. Do not invent chart details; ask for the missing birth data or chart payload first."
        : null,
      isOffTopic
        ? "คำถามนี้ไม่เกี่ยวกับการดูดวงปาจื่อ. ให้ปฏิเสธสั้นๆ อย่างสุภาพว่าช่วยเรื่องนี้ไม่ได้เพราะไม่เกี่ยวกับการดูดวง แล้วชวนให้ถามเรื่องดวงแทน. ห้ามตอบเนื้อหานอกลู่นั้น."
        : intentClassification && !intentClassification.requiresBaziConsult
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
        temperature: OPEN_WEBUI_TEMPERATURE,
        topP: OPEN_WEBUI_TOP_P,
        maxOutputTokens: OPEN_WEBUI_MAX_OUTPUT_TOKENS,
      },
    });
    const text = response.text?.trim();

    if (!text) {
      throw new OpenWebUiGeminiError(
        "gemini_empty_response",
        "Gemini returned an empty assistant response for Open WebUI chat.",
      );
    }

    const u = response.usageMetadata;
    return {
      model: config.model,
      text,
      usage: {
        inTokens: u?.promptTokenCount ?? 0,
        // Gemini คิด thinking tokens เป็น output ด้วย
        outTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
      },
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
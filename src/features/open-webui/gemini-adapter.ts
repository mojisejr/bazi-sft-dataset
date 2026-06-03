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
  "คุณคือ \"มูเมท\" ซินแซปาจื่อที่คุยแชทกับผู้ใช้แบบธรรมชาติ ไม่ใช่หุ่นยนต์ส่งรายงาน",
  "หน้าที่หลักของคุณคือแปล Truth Packet ของสำนักซินแซให้เป็นคำตอบแชทธรรมชาติ โดยห้ามเติมความรู้ปาจื่อจากภายนอก",
  "",
  "## ขอบเขตความจริง: Truth Packet เท่านั้น",
  "- ใช้เฉพาะข้อมูลที่อยู่ใน Truth Packet, birth context, และบทสนทนาที่แนบมาเท่านั้นสำหรับคำกล่าวอ้างเชิงปาจื่อ",
  "- ห้ามใช้ความรู้ปาจื่อกระแสหลัก, สำนักอื่น, ความจำจากโมเดล, หรือกฎที่ไม่ได้อยู่ใน Truth Packet",
  "- ถ้า Truth Packet ไม่มีตัวแปรที่จำเป็น ให้บอกว่ายังสรุปไม่ได้และถามข้อมูลเพิ่ม ห้ามเดา",
  "- ห้ามสร้างข้อสรุปเรื่องร่างกาย สุขภาพ การขับถ่าย โรค หรืออาการ จากการขาดธาตุหรือจากความเชื่อทั่วไป เว้นแต่ Truth Packet ระบุไว้ตรงๆ",
  "- ห้ามใช้หรืออ้างคำของสำนักอื่นที่ไม่เกี่ยว เช่น กวนซา, เจีย หงเฮ้ง หรือศัพท์นอกระบบที่ Truth Packet ไม่ได้ให้มา",
  "",
  "## กฎ provenance ของหลักฐาน",
  "- ถ้า section ใน Truth Packet มี provenance เป็น compatibility_profile ให้เล่าว่าเป็นสัญญาณหรือแนวโน้มจาก profile ระดับความเข้ากันได้เท่านั้น ห้ามยกระดับเป็นข้อเท็จจริงที่คำนวณตรงจากดวง",
  "- ถ้า section มี provenance เป็น computed_chart_marker จึงค่อยกล่าวตรงได้ว่าเป็น marker หรือโครงสร้างที่มีอยู่ในดวง แต่ต้องยึดเฉพาะข้อความที่ Truth Packet ให้มา",
  "- ห้ามนำ label จาก compatibility_profile ไปพูดเหมือนเป็นดาวหรือ marker คำนวณตรง เว้นแต่ Truth Packet มี computed_chart_marker นั้นแยกไว้ชัดเจน",
  "",
  "## โครงสร้างคำตอบที่ต้องส่งออกทุกครั้ง",
  "- ส่งออกเป็นสองบล็อกตามลำดับนี้เท่านั้น: <bazi_logic> แล้วตามด้วย <reply>",
  "- <bazi_logic> คือ evidence trace สั้นๆ จาก Truth Packet ไม่ใช่รายงานยาว และห้ามใส่ข้ออ้างที่ไม่มีหลักฐาน",
  "- <reply> คือคำตอบแชทธรรมชาติสำหรับผู้ใช้ อ่านเหมือนซินแซคุยกับคนจริง",
  "- ห้ามสลับลำดับ ห้ามละบล็อก และห้ามเพิ่มบล็อกอื่นนอกเหนือจากสองบล็อกนี้",
  "",
  "## Sinsae reasoning flow ใน <bazi_logic>",
  "1. อ่าน Truth Packet ก่อน และระบุว่ามี/ไม่มีข้อมูลสำคัญอะไร",
  "2. ตรวจดิถี (Day Master) และความแข็ง/อ่อนก่อนเสมอ เพราะเป็นฐานบุคลิกและความสำเร็จ",
  "3. ระบุตัวถ่ายเทเป็นกริยา (Verb) ของพฤติกรรมหลัก ก่อนข้ามไปเรื่องอื่น",
  "4. ใช้ 12 เซงแซ / 12 Qi เป็นคำขยาย (Adjective) เพื่อปรับระดับและน้ำหนักของพฤติกรรม",
  "5. ตรวจเส้นแรงความสัมพันธ์ เช่น ตัวถ่ายเทไปหาลาภ คู่ ครอบครัว หรืองาน ตามหัวข้อที่ผู้ใช้ถาม",
  "6. ค่อยสรุปเป็น <reply> โดยถ่ายทอดเฉพาะสิ่งที่ flow ข้างบนรองรับ",
  "",
  "## รูปแบบคำตอบ: สนทนาแบบคน ไม่ใช่โครงสร้างรายงาน",
  "- ห้ามใช้หัวข้อรายงาน (เช่น \"สรุป:\", \"วิเคราะห์:\", \"จากข้อมูลที่ให้มา\")",
  "- เขียนเป็นย่อหน้าพูดคุยธรรมชาติ ไม่บังคับใช้ bullet points",
  "- ห้ามลงท้ายแบบหุ่นยนต์ (เช่น \"หวังว่าจะเป็นประโยชน์\")",
  "- ความยาวคำตอบแปรผัน: ถามสั้นตอบสั้น ถามลึกค่อยขยายความ",
  "",
  "## นโยบายความกระชับของคำตอบ",
  "- ให้ตอบกระชับเป็นค่าเริ่มต้น โดยปกติอยู่ราว 2-4 ประโยค หรือประมาณ 5-8 บรรทัดบนหน้าจอแชท",
  "- ขยายความได้เมื่อผู้ใช้ขอรายละเอียดเพิ่ม, ถามหลายชั้น, หรือ Truth Packet มีหลายประเด็นสำคัญที่ต้องอธิบายเพื่อไม่ให้ความหมายเพี้ยน",
  "- ถ้าต้องขอข้อมูลเพิ่ม ให้ถามเฉพาะข้อมูลที่จำเป็นที่สุดก่อน และอย่ายืดคำเกริ่นนำ",
  "",
  "## ภาษาซินแซ: คำศัพท์แท้ + อธิบายง่าย",
  "- ใช้ศัพท์ปาจื่อที่มาจาก Truth Packet เท่านั้น ตามด้วยคำอธิบายสั้นๆ ให้คนทั่วไปเข้าใจ",
  "- ฟันธงตรงประเด็น ไม่อ้อมค้อม ไม่มีน้ำเยิ่ม",
  "",
  "## อุปมาอุปไมย: ใช้เฉพาะจุดสำคัญ 1-2 จุด",
  "- ใช้อุปมาเมื่อช่วยให้เข้าใจง่าย ไม่สาดทุกย่อหน้า",
  "- หลีกเลี่ยงการใช้อุปมาซ้ำซากหรือไม่จำเป็น",
  "",
  "## น้ำเสียง",
  "ใช้คำลงท้ายผู้หญิง (ค่ะ/นะคะ) เป็นค่าเริ่มต้น",
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
  episodicMemory?: {
    contextSummary: string | null;
    messages: Array<Pick<NormalizedChatMessage, "role" | "content">>;
  };
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
  const episodicMemory = input.executionContext?.episodicMemory;
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
      episodicMemory?.contextSummary
        ? [
          "Same-thread continuity summary:",
          episodicMemory.contextSummary,
        ].join("\n")
        : null,
      episodicMemory?.messages.length
        ? [
          "Same-thread episodic transcript from persisted memory:",
          episodicMemory.messages.map(formatConversationLine).join("\n\n"),
        ].join("\n")
        : null,
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
          "Respect the packet provenance markers: compatibility_profile = profile-level evidence only; computed_chart_marker = direct chart fact only when explicitly present.",
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
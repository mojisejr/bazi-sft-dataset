/**
 * เกลาคำถามก่อนเก็บเข้าคลัง (CIEL mumate-pdpa-reconsent-001 plan 0.3) — ความหมายเดิม ไม่มีข้อมูลที่ชี้ตัวคน
 *
 * ขั้นตอนใน logAiQuestion: scrubPii (กฎ) → rewriteAiQuestion (โมเดล) → scrubPii อีกรอบ
 *   - ใช้ Gemini key + client options ชุดเดียวกับแชท (triage model) → คำถามไม่ได้ไปหาผู้ประมวลผลรายใหม่
 *   - ล้ม/ว่าง/หมดเวลา/ยาวผิดปกติ (โมเดลตอบคำถามแทนที่จะเกลา) = คืน null → ไม่เก็บอะไรเลย (fail closed)
 *   - เรียกหลังตอบแชทแล้ว (fire-and-forget ใน logAiQuestion) → แชทไม่ช้าลง
 */
import { GoogleGenAI } from "@google/genai";

import { getOpenWebUiTriageConfig } from "@/features/open-webui/triage";
import { genAiClientOptions } from "@/lib/llm-timeout";

/** นานกว่านี้ = ทิ้ง ไม่เก็บ (ไม่มีใครรอคำตอบนี้ แต่ไม่ปล่อยให้ค้าง) */
export const AI_QUESTION_REWRITE_TIMEOUT_MS = 20_000;

export const AI_QUESTION_REWRITE_INSTRUCTION = [
  "คุณคือตัวกรองข้อมูลส่วนบุคคล ไม่ใช่ผู้ช่วยตอบคำถาม",
  "งานเดียวของคุณ: เขียนข้อความของผู้ใช้ใหม่ ให้ความหมาย เจตนา และหัวข้อที่ถามเหมือนเดิมทุกอย่าง แต่ไม่มีข้อมูลที่ชี้กลับไปหาตัวบุคคลได้",
  "แทนที่ด้วยป้ายเหล่านี้:",
  "- ชื่อคน นามสกุล ชื่อเล่น ชื่อบัญชีโซเชียล (ของผู้ใช้หรือคนอื่น) → [ชื่อ]",
  "- วันที่เจาะจง วันเดือนปีเกิด (เช่น 12/05/2533, 3 มีนาคม 2530) → [วันที่]",
  "- เวลาเกิดหรือเวลาเจาะจง (เช่น 10.30 น.) → [เวลา]",
  "- ที่อยู่ บ้านเลขที่ ถนน หมู่บ้าน คอนโด ชื่อโรงเรียน มหาวิทยาลัย บริษัท ที่ทำงาน โรงพยาบาล ร้านค้า → [สถานที่]",
  "- เบอร์โทร อีเมล เลขบัตร เลขบัญชี ทะเบียนรถ ไลน์ไอดี → [ตัวเลข]",
  "เก็บไว้ตามเดิม: ความสัมพันธ์ทั่วไป (แฟน แม่ ลูก หัวหน้า), อาการหรือเรื่องสุขภาพ, อาชีพแบบกว้าง, ปีหรือช่วงเวลาที่ถามถึง (ปีนี้ ปี 2569 เดือนหน้า), ปีนักษัตร ธาตุ ราศี, จังหวัดหรือประเทศ",
  "ห้ามตอบคำถาม ห้ามสรุป ห้ามเติมหรือตัดเนื้อหาอื่น ใช้ภาษาเดิมของผู้ใช้ ถ้าไม่มีอะไรต้องแทนให้คืนข้อความเดิมทุกตัวอักษร",
  'ตอบเป็น JSON เท่านั้น: {"text": "<ข้อความที่เกลาแล้ว>"}',
].join("\n");

const REWRITE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: { type: "string" } },
} as const;

type RewriteRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
    responseMimeType: "application/json";
    responseJsonSchema: typeof REWRITE_JSON_SCHEMA;
  };
};
type RewriteResponse = {
  text?: string | null;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};
export type RewriteGenerateContent = (request: RewriteRequest) => Promise<RewriteResponse>;

export type AiQuestionRewrite = { text: string; usage: { model: string; inTokens: number; outTokens: number } };

/** ยาวเกินนี้ = โมเดลน่าจะตอบ/แต่งเพิ่ม ไม่ใช่เกลา → ทิ้ง (ป้ายแทนชื่อทำให้ยาวขึ้นได้บ้าง) */
export function plausibleRewriteLength(original: string, rewritten: string): boolean {
  return rewritten.length > 0 && rewritten.length <= original.length * 1.5 + 40;
}

/** เกลาคำถามหนึ่งข้อ — null = ไม่ควรเก็บ (ล้ม ว่าง หมดเวลา หรือผลไม่น่าเชื่อ) · ไม่ throw */
export async function rewriteAiQuestion(
  question: string,
  options: { env?: Partial<NodeJS.ProcessEnv>; generateContent?: RewriteGenerateContent } = {},
): Promise<AiQuestionRewrite | null> {
  try {
    const config = getOpenWebUiTriageConfig(options.env);
    const generateContent: RewriteGenerateContent =
      options.generateContent ??
      ((request) => new GoogleGenAI(genAiClientOptions(config.apiKey, AI_QUESTION_REWRITE_TIMEOUT_MS)).models.generateContent(request));
    const response = await generateContent({
      model: config.model,
      contents: question,
      config: {
        systemInstruction: AI_QUESTION_REWRITE_INSTRUCTION,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: REWRITE_JSON_SCHEMA,
      },
    });
    const parsed = JSON.parse(response.text?.trim() || "null") as { text?: unknown } | null;
    const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
    if (!plausibleRewriteLength(question, text)) return null;
    const u = response.usageMetadata;
    return {
      text,
      usage: { model: config.model, inTokens: u?.promptTokenCount ?? 0, outTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0) },
    };
  } catch {
    return null;
  }
}

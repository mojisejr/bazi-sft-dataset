// Hour Rectification — llm-question-generator (#hour-rectification-engine, v1).
//
// 🔒 LLM CALL BUDGET GUARD — the single most important property of this file. ฟีม is worried about
// runaway API cost on an unattended run. The counter lives HERE, centrally, so every call path that
// goes through this module is governed — there is no way to reach the LLM from this generator
// without passing the guard first.
//
//   - MAX_LLM_CALLS defaults to 20 (ฟีม raised it from v0's 10 for the more complex v1 bank),
//     overridable via env RECTIFICATION_MAX_LLM_CALLS. Real target is still 3-6 calls.
//   - Checked BEFORE every call, not after: if callCount >= max, throws LlmBudgetExceededError
//     immediately — no network request is made for the call that would exceed the budget.
//   - One generator instance = one shared budget for the whole generation run. The caller
//     (generate-network.ts) must create exactly ONE instance per run and reuse it for every call
//     (draft + repairs) — creating a second instance to "reset" the counter defeats the guard and
//     must never be done.
//
// v1 shift: the LLM authors a person-agnostic BANK of behavioural questions and TAGS each option
// with structural-signature votes (element / role / strength) from a FIXED vocabulary. It never
// decides an hour — the runtime match does, against the real user's chart. This is the honest,
// still-unproven part (behaviour→property mapping) — kept isolated here so swapping in real rules
// later touches only the bank, not the match engine.
import { generateProseLlm } from "@/lib/bazi/reading-llm";
import {
  SIGNATURE_DIMENSIONS,
  SIGNATURE_VOCAB,
  type BankQuestion,
  type QuestionBank,
  type QuestionOption,
  type SignatureVote,
} from "../domain/types";
import type { ValidationIssue } from "../domain/validate-tree";

export class LlmBudgetExceededError extends Error {
  constructor(
    public readonly attemptedCall: number,
    public readonly maxCalls: number,
  ) {
    super(
      `LLM call budget exceeded: attempted call ${attemptedCall} of a max ${maxCalls} — stopping ` +
        `before sending the request. Increase via env RECTIFICATION_MAX_LLM_CALLS if intentional.`,
    );
    this.name = "LlmBudgetExceededError";
  }
}

export const DEFAULT_MAX_LLM_CALLS = 20;

export function resolveMaxLlmCalls(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.RECTIFICATION_MAX_LLM_CALLS;
  if (!raw || !raw.trim()) return DEFAULT_MAX_LLM_CALLS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_LLM_CALLS;
}

type RawLlmCaller = (input: {
  systemInstruction: string;
  userPrompt: string;
}) => Promise<{ text: string; model: string }>;

// Wire format the LLM emits — deliberately close to (but not identical to) the domain shape so the
// hand-written translation step below is a natural place to reject malformed output rather than
// silently coercing it.
type WireVote = { dimension: string; value: string; weight: number };
type WireOption = { id: string; label: string; evidence: WireVote[] };
type WireQuestion = { id: string; question: string; options: WireOption[] };
type WireBank = { questions: WireQuestion[] };

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseWireBank(text: string): WireBank {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch (error) {
    throw new Error(
      `LLM response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("questions" in parsed) ||
    !Array.isArray((parsed as WireBank).questions)
  ) {
    throw new Error('LLM response JSON missing required "questions" array shape');
  }
  return parsed as WireBank;
}

function wireVoteToVote(wire: WireVote): SignatureVote {
  if (!wire || typeof wire.dimension !== "string" || typeof wire.value !== "string") {
    throw new Error(`LLM produced a malformed evidence vote: ${JSON.stringify(wire)}`);
  }
  const weight = typeof wire.weight === "number" && wire.weight > 0 ? wire.weight : 1;
  return { dimension: wire.dimension as SignatureVote["dimension"], value: wire.value, weight };
}

function wireQuestionsToBankQuestions(wireQuestions: WireQuestion[]): BankQuestion[] {
  return wireQuestions.map((wireQuestion) => {
    if (!wireQuestion.id || !wireQuestion.question || !Array.isArray(wireQuestion.options)) {
      throw new Error(`LLM produced a malformed question: ${JSON.stringify(wireQuestion)}`);
    }
    const options: QuestionOption[] = wireQuestion.options.map((option) => {
      if (!option.id || !option.label || !Array.isArray(option.evidence)) {
        throw new Error(`LLM produced a malformed option: ${JSON.stringify(option)}`);
      }
      return {
        id: option.id,
        label: option.label,
        evidence: option.evidence.map(wireVoteToVote),
      };
    });
    return { id: wireQuestion.id, question: wireQuestion.question, options };
  });
}

// The vocabulary block handed to the LLM — the SAME const-derived vocabulary validate-tree and
// match.ts use, described in plain Thai so the model tags behaviour with the right property.
function vocabularyBlock(): string {
  return [
    "ชุดคุณสมบัติ (dimension) และค่าที่อนุญาต (ต้องใช้ตรงตามนี้เป๊ะ ห้ามคิดค่าใหม่):",
    `- stemElement (ธาตุของก้านยาม): ${SIGNATURE_VOCAB.stemElement.join(", ")}`,
    "    wood=พลังเติบโต/ริเริ่ม, fire=พลังแสดงออก/กระตือรือร้น, earth=พลังมั่นคง/ดูแล, metal=พลังระเบียบ/เด็ดขาด, water=พลังยืดหยุ่น/คิดลึก",
    `- stemRole (บทบาทก้านยามเทียบดิถี): ${SIGNATURE_VOCAB.stemRole.join(", ")}`,
    "    same=พึ่งตัวเอง/เพื่อนพ้อง, resource=ได้รับการสนับสนุน/เรียนรู้, output=สร้างสรรค์/ถ่ายเท, wealth=จัดการทรัพย์/ควบคุมสิ่งของ, power=วินัย/หน้าที่/ถูกกำกับ",
    `- branchRole (บทบาทกิ่งยามเทียบดิถี): ${SIGNATURE_VOCAB.branchRole.join(", ")} (ความหมายเดียวกับ stemRole แต่ดูจากกิ่ง)`,
    `- strengthBucket (กำลังดิถีรวมของช่วงยามนั้น): ${SIGNATURE_VOCAB.strengthBucket.join(", ")}`,
    "    strong=พลังชีวิตแรง/ยืนหยัด, balanced=สมดุล, weak=ต้องพึ่งพา/ประหยัดพลัง",
  ].join("\n");
}

const WIRE_EXAMPLE =
  '{"questions":[{"id":"q1","question":"เวลาเจอปัญหาใหม่ คุณมัก...","options":[' +
  '{"id":"a","label":"ลุยลองเองทันที","evidence":[{"dimension":"stemElement","value":"fire","weight":2},{"dimension":"stemRole","value":"output","weight":1}]},' +
  '{"id":"b","label":"หาข้อมูล/ถามผู้รู้ก่อน","evidence":[{"dimension":"stemRole","value":"resource","weight":2}]}]}]}';

// === call 1: generate the whole bank from the vocabulary (person-agnostic) ===
async function generateBank(callLlm: RawLlmCaller, targetSize: number): Promise<QuestionBank> {
  const systemInstruction =
    "คุณคือนักออกแบบแบบสอบถามสำหรับ สอบยาม (Hour Rectification) แนวใหม่ — คุณไม่ต้องทายยามเอง " +
    "หน้าที่คุณคือออกคำถามชีวิตจริงแบบเลือกตอบ แล้ว 'ติดป้าย' แต่ละตัวเลือกว่าบ่งชี้คุณสมบัติเชิงโครงสร้างอะไร " +
    "ระบบจะเอาป้ายเหล่านี้ไปแมตช์กับดวงจริงของผู้ตอบเองภายหลัง";
  const userPrompt = [
    vocabularyBlock(),
    "",
    `งาน: ออกคำถามชีวิตจริงแบบ multiple-choice ประมาณ ${targetSize} ข้อ (อย่างน้อย 20) ที่คนทั่วไปตอบได้เองแม้ไม่รู้ศาสตร์นี้ ` +
      "(เช่น นิสัยการทำงาน การจัดการเงิน ความสัมพันธ์ พลังงานตอนเด็ก การตัดสินใจ)",
    "กติกาบังคับ (ห้ามฝ่าฝืน):",
    "- ทุกคำถามมีอย่างน้อย 2 ตัวเลือก",
    "- ทุกตัวเลือกต้องมี evidence อย่างน้อย 1 ป้าย (dimension+value+weight)",
    `- ใช้ dimension เฉพาะ: ${SIGNATURE_DIMENSIONS.join(", ")} และ value ตรงตามรายการข้างบนเท่านั้น`,
    "- weight เป็นจำนวนบวก (1=สัญญาณอ่อน, 2=ปานกลาง, 3=ชัดมาก)",
    "- กระจายให้ครบทั้ง 4 dimension ทั่วทั้งชุด (แต่ละ dimension ต้องมีคำถามที่ probe อย่างน้อย 2-3 ข้อ เพื่อให้ runtime เลือกมุมที่แยกดวงได้ดีสุด)",
    "- ห้ามถามศัพท์เทคนิคโหราศาสตร์ (เช่น 'เทพเจ้าสิบของคุณคืออะไร') — ถามพฤติกรรม/ประสบการณ์จริงเท่านั้น",
    "- id คำถามและ id ตัวเลือกห้ามซ้ำกันในชุด",
    "",
    "ตอบเป็น JSON ล้วนๆ เท่านั้น (ห้ามข้อความอื่นนอก JSON, ห้าม markdown code fence) ตรงรูปแบบนี้เป๊ะ:",
    WIRE_EXAMPLE,
  ].join("\n");

  const response = await callLlm({ systemInstruction, userPrompt });
  const wireBank = parseWireBank(response.text);
  return {
    version: "llm-draft",
    generatedAt: "", // stamped by generate-network.ts on success
    questions: wireQuestionsToBankQuestions(wireBank.questions),
  };
}

function describeIssuesForPrompt(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => {
      switch (issue.code) {
        case "EMPTY_BANK":
          return "- ชุดคำถามว่างเปล่า ต้องสร้างคำถามขึ้นมาใหม่ทั้งหมด";
        case "BANK_TOO_SMALL":
          return `- ชุดมีแค่ ${issue.size} ข้อ ต้องมีอย่างน้อย ${issue.min} ข้อ — เพิ่มคำถามใหม่`;
        case "DUPLICATE_QUESTION_ID":
          return `- คำถาม id "${issue.questionId}" ซ้ำ — ต้องเปลี่ยน id ให้ไม่ซ้ำ`;
        case "TOO_FEW_OPTIONS":
          return `- คำถาม "${issue.questionId}" มีแค่ ${issue.optionCount} ตัวเลือก ต้องมีอย่างน้อย 2`;
        case "DUPLICATE_OPTION_ID":
          return `- คำถาม "${issue.questionId}" มีตัวเลือก id ซ้ำ "${issue.optionId}"`;
        case "OPTION_NO_EVIDENCE":
          return `- คำถาม "${issue.questionId}" ตัวเลือก "${issue.optionId}" ไม่มี evidence เลย ต้องติดป้ายอย่างน้อย 1`;
        case "UNKNOWN_DIMENSION":
          return `- คำถาม "${issue.questionId}" ตัวเลือก "${issue.optionId}" ใช้ dimension "${issue.dimension}" ที่ไม่อนุญาต`;
        case "UNKNOWN_VALUE":
          return `- คำถาม "${issue.questionId}" ตัวเลือก "${issue.optionId}" dimension "${issue.dimension}" ใช้ค่า "${issue.value}" ที่ไม่อยู่ในรายการ`;
        case "NON_POSITIVE_WEIGHT":
          return `- คำถาม "${issue.questionId}" ตัวเลือก "${issue.optionId}" weight ${issue.weight} ต้องเป็นจำนวนบวก`;
        case "DIMENSION_NOT_PROBED":
          return `- ยังไม่มีคำถามที่ probe dimension "${issue.dimension}" เลย ต้องเพิ่มคำถามที่ติดป้าย dimension นี้`;
        case "DEPTH_CEILING_TOO_LOW":
          return `- (config) ceiling ความลึกต่ำเกินไป`;
        default:
          return `- ปัญหาที่ไม่รู้จัก: ${JSON.stringify(issue)}`;
      }
    })
    .join("\n");
}

// === call 2+: repair ONLY the problems validate-tree reported ===
async function repairBank(
  bank: QuestionBank,
  issues: ValidationIssue[],
  callLlm: RawLlmCaller,
): Promise<QuestionBank> {
  const systemInstruction =
    "คุณคือนักออกแบบแบบสอบถาม สอบยาม กำลังซ่อมชุดคำถามที่มีปัญหาเฉพาะบางจุด " +
    "ตอบกลับมาเป็นชุดคำถามที่แก้ไขแล้ว (ส่งเฉพาะข้อที่แก้/เพิ่มใหม่ก็ได้ ระบบจะ merge ตาม id)";
  const userPrompt = [
    vocabularyBlock(),
    "",
    "ชุดคำถามตอนนี้ (สำหรับดู context):",
    JSON.stringify({ questions: bank.questions }, null, 2),
    "",
    "ปัญหาที่ต้องแก้:",
    describeIssuesForPrompt(issues),
    "",
    "ตอบเป็น JSON ล้วนๆ (ห้าม markdown fence) รูปแบบ {\"questions\":[...]} — ส่งเฉพาะคำถามที่แก้ไข/เพิ่มใหม่ " +
      "(id เดิม=แทนที่, id ใหม่=เพิ่ม) ไม่ต้องส่งข้อที่ไม่เปลี่ยน",
  ].join("\n");

  const response = await callLlm({ systemInstruction, userPrompt });
  const wireBank = parseWireBank(response.text);
  const patched = wireQuestionsToBankQuestions(wireBank.questions);
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  for (const question of patched) byId.set(question.id, question);
  return { ...bank, questions: Array.from(byId.values()) };
}

export type LlmQuestionGenerator = {
  generateBank: (targetSize: number) => Promise<QuestionBank>;
  repairBank: (bank: QuestionBank, issues: ValidationIssue[]) => Promise<QuestionBank>;
  getCallCount: () => number;
  getMaxCalls: () => number;
};

export function createLlmQuestionGenerator(
  deps: {
    callLlm?: RawLlmCaller;
    maxCalls?: number;
    env?: Record<string, string | undefined>;
  } = {},
): LlmQuestionGenerator {
  const maxCalls = deps.maxCalls ?? resolveMaxLlmCalls(deps.env);
  const rawCallLlm: RawLlmCaller =
    deps.callLlm ??
    (async (input) => {
      const result = await generateProseLlm({
        systemInstruction: input.systemInstruction,
        userPrompt: input.userPrompt,
        usageLabel: "hour-rectification",
        apiKey: process.env.GEMINI_API_KEY,
      });
      return result;
    });

  let callCount = 0;

  // The ONE place every LLM request in this module funnels through. Checked BEFORE calling.
  const guardedCallLlm: RawLlmCaller = async (input) => {
    if (callCount >= maxCalls) {
      throw new LlmBudgetExceededError(callCount + 1, maxCalls);
    }
    callCount += 1;
    return rawCallLlm(input);
  };

  return {
    generateBank: (targetSize) => generateBank(guardedCallLlm, targetSize),
    repairBank: (bank, issues) => repairBank(bank, issues, guardedCallLlm),
    getCallCount: () => callCount,
    getMaxCalls: () => maxCalls,
  };
}

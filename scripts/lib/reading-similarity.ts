/**
 * วัดความใกล้เคียงระหว่างผล LLM กับ gptCase reference
 * - embedding cosine (Gemini embeddings) = ความใกล้เชิงความหมายโดยรวม
 * - LLM-judge (Gemini ให้คะแนน rubric) = faithfulness / tone / coverage / overall (0-100)
 * deps ฉีดได้ทั้งหมด เพื่อ unit test แบบไม่ยิง network
 */
import { GoogleGenAI } from "@google/genai";

export const DEFAULT_EMBED_MODEL = "gemini-embedding-001";
export const DEFAULT_JUDGE_MODEL = "gemini-3-flash-preview";

/** cosine similarity ของเวกเตอร์ 2 ตัว (pure, testable) */
export function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type JudgeScore = {
  faithfulness: number;
  tone: number;
  coverage: number;
  overall: number;
};

const JUDGE_KEYS: (keyof JudgeScore)[] = ["faithfulness", "tone", "coverage", "overall"];

/** parse + clamp ผลคะแนน judge ให้อยู่ใน 0-100 (pure, testable) */
export function parseJudgeScore(raw: unknown): JudgeScore {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out = {} as JudgeScore;
  for (const k of JUDGE_KEYS) {
    const n = Number(obj[k]);
    out[k] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  }
  return out;
}

/** ถ่วงน้ำหนักรวม: cosine (0-1)→0-100 ผสม judge.overall (0-100) */
export function combinedScore(cosine: number, judgeOverall: number | null, cosineWeight = 0.5): number {
  const cos100 = Math.max(0, Math.min(1, cosine)) * 100;
  if (judgeOverall == null) return cos100;
  return cosineWeight * cos100 + (1 - cosineWeight) * judgeOverall;
}

// ───────── deps ที่ฉีดได้ ─────────
export type EmbedFn = (text: string) => Promise<number[]>;
export type JudgeFn = (candidate: string, reference: string) => Promise<JudgeScore>;

export type Scorer = {
  embeddingCosine: (a: string, b: string) => Promise<number>;
  llmJudge: JudgeFn;
};

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    faithfulness: { type: "integer", minimum: 0, maximum: 100 },
    tone: { type: "integer", minimum: 0, maximum: 100 },
    coverage: { type: "integer", minimum: 0, maximum: 100 },
    overall: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["faithfulness", "tone", "coverage", "overall"],
} as const;

function judgePrompt(candidate: string, reference: string): string {
  return [
    "เปรียบเทียบ \"คำทำนาย candidate\" กับ \"คำทำนายอ้างอิง reference\" (ฉบับมาตรฐานที่ต้องการ)",
    "ให้คะแนน 0-100 ตาม rubric (ยิ่งใกล้ reference ยิ่งสูง):",
    "- faithfulness: ความถูกต้องของข้อเท็จจริง/ครบถ้วน ไม่หลอน ไม่ตัดข้อมูลเทียบ reference",
    "- tone: โทน/สำนวน/ความอบอุ่น/การจัดหัวข้อย่อย ใกล้ reference แค่ไหน",
    "- coverage: ครอบคลุมประเด็นและรายการ (อาชีพ/สี/ช่วงอายุ ฯลฯ) เท่า reference แค่ไหน",
    "- overall: ภาพรวมความใกล้เคียง",
    "ตอบเป็น JSON ตาม schema เท่านั้น",
    "",
    "=== reference ===",
    reference,
    "",
    "=== candidate ===",
    candidate,
  ].join("\n");
}

/** สร้าง scorer ที่ผูกกับ Gemini จริง (อ่าน apiKey จาก env ภายนอกแล้วส่งเข้ามา) */
export function createGeminiScorer(opts: {
  apiKey: string;
  embedModel?: string;
  judgeModel?: string;
  embed?: EmbedFn;
  judge?: JudgeFn;
}): Scorer {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const embedModel = opts.embedModel ?? DEFAULT_EMBED_MODEL;
  const judgeModel = opts.judgeModel ?? DEFAULT_JUDGE_MODEL;

  const embed: EmbedFn =
    opts.embed ??
    (async (text: string) => {
      const res = await ai.models.embedContent({ model: embedModel, contents: text });
      // รองรับหลายรูปแบบ response ของ SDK
      const anyRes = res as unknown as {
        embeddings?: Array<{ values?: number[] }>;
        embedding?: { values?: number[] };
      };
      return (
        anyRes.embeddings?.[0]?.values ??
        anyRes.embedding?.values ??
        []
      );
    });

  const judge: JudgeFn =
    opts.judge ??
    (async (candidate: string, reference: string) => {
      const res = await ai.models.generateContent({
        model: judgeModel,
        contents: judgePrompt(candidate, reference),
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: JUDGE_SCHEMA,
        },
      });
      const text = res.text?.trim() ?? "{}";
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }
      return parseJudgeScore(parsed);
    });

  // cache embedding ต่อข้อความ (กัน call ซ้ำในรอบเดียว)
  const cache = new Map<string, Promise<number[]>>();
  const embedCached = (t: string) => {
    let p = cache.get(t);
    if (!p) {
      p = embed(t);
      cache.set(t, p);
    }
    return p;
  };

  return {
    embeddingCosine: async (a, b) => {
      const [va, vb] = await Promise.all([embedCached(a), embedCached(b)]);
      return cosineSim(va, vb);
    },
    llmJudge: judge,
  };
}

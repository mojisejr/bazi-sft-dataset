/**
 * คลังคำถาม AI เพื่อเทรน (เอ็ม 2026-10-22) — เก็บเฉพาะ "คำถาม" (ไม่เก็บคำตอบ) ของคนที่ยินยอม
 * bazi_consent kind='ai_training' (แถวล่าสุด accepted=true และ version = AI_TRAINING_VERSION) · ไม่ยินยอม/ไม่เคยตอบ = ไม่เก็บ
 * รุ่น 2026-10.2 (CIEL mumate-bdash-v2-001 slice 4): จุดประสงค์เพิ่มการวิเคราะห์เพื่อพัฒนาบริการ (bdash แชตถามอะไร) —
 * ยินยอมรุ่นเดิมไม่นับแล้ว จนกว่าจะตอบรุ่นนี้ (fe ถามอีกครั้ง). ต้องตรงกับ AI_TRAINING_VERSION ใน mootech-fe
 *
 * ความเป็นส่วนตัว:
 *   - subject = HMAC-SHA256(anon_id, AI_QUESTION_SALT) — ไม่มี anon_id ในตาราง ย้อนหาตัวคนไม่ได้ แต่ใช้ลบของคนที่ถอนได้
 *   - เกลาก่อนเก็บ (CIEL mumate-pdpa-reconsent-001 plan 0.3): scrubPii() → rewriteAiQuestion() (โมเดลแทนชื่อ วันที่
 *     สถานที่ ด้วยป้าย ความหมายเดิม) → scrubPii() อีกรอบ · เกลาไม่สำเร็จ = ไม่เก็บ
 *   - ถอนความยินยอม → purgeAiQuestions() ลบของคนนั้นทั้งหมด (เรียกจาก /api/account/consent และ cron account-purge)
 *   - เก็บ 2 ปี (AI_QUESTION_RETENTION_DAYS) แล้วลบทุกวันด้วย cron /api/cron/ai-question-purge
 */
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { rewriteAiQuestion, type AiQuestionRewrite } from "@/lib/bazi/ai-question-rewrite";
import { logLlmUsage } from "@/lib/llm-usage/logger";

export const AI_TRAINING_CONSENT_KIND = "ai_training";
export const AI_TRAINING_VERSION = "2026-10.2";
export const AI_QUESTION_RETENTION_DAYS = 730;
const MAX_LEN = 1000;

function salt(): string {
  return process.env.AI_QUESTION_SALT || process.env.OPS_ADMIN_SECRET || "mumate-ai-question-log";
}

export function subjectFor(anonId: string): string {
  return createHmac("sha256", salt()).update(anonId).digest("hex").slice(0, 32);
}

/** ตัดข้อมูลระบุตัวตนในข้อความ — แทนด้วยป้าย [ลิงก์] [อีเมล] [วันที่] [เวลา] [เบอร์] [ตัวเลข] */
export function scrubPii(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[ลิงก์]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[อีเมล]")
    .replace(/\b\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{2,4}\b/g, "[วันที่]")
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:น\.|นาฬิกา)/g, "[เวลา]")
    .replace(/(?:\+?66|0)(?:[\s-]?\d){8,9}/g, "[เบอร์]")
    .replace(/\d(?:[\s-]?\d){5,}/g, "[ตัวเลข]")
    .trim()
    .slice(0, MAX_LEN);
}

function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

export async function hasAiTrainingConsent(anonId: string): Promise<boolean> {
  const r = await createDbClient().execute(sql`
    SELECT accepted, version FROM bazi_consent
     WHERE anon_id = ${anonId} AND kind = ${AI_TRAINING_CONSENT_KIND}
     ORDER BY created_at DESC LIMIT 1`);
  const latest = rowsOf(r)[0];
  return latest?.accepted === true && latest.version === AI_TRAINING_VERSION;
}

/** fire-and-forget — ไม่ยินยอม/ไม่มี anonId/ข้อความว่าง/เกลาไม่สำเร็จ = ไม่ทำอะไร · error ไม่กระทบแชท */
export function logAiQuestion(
  input: {
    anonId?: string | null;
    question?: string | null;
    source?: string;
    persona?: string | null;
    topicId?: string | null;
  },
  deps: { rewrite?: (question: string) => Promise<AiQuestionRewrite | null> } = {},
): void {
  const anonId = input.anonId?.trim();
  const scrubbed = scrubPii(input.question ?? "");
  if (!anonId || scrubbed.length < 2) return;
  const rewrite = deps.rewrite ?? ((q: string) => rewriteAiQuestion(q));
  void (async () => {
    try {
      if (!(await hasAiTrainingConsent(anonId))) return;
      const rewritten = await rewrite(scrubbed);
      if (!rewritten) return;
      logLlmUsage("open_webui", { provider: "gemini", ...rewritten.usage, label: "question-rewrite", anonId });
      const question = scrubPii(rewritten.text);
      if (question.length < 2) return;
      await createDbClient().execute(sql`
        INSERT INTO ai_question_log (subject, question, source, persona, topic_id)
        VALUES (${subjectFor(anonId)}, ${question}, ${input.source ?? "chat"}, ${input.persona ?? null}, ${input.topicId ?? null})`);
    } catch {
      /* fire-and-forget */
    }
  })();
}

/** ถอนความยินยอม → ลบคำถามของคนนี้ทั้งหมด */
export async function purgeAiQuestions(anonId: string): Promise<void> {
  await createDbClient().execute(sql`DELETE FROM ai_question_log WHERE subject = ${subjectFor(anonId)}`);
}

/** ลบคำถามที่เก่ากว่า AI_QUESTION_RETENTION_DAYS — ใช้ทั้ง cron รายวันและปุ่ม purge-expired ใน /api/ops/ai-questions */
export async function purgeExpiredAiQuestions(): Promise<number> {
  const r = await createDbClient().execute(sql`
    DELETE FROM ai_question_log WHERE created_at < now() - (${String(AI_QUESTION_RETENTION_DAYS)} || ' days')::interval RETURNING id`);
  return rowsOf(r).length;
}

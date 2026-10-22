/**
 * คลังคำถาม AI เพื่อเทรน (เอ็ม 2026-10-22) — เก็บเฉพาะ "คำถาม" (ไม่เก็บคำตอบ) ของคนที่ยินยอม
 * bazi_consent kind='ai_training' (แถวล่าสุด accepted=true) · ไม่ยินยอม/ไม่เคยตอบ = ไม่เก็บ
 *
 * ความเป็นส่วนตัว:
 *   - subject = HMAC-SHA256(anon_id, AI_QUESTION_SALT) — ไม่มี anon_id ในตาราง ย้อนหาตัวคนไม่ได้
 *   - scrubPii() ตัดเบอร์โทร อีเมล เลขยาว (บัตร/บัญชี) ลิงก์ ก่อนบันทึก
 *   - ถอนความยินยอม → purgeAiQuestions() ลบของคนนั้นทั้งหมด (เรียกจาก /api/account/consent)
 *   - เก็บ 2 ปี (AI_QUESTION_RETENTION_DAYS) แล้วลบ
 */
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";

export const AI_TRAINING_CONSENT_KIND = "ai_training";
export const AI_QUESTION_RETENTION_DAYS = 730;
const MAX_LEN = 1000;

function salt(): string {
  return process.env.AI_QUESTION_SALT || process.env.OPS_ADMIN_SECRET || "mumate-ai-question-log";
}

export function subjectFor(anonId: string): string {
  return createHmac("sha256", salt()).update(anonId).digest("hex").slice(0, 32);
}

/** ตัดข้อมูลระบุตัวตนในข้อความ — แทนด้วยป้าย [เบอร์] [อีเมล] [ตัวเลข] [ลิงก์] */
export function scrubPii(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[ลิงก์]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[อีเมล]")
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
    SELECT accepted FROM bazi_consent
     WHERE anon_id = ${anonId} AND kind = ${AI_TRAINING_CONSENT_KIND}
     ORDER BY created_at DESC LIMIT 1`);
  return rowsOf(r)[0]?.accepted === true;
}

/** fire-and-forget — ไม่ยินยอม/ไม่มี anonId/ข้อความว่าง = ไม่ทำอะไร · error ไม่กระทบแชท */
export function logAiQuestion(input: {
  anonId?: string | null;
  question?: string | null;
  source?: string;
  persona?: string | null;
  topicId?: string | null;
}): void {
  const anonId = input.anonId?.trim();
  const question = scrubPii(input.question ?? "");
  if (!anonId || question.length < 2) return;
  void (async () => {
    try {
      if (!(await hasAiTrainingConsent(anonId))) return;
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

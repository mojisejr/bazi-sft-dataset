import { purgeExpiredAiQuestions } from "@/lib/bazi/ai-question-log";

export const runtime = "nodejs";

/**
 * /api/cron/ai-question-purge — ลบคำถามในคลัง ai_question_log ที่เก็บไว้ครบ 2 ปี ทุกวัน
 * (CIEL mumate-pdpa-reconsent-001 plan 0.3: นโยบายข้อ 3.1 บอกว่าลบเมื่อครบ 2 ปี).
 *   Bearer CRON_SECRET (fail-closed เหมือน cron อื่น) — ตั้งเวลาใน vercel.json; บน DO เรียกจาก timer ใน mumate-infra (cron.tsv).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return Response.json({ ok: true, deleted: await purgeExpiredAiQuestions() }, { status: 200 });
}

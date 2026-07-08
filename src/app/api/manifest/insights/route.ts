import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import {
  baziManifestCheckin,
  baziManifestEntry,
  baziManifestGoal,
  baziManifestTask,
} from "@/db/schema";
import { computeStreak, todayBangkok } from "@/lib/bazi/manifest/dates";
import { guardServerLlm } from "@/lib/bazi/llm-guard";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

export const runtime = "nodejs";

/**
 * POST /api/manifest/insights — Behavior Insights (จอ My Journal → Behavior Insights).
 * LLM วิเคราะห์ pattern จากข้อมูลจริง (mood/บันทึก 45 วัน + สตรีค + เป้าหมาย+ความคืบหน้า)
 * → คำคมวันนี้ + ข้อสังเกต 3-4 ข้อ + กำลังใจ (โทนโค้ชฮีลใจ) — ห้ามแต่งข้อเท็จจริงใหม่.
 * Body: { anonId, provider?, apiKey?, model? } (ไม่ส่ง apiKey = ใช้คีย์เซิร์ฟเวอร์ ผ่าน guard)
 */

const LOOKBACK_DAYS = 45;

const SYSTEM_INSTRUCTION = `คุณคือโค้ชฮีลใจสไตล์ Louise Hay พูดไทย อบอุ่น ไม่ตัดสิน
คุณจะได้รับ "ข้อมูลจริง" ของผู้ใช้: อารมณ์รายวัน (1=แย่มาก … 5=ดีมาก), บันทึกสั้น ๆ, สตรีค, เป้าหมายกับความคืบหน้า
หน้าที่:
1) วิเคราะห์ pattern จากข้อมูลจริงเท่านั้น — ห้ามสมมุติเหตุการณ์/ตัวเลขที่ไม่มีในข้อมูล
2) ชี้ข้อสังเกตที่เป็นประโยชน์ (เช่น อารมณ์ดีขึ้นช่วงไหน สัมพันธ์กับงานที่ติ๊กไหม เป้าไหนคืบหน้า/ค้าง)
3) ให้กำลังใจแบบเจาะจงกับสิ่งที่เขาทำจริง ไม่ใช่คำปลอบทั่วไป
ตอบเป็น JSON เท่านั้น (ไม่มี markdown):
{"quote":"คำคมสั้น 1 ประโยคที่สอดคล้องกับสถานการณ์ของเขา","insights":["ข้อสังเกต 3-4 ข้อ ข้อละ 1-2 ประโยค"],"encouragement":"ย่อหน้าให้กำลังใจ 2-3 ประโยค"}`;

const Schema = z.object({
  anonId: z.string().trim().min(1).max(128),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
});

function moodLabel(m: number | null): string {
  if (m == null) return "-";
  return `${m}/5`;
}

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const usedOwnKey = Boolean(body.apiKey);
    if (body.provider === "gemini") {
      const blocked = guardServerLlm(request, "manifest_insights", usedOwnKey);
      if (blocked) return blocked;
    }

    const db = createDbClient();
    const today = todayBangkok();
    const fromDate = new Date(`${today}T00:00:00Z`);
    fromDate.setUTCDate(fromDate.getUTCDate() - LOOKBACK_DAYS);
    const from = fromDate.toISOString().slice(0, 10);

    const [entries, allDates, goals] = await Promise.all([
      db
        .select()
        .from(baziManifestEntry)
        .where(and(eq(baziManifestEntry.anonId, body.anonId), gte(baziManifestEntry.entryDate, from)))
        .orderBy(desc(baziManifestEntry.entryDate))
        .limit(60),
      db
        .select({ d: baziManifestEntry.entryDate })
        .from(baziManifestEntry)
        .where(eq(baziManifestEntry.anonId, body.anonId)),
      db
        .select()
        .from(baziManifestGoal)
        .where(and(eq(baziManifestGoal.anonId, body.anonId), eq(baziManifestGoal.status, "active"))),
    ]);

    if (!entries.length && !goals.length) {
      return Response.json(
        { error: "ยังไม่มีข้อมูลบันทึก/เป้าหมายพอสำหรับวิเคราะห์ — เริ่มบันทึกก่อนนะ" },
        { status: 404 },
      );
    }

    // ความคืบหน้าเป้าหมาย (แบบเดียวกับ /api/manifest/goals)
    const goalIds = goals.map((g) => g.id);
    const tasks = goalIds.length
      ? await db.select().from(baziManifestTask).where(inArray(baziManifestTask.goalId, goalIds))
      : [];
    const taskIds = tasks.map((t) => t.id);
    const doneRows = taskIds.length
      ? await db
          .select({
            taskId: baziManifestCheckin.taskId,
            done: sql<number>`coalesce(sum(${baziManifestCheckin.count}), 0)::int`,
          })
          .from(baziManifestCheckin)
          .where(inArray(baziManifestCheckin.taskId, taskIds))
          .groupBy(baziManifestCheckin.taskId)
      : [];
    const doneByTask = new Map(doneRows.map((r) => [r.taskId, r.done]));

    const streak = computeStreak(allDates.map((r) => r.d));

    // ── ประกอบข้อเท็จจริงป้อน LLM ──
    const goalLines = goals.map((g) => {
      const gTasks = tasks.filter((t) => t.goalId === g.id);
      const target = gTasks.reduce((s, t) => s + t.targetCount, 0);
      const done = gTasks.reduce((s, t) => s + Math.min(doneByTask.get(t.id) ?? 0, t.targetCount), 0);
      const pct = target ? Math.round((done / target) * 100) : 0;
      return `- "${g.title}"${g.affirmation ? ` (affirmation: ${g.affirmation})` : ""} คืบหน้า ${done}/${target} (${pct}%)`;
    });
    const entryLines = entries.map((e) => {
      const note = (e.note ?? "").replace(/\s+/g, " ").slice(0, 120);
      return `- ${e.entryDate} อารมณ์ ${moodLabel(e.mood)}${note ? ` บันทึก: "${note}"` : ""}`;
    });

    const userPrompt = [
      `วันนี้: ${today}`,
      `สตรีคบันทึก: ปัจจุบัน ${streak.current} วันติด (สถิติสูงสุด ${streak.best} วัน)`,
      "",
      `เป้าหมาย active (${goals.length}):`,
      ...(goalLines.length ? goalLines : ["- ยังไม่มีเป้าหมาย"]),
      "",
      `บันทึกย้อนหลัง ${LOOKBACK_DAYS} วัน (${entries.length} รายการ ใหม่→เก่า):`,
      ...(entryLines.length ? entryLines : ["- ยังไม่มีบันทึก"]),
    ].join("\n");

    const result = await generateProseLlm({
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt,
      provider: body.provider as ReadingLlmProvider,
      apiKey: body.provider === "anthropic" ? body.apiKey ?? "local" : body.apiKey,
      model: body.model,
      temperature: 0.6,
      usageFeature: "manifest_insights",
      usageAnonId: body.anonId,
      usageLabel: `entries:${entries.length} goals:${goals.length}`,
    });

    // parse JSON (เผื่อโมเดลห่อ code fence) — พังก็ fallback เป็นข้อความล้วน
    let parsed: { quote?: string; insights?: string[]; encouragement?: string } | null = null;
    try {
      const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    return Response.json(
      {
        anonId: body.anonId,
        quote: parsed?.quote ?? null,
        insights: Array.isArray(parsed?.insights) ? parsed.insights : [],
        encouragement: parsed?.encouragement ?? (parsed ? null : result.text),
        basedOn: { days: LOOKBACK_DAYS, entries: entries.length, goals: goals.length, streak },
        model: result.model,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid insights payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown insights error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

import { and, eq, or, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziLedgerTxn, baziQiClaim } from "@/db/schema";
import { spendQi, QiError } from "@/lib/bazi/qi/engine";

export const runtime = "nodejs";

/**
 * /api/qi/streak-restore — กู้คืนสตรีคเช็คอินที่ขาดไป 1 วัน (เฟรม check-in state-D).
 *   POST { anonId } → { ok, restoredDay, ...balance }
 * กลไก: หัก 20 ชี่ผ่าน spendQi("streak_restore") โดย "แถวหักแต้ม" ถือ ref = วันที่ที่กู้ (เมื่อวาน) —
 *   FE (qi-model.checkedInDays) นับ ref ของแถว qi:spend:streak_restore เป็นวันเช็คอินย้อนหลัง → สตรีคเชื่อมต่อ.
 *   ไม่ back-date created_at (wallet route กรอง qiDelta!=0 อยู่แล้ว แถวนี้ -20 จึงโผล่ในประวัติ).
 * กติกา: จำกัดสัปดาห์ละ 1 ครั้ง (bazi_qi_claim code=streak_restore period=สัปดาห์); เมื่อวานต้อง "ยังไม่เช็คอิน/ยังไม่กู้";
 *   แต้มไม่พอ → 409 (ยังไม่ตัดสิทธิ์สัปดาห์ เพราะเช็ค+หักก่อน insert claim).
 */

const PostSchema = z.object({ anonId: z.string().trim().min(1).max(128) });

const bkkDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** คีย์สัปดาห์ = วันจันทร์ของสัปดาห์นั้น (อิงวันปฏิทิน Bangkok) */
function weekKey(todayStr: string): string {
  const [y, m, d] = todayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=อา..6=ส
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(dt.getTime() - sinceMonday * 86400000);
  return `week:${monday.toISOString().slice(0, 10)}`;
}

export async function POST(request: Request) {
  try {
    const { anonId } = PostSchema.parse(await request.json());
    const db = createDbClient();
    const now = new Date();
    const today = bkkDay(now);
    const yesterday = bkkDay(new Date(now.getTime() - 86400000));

    // เมื่อวานมีเช็คอิน (daily_login) หรือกู้ไปแล้ว (streak_restore ref=เมื่อวาน) → ไม่มีวันให้กู้
    const existing = await db
      .select({ id: baziLedgerTxn.id })
      .from(baziLedgerTxn)
      .where(
        and(
          eq(baziLedgerTxn.anonId, anonId),
          or(
            and(
              eq(baziLedgerTxn.reason, "qi:earn:daily_login"),
              sql`to_char(${baziLedgerTxn.createdAt} AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') = ${yesterday}`,
            ),
            and(eq(baziLedgerTxn.reason, "qi:spend:streak_restore"), eq(baziLedgerTxn.ref, yesterday)),
          ),
        ),
      )
      .limit(1);
    if (existing.length) {
      return Response.json({ error: "ไม่มีวันให้กู้คืน (เมื่อวานเช็คอินหรือกู้ไปแล้ว)" }, { status: 409 });
    }

    // จำกัดสัปดาห์ละ 1 ครั้ง — เช็คก่อน (อ่าน) แล้วค่อยหักแต้ม แล้วค่อยจอง (กันเสียแต้มเปล่าเมื่อแต้มไม่พอ)
    const wk = weekKey(today);
    const used = await db
      .select({ code: baziQiClaim.code })
      .from(baziQiClaim)
      .where(and(eq(baziQiClaim.anonId, anonId), eq(baziQiClaim.code, "streak_restore"), eq(baziQiClaim.periodKey, wk)))
      .limit(1);
    if (used.length) {
      return Response.json({ error: "ใช้สิทธิ์กู้คืนสตรีคของสัปดาห์นี้ไปแล้ว" }, { status: 409 });
    }

    // หัก 20 ชี่ + มาร์ควันที่กู้ผ่าน ref (แต้มไม่พอ → QiError 409, ไม่ตัดสิทธิ์สัปดาห์)
    const res = await spendQi(anonId, "streak_restore", yesterday);

    // จองสิทธิ์สัปดาห์ (idempotent) — สำเร็จหลังหักแต้มแล้ว
    await db
      .insert(baziQiClaim)
      .values({ anonId, code: "streak_restore", periodKey: wk })
      .onConflictDoNothing();

    return Response.json({ ok: true, restoredDay: yesterday, ...res.balance }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid streak-restore payload.", details: error.issues }, { status: 400 });
    }
    if (error instanceof QiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown streak-restore error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

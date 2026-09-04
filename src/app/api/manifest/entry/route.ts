import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z, ZodError } from "zod";

import { createDbClient } from "@/db/client";
import { baziManifestEntry } from "@/db/schema";
import { computeStreak, DATE_RE, todayBangkok } from "@/lib/bazi/manifest/dates";
import { applyLedger } from "@/lib/bazi/manifest/ledger";

export const runtime = "nodejs";

/**
 * /api/manifest/entry — บันทึกประจำวัน (mood + โน้ต) + สตรีค (จอ journal / streak).
 *   POST { anonId, date?, mood?(1-5), note? } → upsert; วันแรกของวันนั้นแจกแต้มเช็คอิน
 *   GET  ?anonId=...&from=&to=              → entries[] + streak {current, best}
 */

/** รางวัลบันทึกครั้งแรกของแต่ละวัน (เข้า ledger เหตุผล daily_journal) */
const DAILY_REWARD = { coins: 10, xp: 50 };

const PostSchema = z.object({
  anonId: z.string().trim().min(1).max(128),
  date: z.string().regex(DATE_RE).optional(),
  mood: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(4000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const entryDate = body.date ?? todayBangkok();
    const db = createDbClient();

    // แถวใหม่ = บันทึกแรกของวันนั้น → ให้รางวัล; แถวเดิม = อัปเดตเฉย ๆ
    const inserted = await db
      .insert(baziManifestEntry)
      .values({ anonId: body.anonId, entryDate, mood: body.mood ?? null, note: body.note ?? null })
      .onConflictDoNothing()
      .returning({ entryDate: baziManifestEntry.entryDate });

    let rewarded = false;
    if (inserted.length) {
      rewarded = Boolean(
        await applyLedger({
          anonId: body.anonId,
          // รางวัลบันทึกประจำวันเข้าเป็น QI (รวม coins→qi ทั้งแอป)
          qiDelta: DAILY_REWARD.coins,
          xpDelta: DAILY_REWARD.xp,
          reason: "daily_journal",
          ref: entryDate,
        }),
      );
    } else {
      await db
        .update(baziManifestEntry)
        .set({
          ...(body.mood !== undefined ? { mood: body.mood } : {}),
          ...(body.note !== undefined ? { note: body.note } : {}),
          updatedAt: sql`now()`,
        })
        .where(and(eq(baziManifestEntry.anonId, body.anonId), eq(baziManifestEntry.entryDate, entryDate)));
    }

    // สตรีคล่าสุดหลังบันทึก
    const dates = await db
      .select({ d: baziManifestEntry.entryDate })
      .from(baziManifestEntry)
      .where(eq(baziManifestEntry.anonId, body.anonId));
    const streak = computeStreak(dates.map((r) => r.d));

    return Response.json({ anonId: body.anonId, date: entryDate, rewarded, streak }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid entry payload.", details: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown entry error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const anonId = url.searchParams.get("anonId")?.trim();
    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return Response.json({ error: "from/to ต้องเป็น YYYY-MM-DD" }, { status: 400 });
    }

    const db = createDbClient();
    const conditions = [eq(baziManifestEntry.anonId, anonId)];
    if (from) conditions.push(gte(baziManifestEntry.entryDate, from));
    if (to) conditions.push(lte(baziManifestEntry.entryDate, to));

    const entries = await db
      .select()
      .from(baziManifestEntry)
      .where(and(...conditions))
      .orderBy(desc(baziManifestEntry.entryDate))
      .limit(400);

    // สตรีคคิดจากทุกวันของ user (ไม่จำกัดช่วง from/to)
    const allDates = await db
      .select({ d: baziManifestEntry.entryDate })
      .from(baziManifestEntry)
      .where(eq(baziManifestEntry.anonId, anonId));
    const streak = computeStreak(allDates.map((r) => r.d));

    return Response.json({ anonId, entries, streak }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown entry error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

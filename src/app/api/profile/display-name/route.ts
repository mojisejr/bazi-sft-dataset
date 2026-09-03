import { and, eq, ne, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziUserProfile } from "@/db/schema";

export const runtime = "nodejs";

/**
 * /api/profile/display-name — ชื่อแสดงแบบ @name (team.mp4 2026-09: ตั้งไม่ซ้ำกัน โชว์คู่ชื่อจริง
 * ในระบบเพื่อน/ดวงสมพงษ์ แบบจางๆ ใต้ชื่อ เหมือน LINE; คนเก่าที่ยังไม่เคยตั้ง = ไม่มีแถว ตั้งได้ฟรี)
 *
 *   GET  ?anonId=...            → { anonId, displayName | null }
 *   GET  ?check=NAME            → { available: boolean } (กันชื่อซ้ำแบบไม่สนตัวพิมพ์ — ไว้ให้ฟอร์มเช็คขณะพิมพ์)
 *   POST {anonId, displayName}  → { anonId, displayName } | 409 { error: "display_name_taken" }
 *
 * รูปแบบชื่อ: ไทย/อังกฤษ/ตัวเลข/_/. ความยาว 4-24 — บังคับทั้ง FE และที่นี่ (BFF คือประตูเดียวที่เรียก)
 * unique ที่ระดับ DB (lower(display_name)) ทำให้แม้แข่งกันยื่นพร้อมกัน ก็มีคนเดียวที่ได้ชื่อ
 */
const DISPLAY_NAME_RE = /^[0-9A-Za-z_\u0E00-\u0E7F.]{4,24}$/u;
const PG_UNIQUE_VIOLATION = "23505";

function cleanName(raw: unknown): string {
  return String(raw ?? "").trim();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const anonId = url.searchParams.get("anonId")?.trim();
    const check = cleanName(url.searchParams.get("check"));

    if (check) {
      if (!DISPLAY_NAME_RE.test(check)) {
        return Response.json({ available: false, reason: "invalid_format" }, { status: 200 });
      }
      const db = createDbClient();
      const rows = await db
        .select({ anonId: baziUserProfile.anonId })
        .from(baziUserProfile)
        .where(sql`lower(${baziUserProfile.displayName}) = ${check.toLowerCase()}`)
        .limit(1);
      return Response.json({ available: rows.length === 0 }, { status: 200 });
    }

    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    const db = createDbClient();
    const rows = await db
      .select()
      .from(baziUserProfile)
      .where(eq(baziUserProfile.anonId, anonId))
      .limit(1);
    return Response.json(
      { anonId, displayName: rows[0]?.displayName ?? null },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown display name error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      anonId?: unknown;
      displayName?: unknown;
    };
    const anonId = String(body.anonId ?? "").trim();
    const displayName = cleanName(body.displayName);

    if (!anonId) return Response.json({ error: "anonId is required." }, { status: 400 });
    if (!DISPLAY_NAME_RE.test(displayName)) {
      return Response.json(
        { error: "invalid_format", message: "ชื่อแสดงต้องเป็นไทย/อังกฤษ/ตัวเลข/_/. ยาว 4-24 ตัวอักษร" },
        { status: 400 },
      );
    }

    const db = createDbClient();

    // ชื่อซ้ำโดยคนอื่น → 409 ก่อนยิง upsert (race ปิดด้วย unique index ด้านล่างอีกชั้น)
    const taken = await db
      .select({ anonId: baziUserProfile.anonId })
      .from(baziUserProfile)
      .where(
        and(
          sql`lower(${baziUserProfile.displayName}) = ${displayName.toLowerCase()}`,
          ne(baziUserProfile.anonId, anonId),
        ),
      )
      .limit(1);
    if (taken.length > 0) {
      return Response.json({ error: "display_name_taken" }, { status: 409 });
    }

    const rows = await db
      .insert(baziUserProfile)
      .values({ anonId, displayName })
      .onConflictDoUpdate({
        target: baziUserProfile.anonId,
        set: { displayName, updatedAt: new Date() },
      })
      .returning({ anonId: baziUserProfile.anonId, displayName: baziUserProfile.displayName });

    return Response.json(rows[0] ?? { anonId, displayName }, { status: 200 });
  } catch (error) {
    // 23505 = unique violation จาก index lower(display_name) — แข่งกันยื่นพร้อมกัน
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === PG_UNIQUE_VIOLATION) {
      return Response.json({ error: "display_name_taken" }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Unknown display name error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

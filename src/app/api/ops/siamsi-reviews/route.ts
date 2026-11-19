// /api/ops/siamsi-reviews — รีวิวเซียมซีโป๊ยเซียน (ใครเปิดได้ใบไหน รีวิวอะไร ได้กี่ QI) ไว้ทำคอนเทนต์ (2026-11-19)
// secret-gated ด้วย OPS_ADMIN_SECRET (fail-closed) เหมือน /api/ops/ai-questions
//   GET ?secret=&q=&rating=up|down&days=&limit=&offset=  → { total, rows, stats }
//   GET ...&format=csv                                   → ไฟล์ CSV (สูงสุด 20,000 แถว)
import { sql, type SQL } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { getImmortalDeck } from "@/lib/bazi/immortal-cards/decks";

export const runtime = "nodejs";

function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

export type SiamsiReviewRow = {
  id: string;
  anonId: string;
  userName: string;
  cardNo: number;
  cardName: string;
  category: string | null;
  rating: 1 | -1;
  review: string;
  rewardQi: number;
  drawnAt: string;
  reviewedAt: string;
};

function whereOf(p: URLSearchParams): SQL {
  const parts: SQL[] = [sql`h.reviewed_at IS NOT NULL`];
  const q = p.get("q")?.trim();
  if (q) {
    const like = `%${q}%`;
    parts.push(sql`(h.review ILIKE ${like} OR u.name ILIKE ${like} OR pr.display_name ILIKE ${like} OR h.anon_id ILIKE ${like})`);
  }
  const rating = p.get("rating");
  if (rating === "up") parts.push(sql`h.rating = 1`);
  else if (rating === "down") parts.push(sql`h.rating = -1`);
  const card = Number(p.get("card"));
  if (Number.isInteger(card) && card > 0) parts.push(sql`h.card_no = ${card}`);
  const days = Number(p.get("days"));
  if (Number.isFinite(days) && days > 0) parts.push(sql`h.reviewed_at >= now() - (${String(Math.floor(days))} || ' days')::interval`);
  return sql.join(parts, sql` AND `);
}

const FROM = sql`FROM siamsi_history h
  LEFT JOIN "user" u ON u.user_id = h.anon_id
  LEFT JOIN bazi_user_profile pr ON pr.anon_id = h.anon_id`;

export async function GET(request: Request) {
  const secret = process.env.OPS_ADMIN_SECRET;
  const p = new URL(request.url).searchParams;
  if (!secret || p.get("secret") !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const db = createDbClient();
  const deck = getImmortalDeck("poysian");
  const where = whereOf(p);
  const toRow = (r: Record<string, unknown>): SiamsiReviewRow => {
    const no = Number(r.card_no);
    const c = deck?.cards.find((x) => x.no === no);
    const name = [r.display_name, r.u_name].map((x) => String(x ?? "").trim()).find(Boolean) ?? "";
    return {
      id: String(r.id),
      anonId: String(r.anon_id),
      userName: name,
      cardNo: no,
      cardName: c?.name ?? "",
      category: c?.category ?? null,
      rating: Number(r.rating) === -1 ? -1 : 1,
      review: String(r.review ?? ""),
      rewardQi: Number(r.reward_qi ?? 0),
      drawnAt: new Date(String(r.created_at)).toISOString(),
      reviewedAt: new Date(String(r.reviewed_at)).toISOString(),
    };
  };
  const select = sql`SELECT h.id, h.anon_id, h.card_no, h.rating, h.review, h.reward_qi, h.created_at, h.reviewed_at,
    u.name AS u_name, pr.display_name`;

  try {
    if (p.get("format") === "csv") {
      const rows = rowsOf(await db.execute(sql`${select} ${FROM} WHERE ${where} ORDER BY h.reviewed_at DESC LIMIT 20000`)).map(toRow);
      const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      const lines = [
        ["วันที่รีวิว", "ชื่อผู้ใช้", "anonId", "ใบที่", "ชื่อไพ่", "หมวด", "ผล", "รีวิว", "QI"],
        ...rows.map((r) => [
          new Date(r.reviewedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
          r.userName, r.anonId, String(r.cardNo), r.cardName, r.category ?? "", r.rating === 1 ? "ตรง" : "ไม่ตรง", r.review, String(r.rewardQi),
        ]),
      ];
      return new Response("﻿" + lines.map((l) => l.map(esc).join(",")).join("\n"), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="siamsi-reviews.csv"` },
      });
    }
    const limit = Math.min(200, Math.max(1, Number(p.get("limit")) || 50));
    const offset = Math.max(0, Number(p.get("offset")) || 0);
    const [res, cnt, st] = await Promise.all([
      db.execute(sql`${select} ${FROM} WHERE ${where} ORDER BY h.reviewed_at DESC LIMIT ${limit} OFFSET ${offset}`),
      db.execute(sql`SELECT count(*)::int AS n ${FROM} WHERE ${where}`),
      db.execute(sql`SELECT
          count(*) FILTER (WHERE reviewed_at IS NOT NULL)::int AS reviews,
          count(*) FILTER (WHERE rating = 1)::int AS up,
          count(*) FILTER (WHERE rating = -1)::int AS down,
          count(*)::int AS draws,
          COALESCE(SUM(reward_qi) FILTER (WHERE reviewed_at >= date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'), 0)::int AS qi_month
        FROM siamsi_history`),
    ]);
    const s = rowsOf(st)[0] ?? {};
    return Response.json({
      total: Number(rowsOf(cnt)[0]?.n ?? 0),
      rows: rowsOf(res).map(toRow),
      stats: { reviews: Number(s.reviews ?? 0), up: Number(s.up ?? 0), down: Number(s.down ?? 0), draws: Number(s.draws ?? 0), qiMonth: Number(s.qi_month ?? 0) },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    // ยังไม่มีตาราง (ยังไม่มีใครเปิดไพ่หลัง deploy) → ว่าง
    if (/siamsi_history/.test(msg) && /does not exist/.test(msg)) return Response.json({ total: 0, rows: [], stats: { reviews: 0, up: 0, down: 0, draws: 0, qiMonth: 0 } });
    return Response.json({ error: msg }, { status: 500 });
  }
}

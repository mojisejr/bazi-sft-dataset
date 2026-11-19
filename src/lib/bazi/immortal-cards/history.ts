/**
 * ประวัติเซียมซีโป๊ยเซียน + รีวิว (2026-11-19)
 * - ทุกครั้งที่เปิดไพ่ (มี anonId) → บันทึก 1 แถว, เก็บล่าสุด 20 แถว/คน (เก่ากว่านั้นลบ)
 * - รีวิวได้ครั้งเดียวต่อแถว: 👍(1)/👎(-1) + ข้อความ → สุ่ม 3-5 QI, รวมทั้งเดือน (เดือนไทย) ไม่เกิน 100 QI
 * ตาราง = drizzle/0058_siamsi_history.sql (สร้างเองถ้ายังไม่มี)
 */
import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { getImmortalDeck, type ImmortalCard } from "@/lib/bazi/immortal-cards/decks";
import { applyLedger } from "@/lib/bazi/manifest/ledger";

export const HISTORY_KEEP = 20;
export const REVIEW_QI_MIN = 3;
export const REVIEW_QI_MAX = 5;
export const REVIEW_QI_MONTH_CAP = 100;
export const REVIEW_MIN_CHARS = 5;

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ensured ??= (async () => {
    const db = createDbClient();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS siamsi_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL, deck text NOT NULL DEFAULT 'poysian',
      card_no integer NOT NULL, question text, rating smallint CHECK (rating IN (-1, 1)), review text,
      reward_qi integer NOT NULL DEFAULT 0, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS siamsi_history_anon_idx ON siamsi_history (anon_id, created_at DESC)`);
  })().catch((e) => {
    ensured = null;
    throw e;
  });
  return ensured;
}

/** บันทึกการเปิดไพ่ — คืน id (null ถ้าบันทึกไม่ได้; ไม่ให้ล้มการเปิดไพ่) */
export async function recordDraw(anonId: string, cardNo: number, question?: string | null): Promise<string | null> {
  try {
    await ensureTable();
    const db = createDbClient();
    const rows = (await db.execute(sql`
      INSERT INTO siamsi_history (anon_id, card_no, question) VALUES (${anonId}, ${cardNo}, ${question ?? null}) RETURNING id
    `)) as unknown as Array<{ id: string }>;
    await db.execute(sql`
      DELETE FROM siamsi_history WHERE anon_id = ${anonId} AND id NOT IN (
        SELECT id FROM siamsi_history WHERE anon_id = ${anonId} ORDER BY created_at DESC LIMIT ${HISTORY_KEEP})
    `);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

const MONTH_START = sql`(date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok')`;

async function monthEarned(anonId: string): Promise<number> {
  const db = createDbClient();
  // นับจาก ledger — แถวประวัติเก่า (เกิน 20) ถูกลบได้ แต่ ledger ไม่หาย
  const r = (await db.execute(sql`
    SELECT COALESCE(SUM(qi_delta), 0)::int AS n FROM bazi_ledger_txn
    WHERE anon_id = ${anonId} AND reason = 'qi:earn:siamsi_review' AND created_at >= ${MONTH_START}
  `)) as unknown as Array<{ n: number }>;
  return Number(r[0]?.n ?? 0);
}

export type HistoryItem = {
  id: string;
  createdAt: string;
  question: string | null;
  rating: 1 | -1 | null;
  review: string | null;
  rewardQi: number;
  card: Omit<ImmortalCard, "deep"> | null;
};

export async function listHistory(anonId: string): Promise<{ items: HistoryItem[]; monthEarned: number; monthCap: number }> {
  await ensureTable();
  const db = createDbClient();
  const rows = (await db.execute(sql`
    SELECT id, card_no, question, rating, review, reward_qi, created_at FROM siamsi_history
    WHERE anon_id = ${anonId} ORDER BY created_at DESC LIMIT ${HISTORY_KEEP}
  `)) as unknown as Array<{ id: string; card_no: number; question: string | null; rating: number | null; review: string | null; reward_qi: number; created_at: Date | string }>;
  const deck = getImmortalDeck("poysian");
  const items = rows.map((r) => {
    const found = deck?.cards.find((c) => c.no === Number(r.card_no));
    let card: HistoryItem["card"] = null;
    if (found) {
      const { deep: _deep, ...rest } = found;
      card = rest;
    }
    return {
      id: r.id,
      createdAt: new Date(r.created_at).toISOString(),
      question: r.question,
      rating: r.rating === 1 ? 1 : r.rating === -1 ? -1 : null,
      review: r.review,
      rewardQi: Number(r.reward_qi ?? 0),
      card,
    } satisfies HistoryItem;
  });
  return { items, monthEarned: await monthEarned(anonId), monthCap: REVIEW_QI_MONTH_CAP };
}

export type ReviewResult =
  | { ok: true; rewardQi: number; capped: boolean; monthEarned: number; monthCap: number }
  | { ok: false; status: number; reason: string };

export async function submitReview(
  anonId: string,
  id: string,
  rating: 1 | -1,
  review: string,
  rand: () => number = Math.random,
): Promise<ReviewResult> {
  const text = review.trim();
  if (text.length < REVIEW_MIN_CHARS) return { ok: false, status: 400, reason: `เขียนรีวิวอย่างน้อย ${REVIEW_MIN_CHARS} ตัวอักษร` };
  await ensureTable();
  const db = createDbClient();
  // จองแถว (รีวิวได้ครั้งเดียว) — race-safe ด้วยเงื่อนไข reviewed_at IS NULL
  const claimed = (await db.execute(sql`
    UPDATE siamsi_history SET rating = ${rating}, review = ${text.slice(0, 1000)}, reviewed_at = now()
    WHERE id = ${id} AND anon_id = ${anonId} AND reviewed_at IS NULL RETURNING id
  `)) as unknown as Array<{ id: string }>;
  if (!claimed.length) return { ok: false, status: 409, reason: "รีวิวไพ่ใบนี้ไปแล้ว หรือไม่พบประวัตินี้" };

  const earned = await monthEarned(anonId);
  const want = REVIEW_QI_MIN + Math.floor(rand() * (REVIEW_QI_MAX - REVIEW_QI_MIN + 1));
  const reward = Math.max(0, Math.min(want, REVIEW_QI_MONTH_CAP - earned));
  if (reward > 0) {
    const bal = await applyLedger({ anonId, qiDelta: reward, reason: "qi:earn:siamsi_review", ref: id });
    if (bal) await db.execute(sql`UPDATE siamsi_history SET reward_qi = ${reward} WHERE id = ${id}`);
  }
  return { ok: true, rewardQi: reward, capped: reward < want, monthEarned: earned + reward, monthCap: REVIEW_QI_MONTH_CAP };
}

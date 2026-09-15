// src/lib/bazi/qi/discount.ts — โค้ด "ลดราคา" ตอนจ่ายเงิน (#2 คูปอง · ซินแสนุ้ย 2026-09-14 แก้เพิ่ม).
//
// ต่างจาก activity_coupon (แลกรับ QI/เครดิต/tier เข้าบัญชี): โค้ดนี้ = ส่วนลดเงินที่ "กรอกตอน checkout" แล้วลดยอด.
// เลนคิดเงิน/จองโควตา/ใบเสร็จ อยู่ฝั่ง FE (mootech-fe lib/discount/*) ครบแล้ว — DB ใช้ตาราง discount_code ร่วมกัน
// (โปรเจกต์ Supabase เดียวกัน). ที่นี่แค่ "สร้าง/พัก/ดู" จากหลังบ้าน engine ให้แอดมินทำได้ในที่เดียว.
// value: PERCENT → เปอร์เซ็นต์ (10 = 10%) ; FIXED → satang. maxDiscountSatang = เพดานลด (เฉพาะ PERCENT). ตรง FE rules.ts.
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";

export type OpsDiscount = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  maxDiscountSatang: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUseTotal: number | null;
  maxUsePerUser: number | null;
  status: string;
  usedCount: number;
  distinctUsers: number; // จำนวน "คน" ที่ใช้ (นับ user ไม่ซ้ำ) — ต่างจาก usedCount (จำนวนครั้ง)
  createdAt: string;
};

// รายการผู้ใช้โค้ด (ใครใช้บ้าง) — โชว์ในหลังบ้าน
export type DiscountRedemptionRow = {
  userId: string;
  name: string; // @name / ชื่อไลน์ / อีเมล / user_id (อย่างใดอย่างหนึ่งที่มี)
  discountSatang: number;
  redeemedAt: string | null;
};

const iso = (d: unknown): string | null => (d ? new Date(d as string).toISOString() : null);

function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

export async function listDiscounts(): Promise<OpsDiscount[]> {
  const db = createDbClient();
  const r = await db.execute(
    sql`SELECT dc.id, dc.code, dc.kind, dc.value, dc.max_discount_satang, dc.starts_at, dc.ends_at,
               dc.max_use_total, dc.max_use_per_user, dc.status, dc.used_count, dc.created_at,
               (SELECT COUNT(DISTINCT user_id) FROM discount_redemption WHERE code_id = dc.id) AS distinct_users
        FROM discount_code dc ORDER BY dc.created_at DESC LIMIT 300`,
  );
  return rowsOf(r).map((x) => ({
    id: String(x.id),
    code: String(x.code),
    kind: x.kind === "FIXED" ? "FIXED" : "PERCENT",
    value: Number(x.value),
    maxDiscountSatang: x.max_discount_satang == null ? null : Number(x.max_discount_satang),
    startsAt: iso(x.starts_at),
    endsAt: iso(x.ends_at),
    maxUseTotal: x.max_use_total == null ? null : Number(x.max_use_total),
    maxUsePerUser: x.max_use_per_user == null ? null : Number(x.max_use_per_user),
    status: String(x.status),
    usedCount: Number(x.used_count ?? 0),
    distinctUsers: Number(x.distinct_users ?? 0),
    createdAt: iso(x.created_at) ?? "",
  }));
}

/** ใครใช้โค้ดนี้บ้าง — join user/@name เพื่อโชว์ชื่อ (ล่าสุดก่อน). ใช้ในหลังบ้าน /ops. */
export async function listRedemptions(codeId: string): Promise<DiscountRedemptionRow[]> {
  const db = createDbClient();
  const r = await db.execute(
    sql`SELECT r.user_id, r.discount_satang, r.redeemed_at,
               u.name AS line_name, u.email, p.display_name
        FROM discount_redemption r
        LEFT JOIN "user" u ON u.user_id = r.user_id
        LEFT JOIN bazi_user_profile p ON p.anon_id = r.user_id
        WHERE r.code_id = ${codeId}
        ORDER BY r.redeemed_at DESC LIMIT 500`,
  );
  return rowsOf(r).map((x) => {
    const handle = x.display_name ? `@${String(x.display_name)}` : null;
    const name = handle ?? (x.line_name ? String(x.line_name) : null) ?? (x.email ? String(x.email) : null) ?? String(x.user_id);
    return {
      userId: String(x.user_id),
      name,
      discountSatang: Number(x.discount_satang ?? 0),
      redeemedAt: iso(x.redeemed_at),
    };
  });
}

export type ValidatedDiscount = {
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  maxDiscountSatang: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUseTotal: number | null;
  maxUsePerUser: number | null;
};

function parseDate(v: unknown): Date | null | "invalid" {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}
function parseCount(v: unknown): number | null | "invalid" {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return "invalid";
  return Math.round(n);
}

/** ตรวจ input จากฟอร์ม /ops → ค่าที่พร้อมเขียน DB. value/maxDiscountBaht เป็น "บาท" ในฟอร์ม แปลงเป็น satang ที่นี่. */
export function validateCreate(input: Record<string, unknown>): { ok: true; value: ValidatedDiscount } | { ok: false; reason: string } {
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(code)) return { ok: false, reason: "โค้ดต้องเป็น a-z 0-9 _ - ยาว 2-40 ตัว" };
  const kind = input.kind === "FIXED" ? "FIXED" : input.kind === "PERCENT" ? "PERCENT" : null;
  if (!kind) return { ok: false, reason: "ชนิดต้องเป็น PERCENT หรือ FIXED" };
  const rawValue = Number(input.value);
  if (!Number.isFinite(rawValue) || rawValue <= 0) return { ok: false, reason: "มูลค่าต้องมากกว่า 0" };

  let value: number;
  let maxDiscountSatang: number | null = null;
  if (kind === "PERCENT") {
    value = Math.round(rawValue);
    // 1-99% (เจ้าของ 2026-09-15): ไม่ให้ 100% เพราะยอดเป็น 0 gateway รับไม่ได้ (FE rules MIN_CHARGE_SATANG
    // ยังกันยอด < ฿20 ตอน checkout อีกชั้น — % สูงบนแพ็กถูกอาจโดนปฏิเสธ BELOW_MIN)
    if (value < 1 || value > 99) return { ok: false, reason: "ส่วนลดเปอร์เซ็นต์ต้อง 1-99" };
    const mdb = Number(input.maxDiscountBaht);
    maxDiscountSatang = Number.isFinite(mdb) && mdb > 0 ? Math.round(mdb * 100) : null;
  } else {
    value = Math.round(rawValue * 100); // บาท → satang
    if (value < 100) return { ok: false, reason: "ส่วนลดแบบจำนวนเงินต้อง ≥ 1 บาท" };
  }

  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (startsAt === "invalid" || endsAt === "invalid") return { ok: false, reason: "วันที่ไม่ถูกต้อง หรือเว้นว่าง" };
  if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) return { ok: false, reason: "วันเริ่มต้องก่อนวันหมดอายุ" };
  const maxUseTotal = parseCount(input.maxUseTotal);
  const maxUsePerUser = parseCount(input.maxUsePerUser);
  if (maxUseTotal === "invalid" || maxUsePerUser === "invalid") return { ok: false, reason: "จำนวนครั้งต้อง ≥ 1 หรือเว้นว่าง" };

  return {
    ok: true,
    value: { code, kind, value, maxDiscountSatang, startsAt: startsAt || null, endsAt: endsAt || null, maxUseTotal: maxUseTotal || null, maxUsePerUser: maxUsePerUser || null },
  };
}

/** โค้ดซ้ำไหม (lower(code) UNIQUE — index uq_discount_code_lower_code) */
export async function isCodeTaken(code: string): Promise<boolean> {
  const db = createDbClient();
  const r = await db.execute(sql`SELECT 1 FROM discount_code WHERE lower(code) = lower(${code}) LIMIT 1`);
  return rowsOf(r).length > 0;
}

/** สร้างโค้ดส่วนลด — applies_to ว่าง = ทุกแพ็กเกจ (FE rules: [] = every package). */
export async function createDiscount(v: ValidatedDiscount): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  if (await isCodeTaken(v.code)) return { ok: false, reason: "มีโค้ดนี้อยู่แล้ว" };
  const db = createDbClient();
  const id = randomUUID();
  await db.execute(
    sql`INSERT INTO discount_code (id, code, kind, value, max_discount_satang, applies_to, starts_at, ends_at, max_use_total, max_use_per_user, status, used_count, created_by, created_at)
        VALUES (${id}, ${v.code}, ${v.kind}, ${v.value}, ${v.maxDiscountSatang}, '{}', ${v.startsAt ? v.startsAt.toISOString() : null}, ${v.endsAt ? v.endsAt.toISOString() : null}, ${v.maxUseTotal}, ${v.maxUsePerUser}, 'ACTIVE', 0, 'ops-engine', now())`,
  );
  return { ok: true, id };
}

export async function setStatus(id: string, status: "ACTIVE" | "PAUSED" | "EXPIRED"): Promise<boolean> {
  const db = createDbClient();
  const r = await db.execute(sql`UPDATE discount_code SET status = ${status} WHERE id = ${id} RETURNING id`);
  return rowsOf(r).length > 0;
}

/** ลบโค้ดส่วนลด — เฉพาะที่ "ยังไม่ถูกใช้" (used_count = 0) กัน FK discount_redemption + กันลบประวัติ. */
export async function deleteDiscount(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = createDbClient();
  const r = await db.execute(sql`DELETE FROM discount_code WHERE id = ${id} AND used_count = 0 RETURNING id`);
  if (rowsOf(r).length > 0) return { ok: true };
  const ex = await db.execute(sql`SELECT used_count FROM discount_code WHERE id = ${id} LIMIT 1`);
  if (rowsOf(ex).length === 0) return { ok: false, reason: "ไม่พบโค้ด" };
  return { ok: false, reason: "โค้ดถูกใช้ไปแล้ว ลบไม่ได้ (พักแทนได้)" };
}

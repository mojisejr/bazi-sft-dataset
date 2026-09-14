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
  createdAt: string;
};

const iso = (d: unknown): string | null => (d ? new Date(d as string).toISOString() : null);

function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

export async function listDiscounts(): Promise<OpsDiscount[]> {
  const db = createDbClient();
  const r = await db.execute(
    sql`SELECT id, code, kind, value, max_discount_satang, starts_at, ends_at, max_use_total, max_use_per_user, status, used_count, created_at
        FROM discount_code ORDER BY created_at DESC LIMIT 300`,
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
    createdAt: iso(x.created_at) ?? "",
  }));
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
    // ไม่ให้ลด 100% (FE rules MIN_CHARGE_SATANG กันยอดเป็น 0) — เพดาน 90%
    if (value < 1 || value > 90) return { ok: false, reason: "ส่วนลดเปอร์เซ็นต์ต้อง 1-90" };
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

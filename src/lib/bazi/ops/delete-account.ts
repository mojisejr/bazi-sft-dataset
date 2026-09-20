// src/lib/bazi/ops/delete-account.ts
// เอ็ม 2026-09-20: /ops (หลังบ้าน engine) ต้องมีปุ่ม "ลบบัญชี" — ลบออกจาก data จริง เพื่อให้ผู้ใช้ต้อง
// "สมัครใหม่เท่านั้น" ไว้เทสต์ LINE login ของคนใหม่. (ตัวลบในแอป /api/account/delete เป็นแบบพัก 30 วัน
// ไม่ลบ mapping → re-login เจอคนเดิม ใช้เทสต์ไม่ได้.)
//
// ตัวชี้ขาด = user_provider (register-login ของ LINE หา user จาก id_token ในตารางนี้) → ลบแล้ว = สมัครใหม่
// เป็น user_id ใหม่. ลบตารางที่ผูกตัวตน (คีย์ด้วย anonId=user_id) ตามลำดับลูก→identity ท้ายสุด. best-effort
// ต่อ table (ตารางหาย/คอลัมน์ไม่ตรงใน env ไหน จะข้ามไป ไม่ทำให้ทั้งชุดล้ม) — engine ใช้ Supabase เดียวกับ FE
// (ตาราง "user"/user_provider/member_subscription มีจริงบน prod).
import { sql } from "drizzle-orm";

import type { createDbClient } from "@/db/client";

type Db = ReturnType<typeof createDbClient>;

// { table, col } — col คือคอลัมน์ที่เก็บ user_id/anonId. ชื่อทั้งหมดเป็นค่าคงที่ (ไม่รับจาก input) → ปลอดภัย
// จาก SQL injection; ค่า anonId ผูกเป็น bound param เสมอ.
const TARGETS: Array<{ table: string; col: string }> = [
  { table: "user_provider", col: "user_id" }, // ★ ตัวชี้ขาด: LINE id_token → user
  { table: "member_subscription", col: "user_id" }, // tier/สมาชิก (shared)
  { table: "bazi_entitlement", col: "anon_id" }, // สิทธิ์/เครดิต (engine)
  { table: "bazi_ledger_txn", col: "anon_id" }, // ประวัติแต้ม QI
  { table: "bazi_wallet", col: "anon_id" }, // ยอด QI
  { table: "bazi_user_profile", col: "anon_id" }, // โปรไฟล์/วันเกิด (engine)
  { table: "user", col: "user_id" }, // identity — ท้ายสุด
];

export type DeleteAccountResult = { deleted: Record<string, number>; errors: string[] };

/**
 * ลบบัญชีออกจาก data ทั้งหมด (scoped ที่ anonId=user_id) ให้ re-login ด้วย LINE เป็น "คนใหม่".
 * คืนจำนวนแถวที่ลบต่อ table + รายการ error (best-effort — table ที่พลาดไม่ทำให้ทั้งชุดล้ม).
 */
export async function deleteAccountEverywhere(db: Db, anonId: string): Promise<DeleteAccountResult> {
  const deleted: Record<string, number> = {};
  const errors: string[] = [];

  for (const { table, col } of TARGETS) {
    try {
      const res = await db.execute(
        sql`DELETE FROM ${sql.raw(`"${table}"`)} WHERE ${sql.raw(`"${col}"`)} = ${anonId}`,
      );
      deleted[table] = Number((res as { count?: number }).count ?? 0);
    } catch (e) {
      errors.push(`${table}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return { deleted, errors };
}

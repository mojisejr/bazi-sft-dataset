/**
 * เตรียมคีย์ 60 กะจื่อ (แถวว่าง) ให้กลุ่ม spouse_knowledge_60 "บท 7 · ความรู้คู่ครอง 60 กะจื่อ"
 * — ซินแสเข้า /reading/newdata แล้วเติมเนื้อหาได้เลย ไม่ต้องพิมพ์คีย์เอง
 * idempotent: แถวที่มีอยู่แล้ว (ซินแสอาจกรอกไปแล้ว) ไม่ถูกแตะ (ON CONFLICT DO NOTHING)
 * Usage: node --env-file=.env --import tsx scripts/seed-spouse-knowledge-60.ts
 */
import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

/** 60 กะจื่อเรียงตามวัฏจักร (甲子 → 乙丑 → ... → 癸亥) */
function sixtyGanzhi(): string[] {
  const out: string[] = [];
  for (let i = 0; i < 60; i++) {
    out.push(`${STEMS[i % 10]}${BRANCHES[i % 12]}`);
  }
  return out;
}

async function main() {
  const sql = neon(getDatabaseUrl());
  const keys = sixtyGanzhi();
  let inserted = 0;
  for (const [i, key] of keys.entries()) {
    const r = await sql.query(
      `insert into bazi_newdata (group_key, item_key, ordinal, value, source_file)
       values ('spouse_knowledge_60', $1, $2, $3::jsonb, 'seed-spouse-knowledge-60')
       on conflict (group_key, item_key) do nothing`,
      [key, i, JSON.stringify({ text: "" })],
    );
    const count = (r as { rowCount?: number }).rowCount ?? (Array.isArray(r) ? 0 : 1);
    inserted += count ? 1 : 0;
  }
  const check = await sql.query(
    "select count(*)::int n from bazi_newdata where group_key = 'spouse_knowledge_60'",
  );
  const rows = (Array.isArray(check) ? check : (check as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
  console.log(`OK spouse_knowledge_60: rows in DB = ${rows[0]?.n ?? 0} (inserted new ${inserted})`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});

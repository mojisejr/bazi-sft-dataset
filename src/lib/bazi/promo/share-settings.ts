// src/lib/bazi/promo/share-settings.ts — อ่าน/แก้ตั้งค่า "แชร์เพื่อน Pro ฟรี 1 เดือน" (promo_share_campaign).
// ตาราง promo_share_campaign อยู่ DB เดียวกัน (ฝั่ง FE เป็นเจ้าของ logic) — engine /ops แก้ค่าให้ปรับได้ไม่ต้อง deploy.
import { sql } from "drizzle-orm";
import { createDbClient } from "@/db/client";

const CAMPAIGN_ID = "MUMATE_FREE_MONTH";

export type ShareSettings = { enabled: boolean; maxPerIssuer: number; maxTotal: number; usedTotal: number };

export async function getShareSettings(): Promise<ShareSettings | null> {
  const db = createDbClient();
  const r = (await db.execute(
    sql`SELECT enabled, max_per_issuer, max_total, used_count FROM promo_share_campaign WHERE id = ${CAMPAIGN_ID} LIMIT 1`,
  )) as unknown as Record<string, unknown>[];
  if (!r.length) return null;
  return {
    enabled: r[0].enabled !== false,
    maxPerIssuer: Number(r[0].max_per_issuer ?? 10),
    maxTotal: Number(r[0].max_total ?? 1000),
    usedTotal: Number(r[0].used_count ?? 0),
  };
}

export async function updateShareSettings(p: { enabled?: boolean; maxPerIssuer?: number; maxTotal?: number }): Promise<ShareSettings | null> {
  const db = createDbClient();
  const enabled = p.enabled === undefined ? null : p.enabled;
  const maxPerIssuer = p.maxPerIssuer === undefined ? null : Math.max(0, Math.floor(p.maxPerIssuer));
  const maxTotal = p.maxTotal === undefined ? null : Math.max(0, Math.floor(p.maxTotal));
  await db.execute(sql`
    UPDATE promo_share_campaign SET
      enabled = COALESCE(${enabled}, enabled),
      max_per_issuer = COALESCE(${maxPerIssuer}, max_per_issuer),
      max_total = COALESCE(${maxTotal}, max_total)
    WHERE id = ${CAMPAIGN_ID}`);
  return getShareSettings();
}

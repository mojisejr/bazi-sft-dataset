// src/lib/bazi/promo/campaign-link.ts — CRUD แคมเปญลิงก์ broadcast (บันทึก/แก้ไขได้จาก /ops).
// เก็บค่าที่ใช้ประกอบลิงก์ checkout ต่อ 1 กิจกรรม เพื่อกลับมาก็อป/แก้ทีหลัง (เอ็ม 2026-09-28).
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createDbClient } from "@/db/client";

export type CampaignLink = {
  id: string;
  name: string;
  packageCode: string;
  code: string | null;
  host: string;
  liffId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CampaignLinkInput = {
  name: string;
  packageCode: string;
  code?: string | null;
  host: string;
  liffId?: string | null;
};

function mapRow(r: Record<string, unknown>): CampaignLink {
  return {
    id: String(r.id),
    name: String(r.name),
    packageCode: String(r.package_code),
    code: r.code == null ? null : String(r.code),
    host: String(r.host),
    liffId: r.liff_id == null ? null : String(r.liff_id),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

const norm = (v?: string | null) => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

export async function listCampaignLinks(): Promise<CampaignLink[]> {
  const db = createDbClient();
  const rows = (await db.execute(
    sql`SELECT * FROM promo_campaign_link ORDER BY created_at DESC`,
  )) as unknown as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function createCampaignLink(input: CampaignLinkInput): Promise<CampaignLink> {
  const db = createDbClient();
  const id = randomUUID();
  const rows = (await db.execute(sql`
    INSERT INTO promo_campaign_link (id, name, package_code, code, host, liff_id)
    VALUES (${id}, ${input.name.trim()}, ${input.packageCode.trim()}, ${norm(input.code)}, ${input.host.trim()}, ${norm(input.liffId)})
    RETURNING *`)) as unknown as Record<string, unknown>[];
  return mapRow(rows[0]);
}

export async function updateCampaignLink(id: string, input: CampaignLinkInput): Promise<CampaignLink | null> {
  const db = createDbClient();
  const rows = (await db.execute(sql`
    UPDATE promo_campaign_link
    SET name = ${input.name.trim()}, package_code = ${input.packageCode.trim()}, code = ${norm(input.code)},
        host = ${input.host.trim()}, liff_id = ${norm(input.liffId)}, updated_at = now()
    WHERE id = ${id}
    RETURNING *`)) as unknown as Record<string, unknown>[];
  return rows.length ? mapRow(rows[0]) : null;
}

export async function deleteCampaignLink(id: string): Promise<boolean> {
  const db = createDbClient();
  const rows = (await db.execute(
    sql`DELETE FROM promo_campaign_link WHERE id = ${id} RETURNING id`,
  )) as unknown as Record<string, unknown>[];
  return rows.length > 0;
}

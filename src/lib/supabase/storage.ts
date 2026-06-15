/**
 * Supabase Storage helper สำหรับรูปไพ่โหมดเซียน
 * - อัปโหลดรูปขึ้น bucket (public) แล้วคืน public URL ไปเก็บใน DB
 * server-only (ใช้ service role key — ห้าม import ฝั่ง client)
 *
 * ตั้งค่าใน .env:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   SUPABASE_DIVINE_BUCKET=divine-cards   (ไม่ใส่ = "divine-cards")
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DIVINE_BUCKET = "divine-cards";

export function getDivineBucket(): string {
  return process.env.SUPABASE_DIVINE_BUCKET?.trim() || DEFAULT_DIVINE_BUCKET;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env ก่อนใช้ Supabase Storage",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * อัปโหลดรูปไพ่ขึ้น storage (upsert ทับของเดิม) แล้วคืน public URL
 * path = cards/<no>.<ext>
 */
export async function uploadDivineCardImage(
  cardNo: number,
  data: Buffer | Uint8Array,
  mime: string,
  client: SupabaseClient = createSupabaseAdmin(),
): Promise<string> {
  const bucket = getDivineBucket();
  const ext = mime.includes("png") ? "png" : "jpg";
  const objectPath = `cards/${cardNo}.${ext}`;

  const { error } = await client.storage.from(bucket).upload(objectPath, data, {
    contentType: mime,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) {
    throw new Error(`อัปโหลดรูปไพ่ #${cardNo} ขึ้น Supabase ไม่สำเร็จ: ${error.message}`);
  }

  const { data: pub } = client.storage.from(bucket).getPublicUrl(objectPath);
  return pub.publicUrl;
}

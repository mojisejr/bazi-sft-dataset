/**
 * Repository ของรูป mascot 60 ดิถี (ตาราง bazi_mascot_image)
 * factory + DI ทดสอบได้ — มิเรอร์ divine-cards/image-repository.ts
 */
import { eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziMascotImage, type SelectBaziMascotImage } from "@/db/schema";

export type MascotImageRow = SelectBaziMascotImage;

export type MascotImageInput = {
  nameTh: string;
  nameEn: string;
  /** URL บน Supabase Storage (แหล่งหลัก) */
  imageUrl?: string | null;
  mime: string;
};

export type MascotImageRepository = {
  /** ดึงรูปตามเสาวัน (กะจื่อ) — null ถ้าไม่มี */
  getByGanzhi: (ganzhi: string) => Promise<MascotImageRow | null>;
  /** ทั้งหมดที่มี */
  getAll: () => Promise<MascotImageRow[]>;
  /**
   * ganzhi + image_url เท่านั้น (คอลัมน์เดิม) — สำหรับ digest ตาข่าย 2.
   * select แคบไม่แตะ image_url_v2 ⇒ ใช้ได้แม้ก่อน migration (robust ต่อ Phase order).
   */
  listImageUrlPairs: () => Promise<Array<{ ganzhi: string; imageUrl: string | null }>>;
  upsert: (ganzhi: string, input: MascotImageInput) => Promise<void>;
  /**
   * เขียน "เฉพาะ" image_url_v2 (ชุด UI v2) — ⚠️ ไม่แตะ imageUrl เดิมเด็ดขาด.
   * แถวมีอยู่ → update เฉพาะ image_url_v2; แถวหาย → insert (imageUrl คง null, ชื่อจาก input).
   */
  setImageUrlV2: (ganzhi: string, input: MascotV2ImageInput) => Promise<void>;
};

export type MascotV2ImageInput = {
  nameTh: string;
  nameEn: string;
  /** URL ชุด v2 บน Supabase Storage (mascot-v2/) */
  imageUrlV2: string;
  mime?: string;
};

export function createDbMascotImageRepository(
  db = createDbClient(),
): MascotImageRepository {
  return {
    async getByGanzhi(ganzhi) {
      const rows = await db
        .select()
        .from(baziMascotImage)
        .where(eq(baziMascotImage.ganzhi, ganzhi))
        .limit(1);
      return rows[0] ?? null;
    },

    async getAll() {
      return db.select().from(baziMascotImage);
    },

    async listImageUrlPairs() {
      return db
        .select({ ganzhi: baziMascotImage.ganzhi, imageUrl: baziMascotImage.imageUrl })
        .from(baziMascotImage);
    },

    async upsert(ganzhi, input) {
      const { nameTh, nameEn, imageUrl = null, mime } = input;
      await db
        .insert(baziMascotImage)
        .values({ ganzhi, nameTh, nameEn, imageUrl, mime })
        .onConflictDoUpdate({
          target: baziMascotImage.ganzhi,
          set: { nameTh, nameEn, imageUrl, mime },
        });
    },

    async setImageUrlV2(ganzhi, input) {
      const { nameTh, nameEn, imageUrlV2, mime = "image/png" } = input;
      await db
        .insert(baziMascotImage)
        .values({ ganzhi, nameTh, nameEn, imageUrlV2, mime })
        .onConflictDoUpdate({
          target: baziMascotImage.ganzhi,
          // ⚠️ เฉพาะ image_url_v2 — ไม่มี imageUrl/nameTh/nameEn ใน set → ของเดิมไม่ถูกแตะ
          set: { imageUrlV2 },
        });
    },
  };
}

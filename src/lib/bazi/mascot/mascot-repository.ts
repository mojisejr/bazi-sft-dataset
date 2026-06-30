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
  upsert: (ganzhi: string, input: MascotImageInput) => Promise<void>;
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
  };
}

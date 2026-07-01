/**
 * Repository ของรูปไพ่ออราเคิลเคี้ยงคุง (ตาราง bazi_oracle_card_image)
 * factory + DI ทดสอบได้ — มิเรอร์ divine-cards/image-repository.ts
 */
import { inArray } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziOracleCardImage, type SelectBaziOracleCardImage } from "@/db/schema";

export type OracleCardImageRow = SelectBaziOracleCardImage;

export type OracleCardImageInput = {
  prompt: string;
  /** URL บน Supabase Storage (แหล่งหลัก) */
  imageUrl?: string | null;
  /** base64 (legacy/fallback) */
  imageBase64?: string | null;
  mime: string;
  model: string;
};

export type OracleCardImageRepository = {
  /** เลขไพ่ที่มีรูปแล้ว */
  listNos: () => Promise<number[]>;
  /** ดึงรูปตามเลขไพ่ (เฉพาะที่มี) */
  getByNos: (nos: number[]) => Promise<OracleCardImageRow[]>;
  upsert: (cardNo: number, input: OracleCardImageInput) => Promise<void>;
};

export function createDbOracleCardImageRepository(
  db = createDbClient(),
): OracleCardImageRepository {
  return {
    async listNos() {
      const rows = await db
        .select({ cardNo: baziOracleCardImage.cardNo })
        .from(baziOracleCardImage);
      return rows.map((r) => r.cardNo).sort((a, b) => a - b);
    },

    async getByNos(nos) {
      if (nos.length === 0) return [];
      return db
        .select()
        .from(baziOracleCardImage)
        .where(inArray(baziOracleCardImage.cardNo, nos));
    },

    async upsert(cardNo, input) {
      const { prompt, imageUrl = null, imageBase64 = null, mime, model } = input;
      await db
        .insert(baziOracleCardImage)
        .values({ cardNo, prompt, imageUrl, imageBase64, mime, model })
        .onConflictDoUpdate({
          target: baziOracleCardImage.cardNo,
          set: { prompt, imageUrl, imageBase64, mime, model },
        });
    },
  };
}

/**
 * Repository ของรูปไพ่โหมดเซียน (ตาราง bazi_divine_card_image)
 * factory + DI ทดสอบได้ — มิเรอร์ knowledge-override-repository.ts
 */
import { inArray } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziDivineCardImage, type SelectBaziDivineCardImage } from "@/db/schema";

export type DivineCardImageRow = SelectBaziDivineCardImage;

export type DivineCardImageRepository = {
  /** เลขไพ่ที่มีรูปแล้ว */
  listNos: () => Promise<number[]>;
  /** ดึงรูปตามเลขไพ่ (เฉพาะที่มี) */
  getByNos: (nos: number[]) => Promise<DivineCardImageRow[]>;
  upsert: (
    cardNo: number,
    prompt: string,
    imageBase64: string,
    mime: string,
    model: string,
  ) => Promise<void>;
};

export function createDbDivineCardImageRepository(
  db = createDbClient(),
): DivineCardImageRepository {
  return {
    async listNos() {
      const rows = await db
        .select({ cardNo: baziDivineCardImage.cardNo })
        .from(baziDivineCardImage);
      return rows.map((r) => r.cardNo).sort((a, b) => a - b);
    },

    async getByNos(nos) {
      if (nos.length === 0) return [];
      return db
        .select()
        .from(baziDivineCardImage)
        .where(inArray(baziDivineCardImage.cardNo, nos));
    },

    async upsert(cardNo, prompt, imageBase64, mime, model) {
      await db
        .insert(baziDivineCardImage)
        .values({ cardNo, prompt, imageBase64, mime, model })
        .onConflictDoUpdate({
          target: baziDivineCardImage.cardNo,
          set: { prompt, imageBase64, mime, model },
        });
    },
  };
}

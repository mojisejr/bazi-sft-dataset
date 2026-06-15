/**
 * บีบอัดรูปไพ่ที่เก็บไว้แล้วใน DB (PNG ใหญ่ → JPEG เล็ก) โดย "ไม่เรียก Imagen ซ้ำ"
 * ใช้ครั้งเดียวหลังจากเคย gen เป็น PNG ขนาดเต็มไปแล้ว
 *
 * Usage: node --env-file=.env --import tsx scripts/recompress-divine-images.ts
 */
import { createDbClient } from "../src/db/client";
import { baziDivineCardImage } from "../src/db/schema";
import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { createDbDivineCardImageRepository } from "../src/lib/bazi/divine-cards/image-repository";

async function main() {
  const db = createDbClient();
  const repo = createDbDivineCardImageRepository(db);
  // ดึงแค่ card_no + mime (เล็ก) — เลี่ยง limit response 64MB ของ Neon HTTP
  const meta = await db
    .select({ cardNo: baziDivineCardImage.cardNo, mime: baziDivineCardImage.mime })
    .from(baziDivineCardImage);
  console.log(`พบรูป ${meta.length} ใบ`);

  let changed = 0;
  let before = 0;
  let after = 0;
  for (const m of meta) {
    if (m.mime === "image/jpeg") continue; // บีบแล้ว ข้าม (กันรันซ้ำ)
    // ดึงทีละใบ (รูปใหญ่ ~2.5MB)
    const [row] = await repo.getByNos([m.cardNo]);
    if (!row) continue;
    before += row.imageBase64.length;
    const out = await compressCardImage(row.imageBase64);
    after += out.base64.length;
    await repo.upsert(row.cardNo, row.prompt, out.base64, out.mime, row.model);
    changed += 1;
    console.log(
      `  ✓ #${row.cardNo}: ${(row.imageBase64.length / 1024).toFixed(0)}KB → ${(out.base64.length / 1024).toFixed(0)}KB`,
    );
  }

  console.log(
    `\nบีบอัด ${changed} ใบ — รวม ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB`,
  );
}

main().catch((e) => {
  console.error("RECOMPRESS FAILED:", e);
  process.exit(1);
});

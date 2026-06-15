/**
 * สร้างรูปไพ่โหมดเซียนครบทั้ง 80 ใบด้วย Imagen แล้วเก็บลง DB (bazi_divine_card_image)
 *
 * ต้องรัน migration ก่อน: npm run db:apply:divine-card-image
 * Usage:
 *   node --env-file=.env --import tsx scripts/generate-divine-images.ts          # เฉพาะใบที่ยังไม่มี
 *   node --env-file=.env --import tsx scripts/generate-divine-images.ts --force  # สร้างใหม่ทับทั้งหมด
 *
 * อ่าน GEMINI_API_KEY จาก env (override ด้วย --key=xxx ได้)
 */
import { getAllCards } from "../src/lib/bazi/divine-cards/deck";
import { generateCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { createDbDivineCardImageRepository } from "../src/lib/bazi/divine-cards/image-repository";
import { uploadDivineCardImage } from "../src/lib/supabase/storage";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

async function main() {
  const force = process.argv.includes("--force");
  const apiKey = arg("key") ?? process.env.GEMINI_API_KEY?.trim();
  const model = arg("model");
  if (!apiKey) {
    throw new Error("ไม่พบ GEMINI_API_KEY (ตั้งใน .env หรือส่ง --key=xxx)");
  }

  const limit = Number(arg("limit") ?? "0") || 0;
  const repo = createDbDivineCardImageRepository();
  const existing = new Set(await repo.listNos());
  let cards = getAllCards().filter((c) => force || !existing.has(c.no));
  if (limit > 0) cards = cards.slice(0, limit);

  console.log(`จะสร้างรูป ${cards.length} ใบ (ทั้งหมด ${getAllCards().length}, มีแล้ว ${existing.size})`);

  let ok = 0;
  const failed: Array<{ no: number; error: string }> = [];
  for (const card of cards) {
    try {
      const img = await generateCardImage(card, { apiKey, model });
      const buf = Buffer.from(img.imageBase64, "base64");
      const url = await uploadDivineCardImage(card.no, buf, img.mime);
      await repo.upsert(card.no, {
        prompt: img.prompt,
        imageUrl: url,
        imageBase64: null,
        mime: img.mime,
        model: img.model,
      });
      ok += 1;
      console.log(`  ✓ #${card.no} ${card.name} (${ok}/${cards.length})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "gen ล้มเหลว";
      failed.push({ no: card.no, error: message });
      console.warn(`  ✗ #${card.no} ${card.name}: ${message}`);
    }
  }

  console.log(`\nเสร็จ: สำเร็จ ${ok} ใบ, ล้มเหลว ${failed.length} ใบ`);
  if (failed.length > 0) {
    console.log("ล้มเหลว:", failed.map((f) => `#${f.no}`).join(", "));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("GENERATE FAILED:", e);
  process.exit(1);
});

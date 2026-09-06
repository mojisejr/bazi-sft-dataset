/**
 * build-card-faces — บีบรูปหน้าไพ่จาก knownlage/ (ดิบ ~180MB) เป็นไฟล์เล็ก JPEG (~480px q80)
 * เก็บที่ card-faces/{oracle,divine,sage}/{no}.jpg เพื่อ commit + bundle ขึ้น prod ได้
 * (knownlage ดิบใหญ่เกิน serverless). รันครั้งเดียว/เมื่อรูปต้นทางเปลี่ยน:  npx tsx scripts/build-card-faces.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getCardImageBytes, listCardNos, type CardDeck } from "@/lib/bazi/card-images/file-source";

const OUT = path.join(process.cwd(), "card-faces");
const DECKS: CardDeck[] = ["oracle", "divine", "sage"];

async function main() {
  for (const deck of DECKS) {
    const dir = path.join(OUT, deck);
    mkdirSync(dir, { recursive: true });
    const nos = listCardNos(deck);
    let ok = 0;
    for (const no of nos) {
      const img = await getCardImageBytes(deck, no);
      if (!img) {
        console.warn(`  ! ${deck} #${no}: ไม่พบไฟล์ต้นทาง`);
        continue;
      }
      writeFileSync(path.join(dir, `${no}.jpg`), img.buf);
      ok += 1;
    }
    console.log(`${deck}: เขียน ${ok}/${nos.length} ใบ → ${dir}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

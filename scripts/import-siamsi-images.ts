/**
 * อัปโหลดรูปไพ่เซียมซีเคี้ยงคุง (80 ใบ, ~4MB/ใบ ทรงไม้เซียมซี 1842×5622) จากโฟลเดอร์รูป <dir>/<เลขไพ่>.jpg
 * → ย่อด้วย compressCardImage (กว้าง 600px — ไพ่ทรงยาว 1:3) → Supabase Storage bucket "siamsi-cards"
 * แล้วเขียน imageUrl กลับลง src/lib/bazi/data/siamsi-kiangkung.json (มิเรอร์ import-fengshui-images.ts)
 * ที่มา: Drive โฟลเดอร์ไพ่เซียมซีเคี้ยงคุงที่ซินแสนุ้ยส่งมา 2026-10-15 (ไฟล์ ss<เลข><ชื่อ>.jpg → ตั้งชื่อใหม่เป็น <เลข>.jpg)
 *
 * Usage: node --env-file=.env --import tsx scripts/import-siamsi-images.ts <imageDir>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { ensureSiamsiBucket, uploadSiamsiCardImage } from "../src/lib/supabase/storage";

const IMG_DIR = process.argv[2];
if (!IMG_DIR) throw new Error("ระบุโฟลเดอร์รูป: ... import-siamsi-images.ts <imageDir>");
const JSON_PATH = path.join(process.cwd(), "src", "lib", "bazi", "data", "siamsi-kiangkung.json");

type Card = { no: number; name: string; imageUrl?: string | null };

async function main() {
  const cards = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Card[];
  await ensureSiamsiBucket();
  let before = 0;
  let after = 0;
  const missing: number[] = [];
  for (const card of cards) {
    const file = path.join(IMG_DIR, `${card.no}.jpg`);
    if (!existsSync(file)) {
      missing.push(card.no);
      continue;
    }
    const raw = readFileSync(file);
    before += raw.length;
    const out = await compressCardImage(raw.toString("base64"), { width: 600, quality: 82 });
    const buf = Buffer.from(out.base64, "base64");
    after += buf.length;
    card.imageUrl = await uploadSiamsiCardImage(card.no, buf, out.mime);
    console.log(`  ✓ #${card.no} ${card.name} (${(raw.length / 1048576).toFixed(1)}MB → ${(buf.length / 1024).toFixed(0)}KB)`);
  }
  writeFileSync(JSON_PATH, JSON.stringify(cards, null, 2) + "\n", "utf8");
  console.log(`\nอัปโหลด ${cards.length - missing.length}/${cards.length} ใบ — ${(before / 1048576).toFixed(0)}MB → ${(after / 1048576).toFixed(1)}MB`);
  if (missing.length) console.log(`⚠️ ไม่พบรูป: ${missing.join(", ")}`);
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e);
  process.exit(1);
});

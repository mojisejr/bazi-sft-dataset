/**
 * อัปโหลดรูปไพ่อาถรรพ์ฮวงจุ้ย (78 ใบ, ~6MB/ใบ) จากโฟลเดอร์รูป <dir>/<เลขไพ่>.jpg
 * → ย่อด้วย compressCardImage (กว้าง 900px) → Supabase Storage bucket "fengshui-cards"
 * แล้วเขียน imageUrl กลับลง src/lib/bazi/data/fengshui-cards.json (มิเรอร์ import-tarot-images.ts)
 * ที่มา: Drive โฟลเดอร์ "อาถรรพ์ฮวงจุ้ย" ที่ซินแสนุ้ยส่งมา 2026-10-07 (ไฟล์ FS<เลข><ชื่อ>.jpg → ตั้งชื่อใหม่เป็น <เลข>.jpg)
 *
 * Usage: node --env-file=.env --import tsx scripts/import-fengshui-images.ts <imageDir>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { ensureFengshuiBucket, uploadFengshuiCardImage } from "../src/lib/supabase/storage";

const IMG_DIR = process.argv[2];
if (!IMG_DIR) throw new Error("ระบุโฟลเดอร์รูป: ... import-fengshui-images.ts <imageDir>");
const JSON_PATH = path.join(process.cwd(), "src", "lib", "bazi", "data", "fengshui-cards.json");

type Card = { no: number; name: string; imageUrl?: string | null };

async function main() {
  const cards = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Card[];
  await ensureFengshuiBucket();
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
    const out = await compressCardImage(raw.toString("base64"), { width: 900, quality: 82 });
    const buf = Buffer.from(out.base64, "base64");
    after += buf.length;
    card.imageUrl = await uploadFengshuiCardImage(card.no, buf, out.mime);
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

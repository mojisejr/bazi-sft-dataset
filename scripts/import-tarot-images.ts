/**
 * อัปโหลดรูปไพ่ทาโรต์ Oriental Charm (78 ใบ, ~6.5MB/ใบ) จาก ../The Oriental Charm Tarot/*.jpg
 * → ย่อด้วย compressCardImage (sharp, กว้าง 900px JPEG) → Supabase Storage bucket "tarot-cards"
 * แล้วเขียน imageUrl กลับลง src/lib/bazi/data/tarot-tao.json (มิเรอร์ import-fortune-sage-images.ts)
 *
 * Usage: node --env-file=.env --import tsx scripts/import-tarot-images.ts [imageDir]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { ensureTarotBucket, uploadTarotCardImage } from "../src/lib/supabase/storage";

const ROOT = process.cwd();
const IMG_DIR = process.argv[2] ?? path.join(ROOT, "..", "The Oriental Charm Tarot");
const JSON_PATH = path.join(ROOT, "src", "lib", "bazi", "data", "tarot-tao.json");

type Card = { no: number; name: string; imageUrl?: string | null };

/** ชื่อไฟล์/ชื่อไพ่ → คีย์เทียบ: ตัดนามสกุล, ส่วนหลัง "—", วงเล็บหลง, "The " นำหน้า, ช่องว่างซ้ำ */
export function cardKey(s: string): string {
  return s
    .replace(/\.[a-z]+$/i, "")
    .split("—")[0]
    .replace(/[()]/g, "")
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ");
}

async function main() {
  const cards = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Card[];
  const files = new Map(readdirSync(IMG_DIR).map((f) => [cardKey(f), f]));
  await ensureTarotBucket();

  let before = 0;
  let after = 0;
  const missing: string[] = [];
  for (const card of cards) {
    const file = files.get(cardKey(card.name));
    if (!file) {
      missing.push(card.name);
      continue;
    }
    const raw = readFileSync(path.join(IMG_DIR, file));
    before += raw.length;
    const out = await compressCardImage(raw.toString("base64"), { width: 900, quality: 82 });
    const buf = Buffer.from(out.base64, "base64");
    after += buf.length;
    card.imageUrl = await uploadTarotCardImage(card.no, buf, out.mime);
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

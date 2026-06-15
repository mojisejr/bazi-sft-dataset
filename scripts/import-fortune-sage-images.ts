/**
 * อัปโหลดรูปหัวเซี่ยงแซ (เซียนเสี่ยงทาย) จาก knownlage/เซียนเสี่ยงทาย/NN.jpg ขึ้น Supabase Storage
 * แล้วเขียน "เฉพาะ public URL" กลับลง src/lib/bazi/data/fortune-sage.json (ไม่เก็บ base64, ไม่ใช้ DB)
 *
 * Usage: node --env-file=.env --import tsx scripts/import-fortune-sage-images.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { ensureFortuneBucket, uploadFortuneStickImage } from "../src/lib/supabase/storage";

const ROOT = process.cwd();
const IMG_DIR = path.join(ROOT, "knownlage", "เซียนเสี่ยงทาย");
const JSON_PATH = path.join(ROOT, "src", "lib", "bazi", "data", "fortune-sage.json");

type Stick = { no: number; imageUrl?: string | null };

async function main() {
  const sticks = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Stick[];
  console.log(`หัวเซี่ยงแซใน JSON: ${sticks.length} หัว`);

  await ensureFortuneBucket();

  let before = 0;
  let after = 0;
  const missing: number[] = [];

  for (const stick of sticks) {
    const file = path.join(IMG_DIR, `${String(stick.no).padStart(2, "0")}.jpg`);
    if (!existsSync(file)) {
      missing.push(stick.no);
      continue;
    }
    const raw = readFileSync(file);
    before += raw.length;
    const out = await compressCardImage(raw.toString("base64"));
    after += out.base64.length;
    const buf = Buffer.from(out.base64, "base64");
    const url = await uploadFortuneStickImage(stick.no, buf, out.mime);
    stick.imageUrl = url;
    console.log(`  ✓ #${stick.no} (${(buf.length / 1024).toFixed(0)}KB) → ${url}`);
  }

  writeFileSync(JSON_PATH, JSON.stringify(sticks, null, 2) + "\n", "utf8");

  console.log(
    `\nอัปโหลด ${sticks.length - missing.length} ใบ — รวม ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB`,
  );
  if (missing.length) console.log(`⚠️ ไม่พบไฟล์รูปสำหรับหัว: ${missing.join(", ")}`);
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e);
  process.exit(1);
});

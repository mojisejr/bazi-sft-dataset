/**
 * อัปโหลดรูป mascot 60 ดิถี จาก knownlage/NewData/รูป 60ดิถี/<file>.png ขึ้น Supabase Storage
 * → ย่อขนาดคงพื้นหลังโปร่ง (PNG/alpha) → upsert ลง DB (ganzhi → ลิงก์ + ชื่อ)
 *
 * Usage: node --env-file=.env --import tsx scripts/import-mascot-images.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { MASCOT_60 } from "../src/lib/bazi/mascot/mascot-60";
import { createDbMascotImageRepository } from "../src/lib/bazi/mascot/mascot-repository";
import { ensureMascotBucket, uploadMascotImage } from "../src/lib/supabase/storage";

const ROOT = process.cwd();
const IMG_DIR = path.join(ROOT, "knownlage", "NewData", "รูป 60ดิถี");

/** กว้างสุด px — mascot เป็นภาพการ์ตูน เก็บ PNG คงความโปร่ง */
const MASCOT_WIDTH = 512;

/** สลัก path-safe สำหรับ Supabase object (ตัดเว้นวรรคในชื่อไฟล์ที่พิมพ์แปลก) */
function objectKey(file: string): string {
  return file.replace(/\s+/g, "");
}

async function resizePng(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize({ width: MASCOT_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  console.log(`mascot ใน mapping: ${MASCOT_60.length} ตัว`);
  await ensureMascotBucket();
  const repo = createDbMascotImageRepository();

  let before = 0;
  let after = 0;
  const missing: string[] = [];
  let ok = 0;

  for (const m of MASCOT_60) {
    const file = path.join(IMG_DIR, `${m.file}.png`);
    if (!existsSync(file)) {
      missing.push(`${m.ganzhi} (${m.file}.png)`);
      continue;
    }
    const raw = readFileSync(file);
    before += raw.length;
    const out = await resizePng(raw);
    after += out.length;
    const url = await uploadMascotImage(objectKey(m.file), out, "image/png");
    await repo.upsert(m.ganzhi, {
      nameTh: m.nameTh,
      nameEn: m.nameEn,
      imageUrl: url,
      mime: "image/png",
    });
    ok += 1;
    console.log(`  ✓ ${m.ganzhi} ${m.nameTh}/${m.nameEn} (${(out.length / 1024).toFixed(0)}KB) → ${url}`);
  }

  console.log(
    `\nเสร็จ: อัปโหลด ${ok}/${MASCOT_60.length} | ขนาด ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB`,
  );
  if (missing.length > 0) {
    console.warn(`ไฟล์หาย ${missing.length}:`);
    for (const x of missing) console.warn(`  - ${x}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e);
  process.exit(1);
});

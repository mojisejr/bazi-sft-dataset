/**
 * นำเข้ารูปไพ่โหมดเซียน "จากไฟล์จริง" ใน knownlage/ไพ่เทพ/ แทนรูปที่ gen ด้วย Imagen
 * - อ่านไฟล์ NN.<ชื่อ>.png/.jpg → บีบเป็น JPEG 640px → upsert ลง DB (ทับของเดิม = ลบ gen ทิ้ง)
 * - อัปเดตชื่อไพ่ใน src/lib/bazi/data/divine-cards.json ให้ตรงกับชื่อไฟล์ภาพ
 *
 * Usage: node --env-file=.env --import tsx scripts/import-divine-images.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { createDbDivineCardImageRepository } from "../src/lib/bazi/divine-cards/image-repository";
import { ensureDivineBucket, uploadDivineCardImage } from "../src/lib/supabase/storage";

const ROOT = process.cwd();
const IMG_DIR = path.join(ROOT, "knownlage", "ไพ่เทพ");
const JSON_PATH = path.join(ROOT, "src", "lib", "bazi", "data", "divine-cards.json");

/** แยกเลขไพ่ + ชื่อจากชื่อไฟล์ เช่น "05เจ้าแม่กวนอิม .อุปสรรค กอบกู้.png" → {no:5, name:"เจ้าแม่กวนอิม อุปสรรค กอบกู้"} */
function parseFile(file: string): { no: number; name: string } | null {
  const m = file.match(/^(\d+)\s*\.?\s*(.+)\.(png|jpe?g)$/i);
  if (!m) return null;
  const no = parseInt(m[1], 10);
  const name = m[2].replace(/\./g, " ").replace(/\s+/g, " ").trim();
  return { no, name };
}

async function main() {
  const files = readdirSync(IMG_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  const parsed = files
    .map((f) => ({ file: f, ...(parseFile(f) ?? { no: 0, name: "" }) }))
    .filter((p) => p.no > 0);
  parsed.sort((a, b) => a.no - b.no);
  console.log(`พบไฟล์รูป ${parsed.length} ใบ`);

  await ensureDivineBucket();
  const repo = createDbDivineCardImageRepository();
  const nameByNo = new Map<number, string>();
  let before = 0;
  let after = 0;

  for (const p of parsed) {
    const raw = readFileSync(path.join(IMG_DIR, p.file));
    before += raw.length;
    const out = await compressCardImage(raw.toString("base64"));
    after += out.base64.length;
    const buf = Buffer.from(out.base64, "base64");
    const url = await uploadDivineCardImage(p.no, buf, out.mime);
    await repo.upsert(p.no, {
      prompt: `manual upload: ${p.file}`,
      imageUrl: url,
      imageBase64: null,
      mime: out.mime,
      model: "manual-upload",
    });
    nameByNo.set(p.no, p.name);
    console.log(`  ✓ #${p.no} ${p.name} (${(buf.length / 1024).toFixed(0)}KB) → ${url}`);
  }

  // อัปเดตชื่อใน JSON ให้ตรงไฟล์
  const cards = JSON.parse(readFileSync(JSON_PATH, "utf8")) as Array<{ no: number; name: string }>;
  let renamed = 0;
  for (const card of cards) {
    const newName = nameByNo.get(card.no);
    if (newName && newName !== card.name) {
      card.name = newName;
      renamed += 1;
    }
  }
  writeFileSync(JSON_PATH, JSON.stringify(cards, null, 2) + "\n", "utf8");

  console.log(
    `\nนำเข้า ${parsed.length} ใบ — รวม ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB`,
  );
  console.log(`เปลี่ยนชื่อใน JSON ${renamed} ใบ`);
  const missing = cards.filter((c) => !nameByNo.has(c.no)).map((c) => c.no);
  if (missing.length) console.log(`⚠️ ไม่พบไฟล์รูปสำหรับใบ: ${missing.join(", ")}`);
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e);
  process.exit(1);
});

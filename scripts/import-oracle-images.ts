/**
 * นำเข้ารูปไพ่ออราเคิลเคี้ยงคุง "จากไฟล์จริง" ใน knownlage/ไพ่ออราเคิลเคี้ยงคุง/
 * - ไฟล์ตั้งชื่อเป็นเลขล้วน N.jpg (1..120) — ชื่อไพ่มาจาก oracle-cards.json (ไม่ได้อยู่ในชื่อไฟล์)
 * - เคสพิเศษ: ไม่มี 100.jpg แต่มี "99(1).jpg" ที่จริงคือรูปการ์ด 100 → แมปให้เป็นเลข 100
 * - บีบเป็น JPEG 640px → อัปโหลด Supabase → upsert URL ลง DB
 *
 * Usage: node --env-file=.env --import tsx scripts/import-oracle-images.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { compressCardImage } from "../src/lib/bazi/divine-cards/image-gen";
import { createDbOracleCardImageRepository } from "../src/lib/bazi/oracle-cards/image-repository";
import { ensureOracleBucket, uploadOracleCardImage } from "../src/lib/supabase/storage";

const ROOT = process.cwd();
const KNOWNLAGE = path.join(ROOT, "knownlage");

/** หา directory ที่เก็บรูปไพ่ออราเคิล (โฟลเดอร์ชื่อขึ้นต้น "ไพ่ออราเคิล" — เผื่อมีช่องว่างท้ายชื่อ) */
function findImageDir(): string {
  const stack = [KNOWNLAGE];
  let best: { dir: string; count: number } | null = null;
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    const jpgs = entries.filter((e) => /\.jpe?g$/i.test(e));
    if (dir.includes("ออราเคิล") && jpgs.length > (best?.count ?? 0)) {
      best = { dir, count: jpgs.length };
    }
    for (const e of entries) {
      const full = path.join(dir, e);
      try {
        if (statSync(full).isDirectory()) stack.push(full);
      } catch {
        /* ignore */
      }
    }
  }
  if (!best) throw new Error("ไม่พบโฟลเดอร์รูปไพ่ออราเคิลใน knownlage/");
  return best.dir;
}

/** แยกเลขไพ่จากชื่อไฟล์: "5.jpg" → 5, "99(1).jpg" → 100 (การ์ด 100 ที่ตั้งชื่อผิด) */
function cardNoFromFile(file: string): number | null {
  const base = file.replace(/\.jpe?g$/i, "").trim();
  if (/^99\s*\(1\)$/.test(base)) return 100;
  const m = base.match(/^(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

async function main() {
  const imgDir = findImageDir();
  console.log(`โฟลเดอร์รูป: ${path.relative(ROOT, imgDir)}`);

  const files = readdirSync(imgDir).filter((f) => /\.jpe?g$/i.test(f));
  const parsed = files
    .map((file) => ({ file, no: cardNoFromFile(file) }))
    .filter((p): p is { file: string; no: number } => p.no !== null && p.no > 0);
  parsed.sort((a, b) => a.no - b.no);
  console.log(`พบไฟล์รูปที่แมปเลขได้ ${parsed.length} ใบ`);

  await ensureOracleBucket();
  const repo = createDbOracleCardImageRepository();
  const seen = new Set<number>();
  let before = 0;
  let after = 0;

  for (const p of parsed) {
    if (seen.has(p.no)) {
      console.log(`  ! ข้าม ${p.file} (เลข ${p.no} ซ้ำ)`);
      continue;
    }
    const raw = readFileSync(path.join(imgDir, p.file));
    before += raw.length;
    const out = await compressCardImage(raw.toString("base64"));
    after += out.base64.length;
    const buf = Buffer.from(out.base64, "base64");
    const url = await uploadOracleCardImage(p.no, buf, out.mime);
    await repo.upsert(p.no, {
      prompt: `manual upload: ${p.file}`,
      imageUrl: url,
      imageBase64: null,
      mime: out.mime,
      model: "manual-upload",
    });
    seen.add(p.no);
    console.log(`  ✓ #${p.no} (${(buf.length / 1024).toFixed(0)}KB) → ${url}`);
  }

  console.log(
    `\nนำเข้า ${seen.size} ใบ — รวม ${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB`,
  );
  const missing: number[] = [];
  for (let n = 1; n <= 120; n += 1) if (!seen.has(n)) missing.push(n);
  if (missing.length) console.log(`⚠️ ยังไม่มีรูปสำหรับใบ: ${missing.join(", ")}`);
}

main().catch((e) => {
  console.error("IMPORT FAILED:", e);
  process.exit(1);
});

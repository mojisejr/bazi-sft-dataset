/**
 * นำเข้ารูป mascot ชุด UI v2 "scenic" (60 ไฟล์ NN_นักษัตร-ธาตุ.jpg มีพื้นหลังเต็มกรอบ)
 * → prod Supabase Storage bucket mootech-v2 โฟลเดอร์ mascot/
 * → upsert เฉพาะคอลัมน์ image_url_v2 (⚠️ ไม่แตะ image_url เดิม, ไม่แตะ bucket mootech ของระบบอื่น)
 *
 * ⛔ ห้ามใช้ scripts/import-mascot-images.ts (ตัวเดิม upsert ทับ image_url). นี่คือตัวแยกใหม่.
 *
 * นามสกุล/mime คุมจากที่เดียว = IMAGE_FORMAT (ปัจจุบัน jpg/image/jpeg). ไฟล์ .png ชุดโปร่งใสเดิม
 * บน storage ไม่ถูกลบ (คนละ key) — เป็นทางถอยกลับ.
 *
 * ตาข่าย (ฟีมกำชับ กันภาพหาย/DB พัง):
 *   1) assertProdTargets — bucket ต้อง mootech-v2 + SUPABASE_URL ต้อง soxsccdlsycaevusndro ไม่งั้น throw ก่อนเขียน
 *   2) md5(image_url) before==baseline และ after==before — image_url เดิมขยับ = fail ดังๆ
 *   3) dry-run พิมพ์ bucket + path ตัวอย่างให้ฟีมเห็นก่อนเสมอ
 *
 * แหล่งรูป (อ่านอย่างเดียว): $MASCOT_V2_DIR หรือ default = ../mootech-fe/public/images/v2/cards
 *
 * Usage:
 *   ตรวจก่อน (ไม่เขียนอะไรเลย):  node --env-file=.env --import tsx scripts/import-mascot-v2-images.ts --dry-run
 *   ยิงจริง (ฟีมสั่งเท่านั้น):    node --env-file=.env --import tsx scripts/import-mascot-v2-images.ts
 *
 * กฎ: ครบ 60 หรือล้ม — ขาดแม้ไฟล์เดียว = throw ก่อนอัปโหลดใดๆ (ห้าม skip เงียบแล้วรายงานสำเร็จ).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  assertImageUrlRowCount,
  assertProdTargets,
  checkProdTargets,
  imageUrlColumnDigest,
  PROD_IMAGE_URL_BASELINE_MD5,
  REQUIRED_BUCKET,
} from "../src/lib/bazi/mascot/mascot-v2-guards";
import { buildMascotV2Table } from "../src/lib/bazi/mascot/mascot-v2";
import {
  createDbMascotImageRepository,
  type MascotImageRepository,
} from "../src/lib/bazi/mascot/mascot-repository";
import {
  ensureMascotBucket,
  getMascotBucket,
  uploadMascotV2Image,
} from "../src/lib/supabase/storage";

/** baseline image_url (ของเก่า ห้ามขยับ) — override ได้ด้วย EXPECTED_IMAGE_URL_MD5 */
const EXPECTED_IMAGE_URL_MD5 = process.env.EXPECTED_IMAGE_URL_MD5?.trim() || PROD_IMAGE_URL_BASELINE_MD5;

/**
 * ชุดรูปที่อัป — คุมนามสกุล+mime ทั้งไฟล์จากที่เดียว.
 * ชุด scenic v2 = jpg (มีพื้นหลังเต็มกรอบ ไม่มี alpha).
 * ⚠️ ext ที่ upload จริงมาจาก mime ผ่าน uploadMascotV2Image (mime.includes("png") ? png : jpg) —
 *    ext ที่นี่ใช้แค่ "หา/แสดง" ต้องตรงกับที่ mime แปลงเป็น มิฉะนั้น dry-run กับของจริงจะเพี้ยน.
 */
const IMAGE_FORMAT = { ext: "jpg", mime: "image/jpeg" } as const;

/** กว้างสุด px — คงเท่าเดิม 512 (เปลี่ยนแค่นามสกุล/พื้นหลัง ไม่เปลี่ยนขนาด) */
const MASCOT_WIDTH = 512;

function srcDir(): string {
  return (
    process.env.MASCOT_V2_DIR?.trim() ||
    path.resolve(process.cwd(), "../mootech-fe/public/images/v2/cards")
  );
}

/** URL public ที่ "จะได้" หลังอัปโหลด (เดาได้จากรูปแบบ Supabase) — โชว์ตอน dry-run เท่านั้น */
function predictedUrl(bucket: string, storageKey: string): string {
  const base = process.env.SUPABASE_URL?.trim();
  const objectPath = `mascot/${storageKey}.${IMAGE_FORMAT.ext}`;
  return base
    ? `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`
    : `(ตั้ง SUPABASE_URL เพื่อดู URL ล่วงหน้า) → ${bucket}/${objectPath}`;
}

/** ลายนิ้วมือ + จำนวนแถว image_url ปัจจุบันจาก DB (select แคบ ganzhi+image_url) — ตาข่าย 2 */
async function currentImageUrlState(repo: MascotImageRepository): Promise<{ digest: string; count: number }> {
  const rows = await repo.listImageUrlPairs();
  return { digest: imageUrlColumnDigest(rows), count: rows.length };
}

async function resizeImage(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .resize({ width: MASCOT_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/** ตรวจครบ 60 ก่อนเขียนใดๆ — คืน list ที่อ่านได้ หรือ throw ถ้าขาด */
function resolveSources() {
  const dir = srcDir();
  const table = buildMascotV2Table(); // โยนเองถ้า mapping ไม่ครบ 60
  const missing: string[] = [];
  const resolved = table.map((e) => {
    const file = path.join(dir, `${e.filename}.${IMAGE_FORMAT.ext}`);
    if (!existsSync(file)) missing.push(`${e.ganzhi} → ${e.filename}.${IMAGE_FORMAT.ext}`);
    return { ...e, file };
  });
  if (missing.length > 0) {
    throw new Error(
      `ไฟล์ v2 หาย ${missing.length}/${table.length} ในโฟลเดอร์ ${dir}:\n` +
        missing.map((m) => `  - ${m}`).join("\n") +
        `\n(ครบ 60 หรือล้ม — ห้าม import บางส่วน)`,
    );
  }
  return { dir, resolved };
}

function printDryRun(dir: string, resolved: ReturnType<typeof resolveSources>["resolved"]) {
  const bucket = getMascotBucket();
  const supaUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const projectRef = supaUrl.replace(/^https?:\/\//, "").split(".")[0] || "(ไม่ได้ตั้ง SUPABASE_URL)";
  const target = checkProdTargets(bucket, supaUrl);

  console.log(`\n=== DRY-RUN (ไม่เขียนอะไรเลย) ===`);
  console.log(`\n🎯 TARGET CHECK (ตาข่าย 3 — ฟีมดูตรงนี้ก่อน):`);
  console.log(`   bucket        : "${bucket}"   ${bucket === REQUIRED_BUCKET ? "✅" : `❌ ต้องเป็น ${REQUIRED_BUCKET}`}`);
  console.log(`   project (URL) : "${projectRef}"   ${supaUrl.includes("soxsccdlsycaevusndro") ? "✅ prod" : "❌ ไม่ใช่ prod soxsccdlsycaevusndro"}`);
  console.log(`   overall       : ${target.ok ? "✅ ปลายทางถูก — รันจริงได้" : `⛔ ${target.reason}`}`);
  console.log(`\nแหล่งรูป : ${dir}`);
  console.log(`ปลายทาง  : ${bucket}/mascot/<key>.${IMAGE_FORMAT.ext}`);
  console.log(`คอลัมน์  : bazi_mascot_image.image_url_v2 (ไม่แตะ image_url เดิม)`);
  console.log(`baseline image_url ที่จะเฝ้า (ตาข่าย 2): ${EXPECTED_IMAGE_URL_MD5}\n`);
  console.log(`  #  | ganzhi | filename                 | ชื่อ (th/en)        | KB   | → object (ascii key)`);
  console.log(`-----+--------+--------------------------+---------------------+------+---------`);
  resolved.forEach((e, i) => {
    const kb = (statSync(e.file).size / 1024).toFixed(0);
    const n = String(i + 1).padStart(3, " ");
    const fn = e.filename.padEnd(24, " ");
    const nm = `${e.nameTh}/${e.nameEn}`.padEnd(19, " ");
    console.log(`  ${n}| ${e.ganzhi}   | ${fn} | ${nm} | ${kb.padStart(4)} | mascot/${e.storageKey}.${IMAGE_FORMAT.ext}`);
  });
  console.log(`\nรวม ${resolved.length} แถว · ตัวอย่าง URL: ${predictedUrl(bucket, resolved[0].storageKey)}`);
  console.log(`\nยังไม่เขียนอะไร — ฟีมตรวจ TARGET CHECK ✅ แล้วสั่งยิงจริงด้วยคำสั่งเดิมแบบไม่ใส่ --dry-run\n`);
}

async function runReal(resolved: ReturnType<typeof resolveSources>["resolved"]) {
  const bucket = getMascotBucket();

  // ── ตาข่าย 1: กันยิงผิด bucket/โปรเจกต์ — throw ก่อนแตะ storage/DB ใดๆ ──
  assertProdTargets(bucket, process.env.SUPABASE_URL);
  console.log(`✅ ตาข่าย1 ผ่าน: bucket=${bucket} · โปรเจกต์ prod soxsccdlsycaevusndro`);

  const repo = createDbMascotImageRepository();

  // ── ตาข่าย 2 (before): จำนวนแถว = 60 และ digest image_url ตรง baseline ก่อนเริ่ม ──
  const before2 = await currentImageUrlState(repo);
  console.log(`   แถว ก่อน: ${before2.count} · md5(image_url) ก่อน: ${before2.digest}  (baseline ${EXPECTED_IMAGE_URL_MD5})`);
  assertImageUrlRowCount(before2.count, resolved.length);
  if (before2.digest !== EXPECTED_IMAGE_URL_MD5) {
    throw new Error(
      `ตาข่าย2: image_url ปัจจุบันไม่ตรง baseline — DB ถูกแตะมาก่อนหรือ baseline ผิด. หยุด ไม่เขียนอะไร.`,
    );
  }

  await ensureMascotBucket();
  let before = 0;
  let after = 0;
  let ok = 0;

  for (const e of resolved) {
    const raw = readFileSync(e.file);
    before += raw.length;
    const out = await resizeImage(raw);
    after += out.length;
    const url = await uploadMascotV2Image(e.storageKey, out, IMAGE_FORMAT.mime);
    await repo.setImageUrlV2(e.ganzhi, {
      nameTh: e.nameTh,
      nameEn: e.nameEn,
      imageUrlV2: url,
      mime: IMAGE_FORMAT.mime,
    });
    ok += 1;
    console.log(`  ✓ ${e.ganzhi} ${e.filename} (${(out.length / 1024).toFixed(0)}KB) → ${url}`);
  }

  if (ok !== resolved.length) {
    throw new Error(`อัปโหลดได้ ${ok}/${resolved.length} — ไม่ครบ 60 (ต้อง rollback ตรวจ)`);
  }

  // ── ตาข่าย 2 (after): จำนวนแถว = 60 (ไม่เกิน/ขาด) และ image_url ไม่ขยับสักแถว ──
  const after2 = await currentImageUrlState(repo);
  console.log(`   แถว หลัง: ${after2.count} · md5(image_url) หลัง: ${after2.digest}`);
  assertImageUrlRowCount(after2.count, resolved.length);
  if (after2.digest !== before2.digest) {
    throw new Error(
      `ตาข่าย2: 🔴 image_url เปลี่ยนระหว่างรัน (${before2.digest} → ${after2.digest}) — DB พัง! ` +
        `กู้จาก ~/mascot-backup-2026-08-02/bazi_mascot_image.before.csv ทันที.`,
    );
  }
  console.log(`✅ ตาข่าย2 ผ่าน: ${after2.count} แถว · image_url ไม่ขยับ (${after2.digest})`);
  console.log(
    `\nเสร็จ: image_url_v2 ครบ ${ok}/${resolved.length} | ขนาด ` +
      `${(before / 1024 / 1024).toFixed(1)}MB → ${(after / 1024 / 1024).toFixed(1)}MB`,
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { dir, resolved } = resolveSources(); // throws ถ้าขาดไฟล์ (ทั้ง dry-run และจริง)

  if (dryRun) {
    printDryRun(dir, resolved);
    return;
  }
  console.log(`นำเข้า mascot v2 จริง: ${resolved.length} รูป จาก ${dir}`);
  await runReal(resolved);
}

main().catch((e) => {
  console.error("IMPORT v2 FAILED:", e);
  process.exit(1);
});

/**
 * Seed รูปสถานที่ศักดิ์สิทธิ์ (รูปจริง) ลง DB เป็น image_base64 — เสิร์ฟผ่าน engine ไม่พึ่ง Supabase.
 * แมตช์ตาม "ชื่อสถานที่" (portable ข้าม DB/prod) ผ่าน manifest.json ในโฟลเดอร์:
 *   <IMG_DIR>/manifest.json = [{ "name": "...", "file": "....jpg" }]
 * ถ้าไม่มี manifest → fallback แมตช์ตาม <location id>.jpg (dev-only)
 *
 * Usage: node --env-file=.env --import tsx scripts/seed-sacred-map-images.ts knownlage/sacred-map-seed
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziSacredMapLocation } from "../src/db/schema";

type ManifestEntry = { name: string; file: string };

async function main() {
  const imgDir = process.argv[2];
  if (!imgDir) throw new Error("usage: seed-sacred-map-images.ts <IMG_DIR>");
  const db = createDbClient();
  const rows = await db
    .select({ id: baziSacredMapLocation.id, name: baziSacredMapLocation.name })
    .from(baziSacredMapLocation);

  const manifestPath = path.join(imgDir, "manifest.json");
  const useManifest = existsSync(manifestPath);
  const manifest: ManifestEntry[] = useManifest
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestEntry[])
    : [];

  let done = 0;
  for (const r of rows) {
    let file: string | null = null;
    if (useManifest) {
      const m = manifest.find((e) => e.name.trim() === r.name.trim());
      if (m) file = path.join(imgDir, m.file);
    } else {
      file = path.join(imgDir, `${r.id}.jpg`);
    }
    if (!file || !existsSync(file)) continue;
    const b64 = readFileSync(file).toString("base64");
    await db
      .update(baziSacredMapLocation)
      .set({ imageBase64: b64, imageMime: "image/jpeg", updatedAt: sql`now()` })
      .where(eq(baziSacredMapLocation.id, r.id));
    done += 1;
    console.log(`  ✓ ${r.name} (${(b64.length / 1024).toFixed(0)}KB)`);
  }
  console.log(`seeded ${done}/${rows.length} images (match by ${useManifest ? "name" : "id"})`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

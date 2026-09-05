/**
 * Seed รูปสถานที่ศักดิ์สิทธิ์ลง DB (image_base64) จากไฟล์ placeholder ที่ generate ไว้
 * — ทำให้รูปขึ้นทั้ง dev+prod โดยไม่พึ่ง Supabase (imageUrl เดิมชี้ supabase ที่ DNS ไม่ถึง)
 * ไฟล์อยู่ที่ <IMG_DIR>/<location id>.jpg. Usage:
 *   node --env-file=.env --import tsx scripts/seed-sacred-map-images.ts <IMG_DIR>
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziSacredMapLocation } from "../src/db/schema";

async function main() {
  const imgDir = process.argv[2];
  if (!imgDir) throw new Error("usage: seed-sacred-map-images.ts <IMG_DIR>");
  const db = createDbClient();
  const rows = await db.select({ id: baziSacredMapLocation.id }).from(baziSacredMapLocation);
  let done = 0;
  for (const r of rows) {
    const file = path.join(imgDir, `${r.id}.jpg`);
    if (!existsSync(file)) continue;
    const b64 = readFileSync(file).toString("base64");
    await db
      .update(baziSacredMapLocation)
      .set({ imageBase64: b64, imageMime: "image/jpeg" })
      .where(eq(baziSacredMapLocation.id, r.id));
    done += 1;
    console.log(`  ✓ ${r.id} (${(b64.length / 1024).toFixed(0)}KB)`);
  }
  console.log(`seeded ${done} images`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

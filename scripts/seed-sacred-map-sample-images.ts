/**
 * Seed รูปตัวอย่างให้สถานที่ sacred-map (ทำเท่าที่มี) —
 * ดาวน์โหลดรูปจาก Wikimedia Commons → อัปขึ้น Supabase bucket ของเราเอง → เซ็ต image_url
 * จับคู่ด้วย "ชื่อสถานที่" ที่ seed ไว้ (apply-sacred-map-migration.ts). อัปเฉพาะแถวที่ยังไม่มีรูป.
 * Usage: node --env-file=.env --import tsx scripts/seed-sacred-map-sample-images.ts [--force]
 */
import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";
import { ensureSacredBucket, uploadSacredMapImage } from "../src/lib/supabase/storage";

const FORCE = process.argv.includes("--force");

/**
 * name (ตรงกับที่ seed) → { slug, url รูป Wikimedia (330px), rasiUpper/rasiLower }
 * หมายเหตุ: ราศีเป็น "ตัวอย่าง" เชิงธีม (ธาตุ/สัญลักษณ์องค์เทพ) ไว้ให้ซินแสแก้ทีหลัง
 */
const SAMPLES: Array<{
  name: string;
  slug: string;
  url: string;
  rasiUpper: string;
  rasiLower: string;
}> = [
  {
    name: "ศาลเจ้าพ่อเสือ (เสาชิงช้า)",
    slug: "sample-chaopho-suea",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/%E0%B8%A8%E0%B8%B2%E0%B8%A5%E0%B9%80%E0%B8%88%E0%B9%89%E0%B8%B2%E0%B8%9E%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%AA%E0%B8%B7%E0%B8%AD_%E0%B9%80%E0%B8%AA%E0%B8%B2%E0%B8%8A%E0%B8%B4%E0%B8%87%E0%B8%8A%E0%B9%89%E0%B8%B2_%E0%B8%9E%E0%B8%A3%E0%B8%B0%E0%B8%99%E0%B8%84%E0%B8%A3_San_Chaopho_Suea_%28Sao_Chingcha%29.jpg/330px-%E0%B8%A8%E0%B8%B2%E0%B8%A5%E0%B9%80%E0%B8%88%E0%B9%89%E0%B8%B2%E0%B8%9E%E0%B9%88%E0%B8%AD%E0%B9%80%E0%B8%AA%E0%B8%B7%E0%B8%AD_%E0%B9%80%E0%B8%AA%E0%B8%B2%E0%B8%8A%E0%B8%B4%E0%B8%87%E0%B8%8A%E0%B9%89%E0%B8%B2_%E0%B8%9E%E0%B8%A3%E0%B8%B0%E0%B8%99%E0%B8%84%E0%B8%A3_San_Chaopho_Suea_%28Sao_Chingcha%29.jpg",
    rasiUpper: "แก (ทอง)",
    rasiLower: "ขาล (เสือ)",
  },
  {
    name: "พระพรหมเอราวัณ",
    slug: "sample-erawan",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Phra_Phrom_at_Erawan_Shrine.jpg/330px-Phra_Phrom_at_Erawan_Shrine.jpg",
    rasiUpper: "โบ่ว (ดิน)",
    rasiLower: "มะโรง (มังกร)",
  },
  {
    name: "วัดมังกรกมลาวาส (วัดเล่งเน่ยยี่)",
    slug: "sample-wat-mangkon",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%A1%E0%B8%B1%E0%B8%87%E0%B8%81%E0%B8%A3%E0%B8%81%E0%B8%A1%E0%B8%A5%E0%B8%B2%E0%B8%A7%E0%B8%B2%E0%B8%AA_%E0%B8%95%E0%B8%B8%E0%B8%A5%E0%B8%B2%E0%B8%84%E0%B8%A1_2563.jpg/330px-%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%A1%E0%B8%B1%E0%B8%87%E0%B8%81%E0%B8%A3%E0%B8%81%E0%B8%A1%E0%B8%A5%E0%B8%B2%E0%B8%A7%E0%B8%B2%E0%B8%AA_%E0%B8%95%E0%B8%B8%E0%B8%A5%E0%B8%B2%E0%B8%84%E0%B8%A1_2563.jpg",
    rasiUpper: "กุ่ย (น้ำ)",
    rasiLower: "มะโรง (มังกร)",
  },
  {
    name: "ศาลหลักเมืองกรุงเทพมหานคร",
    slug: "sample-lak-mueang",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/%E0%B8%A1%E0%B8%93%E0%B8%91%E0%B8%9B%E0%B8%A8%E0%B8%B2%E0%B8%A5%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B9%80%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%872.jpg/330px-%E0%B8%A1%E0%B8%93%E0%B8%91%E0%B8%9B%E0%B8%A8%E0%B8%B2%E0%B8%A5%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%81%E0%B9%80%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%872.jpg",
    rasiUpper: "กี้ (ดิน)",
    rasiLower: "จอ (สุนัข)",
  },
];

async function main() {
  const sql = neon(getDatabaseUrl());
  await ensureSacredBucket();

  let done = 0;
  for (const s of SAMPLES) {
    const rows = (await sql.query(
      'select id, image_url from "bazi_sacred_map_location" where name = $1 limit 1;',
      [s.name],
    )) as Array<{ id: string; image_url: string | null }>;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) {
      console.log(`skip (ไม่พบ): ${s.name}`);
      continue;
    }

    // เซ็ตราศีตัวอย่างเสมอ (ตัวแทนราศีบน/ล่าง)
    await sql.query(
      'update "bazi_sacred_map_location" set rasi_upper = $1, rasi_lower = $2 where id = $3;',
      [s.rasiUpper, s.rasiLower, row.id],
    );

    // อัปรูปเฉพาะเมื่อยังไม่มี (หรือ --force)
    if (row.image_url && !FORCE) {
      console.log(`OK ราศี (มีรูปแล้ว): ${s.name}`);
      done++;
      continue;
    }

    const res = await fetch(s.url, { headers: { "user-agent": "mumate-sacred-map-seed/1.0" } });
    if (!res.ok) {
      console.log(`OK ราศี (แต่โหลดรูปไม่ได้ ${res.status}): ${s.name}`);
      done++;
      continue;
    }
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    const publicUrl = await uploadSacredMapImage(s.slug, buffer, mime);

    await sql.query('update "bazi_sacred_map_location" set image_url = $1 where id = $2;', [
      publicUrl,
      row.id,
    ]);
    console.log(`OK รูป+ราศี: ${s.name} → ${publicUrl}`);
    done++;
  }
  console.log(`\nเสร็จ: อัปรูปตัวอย่าง ${done}/${SAMPLES.length} แถว`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});

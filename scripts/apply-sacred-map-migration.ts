/**
 * Apply migration: bazi_sacred_map_location (additive, idempotent) + seed สถานที่ตัวอย่าง
 * Usage: node --env-file=.env --import tsx scripts/apply-sacred-map-migration.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { getDatabaseUrl } from "../src/lib/env";

const DUPLICATE_OBJECT = "42710";

/** สถานที่มูยอดนิยมสำหรับ seed ครั้งแรก (พิกัดโดยประมาณ) — status='verified' */
const SEED = [
  {
    name: "ศาลเจ้าพ่อเสือ (เสาชิงช้า)",
    deity: "เจ้าพ่อเสือ (ตั่วเหล่าเอี๊ย)",
    description: "ศาลเจ้าจีนเก่าแก่ ขอพรเรื่องอำนาจบารมี หน้าที่การงาน แคล้วคลาด",
    province: "กรุงเทพมหานคร",
    address: "ถนนตะนาว แขวงศาลเจ้าพ่อเสือ เขตพระนคร",
    lat: 13.7546,
    lng: 100.4989,
    direction: "ทิศเหนือ",
    element: "metal",
    needs: ["การงาน", "สุขภาพ"],
    worship_guide: "ไข่ต้ม หมูสามชั้น ข้าวเหนียวหวาน น้ำมันเติมตะเกียง จุดธูป 18 ดอก",
  },
  {
    name: "พระตรีมูรติ (เซ็นทรัลเวิลด์)",
    deity: "พระตรีมูรติ",
    description: "เทพแห่งความรัก ขอพรเรื่องความรัก คู่ครอง",
    province: "กรุงเทพมหานคร",
    address: "หน้าห้างเซ็นทรัลเวิลด์ ถนนราชดำริ",
    lat: 13.7466,
    lng: 100.5396,
    direction: "ทิศตะวันออก",
    element: "fire",
    needs: ["รัก"],
    worship_guide: "ดอกกุหลาบแดง 9 ดอก ธูปแดง 9 ดอก เทียนแดง มาไหว้วันพฤหัสฯ เวลา 21.30 น.",
  },
  {
    name: "พระพรหมเอราวัณ",
    deity: "ท้าวมหาพรหม",
    description: "ขอพรได้ทุกเรื่อง โดยเฉพาะการงาน โชคลาภ ความสำเร็จ",
    province: "กรุงเทพมหานคร",
    address: "แยกราชประสงค์ ถนนราชดำริ",
    lat: 13.7443,
    lng: 100.5405,
    direction: "ทิศตะวันออกเฉียงเหนือ",
    element: "earth",
    needs: ["การงาน", "เงิน", "สุขภาพ"],
    worship_guide: "พวงมาลัยดาวเรือง ธูป 12 ดอก เทียน 4 สี ไหว้ครบ 4 หน้า",
  },
  {
    name: "วัดมังกรกมลาวาส (วัดเล่งเน่ยยี่)",
    deity: "เทพเจ้าไท้ส่วยเอี๊ย / องค์เทพต่าง ๆ",
    description: "แก้ชง เสริมดวง ขอพรสุขภาพและโชคลาภ",
    province: "กรุงเทพมหานคร",
    address: "ถนนเจริญกรุง เขตป้อมปราบศัตรูพ่าย",
    lat: 13.7414,
    lng: 100.5106,
    direction: "ทิศเหนือ",
    element: "water",
    needs: ["สุขภาพ", "เงิน"],
    worship_guide: "ชุดแก้ชง ธูปเทียน กระดาษเงินกระดาษทอง ถวายตามซุ้มเทพ",
  },
  {
    name: "ศาลหลักเมืองกรุงเทพมหานคร",
    deity: "เทพารักษ์หลักเมือง",
    description: "ขอพรความมั่นคง หน้าที่การงาน แก้ปีชง",
    province: "กรุงเทพมหานคร",
    address: "ถนนหลักเมือง แขวงพระบรมมหาราชวัง",
    lat: 13.7527,
    lng: 100.4939,
    direction: "ทิศใต้",
    element: "earth",
    needs: ["การงาน", "สุขภาพ"],
    worship_guide: "พวงมาลัย ทองคำเปลว ผ้าแพร 7 สี น้ำมันเติมตะเกียง",
  },
  {
    name: "เจ้าแม่กวนอิม มูลนิธิเทียนฟ้า",
    deity: "เจ้าแม่กวนอิม",
    description: "ขอพรสุขภาพ ความเมตตา ปัดเป่าทุกข์โศก",
    province: "กรุงเทพมหานคร",
    address: "ถนนเยาวราช เขตสัมพันธวงศ์",
    lat: 13.7401,
    lng: 100.5093,
    direction: "ทิศตะวันตก",
    element: "water",
    needs: ["สุขภาพ", "รัก"],
    worship_guide: "ดอกบัว ผลไม้ ธูปหอม งดของคาว บูชาด้วยใจเมตตา",
  },
];

async function main() {
  const sqlPath = path.resolve(process.cwd(), "drizzle/0029_sacred_map.sql");
  const ddl = readFileSync(sqlPath, "utf8");
  const sql = neon(getDatabaseUrl());

  const statements = ddl
    .split("--> statement-breakpoint")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    try {
      await sql.query(statement);
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === DUPLICATE_OBJECT) {
        continue;
      }
      throw error;
    }
  }

  // seed เฉพาะเมื่อตารางยังว่าง (idempotent)
  const countRes = await sql.query('select count(*)::int as n from "bazi_sacred_map_location";');
  const countRows = (Array.isArray(countRes) ? countRes : (countRes as { rows?: unknown[] }).rows ?? []) as Array<{
    n: number;
  }>;
  const existing = countRows[0]?.n ?? 0;

  if (existing === 0) {
    for (const s of SEED) {
      await sql.query(
        `insert into "bazi_sacred_map_location"
          (name, deity, description, province, address, lat, lng, direction, element, needs, worship_guide, status, source)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,'verified','admin')`,
        [
          s.name,
          s.deity,
          s.description,
          s.province,
          s.address,
          s.lat,
          s.lng,
          s.direction,
          s.element,
          JSON.stringify(s.needs),
          s.worship_guide,
        ],
      );
    }
    console.log(`OK seeded ${SEED.length} sacred-map locations`);
  } else {
    console.log(`OK skip seed (already ${existing} rows)`);
  }

  const result = await sql.query(
    "select column_name, data_type from information_schema.columns where table_name = 'bazi_sacred_map_location' order by ordinal_position;",
  );
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    column_name: string;
    data_type: string;
  }>;
  console.log("OK table bazi_sacred_map_location columns:");
  for (const r of rows) {
    console.log(`  - ${r.column_name}: ${r.data_type}`);
  }
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e);
  process.exit(1);
});

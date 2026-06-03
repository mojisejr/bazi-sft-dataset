/**
 * Export a deterministic Chinese-astrology reading to a .docx file.
 *
 * Usage:
 *   npx tsx scripts/export-reading-docx.ts <YYYY-MM-DD> <HH:mm> <male|female> [province] [outPath]
 *
 * Example:
 *   npx tsx scripts/export-reading-docx.ts 1993-11-24 15:09 male "Chiang Rai" out/case.docx
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildReadingDocxBuffer } from "@/lib/bazi/reading-docx";

async function main() {
  // โหลด .env (DATABASE_URL ฯลฯ) — engine adapter ต่อ DB แบบ lazy ตอนเรียกใช้
  try {
    process.loadEnvFile(".env");
  } catch {
    // ไม่มี .env ก็ข้าม (อาศัย env ที่ตั้งไว้แล้ว)
  }

  const [birthDate, birthTime, gender, province = "Bangkok", outPath] = process.argv.slice(2);

  if (!birthDate || !birthTime || (gender !== "male" && gender !== "female")) {
    console.error(
      "Usage: npx tsx scripts/export-reading-docx.ts <YYYY-MM-DD> <HH:mm> <male|female> [province] [outPath]",
    );
    process.exit(1);
  }

  const rawInput = RawInputSchema.parse({
    birthDate,
    birthTime,
    gender,
    province,
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  });

  const calculatedState = await calculateBaziStateFromRawInput(rawInput);
  const buffer = await buildReadingDocxBuffer(rawInput, calculatedState);

  const target = outPath ?? `out/reading-${birthDate}-${gender}.docx`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);

  console.log(`✓ เขียนรายงานแล้ว: ${target} (ดิถี ${calculatedState.dayMaster})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

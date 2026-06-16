/**
 * Export ปฏิทินโหราศาสตร์ทั้งปีเป็นไฟล์ Excel (.xlsx) เลียนแบบไฟล์ต้นฉบับ ManvsDay.
 *
 * Usage:
 *   npm run export:almanac -- <ปีพ.ศ.> [outPath]
 *   npx tsx scripts/export-almanac-xlsx.ts 2569 out/almanac-2569.xlsx
 *
 * รองรับทุกปี (อดีต/อนาคต) เพราะคำนวณเสาด้วย lunar-javascript.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { buildAlmanacWorkbook } from "@/lib/bazi/almanac/almanac-xlsx";

async function main(): Promise<void> {
  const [yearArg, outArg] = process.argv.slice(2);
  const yearBE = Number(yearArg);
  if (!Number.isInteger(yearBE) || yearBE < 2400 || yearBE > 2700) {
    console.error("ระบุปี พ.ศ. (เช่น 2569). ตัวอย่าง: npm run export:almanac -- 2569 out/almanac-2569.xlsx");
    process.exit(1);
  }
  const outPath = outArg ?? `out/almanac-${yearBE}.xlsx`;
  const buffer = await buildAlmanacWorkbook(yearBE);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`เขียนปฏิทิน พ.ศ. ${yearBE} -> ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

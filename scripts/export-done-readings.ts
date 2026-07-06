/**
 * Export ดวงที่ mark "เสร็จสิ้น" (status=done) เป็น dataset JSON ไปเทรน/ปรับใช้
 * แต่ละรายการ = ข้อมูลนำเข้า + คำอ่านสุดท้ายรายบท (เนื้อ PDF สุดท้ายที่ซินแสแก้แล้ว)
 *
 * Usage: node --env-file=.env --import tsx scripts/export-done-readings.ts [outfile]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { collectDoneReadingsForExport } from "../src/lib/bazi/reading-sessions";

async function main() {
  const items = await collectDoneReadingsForExport();
  const stamp = new Date().toISOString().slice(0, 10);
  const outArg = process.argv[2];
  const outPath = outArg
    ? path.resolve(process.cwd(), outArg)
    : path.resolve(process.cwd(), "exports", `done-readings-${stamp}.json`);

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ count: items.length, items }, null, 2), "utf8");

  const chapters = items.reduce((s, it) => s + Object.keys(it.readings).length, 0);
  console.log(`export ${items.length} ดวง (${chapters} บท) → ${outPath}`);
}

main().then(() => process.exit(0));

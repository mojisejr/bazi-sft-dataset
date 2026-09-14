// Ingest คี้มึ้ง "ระดับปี/เดือน" (奇門 年家/月家) จากสเปรดชีตซินแส → qimen-year-month-2569.json
// ที่มา: knownlage/NewData/คี้มึ้ง2569.xlsx (4 sheet ก.ย.–ธ.ค. 2569) — ส่วน "header block" ด้านบนของแต่ละชีต
// รัน: node scripts/ingest-qimen-month.cjs
//
// โครง header block (ตรวจจากไฟล์จริง):
//   YEAR block  (rows 1-3): c7="คี้มึ้งปี" (c6 ว่าง) ; row+1 = ก้านปี(c7)+8 ประตูทิศ(c8..15) ; row+2 = กิ่งปี(c7)+8 เทพ
//   MONTH block (rows 4-6, 7-9): c6="คี้มึ้งเดือน" ; row+1 = ก้านเดือน(c6)+8 ทิศ ; row+2 = กิ่งเดือน(c6)+8 เทพ
//   8 ประตูคงที่ 開休生傷杜景死驚 (คอลัมน์ c8..c15). พย/ธค มี 2 บล็อกเดือน (เสาเปลี่ยนกลางเดือนตาม 節氣).
//
// caishenDir/badDir/deity (ทิศไฉ่ซิ้ง/ทิศร้าย/องค์เทพประจำเดือน) ไม่มีใน xlsx นี้ (มาจาก Google Sheet แยก) →
// สคริปต์ "รักษา" ค่าที่กรอกมือไว้แล้วใน JSON เดิม (丙申/丁酉/丙午) และไม่ใส่ให้เสาใหม่ (engine รับ null ได้).
// badDir = อสูร engine คำนวณเอง (asuraOf) — ไม่ใช้จากไฟล์.
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join("knownlage", "NewData", "คี้มึ้ง2569.xlsx");
const OUT = path.join("src", "lib", "bazi", "data", "almanac", "qimen-year-month-2569.json");
const GATES = ["開", "休", "生", "傷", "杜", "景", "死", "驚"];
const nfc = (s) => (s || "").normalize("NFC"); // สเปรดชีตมี CJK compatibility glyph (เช่น 辰 U+F971) → NFC ให้ตรง engine

function readCells(ws, dirRow, deityRow) {
  const cells = [];
  for (let i = 0; i < 8; i++) {
    const dir = nfc(ws.getCell(dirRow, 8 + i).text).trim();
    const deity = nfc(ws.getCell(deityRow, 8 + i).text).trim();
    cells.push({ gate: GATES[i], dir, deity });
  }
  return cells;
}

// สร้าง entry: cells/kimeng/kimengBranch จาก xlsx + รักษา caishenDir/badDir/deity ที่กรอกมือไว้ (ถ้ามี)
function buildEntry(stem, branch, cells, prev) {
  const e = { kimeng: stem, kimengBranch: branch };
  if (prev && prev.caishenDir != null) e.caishenDir = prev.caishenDir;
  if (prev && prev.badDir != null) e.badDir = prev.badDir;
  if (prev && prev.deity != null) e.deity = prev.deity;
  e.cells = cells;
  return e;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { year: {}, month: {} };
  const yearOut = {};
  const monthOut = {};
  let mBlocks = 0, yBlocks = 0, conflicts = 0;

  for (const ws of wb.worksheets) {
    for (let r = 1; r + 2 <= ws.rowCount; r++) {
      const c6 = nfc(ws.getCell(r, 6).text).trim();
      const c7 = nfc(ws.getCell(r, 7).text).trim();
      // ── MONTH block ──
      if (c6 === "คี้มึ้งเดือน") {
        const stem = nfc(ws.getCell(r + 1, 6).text).trim();
        const branch = nfc(ws.getCell(r + 2, 6).text).trim();
        if (!stem || !branch) continue;
        const cells = readCells(ws, r + 1, r + 2);
        if (cells.some((c) => !c.dir || !c.deity)) continue;
        const pillar = stem + branch;
        mBlocks++;
        if (monthOut[pillar] && JSON.stringify(monthOut[pillar].cells) !== JSON.stringify(cells)) {
          conflicts++;
          console.warn(`  ! month ${pillar} conflict across sheets (cells differ)`);
        }
        if (!monthOut[pillar]) monthOut[pillar] = buildEntry(stem, branch, cells, existing.month && existing.month[pillar]);
      }
      // ── YEAR block (c7 ป้าย, c6 ว่าง — กันชนกับ header เดือนที่มีทั้ง c6+c7) ──
      if (c7 === "คี้มึ้งปี" && !c6) {
        const stem = nfc(ws.getCell(r + 1, 7).text).trim();
        const branch = nfc(ws.getCell(r + 2, 7).text).trim();
        if (!stem || !branch) continue;
        const cells = readCells(ws, r + 1, r + 2);
        if (cells.some((c) => !c.dir || !c.deity)) continue;
        const pillar = stem + branch;
        yBlocks++;
        if (yearOut[pillar] && JSON.stringify(yearOut[pillar].cells) !== JSON.stringify(cells)) {
          conflicts++;
          console.warn(`  ! year ${pillar} conflict across sheets (cells differ)`);
        }
        if (!yearOut[pillar]) yearOut[pillar] = buildEntry(stem, branch, cells, existing.year && existing.year[pillar]);
      }
    }
  }

  const out = {
    _note:
      "คี้มึ้งระดับปี/เดือน (奇門) — cells/kimeng ingest จาก knownlage/NewData/คี้มึ้ง2569.xlsx (scripts/ingest-qimen-month.cjs), ครอบ ก.ย.–ธ.ค. 2569. key = เสาปี/เดือน ganzhi. cells = 8 ประตู (開休生傷杜景死驚) → ทิศ+เทพ. caishenDir/deity เดือน (丙申/丁酉) + ปี (丙午) กรอกมือจาก Google Sheet — รักษาไว้; เสาอื่นยังไม่มี (engine รับ null). badDir=อสูร engine คำนวณเอง.",
    year: yearOut,
    month: monthOut,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `wrote ${OUT}\n  year pillars: ${Object.keys(yearOut).join(", ")} (${yBlocks} blocks)\n  month pillars: ${Object.keys(monthOut).join(", ")} (${mBlocks} blocks)\n  conflicts: ${conflicts}`,
  );
})().catch((e) => { console.error(e); process.exit(1); });

// Ingest คี้มึ้ง (奇門 8 ประตู 8 เทพ) จากสเปรดชีตของซินแส → JSON ที่ engine ใช้
// ที่มา: knownlage/NewData/คี้มึ้ง2569.xlsx (4 sheet ก.ย.–ธ.ค. 2569)
// รัน: node scripts/ingest-qimen.cjs
// โครงต่อวัน 2 แถว: ราศีบน = ก้านวัน/เดือน/ปี + 8 ประตู(開休生傷杜景死驚 คงที่)→ทิศ ; ราศีล่าง = กิ่งวัน/เดือน/ปี + 8 เทพ (คอลัมน์เดียวกัน)
// คีย์ = `${dayGanzhi}|${monthGanzhi}|${yearGanzhi}` (ยืนยันไม่ซ้ำ 126 วัน) — engine คำนวณ pillar สดครบ 3 ชั้น
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join("knownlage", "NewData", "คี้มึ้ง2569.xlsx");
const OUT = path.join("src", "lib", "bazi", "data", "almanac", "qimen-2569.json");
const GATES = ["開", "休", "生", "傷", "杜", "景", "死", "驚"];

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const out = {};
  let pairs = 0, conflicts = 0;
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= ws.rowCount; r++) {
      if (ws.getCell(r, 4).text !== "ราศีบน" || ws.getCell(r + 1, 4).text !== "ราศีล่าง") continue;
      const up = r, lo = r + 1;
      // normalize NFC: สเปรดชีตมีอักษร CJK compatibility (เช่น 辰 U+F971) ต้อง map เป็นตัวมาตรฐาน (U+8FB0)
      // ให้ตรงกับ ganzhi ที่ engine คำนวณจาก lunar-javascript
      const nfc = (s) => (s || "").normalize("NFC");
      const dayGZ = nfc(ws.getCell(up, 5).text) + nfc(ws.getCell(lo, 5).text);
      const monGZ = nfc(ws.getCell(up, 6).text) + nfc(ws.getCell(lo, 6).text);
      const yrGZ = nfc(ws.getCell(up, 7).text) + nfc(ws.getCell(lo, 7).text);
      const dirs = [], deities = [];
      for (let c = 8; c <= 15; c++) { dirs.push(ws.getCell(up, c).text); deities.push(nfc(ws.getCell(lo, c).text)); }
      if (dirs.some((x) => !x) || deities.some((x) => !x)) continue;
      const key = `${dayGZ}|${monGZ}|${yrGZ}`;
      const val = GATES.map((g, i) => ({ gate: g, dir: dirs[i], deity: deities[i] }));
      pairs++;
      if (out[key] && JSON.stringify(out[key]) !== JSON.stringify(val)) conflicts++;
      out[key] = val;
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + "\n");
  console.log(`wrote ${OUT}: ${Object.keys(out).length} keys (pairs=${pairs}, conflicts=${conflicts})`);
})().catch((e) => { console.error(e); process.exit(1); });

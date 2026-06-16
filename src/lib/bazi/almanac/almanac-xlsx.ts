/**
 * Export ปฏิทินโหราศาสตร์เป็นไฟล์ Excel (.xlsx) เลียนแบบเลย์เอาต์ไฟล์ต้นฉบับ
 * (knownlage/ManvsDay/ปฏิทิน 2569.xlsx): 1 ชีต/เดือน, แต่ละวัน = บล็อก 6 แถว.
 *
 * ใช้ exceljs (เพิ่มเป็น dependency); engine จาก almanac-engine.ts (รองรับทุกปี).
 */
import ExcelJS from "exceljs";

import { buildAlmanacYear } from "@/lib/bazi/almanac/almanac-engine";
import type { AlmanacDay } from "@/lib/bazi/almanac/types";

const MONTH_TOKENS = [
  "jan", "feb", "mar", "apr", "may", "jun", "july", "aug", "sep", "oct", "nov", "dec",
];

const SCORE_GROUP_LABELS = ["T", "T", "D", "D", "D", "D", "DM", "DM", "M", "M", "Y", "Y"];

function writeDayBlock(ws: ExcelJS.Worksheet, top: number, day: AlmanacDay): void {
  const set = (row: number, col: number, value: ExcelJS.CellValue) => {
    ws.getCell(row, col).value = value;
  };

  // ----- คอลัมน์ซ้าย: วัน/เสา/officer/คะแนน -----
  set(top, 1, day.weekday);
  set(top + 1, 1, Number(day.date.slice(8, 10)));
  set(top + 2, 1, `พ.ศ. ${day.yearBE}`);
  set(top + 3, 1, day.date);

  set(top, 3, "ดิถี");
  set(top + 1, 3, day.officer ?? "");
  set(top + 2, 3, day.officerDesc ?? "");

  // เสา 3 ต้น (ก้านแถวบน / กิ่งแถวล่าง) คอลัมน์ E(วัน) G(เดือน) I(ปี)
  set(top, 5, "วัน"); set(top, 7, "เดือน"); set(top, 9, "ปี");
  set(top + 1, 5, day.dayPillar.stem); set(top + 1, 7, day.monthPillar.stem); set(top + 1, 9, day.yearPillar.stem);
  set(top + 2, 5, day.dayPillar.branch); set(top + 2, 7, day.monthPillar.branch); set(top + 2, 9, day.yearPillar.branch);
  // กำลังดิถี (E) เป็นตัวเลขเด่นเหมือนต้นฉบับ + กำลังรวม (K) เป็นรอง
  set(top, 11, `${(day.strength.ratioDay * 100).toFixed(0)}%${day.strength.exact ? "" : " ~"}`);
  set(top + 1, 11, day.strength.ratioTotal);

  // คะแนน 12 ช่อง M..X (col 13..24): แถว header / ค่า / max
  for (let i = 0; i < 12; i += 1) {
    set(top, 13 + i, SCORE_GROUP_LABELS[i]);
    set(top + 1, 13 + i, day.strength.values[i] ?? 0);
    set(top + 2, 13 + i, day.strength.max[i] ?? 0);
  }

  // ----- คอลัมน์ขวา: เวลามงคล / เทพ / สี / ทิศ / อุปถัมป์ / ประตู / 八神 -----
  day.luckyHours.slice(0, 6).forEach((h, idx) => {
    set(top + idx, 25, h.code);
    set(top + idx, 26, h.range);
  });
  set(top, 27, "เทพประจำวัน"); set(top + 1, 27, day.deity ?? "");
  // สีมงคล 2 ชุด (ธาตุหลัก/รอง)
  set(top, 29, "สีมงคล");
  day.colors.slice(0, 2).forEach((c, idx) => {
    set(top + idx, 29, c.element);
    set(top + idx, 30, c.colors);
  });
  set(top, 31, "ทิศโชคลาภ"); set(top + 1, 31, day.luckyDirection ?? "");
  // อสูร วัน/เดือน/ปี
  set(top, 32, "อสูร ว/ด/ป");
  set(top + 1, 32, `${day.asura.day} ${day.asura.month} ${day.asura.year}`);
  // เทพอุปถัมป์ (2 ราย)
  set(top, 33, "อุปถัมป์");
  day.patrons.slice(0, 2).forEach((p, idx) => {
    set(top + idx, 33, p.branch);
    set(top + idx, 34, p.number ?? "");
    set(top + idx, 35, p.zodiac);
  });
  // 8 ประตู 八門 (ชื่อ+ความหมาย แถว top / ทิศ แถว top+1) คอลัมน์ 36..51
  day.gates.forEach((g, idx) => {
    set(top, 36 + idx * 2, `${g.name} ${g.meaning ?? ""}`.trim());
    set(top, 37 + idx * 2, g.direction);
  });
  // 8 เทพ 八神 + คีย์เวิร์ด (เทพ แถว top+1 / 4 คีย์เวิร์ด แถว top+2..top+5) คอลัมน์ 36..51
  day.spirits.forEach((s, idx) => {
    set(top + 1, 36 + idx * 2, s.name);
    s.keywords.slice(0, 4).forEach((kw, k) => set(top + 2 + k, 37 + idx * 2, kw));
  });
  // ข้อมูลเดือน (แถวสุดท้ายของบล็อก)
  set(top + 5, 27, day.monthInfo.deity ? `เทพเดือน: ${day.monthInfo.deity}` : "");
  set(top + 5, 31, day.monthInfo.caishenDir ? `ไฉ่ซิ้ง: ${day.monthInfo.caishenDir}` : "");
}

/** สร้าง workbook ปฏิทินทั้งปี (รับปี พ.ศ.) — คืน Buffer */
export async function buildAlmanacWorkbook(yearBE: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "bazi-sft-dataset almanac";
  const year = buildAlmanacYear(yearBE);

  for (const month of year.months) {
    const sample = month.days[0];
    const monthPillar = sample ? sample.monthPillar.ganzhi : "";
    const ws = wb.addWorksheet(`${yearBE}-${MONTH_TOKENS[month.month - 1]}-${monthPillar}`);
    ws.getCell(1, 7).value = `เดือน ${month.month}`;
    ws.getCell(1, 9).value = `พ.ศ. ${yearBE}`;
    let top = 3;
    for (const day of month.days) {
      writeDayBlock(ws, top, day);
      top += 6;
    }
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

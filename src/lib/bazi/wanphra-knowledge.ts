/**
 * วันพระสำหรับแชท (ซินแสนุ้ย 2026-10-27: "เสี่ยวมู่ตอบวันพระไม่ตรง") — เดิม LLM แต่งรายการวันพระเอง
 * ตอนนี้: คำถามที่พูดถึงวันพระ/วันโกน/วันสำคัญพุทธ → คำนวณจริงจากปฏิทินจันทรคติไทย (thai-lunar.ts)
 * แล้วแนบเป็นความรู้ให้ LLM ตอบ "ตามรายการนี้เท่านั้น"
 *
 * ปี: พ.ศ. 25xx หรือ ค.ศ. 20xx ในคำถาม · ไม่ระบุ = ปีปัจจุบัน (เวลาไทย)
 * เดือน: ถ้าคำถามมีชื่อเดือน → เฉพาะเดือนนั้น · ไม่มี = ทั้งปี
 */
import { thaiBuddhistHolidayFor, thaiLunarDay } from "@/lib/bazi/thai-lunar";

const WANPHRA_RE = /วันพระ|วันโกน|ขึ้น\s*1[45]\s*ค่ำ|แรม\s*1[45]\s*ค่ำ|มาฆบูชา|วิสาขบูชา|อาสาฬหบูชา|เข้าพรรษา|ออกพรรษา|อัฏฐมีบูชา|ตักบาตรเทโว/;

const MONTHS: ReadonlyArray<readonly [RegExp, number, string]> = [
  [/มกรา|ม\.ค\./, 1, "มกราคม"],
  [/กุมภา|ก\.พ\./, 2, "กุมภาพันธ์"],
  [/มีนา|มี\.ค\./, 3, "มีนาคม"],
  [/เมษา|เม\.ย\./, 4, "เมษายน"],
  [/พฤษภา|พ\.ค\./, 5, "พฤษภาคม"],
  [/มิถุนา|มิ\.ย\./, 6, "มิถุนายน"],
  [/กรกฎา|ก\.ค\./, 7, "กรกฎาคม"],
  [/สิงหา|ส\.ค\./, 8, "สิงหาคม"],
  [/กันยา|ก\.ย\./, 9, "กันยายน"],
  [/ตุลา|ต\.ค\./, 10, "ตุลาคม"],
  [/พฤศจิกา|พ\.ย\./, 11, "พฤศจิกายน"],
  [/ธันวา|ธ\.ค\./, 12, "ธันวาคม"],
];

export function isWanPhraQuestion(message: string): boolean {
  return WANPHRA_RE.test(message);
}

function bangkokYear(now: Date): number {
  return new Date(now.getTime() + 7 * 3600_000).getUTCFullYear();
}

/** ปี ค.ศ. ที่ถาม (พ.ศ. → ค.ศ.) · ไม่ระบุ = ปีปัจจุบัน */
export function wanPhraYear(message: string, now = new Date()): number {
  const be = message.match(/25[5-9]\d/);
  if (be) return Number(be[0]) - 543;
  const ce = message.match(/20[2-9]\d/);
  if (ce) return Number(ce[0]);
  return bangkokYear(now);
}

function wanPhraMonth(year: number, month: number): string[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= days; d += 1) {
    const info = thaiLunarDay(year, month, d);
    if (!info.isWanPhra) continue;
    const big = info.kham >= 14 ? " วันพระใหญ่" : "";
    const holiday = thaiBuddhistHolidayFor(year, month, d);
    out.push(`${d} (${info.phase} ${info.kham} ค่ำ${big}${holiday ? ` · ${holiday}` : ""})`);
  }
  return out;
}

/** ความรู้วันพระสำหรับแนบ prompt — คำถามไม่เกี่ยว = null */
export function wanPhraKnowledge(message: string, now = new Date()): string | null {
  if (!isWanPhraQuestion(message)) return null;
  const year = wanPhraYear(message, now);
  if (year < 1950 || year > 2100) return null;
  const only = MONTHS.filter(([re]) => re.test(message));
  const months = only.length ? only.map(([, m, name]) => [m, name] as const) : MONTHS.map(([, m, name]) => [m, name] as const);
  const lines = months.map(([m, name]) => `${name}: ${wanPhraMonth(year, m).join(", ")}`);
  return [
    `รายการวันพระ ปี พ.ศ. ${year + 543} (ค.ศ. ${year}) — คำนวณจากปฏิทินจันทรคติไทยของระบบ (ตรงกับปฏิทินหลวง)`,
    "กฎ: ตอบวันพระ/วันสำคัญตามรายการนี้เท่านั้น ห้ามคำนวณหรือแต่งวันที่เอง ห้ามเติมวันที่ไม่อยู่ในรายการ",
    "วันพระใหญ่ = ขึ้น/แรม 15 ค่ำ (เดือนขาดใช้แรม 14 ค่ำ) · วันพระเล็ก = ขึ้น/แรม 8 ค่ำ · วันโกน = วันก่อนวันพระ 1 วัน",
    ...lines,
  ].join("\n");
}

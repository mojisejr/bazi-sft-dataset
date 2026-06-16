/**
 * Types สำหรับฟีเจอร์ "ปฏิทินโหราศาสตร์" (ManvsDay almanac)
 *
 * ดู memory: manvsday-almanac-decode — แกะสูตรจาก knownlage/ManvsDay/ปฏิทิน 2569.xlsx
 * เกือบทุกชั้นต่อวัน = lookup ตามคีย์ (เสาวัน × month-branch); day-pillar-table เป็น fallback.
 */

export type GanZhi = string; // เช่น "乙亥"

export type LuckyHour = {
  /** โค้ดคุณภาพยาม B1–B8 ในไฟล์ต้นฉบับ */
  code: string;
  /** ช่วงเวลา เช่น "1:00-2:59" */
  range: string;
  /** กิ่งของยาม (時辰) เช่น 午 */
  branch: string;
  /** ชื่อเทพยาม (黃道) เช่น แชเล้ง */
  god: string;
  /** ความหมายสั้น เช่น ก้าวหน้ารุ่งเรือง */
  meaning: string;
};

export type GateInfo = {
  /** ชื่อประตู 八門 (開/休/生/傷/杜/景/死/驚) */
  name: string;
  /** ทิศของประตูในวันนั้น */
  direction: string;
  /** ความหมายไทยของประตู (เปิด/พักผ่อน/…) */
  meaning: string | null;
};

export type SpiritInfo = {
  /** ชื่อเทพ 八神 (陳/雀/地/天/符/蛇/陰/合) */
  name: string;
  /** คีย์เวิร์ดธุรกิจ 4 คำของเทพนั้น */
  keywords: string[];
};

export type ColorInfo = {
  /** ธาตุ (ไม้/ไฟ/ดิน/ทอง/น้ำ) */
  element: string;
  /** สีมงคล (ข้อความ) */
  colors: string;
};

export type PatronInfo = {
  /** กิ่งนักษัตร (干支 branch) */
  branch: string;
  /** เลขกำกับในไฟล์ต้นฉบับ */
  number: number | null;
  /** คำไทย เช่น "คนเกิดปีวอก" */
  zodiac: string;
};

export type AsuraDirections = {
  /** ทิศอสูรวัน (三煞 ตาม branch เสาวัน) */
  day: string;
  /** ทิศอสูรเดือน */
  month: string;
  /** ทิศอสูรปี */
  year: string;
};

export type DeityStar = {
  /** ชื่อดาว เช่น วันธงชัย / วันแตกวัน */
  name: string;
  /** กิจกรรมที่เหมาะ (ดี) หรือควรเลี่ยง (ร้าย) */
  activity: string | null;
};

export type MonthInfo = {
  /** เทพประจำเดือน */
  deity: string | null;
  /** ทิศไฉ่ซิ้ง (เทพโชคลาภ) ประจำเดือน */
  caishenDir: string | null;
  /** ทิศลาภเดือน */
  lapDir: string | null;
};

/** เรคคอร์ดในตาราง lookup (สกัดจากไฟล์ต้นฉบับ) — ใช้ทั้ง day-pillar และ day×month-branch */
export type AlmanacRecord = {
  officer: string | null;
  officer_desc: string | null;
  deity_key: string | null;
  deity: string | null;
  deities?: string[] | null;
  color_primary: [string | null, string | null] | null;
  color_secondary: [string | null, string | null] | null;
  lucky_dir: string | null;
  asura_dir: string | null;
  patrons: [string | null, number | null, string | null][] | null;
  gates: [string | null, string | null][] | null;
  spirits: (string | null)[] | null;
  lucky_hours: [string | null, string | null][] | null;
  scores: number[];
  max: number[];
  holy_day?: boolean;
};

export type StrengthScore = {
  /** [T,T, D,D,D,D, DM,DM, M,M, Y,Y] */
  values: number[];
  max: number[];
  /** K = Σvalues / Σmax (กำลังรวม) */
  ratioTotal: number;
  /** E = กลุ่ม D / max(D) (กำลังดิถีวัน — ตัวเลขเด่นในไฟล์ต้นฉบับ) */
  ratioDay: number;
  /** true = สกัดตรงจากไฟล์ต้นฉบับ; false = ประมาณจากโมเดลฤดู (เดือน autumn 申酉戌亥) */
  exact: boolean;
};

export type Pillar = {
  stem: string;
  branch: string;
  ganzhi: GanZhi;
  /** ธาตุของก้าน (天干) */
  element: string;
};

export type AlmanacDay = {
  /** ค.ศ. ISO date "YYYY-MM-DD" */
  date: string;
  /** พ.ศ. */
  yearBE: number;
  /** วันในสัปดาห์ (ไทย) */
  weekday: string;
  dayPillar: Pillar;
  monthPillar: Pillar;
  yearPillar: Pillar;
  officer: string | null;
  officerDesc: string | null;
  /** เทพประจำวัน (อาจมี 1–2 องค์) */
  deities: string[];
  deity: string | null;
  deityKey: string | null;
  colors: ColorInfo[];
  luckyDirection: string | null;
  asura: AsuraDirections;
  patrons: PatronInfo[];
  gates: GateInfo[];
  spirits: SpiritInfo[];
  luckyHours: LuckyHour[];
  monthInfo: MonthInfo;
  /** เทพดี (ฤกษ์มงคล) ที่เข้าเกณฑ์ของวัน */
  goodDeities: DeityStar[];
  /** เทพร้าย (ฤกษ์อัปมงคล) ที่เข้าเกณฑ์ของวัน */
  badDeities: DeityStar[];
  strength: StrengthScore;
};

export type AlmanacMonth = {
  yearBE: number;
  /** เดือนปฏิทินสากล 1–12 */
  month: number;
  days: AlmanacDay[];
};

export type AlmanacYear = {
  yearBE: number;
  months: AlmanacMonth[];
};

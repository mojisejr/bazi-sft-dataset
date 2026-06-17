/**
 * ปฏิทินจันทรคติไทย (สุริยยาตร์) — คำนวณ ขึ้น/แรม ค่ำ เดือน, วันพระ, และวันสำคัญพุทธ
 *
 * พอร์ตจากอัลกอริทึม suriya-go (splendidmoons/suriya-go, MIT) ซึ่งอิงงานของ J.C. Eade
 * "Rules for Interpolation in the Thai Calendar" + คัมภีร์สุริยยาตร์ (Mahānikāya / ปฏิทินหลวง)
 * รองรับ อธิกมาส (เดือน 8 สองหน) และ อธิกวาร (เดือน 7 มี 30 วัน)
 *
 * ตรวจแล้วกับวันอาสาฬหบูชา 2493–2568 (myhora/bot.or.th) ดู tests/thai-lunar.test.ts
 *
 * หมายเหตุ: ใช้สูตร "บริสุทธิ์" (UseExceptions=false) บางปีในอดีต (เช่น 2537/2540)
 * ปฏิทินทางการเลื่อนอธิกวารต่างจากสูตร — แก้รายวันได้ผ่าน override (เฟส E)
 */

const ERA_DAYS = 292207;
const ERA_HORAKHUN = 373;
const ERA_AVOMAN = 650;
const MONTH_LENGTH = 30;
const CYCLE_SOLAR = 692;
const CYCLE_DAILY = 11;
const KAMMACUBALA_DAILY = 800;
const CS_DIFF = 638;

// ----- Julian Day Number (proleptic Gregorian) -----
export function gregorianToJDN(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

// ----- ค่าสุริยยาตร์ระดับปี -----
type SuriyaYear = {
  year: number;
  horakhun: number;
  kammacubala: number;
  avoman: number;
  tithi: number;
};

const yearCache = new Map<number, SuriyaYear>();
function suriyaYear(ceYear: number): SuriyaYear {
  const cached = yearCache.get(ceYear);
  if (cached) return cached;
  const csYear = ceYear - CS_DIFF;
  const a = csYear * ERA_DAYS + ERA_HORAKHUN;
  const horakhun = Math.floor(a / KAMMACUBALA_DAILY) + 1;
  const kammacubala = KAMMACUBALA_DAILY - (a % KAMMACUBALA_DAILY);
  const a2 = horakhun * CYCLE_DAILY + ERA_AVOMAN;
  const avoman = a2 % CYCLE_SOLAR;
  const b = Math.floor(a2 / CYCLE_SOLAR);
  const tithi = (b + horakhun) % MONTH_LENGTH;
  const su: SuriyaYear = { year: ceYear, horakhun, kammacubala, avoman, tithi };
  yearCache.set(ceYear, su);
  return su;
}

const isSuriyaLeap = (su: SuriyaYear) => su.kammacubala <= 207;

function wouldBeAdhikamasa(su: SuriyaYear): boolean {
  const t = su.tithi;
  return (t >= 24 && t <= 29) || (t >= 0 && t <= 5);
}

const adhikamasaCache = new Map<number, boolean>();
export function isAdhikamasa(ceYear: number): boolean {
  const cached = adhikamasaCache.get(ceYear);
  if (cached !== undefined) return cached;
  // ถ้าปีถัดไปก็เข้าเกณฑ์ ปีนี้ไม่ใช่ (กันนับซ้ำ)
  const res = !wouldBeAdhikamasa(suriyaYear(ceYear + 1)) && wouldBeAdhikamasa(suriyaYear(ceYear));
  adhikamasaCache.set(ceYear, res);
  return res;
}

function wouldBeAdhikavara(su: SuriyaYear): boolean {
  return isSuriyaLeap(su) ? su.avoman <= 126 : su.avoman < 137;
}

const adhikavaraCache = new Map<number, boolean>();
export function isAdhikavara(ceYear: number): boolean {
  const cached = adhikavaraCache.get(ceYear);
  if (cached !== undefined) return cached;
  let res: boolean;
  if (isAdhikamasa(ceYear)) {
    res = false;
  } else {
    const last = suriyaYear(ceYear - 1);
    const carried = isAdhikamasa(ceYear - 1) && wouldBeAdhikavara(last);
    res = carried ? true : wouldBeAdhikavara(suriyaYear(ceYear));
  }
  adhikavaraCache.set(ceYear, res);
  return res;
}

/** ความยาวปีจันทรคติ (วัน): ปกติ 354, อธิกวาร 355, อธิกมาส 384 */
function lunarYearLength(ceYear: number): number {
  const base = 6 * 29 + 6 * 30; // 354
  if (isAdhikamasa(ceYear)) return base + 30;
  if (isAdhikavara(ceYear)) return base + 1;
  return base;
}

// ----- หา Kattika เพ็ญ (ขึ้น 15 ค่ำ เดือน 12) ก่อนปีสุริยคติที่ระบุ -----
// อ้างอิง 2015-11-25 (ลอยกระทง 2558) แล้วก้าวทีละปีจันทรคติ
const kattikaCache = new Map<number, number>();
function previousKattikaJDN(solarYear: number): number {
  const cached = kattikaCache.get(solarYear);
  if (cached !== undefined) return cached;
  let jdn = gregorianToJDN(2015, 11, 25);
  const startYear = 2015;
  let direction = 0;
  if (startYear < solarYear - 1) direction = 1;
  else if (startYear > solarYear - 1) direction = -1;
  if (direction !== 0) {
    for (let y = startYear; y !== solarYear - 1; y += direction) {
      const lenYear = direction === 1 ? y + 1 : y;
      jdn += lunarYearLength(lenYear) * direction;
    }
  }
  kattikaCache.set(solarYear, jdn);
  return jdn;
}

// ----- เดินวันพระ (uposatha) สลับเพ็ญ/ดับ -----
type Phase = "full" | "new";
type Uposatha = {
  jdn: number;
  phase: Phase;
  uDays: number; // 14 หรือ 15
  lunarMonthGo: number; // 1-13 (ระบบ suriya-go; 13 = อาสาฬหหลัง/อธิกมาส)
  event: string; // magha | vesakha | asalha | pavarana | ""
};

function nextUposatha(lu: Uposatha): Uposatha {
  const luYear = jdnToGregorian(lu.jdn).year;
  const adhiMasa = isAdhikamasa(luYear);
  const adhiVara = isAdhikavara(luYear);
  const phase: Phase = lu.phase === "new" ? "full" : "new";
  let lunarMonthGo: number;
  let uDays: number;
  let event = "";

  if (phase === "full") {
    uDays = 15;
    lunarMonthGo = lu.lunarMonthGo;
    if (adhiMasa) {
      if (lunarMonthGo === 4) event = "magha";
      else if (lunarMonthGo === 7) event = "vesakha";
      else if (lunarMonthGo === 13) event = "asalha";
      else if (lunarMonthGo === 11) event = "pavarana";
    } else {
      if (lunarMonthGo === 3) event = "magha";
      else if (lunarMonthGo === 6) event = "vesakha";
      else if (lunarMonthGo === 8) event = "asalha";
      else if (lunarMonthGo === 11) event = "pavarana";
    }
  } else {
    if (lu.lunarMonthGo === 13) lunarMonthGo = 9;
    else if (lu.lunarMonthGo === 8 && adhiMasa) lunarMonthGo = 13;
    else if (lu.lunarMonthGo === 12) lunarMonthGo = 1;
    else lunarMonthGo = lu.lunarMonthGo + 1;
    let mDays: number;
    if (adhiVara && lunarMonthGo === 8) mDays = 30;
    else mDays = lunarMonthGo % 2 === 1 ? 30 : 29;
    uDays = mDays === 29 ? 14 : 15;
  }

  return { jdn: lu.jdn + uDays, phase, uDays, lunarMonthGo, event };
}

// ----- ข้อมูลจันทรคติรายวัน -----
export type ThaiLunarInfo = {
  /** เลขเดือนจันทรคติไทย 1-12 (13 = เดือน 8 หลัง/อธิกมาส) */
  lunarMonth: number;
  isLeapMonth: boolean;
  /** ป้ายเดือน เช่น "เดือน ๓", "เดือน ๘-๘" */
  monthLabel: string;
  phase: "ขึ้น" | "แรม";
  /** ค่ำ 1-15 */
  kham: number;
  /** ป้ายเต็ม เช่น "ขึ้น ๘ ค่ำ เดือน ๖" */
  label: string;
  isWanPhra: boolean;
};

type YearData = {
  days: Map<string, ThaiLunarInfo>;
  holidays: Map<string, string>;
};

const THAI_NUM = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
const toThaiNum = (n: number) => String(n).split("").map((c) => THAI_NUM[Number(c)] ?? c).join("");
const MONTH_NAMES: Record<number, string> = {
  1: "อ้าย", 2: "ยี่", 3: "๓", 4: "๔", 5: "๕", 6: "๖",
  7: "๗", 8: "๘", 9: "๙", 10: "๑๐", 11: "๑๑", 12: "๑๒", 13: "๘-๘",
};
function monthLabelOf(lunarMonth: number): string {
  const nm = MONTH_NAMES[lunarMonth] ?? String(lunarMonth);
  return lunarMonth <= 2 ? `เดือน${nm}` : `เดือน ${nm}`;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
function keyOf(jdn: number): string {
  const g = jdnToGregorian(jdn);
  return `${g.year}-${pad2(g.month)}-${pad2(g.day)}`;
}

const yearDataCache = new Map<number, YearData>();
function yearData(solarYear: number): YearData {
  const cached = yearDataCache.get(solarYear);
  if (cached) return cached;

  const days = new Map<string, ThaiLunarInfo>();
  const holidays = new Map<string, string>();

  // anchor = Kattika เพ็ญเดือน 12 ก่อนปีนี้ (ขึ้น 15 ค่ำ เดือน 12)
  const anchor: Uposatha = {
    jdn: previousKattikaJDN(solarYear),
    phase: "full",
    uDays: 15,
    lunarMonthGo: 12,
    event: "",
  };

  let lastFullGo = 12; // เดือนของเพ็ญล่าสุด → ใช้กับครึ่งแรม
  let lu = anchor;
  // เดินจน uposatha ข้ามเข้าปีถัดไป 1 ดวง (กันเติมปลายเดือน ธ.ค.)
  for (let guard = 0; guard < 60; guard += 1) {
    const u = nextUposatha(lu);
    lu = u;

    const thaiMonth = u.phase === "full" ? u.lunarMonthGo : lastFullGo;
    if (u.phase === "full") lastFullGo = u.lunarMonthGo;
    const isLeap = thaiMonth === 13;
    const phaseTh: "ขึ้น" | "แรม" = u.phase === "full" ? "ขึ้น" : "แรม";
    const mLabel = monthLabelOf(thaiMonth);

    // เติมวันในครึ่งเดือนนี้ (kham 1..uDays) ถอยหลังจากวัน uposatha
    for (let kham = 1; kham <= u.uDays; kham += 1) {
      const jdn = u.jdn - (u.uDays - kham);
      const isWanPhra = kham === 8 || kham === u.uDays;
      days.set(keyOf(jdn), {
        lunarMonth: isLeap ? 8 : thaiMonth,
        isLeapMonth: isLeap,
        monthLabel: mLabel,
        phase: phaseTh,
        kham,
        label: `${phaseTh} ${toThaiNum(kham)} ค่ำ ${mLabel}`,
        isWanPhra,
      });
    }

    // วันสำคัญพุทธ (อิง Event ของเพ็ญ)
    if (u.event === "magha") holidays.set(keyOf(u.jdn), "วันมาฆบูชา");
    else if (u.event === "vesakha") holidays.set(keyOf(u.jdn), "วันวิสาขบูชา");
    else if (u.event === "asalha") {
      holidays.set(keyOf(u.jdn), "วันอาสาฬหบูชา");
      holidays.set(keyOf(u.jdn + 1), "วันเข้าพรรษา");
    } else if (u.event === "pavarana") holidays.set(keyOf(u.jdn), "วันออกพรรษา");

    if (jdnToGregorian(u.jdn).year > solarYear) break;
  }

  const data: YearData = { days, holidays };
  yearDataCache.set(solarYear, data);
  return data;
}

/** ข้อมูลจันทรคติไทยของวันที่ (ค.ศ.) */
export function thaiLunarDay(year: number, month: number, day: number): ThaiLunarInfo {
  const key = `${year}-${pad2(month)}-${pad2(day)}`;
  const info = yearData(year).days.get(key);
  if (info) return info;
  // เผื่อขอบเขต: ลองปีถัดไป/ก่อนหน้า
  return (
    yearData(year + 1).days.get(key) ??
    yearData(year - 1).days.get(key) ?? {
      lunarMonth: 0,
      isLeapMonth: false,
      monthLabel: "",
      phase: "ขึ้น",
      kham: 0,
      label: "",
      isWanPhra: false,
    }
  );
}

/** ชื่อวันสำคัญพุทธของวันที่ (ค.ศ.) — null ถ้าไม่มี */
export function thaiBuddhistHolidayFor(year: number, month: number, day: number): string | null {
  const key = `${year}-${pad2(month)}-${pad2(day)}`;
  return yearData(year).holidays.get(key) ?? yearData(year + 1).holidays.get(key) ?? null;
}

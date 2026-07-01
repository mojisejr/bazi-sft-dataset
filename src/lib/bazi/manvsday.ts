/**
 * Man-vs-Day (ชีต DAYMATE) — เอาดวงเจ้าของมาเทียบกับ "เสาวัน" ของวันที่เลือกจากปฏิทิน.
 *
 * ถอดสูตรจาก Matching.xlsx ชีต DAYMATE: ใช้เอนจิน pair-matching โดเมน love เดิม
 * จับ 4 เสาของเจ้าของ (ยาม/วัน/เดือน/ปี) × เสาวันของวันนั้น (partnerPos=day ทุกมิติ),
 * แล้ว overlay ข้อมูลปฏิทินของวัน (ดิถี/กำลังวัน/ยามมงคล/สี/ทิศ) จาก almanac engine.
 * ใช้ทั้งบนหน้าเว็บ (การ์ดรายวัน) และผ่าน API สำหรับ chat.
 */
import { buildAlmanacDay, pillarsForDate } from "@/lib/bazi/almanac/almanac-engine";
import type { AlmanacDay } from "@/lib/bazi/almanac/types";
import { buildElementInteractionAB, buildFacets, mainFacetOf } from "@/lib/bazi/pair-matching";
import { DEFAULT_MATCHING_TEXT, type MatchingText } from "@/lib/bazi/matching-overlay";
import type {
  DayPillar,
  ElementInteractionAB,
  MatchFacet,
  PillarPos,
} from "@/lib/bazi/pair-types";

/** ข้อมูลปฏิทินย่อของวัน ที่ยกไปแสดงบนการ์ด/ตอบ chat. */
export type ManVsDayAlmanac = Pick<
  AlmanacDay,
  | "weekday"
  | "officer"
  | "officerDesc"
  | "jianchu"
  | "colors"
  | "luckyDirection"
  | "luckyHours"
  | "gates"
> & {
  /** กำลังดิถีของวัน (E = ratioDay 0–1) — G61 ในชีต DAYMATE */
  dayStrength: number;
};

/** ระดับความเหมาะของวัน (ใช้เลือกสี/อีโมจิ/โทน). */
export type DayVerdict = "good" | "neutral" | "caution";

export type ManVsDayResult = {
  /** วันที่ (ค.ศ. ISO) ที่นำมาเทียบ */
  date: string;
  /** เสาวันของวันนั้น เช่น "甲寅" */
  dayGanzhi: string;
  dayPillar: DayPillar;
  /** สี่เสาของ "วัน" (DAY) จากปฏิทิน — ไม่มียาม (วันไม่มีเสายาม) */
  dayChart: { day: DayPillar; month: DayPillar; year: DayPillar };
  /** 4 มิติ (บ้าน/เพื่อน/ที่ทำงาน/ต่างถิ่น) */
  facets: MatchFacet[];
  /** มิติหลัก (วันเรา×วัน) */
  mainFacet: MatchFacet | null;
  /** คะแนนรวม = เฉลี่ย 4 มิติ (G57) ปัด 2 ตำแหน่ง */
  overallPercent: number | null;
  /** ความสัมพันธ์ธาตุ ดิถีเจ้าของ ↔ ธาตุวัน (พิฆาตดิถี ฯลฯ) */
  elementRelation: ElementInteractionAB;
  almanac: ManVsDayAlmanac;
  /** ป้ายสรุปสั้น เช่น "วันนี้ดี" / "วันนี้พอใช้" / "วันนี้ควรระวัง" */
  verdict: DayVerdict;
  /** ประโยคสรุปคำทำนายของวัน (รวมบรรทัดเดียว / ใช้ตอบ chat) */
  summary: string;
  /** หัวข้อสรุป (บรรทัดเด่น) */
  summaryHeadline: string;
  /** สรุปแยกรายหัวข้อ (ไว้เรนเดอร์เป็นรายการ) */
  summaryItems: { key: string; icon: string; label: string; text: string }[];
};

/** สี่เสาของเจ้าของ (ก้าน/กิ่ง) ที่ต้องส่งเข้ามา. */
export type ManPillars = Record<PillarPos, DayPillar>;

/** ตัดอีโมจินำหน้า label ให้เหลือข้อความไทยล้วน. */
function stripEmoji(label: string): string {
  return label.replace(/^[^\p{Script=Thai}a-zA-Z]+/u, "").trim();
}

/** หา facet ดีสุด/แย่สุด (เฉพาะที่มีคะแนน). */
function bestWorstFacet(facets: MatchFacet[]): { best: MatchFacet | null; worst: MatchFacet | null } {
  const scored = facets.filter((f) => f.percent != null);
  if (!scored.length) return { best: null, worst: null };
  const best = scored.reduce((a, b) => ((b.percent ?? 0) > (a.percent ?? 0) ? b : a));
  const worst = scored.reduce((a, b) => ((b.percent ?? 0) < (a.percent ?? 0) ? b : a));
  return { best, worst: best === worst ? null : worst };
}

function verdictOf(overall: number | null): DayVerdict {
  if (overall == null) return "neutral";
  if (overall >= 60) return "good";
  if (overall >= 45) return "neutral";
  return "caution";
}

/** ประโยคสรุปคำทำนายของวัน — รวมคะแนนรวม + ดี/แย่สุด + กำลังวัน + ปฏิกิริยาธาตุ. */
function buildDaySummary(
  overall: number | null,
  facets: MatchFacet[],
  dayStrength: number,
  elementRelation: ElementInteractionAB,
  officer: string | null,
): {
  verdict: DayVerdict;
  summary: string;
  summaryHeadline: string;
  summaryItems: { key: string; icon: string; label: string; text: string }[];
} {
  const verdict = verdictOf(overall);
  const { best, worst } = bestWorstFacet(facets);
  const pctText = overall == null ? "-" : `${Math.round(overall)}%`;
  const headline =
    verdict === "good"
      ? `วันนี้เป็นวันที่ดีสำหรับคุณ (เหมาะ ${pctText})`
      : verdict === "neutral"
        ? `วันนี้พอไปได้ ไม่หวือหวา (เหมาะ ${pctText})`
        : `วันนี้ควรระมัดระวังเป็นพิเศษ (เหมาะเพียง ${pctText})`;

  const strengthPct = Math.round(dayStrength * 100);
  const strengthText =
    strengthPct >= 60
      ? `${strengthPct}% — เข้มแข็ง เหมาะกับการเริ่มงานหรือตัดสินใจ`
      : strengthPct >= 40
        ? `${strengthPct}% — ปานกลาง`
        : `${strengthPct}% — ค่อนข้างอ่อน ควรตั้งรับมากกว่ารุก`;

  const items: { key: string; icon: string; label: string; text: string }[] = [];
  if (best) items.push({ key: "best", icon: "⭐", label: "เรื่องที่ส่งเสริมที่สุด", text: stripEmoji(best.label) });
  if (worst) items.push({ key: "worst", icon: "⚠️", label: "ควรเลี่ยง / ระวัง", text: stripEmoji(worst.label) });
  items.push({ key: "strength", icon: "🔋", label: "กำลังของวัน (ปฏิทิน)", text: strengthText });
  items.push({ key: "element", icon: "☯️", label: "ปฏิกิริยาธาตุกับดิถีคุณ", text: elementRelation.aToB.labelTh });
  if (officer) items.push({ key: "officer", icon: "📅", label: "ดิถีประจำวัน", text: officer });

  const summary = [headline + ".", ...items.map((it) => `${it.label}: ${it.text}.`)].join(" ");
  return { verdict, summary, summaryHeadline: headline, summaryItems: items };
}

function roundPercent(values: number[]): number | null {
  if (!values.length) return null;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.round(avg * 100) / 100;
}

/**
 * เทียบดวงเจ้าของกับวัน (ค.ศ. y/m/d).
 * @param personPillars สี่เสาของเจ้าของ (จาก calculateBaziStateFromRawInput)
 * @param personDayMaster ดิถีเจ้าของ (เสาวัน) สำหรับความสัมพันธ์ธาตุ
 */
export function buildManVsDay(
  personPillars: ManPillars,
  personDayMaster: DayPillar,
  y: number,
  m: number,
  d: number,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): ManVsDayResult {
  const { dayPillar, monthPillar, yearPillar } = pillarsForDate(y, m, d);
  const dayLite: DayPillar = { stem: dayPillar.stem, branch: dayPillar.branch };

  // ฝั่ง "วัน" — ทุก facet ใช้ partnerPos="day" จึงสำคัญแค่ .day; เติม hour/month/year ให้ครบ record.
  const dayRecord: ManPillars = {
    hour: dayLite,
    day: dayLite,
    month: { stem: monthPillar.stem, branch: monthPillar.branch },
    year: { stem: yearPillar.stem, branch: yearPillar.branch },
  };

  const facets = buildFacets("day", personPillars, dayRecord, text);
  const overallPercent = roundPercent(
    facets.map((f) => f.percent).filter((p): p is number => p != null),
  );

  const almanacDay = buildAlmanacDay(y, m, d);
  const elementRelation = buildElementInteractionAB(personDayMaster.stem, dayPillar.stem);
  const { verdict, summary, summaryHeadline, summaryItems } = buildDaySummary(
    overallPercent,
    facets,
    almanacDay.strength.ratioDay,
    elementRelation,
    almanacDay.officer,
  );

  return {
    date: almanacDay.date,
    dayGanzhi: dayPillar.ganzhi,
    dayPillar: dayLite,
    dayChart: { day: dayRecord.day, month: dayRecord.month, year: dayRecord.year },
    facets,
    mainFacet: mainFacetOf(facets),
    overallPercent,
    verdict,
    summary,
    summaryHeadline,
    summaryItems,
    elementRelation,
    almanac: {
      weekday: almanacDay.weekday,
      officer: almanacDay.officer,
      officerDesc: almanacDay.officerDesc,
      jianchu: almanacDay.jianchu,
      colors: almanacDay.colors,
      luckyDirection: almanacDay.luckyDirection,
      luckyHours: almanacDay.luckyHours,
      gates: almanacDay.gates,
      dayStrength: almanacDay.strength.ratioDay,
    },
  };
}

/** สรุปคะแนนของหนึ่งวันในปฏิทินส่วนตัว (ใช้ระบายสีช่องปฏิทิน). */
export type ManVsDayDaySummary = {
  /** ISO "YYYY-MM-DD" */
  date: string;
  /** วันที่ในเดือน 1–31 */
  dayOfMonth: number;
  weekday: string;
  dayGanzhi: string;
  /** คะแนนรวม (เฉลี่ย 4 มิติ) 0–100 */
  overallPercent: number | null;
  /** กำลังดิถีของวัน (ปฏิทิน) 0–1 */
  dayStrength: number;
};

export type ManVsDayMonth = {
  year: number;
  month: number;
  days: ManVsDayDaySummary[];
};

/** จำนวนวันในเดือน (m = 1–12). */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * ปฏิทินส่วนตัวรายเดือน — คะแนนดวงเจ้าของกับทุกวันในเดือน (grid วันดีวันเสีย).
 * ใช้ทั้ง Phase 2 (คลิกปฏิทิน) และ Phase 3 (PDF รายปี วนเรียก 12 เดือน).
 */
export function buildManVsDayMonth(
  personPillars: ManPillars,
  personDayMaster: DayPillar,
  year: number,
  month: number,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): ManVsDayMonth {
  const total = daysInMonth(year, month);
  const days: ManVsDayDaySummary[] = [];
  for (let d = 1; d <= total; d += 1) {
    const r = buildManVsDay(personPillars, personDayMaster, year, month, d, text);
    days.push({
      date: r.date,
      dayOfMonth: d,
      weekday: r.almanac.weekday,
      dayGanzhi: r.dayGanzhi,
      overallPercent: r.overallPercent,
      dayStrength: r.almanac.dayStrength,
    });
  }
  return { year, month, days };
}

export type ManVsDayYear = {
  year: number;
  months: ManVsDayMonth[];
};

/**
 * ปฏิทินส่วนตัวรายปี (12 เดือน) — ใช้ทำ PDF ขาย.
 * @param year ค.ศ.
 */
export function buildManVsDayYear(
  personPillars: ManPillars,
  personDayMaster: DayPillar,
  year: number,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): ManVsDayYear {
  const months: ManVsDayMonth[] = [];
  for (let m = 1; m <= 12; m += 1) {
    months.push(buildManVsDayMonth(personPillars, personDayMaster, year, m, text));
  }
  return { year, months };
}

/**
 * "วัยจรชีวิต" (life timeline) — สร้างข้อมูลไทม์ไลน์อายุจาก state ที่ engine คำนวณ:
 *   - ช่วงวัยจร (daYun) ทั้งชีวิต + ช่วงปัจจุบัน
 *   - ปีจรรายปี (liuNianSeries, +20 ปี) พร้อมเกรด + ปีชง/ฮะ/ให้ร้าย
 *   - ระดับ HIGH/MED/LOW รายด้าน (การงาน/การเงิน/ความรัก) ต่อช่วงวัยจร
 *
 * ⚠️ ระดับรายด้านเป็นค่า "derive" — engine ไม่มีการจัดระดับ career/finance/love
 * แยกกันมาก่อน ที่นี่ประกอบจากปฏิกิริยาธาตุ (วัยจร×ดิถี) + ธาตุอุปถัมภ์(用神) + 12 เชี่ยงแซ
 * ตามหลักโป๊ยยี่มาตรฐาน เป็น provisional (ซินแสปรับได้ภายหลัง) เช่นเดียวกับ gradeLuckPhase.
 */

import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import {
  BRANCH_TO_ELEMENT,
  CLASH_PAIRS,
  HARM_PAIRS,
  SIX_COMBINATION_PAIRS,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  elementRelationKey,
  extractChartFacts,
  favorableElements,
  gradeLuckPhase,
  type ChartFacts,
} from "@/lib/bazi/newdata-lookup";
import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";

export type DomainLevel = "high" | "medium" | "low";
export type LifeDomain = "career" | "finance" | "love";

export type DomainScores = Record<LifeDomain, DomainLevel>;

export type LifeStage = {
  startAge: number;
  endAge: number;
  ganzhi: string;
  isCurrent: boolean;
  /** เกรดรวม 0-3 (เฉลี่ยสองช่วงย่อย) — เหมือนระบบ turning_points */
  overallGrade: number;
  /** ระดับรายด้าน (derive) */
  domains: DomainScores;
  upperState: string | null;
  lowerState: string | null;
};

export type TimelineYear = {
  year: number;
  age: number | null;
  ganzhi: string;
  twelveQi: string | null;
  /** เกรด 0-3 */
  grade: number;
  clash: boolean;
  sixCombine: boolean;
  harm: boolean;
};

export type LifeTimeline = {
  dayMaster: string;
  currentAge: number | null;
  favorableElementsTh: string[];
  stages: LifeStage[];
  current: LifeStage | null;
  years: TimelineYear[];
  /** ปีที่ต้องระวังพิเศษ (ชง/ให้ร้ายกับหลักวัน) ใน 20 ปีข้างหน้า */
  cautionYears: { year: number; age: number | null; ganzhi: string; kind: "clash" | "harm" }[];
  note: string;
};

const EN_TO_TH: Record<string, string> = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
};

const QI_GOOD = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง"]);
const QI_SEVERE = new Set(["ซวย", "ซี่", "เจ๊าะ"]);

/**
 * ค่าความสอดคล้องของบทบาทธาตุ (วัยจรเทียบดิถี) ต่อแต่ละด้าน 0-2 (มาตรฐานโป๊ยยี่):
 *   การงาน   = อำนาจ(官) เด่น, ถ่ายเท(食傷)/คู่ธาตุ รอง
 *   การเงิน   = ลาภ(財) เด่น, ถ่ายเท(食傷 สร้างทรัพย์) รอง
 *   ความรัก   = ขึ้นกับเพศ (หญิง→官=สามี, ชาย→財=ภรรยา); ไม่ระบุเพศ = เฉลี่ย官/財
 */
function roleAffinity(relation: string, gender: string | undefined): Record<LifeDomain, number> {
  const career =
    relation === "power" ? 2 : relation === "output" || relation === "same" ? 1 : 0;
  const finance = relation === "wealth" ? 2 : relation === "output" ? 1 : 0;
  let love: number;
  if (gender === "female") love = relation === "power" ? 2 : relation === "wealth" ? 1 : 0;
  else if (gender === "male") love = relation === "wealth" ? 2 : relation === "power" ? 1 : 0;
  else love = relation === "power" || relation === "wealth" ? 1 : 0;
  return { career, finance, love };
}

function levelFromScore(score: number): DomainLevel {
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

/** เกรดของช่วงย่อย (ก้าน/กิ่ง) จาก qi + ธาตุ — เหมือน matchDaYun */
function phaseGrade(facts: ChartFacts, symbol: string, source: "stem" | "branch", qi: string | null): number {
  const el =
    source === "stem"
      ? STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT]
      : BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT];
  return gradeLuckPhase(facts, el, qi);
}

function buildStage(
  facts: ChartFacts,
  d: ChartFacts["daYun"][number],
  dayEl: string | undefined,
  favTh: string[],
  gender: string | undefined,
): LifeStage {
  // เฉลี่ยเกรดสองช่วงย่อย → เกรดรวมช่วงวัยจร
  const phaseGrades = d.phases.map((ph) => phaseGrade(facts, ph.symbol, ph.source, ph.qi));
  const overallGrade = phaseGrades.length
    ? Math.round(phaseGrades.reduce((s, g) => s + g, 0) / phaseGrades.length)
    : 0;

  // รายด้าน: รวม affinity ของทั้งก้านและกิ่ง + โบนัสธาตุอุปถัมภ์ + โบนัส/หักตาม qi
  const totals: Record<LifeDomain, number> = { career: 0, finance: 0, love: 0 };
  let phaseCount = 0;
  for (const ph of d.phases) {
    const el =
      ph.source === "stem"
        ? STEM_TO_ELEMENT[ph.symbol as keyof typeof STEM_TO_ELEMENT]
        : BRANCH_TO_ELEMENT[ph.symbol as keyof typeof BRANCH_TO_ELEMENT];
    if (!dayEl || !el) continue;
    phaseCount += 1;
    const relation = elementRelationKey(dayEl, el);
    const aff = roleAffinity(relation, gender);
    const favorable = favTh.includes(EN_TO_TH[el] ?? "");
    const qiBonus = ph.qi && QI_GOOD.has(ph.qi) ? 1 : ph.qi && QI_SEVERE.has(ph.qi) ? -1 : 0;
    for (const key of ["career", "finance", "love"] as LifeDomain[]) {
      const base = aff[key];
      // ด้านที่ธาตุช่วงนี้ไม่เกี่ยวโดยตรง ให้อิงจังหวะรวม (qi) เบา ๆ
      totals[key] += base + (base > 0 ? (favorable ? 1 : 0) + qiBonus : Math.max(0, qiBonus));
    }
  }
  const denom = Math.max(1, phaseCount);
  const domains: DomainScores = {
    career: levelFromScore(totals.career / denom + 0.5),
    finance: levelFromScore(totals.finance / denom + 0.5),
    love: levelFromScore(totals.love / denom + 0.5),
  };

  return {
    startAge: d.startAge,
    endAge: d.endAge,
    ganzhi: `${d.stem}${d.branch}`,
    isCurrent: d.isCurrent,
    overallGrade,
    domains,
    upperState: d.upperState,
    lowerState: d.lowerState,
  };
}

function pairIn(set: Set<string>, a: string, b: string): boolean {
  return set.has(`${a}|${b}`) || set.has(`${b}|${a}`);
}

/** สร้างไทม์ไลน์วัยจรชีวิตจาก state ที่คำนวณแล้ว. */
export function buildLifeTimeline(
  state: CalculatedStateValue,
  opts: { gender?: string; birthYear?: number; nowYear?: number } = {},
): LifeTimeline {
  const gender = opts.gender;
  const birthYear = opts.birthYear;
  const nowYear = opts.nowYear ?? new Date().getFullYear();
  const facts = extractChartFacts(state, gender, birthYear);
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  const favTh = favorableElements(facts);
  const currentAge = state.ageSnapshot?.thaiAge ?? null;

  const stages = facts.daYun.map((d) => buildStage(facts, d, dayEl, favTh, gender));
  const current = stages.find((s) => s.isCurrent) ?? null;

  // ปีจรรายปี — ใช้ liuNianSeries ของ engine (มี twelveQiDisplay) + เกรด + flags
  const dayBranch = facts.pillars.find((p) => p.position === "day")?.branch ?? "";
  const years: TimelineYear[] = (state.liuNianSeries ?? []).map((y) => {
    const stemEl = STEM_TO_ELEMENT[y.stem as keyof typeof STEM_TO_ELEMENT];
    const qi = y.twelveQiDisplay ?? resolveDisplayTwelveQiStage(facts.dayMaster, y.branch) ?? null;
    return {
      year: y.year,
      age: y.age ?? null,
      ganzhi: `${y.stem}${y.branch}`,
      twelveQi: qi,
      grade: gradeLuckPhase(facts, stemEl, qi),
      clash: pairIn(CLASH_PAIRS, y.branch, dayBranch),
      sixCombine: pairIn(SIX_COMBINATION_PAIRS, y.branch, dayBranch),
      harm: pairIn(HARM_PAIRS, y.branch, dayBranch),
    };
  });

  // ปีต้องระวัง 20 ปีข้างหน้า (ชง/ให้ร้าย) — เผื่อ liuNianSeries สั้นกว่า 20
  const cautionYears: LifeTimeline["cautionYears"] = [];
  for (let y = nowYear; y < nowYear + 20; y++) {
    const { stem, branch } = annualGanzhi(y);
    const clash = pairIn(CLASH_PAIRS, branch, dayBranch);
    const harm = pairIn(HARM_PAIRS, branch, dayBranch);
    if (!clash && !harm) continue;
    cautionYears.push({
      year: y,
      age: birthYear ? y - birthYear + 1 : null,
      ganzhi: `${stem}${branch}`,
      kind: clash ? "clash" : "harm",
    });
  }

  return {
    dayMaster: facts.dayMaster,
    currentAge,
    favorableElementsTh: favTh,
    stages,
    current,
    years,
    cautionYears,
    note: "ระดับรายด้าน (การงาน/การเงิน/ความรัก) เป็นค่าประเมินเบื้องต้นจากปฏิกิริยาธาตุวัยจร ยังไม่ผ่านการปรับโดยซินแส",
  };
}

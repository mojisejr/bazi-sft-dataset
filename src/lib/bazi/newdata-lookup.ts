/**
 * NewData lookup — แปลง "ผลคำนวณ engine" → "คีย์ NewData ที่ match" → ข้อความคำอ่าน
 *
 * หลักการ (สำคัญ): จับคู่แบบ **set-membership** จากราศีบน/ล่าง (ฮั่นจื้อ) + สถานะ 12 เชี่ยงแซ (ไทย)
 * ที่ engine คายออกมาแน่นอน (fourPillars + lookingStage/lowerStagePrimary) — ไม่พึ่ง interactionState
 * ที่บางดวงว่างเปล่า และไม่พึ่ง taxonomy ภายในของ engine (เฮ้ง/破/刑 ที่ปนกันในตำราซินแส)
 *
 * pure + client-safe (type-only import จาก schema-types) — ทดสอบได้ตรง ๆ
 */
import type { NewdataValue } from "@/db/schema";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import type { NewdataMap } from "@/lib/bazi/newdata-repository";
import {
  avoidElementsTh,
  careerBandFromId,
  doElementsTh,
  elementThOfStem,
  type CareerBand,
  type ElementTh,
} from "@/lib/bazi/constants/career-finance-table";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { meritBandFromScore, meritFavorElements } from "@/lib/bazi/constants/merit-table";
import { buildFavorableSummaryText } from "@/lib/bazi/constants/favorable-element-reading";
import { LUCKY_ANIMAL_BY_DAY_MASTER } from "@/lib/bazi/constants/lucky-animal";
import { ELEMENT_ADVICE_TABLES, type ElementAdviceTable } from "@/lib/bazi/constants/element-advice";
import { FAMILY_STATE_READING } from "@/lib/bazi/constants/family-state-reading";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";
import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
// re-export: ผู้ใช้เดิม (life-timeline/tests) import annualGanzhi จากไฟล์นี้ — คงพื้นผิว public ไว้
export { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import {
  BRANCH_COMBINATION_TRANSFORMS,
  BRANCH_HIDDEN_STEMS,
  BRANCH_TO_ELEMENT,
  CLASH_PAIRS,
  CONTROLS,
  GENERATES,
  HARM_PAIRS,
  normalizeBranchPairKey,
  SAN_HE_GROUPS,
  SIX_COMBINATION_PAIRS,
  STEM_COMBINATION_TRANSFORMS,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

/** ปฏิกิริยาธาตุของ self เทียบ other (มุมดิถี): same/output(ถ่ายเท)/resource(ก่อเกิด)/wealth(ลาภ)/power(พิฆาต) */
export function elementRelationKey(self: string, other: string): string {
  if (self === other) return "same";
  if (GENERATES[self as keyof typeof GENERATES] === other) return "output";
  if (GENERATES[other as keyof typeof GENERATES] === self) return "resource";
  if (CONTROLS[self as keyof typeof CONTROLS] === other) return "wealth";
  if (CONTROLS[other as keyof typeof CONTROLS] === self) return "power";
  return "same";
}

export type PillarPosition = "year" | "month" | "day" | "hour";

export type PillarFact = {
  position: PillarPosition;
  /** ราศีบน (天干) ฮั่นจื้อ */
  stem: string;
  /** ราศีล่าง (地支) ฮั่นจื้อ */
  branch: string;
  /** สถานะ 12 เชี่ยงแซ ของราศีล่างเทียบดิถี (ไทย) เช่น "หมกยก" */
  state: string | null;
  /** สถานะ 12 เชี่ยงแซ ของราศีบน (ก้านเสา) — ใช้บท 6 (พ่อ = ราศีบนหลักเดือน) */
  upperState: string | null;
};

/** ช่วงย่อย 5 ปีของวัยจร (upper = ก้าน, lower = กิ่ง) */
export type LuckPhase = {
  /** "stem" (ราศีบน) | "branch" (ราศีล่าง) */
  source: "stem" | "branch";
  symbol: string;
  startAge: number;
  endAge: number;
  /** สถานะ 12 เชี่ยงแซเทียบดิถี */
  qi: string | null;
  isCurrent: boolean;
};

export type LuckFact = {
  startAge: number;
  endAge: number;
  stem: string;
  branch: string;
  isCurrent: boolean;
  upperState: string | null;
  lowerState: string | null;
  /** ช่วงย่อย 5 ปี (ก้าน→กิ่ง) สำหรับ turning_points ละเอียด */
  phases: LuckPhase[];
};

export type ChartFacts = {
  dayMaster: string;
  /** คะแนนกำลังดิถี (engine strengthScore) — ใช้จัด band บทอาชีพ */
  strengthScore: number;
  /** เพศกำเนิด ("male"/"female") — ใช้บทความรัก (โอกาสมีคู่) · undefined = ไม่ระบุ */
  gender?: string;
  /** ปีเกิด ค.ศ. — ใช้บท 12 คำนวณอายุรายปีจร (นับแบบจีน = ปี-ปีเกิด+1) · undefined = ไม่โชว์อายุ */
  birthYear?: number;
  pillars: PillarFact[];
  daYun: LuckFact[];
};

/** ผลคำอ่าน 1 ก้อนที่ match */
export type NewdataBlock = {
  group: string;
  itemKey: string;
  label?: string;
  text: string;
  /** ราศี/เสาที่ทำให้ match (ไว้โชว์บริบท) */
  context?: string;
};

// ── helper ────────────────────────────────────────────────────────────────
function isCjk(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x3400 && c <= 0x9fff;
}
/** ดึงเฉพาะอักษรจีนจากคีย์ (normalize NFC กันเคส compatibility ideograph) */
export function cjkChars(s: string): string[] {
  return [...s.normalize("NFC")].filter(isCjk);
}

// ── adapter: CalculatedStateValue → ChartFacts ──────────────────────────────
const PILLAR_POSITIONS: PillarPosition[] = ["year", "month", "day", "hour"];

export function extractChartFacts(
  state: CalculatedStateValue,
  gender?: string,
  birthYear?: number,
): ChartFacts {
  const fp = state.fourPillars;
  const pillars: PillarFact[] = PILLAR_POSITIONS.map((position) => {
    const p = fp[position];
    return {
      position,
      stem: p.stem.normalize("NFC"),
      branch: p.branch.normalize("NFC"),
      state: p.lowerStagePrimary ?? p.lookingStage ?? null,
      upperState: p.upperStagePrimary ?? p.upperStageDisplay ?? null,
    };
  });
  const daYun: LuckFact[] = (state.daYun ?? []).map((d) => {
    const phases: LuckPhase[] = [];
    for (const [source, ph] of [
      ["stem", d.upperPhase],
      ["branch", d.lowerPhase],
    ] as const) {
      if (!ph) continue;
      phases.push({
        source,
        symbol: (ph.symbol ?? "").normalize("NFC"),
        startAge: ph.startAge,
        endAge: ph.endAge,
        qi: ph.twelveQiDisplay ?? null,
        isCurrent: Boolean(ph.isCurrent),
      });
    }
    return {
      startAge: d.startAge,
      endAge: d.endAge,
      stem: d.stem.normalize("NFC"),
      branch: d.branch.normalize("NFC"),
      isCurrent: Boolean(d.isCurrent),
      upperState: d.upperStageDisplay ?? null,
      lowerState: d.lowerStageDisplay ?? null,
      phases,
    };
  });
  return {
    dayMaster: state.dayMaster.normalize("NFC"),
    strengthScore: state.strengthScore,
    gender,
    birthYear,
    pillars,
    daYun,
  };
}

/** มัลติเซ็ตของราศีล่างในดวง (รวมตัวซ้ำ) + เซ็ตราศีบน */
function chartSets(facts: ChartFacts) {
  const branchCount = new Map<string, number>();
  const stemSet = new Set<string>();
  const ganzhiSet = new Set<string>();
  for (const p of facts.pillars) {
    branchCount.set(p.branch, (branchCount.get(p.branch) ?? 0) + 1);
    stemSet.add(p.stem);
    ganzhiSet.add(`${p.stem}${p.branch}`);
  }
  const branchSet = new Set(branchCount.keys());
  return { branchCount, branchSet, stemSet, ganzhiSet };
}

// ── matcher per group ───────────────────────────────────────────────────────
function groupItems(map: NewdataMap, group: string): Array<{ key: string; value: NewdataValue }> {
  return Object.entries(map[group] ?? {}).map(([key, value]) => ({ key, value }));
}
function toBlock(
  group: string,
  key: string,
  value: NewdataValue,
  context?: string,
  labelOverride?: string,
): NewdataBlock {
  return { group, itemKey: key, label: labelOverride ?? value.label, text: value.text, context };
}

/** ชื่อเสาแบบไทย (สไตล์ซินแส) */
const THAI_PILLAR_NAME: Record<PillarPosition, string> = {
  year: "เสาปี",
  month: "เสาเดือน",
  day: "เสาวัน",
  hour: "เสายาม",
};

/** กะจื่อ (ก้าน+กิ่ง) ของเสาที่ระบุ จาก facts */
function pillarGanzhi(facts: ChartFacts, position: PillarPosition): string {
  const p = facts.pillars.find((x) => x.position === position);
  return p ? `${p.stem}${p.branch}` : "";
}

/** ป้ายสไตล์ซินแส: "เสาเดือน 庚戌 (ซวย)" — qi ในวงเล็บถ้ามี */
function pillarLabel(facts: ChartFacts, position: PillarPosition, qi?: string | null): string {
  const gz = pillarGanzhi(facts, position);
  const head = `${THAI_PILLAR_NAME[position]} ${gz}`.trim();
  return qi ? `${head} (${qi})` : head;
}

// ── 得令 (เกิดถูกฤดู) — ปรับ band เฉพาะชั้น newdata/career ────────────────────
// engine คะแนนหลัก "ไม่นับ 得令/通根" (ดู operator-strength.ts) แต่ ground-truth ซินแส
// ใช้ 得令 ชัดเจน: ดิถีได้แรงหนุนจากฤดูเมื่อ "กิ่งเดือน = ธาตุเดียวกับดิถี" เท่านั้น
// (ธาตุที่แค่ส่งเสริม/相 ไม่นับ — ซินแสยืนยัน 庚 ใน 戌 ดิน = "เกิดไม่ถูกฤดู")
// เมื่อ 得令 → ยก band ขึ้น 1 ขั้น (calibrate จากดวง 丁 ใน 午: สมดุล → แข็ง)
// ปรับเฉพาะการอ่าน 15 บท (กล่องกำลังดิถี + บทอาชีพ) ไม่แตะ strength engine กลาง
const STRENGTH_ID_ORDER = ["very-weak", "weak", "balanced", "strong", "very-strong"] as const;

/** ดิถีเกิดถูกฤดูไหม — กิ่งเดือนเป็นธาตุเดียวกับดิถี (旺) */
export function isInSeason(facts: ChartFacts): boolean {
  const month = facts.pillars.find((p) => p.position === "month");
  if (!month) return false;
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  const monthEl = BRANCH_TO_ELEMENT[month.branch as keyof typeof BRANCH_TO_ELEMENT];
  return Boolean(dayEl && monthEl && dayEl === monthEl);
}

/** id band 5 ชั้น หลังปรับ 得令 (+1 ขั้นถ้าเกิดถูกฤดู) — base = classify จากคะแนน engine */
export function seasonalStrengthId(facts: ChartFacts): string {
  const base = classifyOperatorStrengthScore(facts.strengthScore).id;
  if (!isInSeason(facts)) return base;
  const i = STRENGTH_ID_ORDER.indexOf(base as (typeof STRENGTH_ID_ORDER)[number]);
  if (i < 0) return base;
  return STRENGTH_ID_ORDER[Math.min(i + 1, STRENGTH_ID_ORDER.length - 1)];
}

/** band อาชีพ 3 ระดับ หลังปรับ 得令 */
export function seasonalCareerBand(facts: ChartFacts): CareerBand {
  return careerBandFromId(seasonalStrengthId(facts));
}

/** กลุ่มคู่ราศีล่าง (clash/harm_hai/harm_heng/combine_branch/trinity_half) — active เมื่อราศีทั้งคู่อยู่ในดวง */
export function matchBranchPairs(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const { branchSet } = chartSets(facts);
  return groupItems(map, group)
    .filter(({ key }) => {
      const chars = cjkChars(key);
      return chars.length >= 2 && chars.every((b) => branchSet.has(b));
    })
    .map(({ key, value }) => toBlock(group, key, value));
}

/** จื่อเฮ้ง — ราศีล่างปรากฏซ้ำ ≥2 ครั้ง */
export function matchSelfPunish(map: NewdataMap, facts: ChartFacts): NewdataBlock[] {
  const { branchCount } = chartSets(facts);
  return groupItems(map, "self_punish")
    .filter(({ key }) => {
      const [b] = cjkChars(key);
      return b !== undefined && (branchCount.get(b) ?? 0) >= 2;
    })
    .map(({ key, value }) => toBlock("self_punish", key, value));
}

/** ซำเฮ้ง — ชุดตัวแทน 3 ตัวครบในดวง (จาก value.combos) */
export function matchSamHeng(map: NewdataMap, facts: ChartFacts): NewdataBlock[] {
  const { branchSet } = chartSets(facts);
  const out: NewdataBlock[] = [];
  for (const { key, value } of groupItems(map, "sam_heng")) {
    const combos = value.combos ?? [];
    const hit = combos.find((trio) => trio.length >= 3 && trio.every((b) => branchSet.has(b.normalize("NFC"))));
    if (hit) out.push(toBlock("sam_heng", key, value, hit.join("")));
  }
  return out;
}

/** ไตรภาคีเต็มชุด — ราศี 3 ตัวครบ (จาก value.branches) */
export function matchTrinity(map: NewdataMap, facts: ChartFacts): NewdataBlock[] {
  const { branchSet } = chartSets(facts);
  return groupItems(map, "trinity")
    .filter(({ value }) => {
      const b = value.branches ?? [];
      return b.length >= 3 && b.every((x) => branchSet.has(x.normalize("NFC")));
    })
    .map(({ key, value }) => toBlock("trinity", key, value));
}

/** ภาคีราศีบน — ราศีบนทั้งคู่อยู่ในดวง */
export function matchStemPairs(map: NewdataMap, facts: ChartFacts): NewdataBlock[] {
  const { stemSet } = chartSets(facts);
  return groupItems(map, "combine_stem")
    .filter(({ key }) => {
      const chars = cjkChars(key);
      return chars.length >= 2 && chars.every((s) => stemSet.has(s));
    })
    .map(({ key, value }) => toBlock("combine_stem", key, value));
}

/** ผั่ว — เสาใดเสาหนึ่งมีกะจื่อ (ราศีบน+ล่าง) ตรงกับคีย์ */
export function matchPhua(map: NewdataMap, facts: ChartFacts): NewdataBlock[] {
  const out: NewdataBlock[] = [];
  for (const { key, value } of groupItems(map, "phua")) {
    const target = key.normalize("NFC");
    const pillar = facts.pillars.find((p) => `${p.stem}${p.branch}` === target);
    if (pillar) out.push(toBlock("phua", key, value, `เสา${pillar.position}`));
  }
  return out;
}

/**
 * บทอาชีพ/ธุรกิจ (career_potential) — ธาตุดิถี × กำลัง × ธาตุราศีบนหลักเดือน
 *   role "do"    → ธาตุที่ควรทำ (เรียงลำดับจากตาราง B)
 *   role "avoid" → ธาตุที่ไม่ควรทำ (heuristic ความสัมพันธ์ธาตุ)
 * order = ลำดับ 1..n ของธาตุในรายการ · คืนกล่องเดียว (รายชื่ออาชีพของธาตุนั้น) หรือ [] ถ้าไม่มี
 */
export function matchCareer(
  map: NewdataMap,
  facts: ChartFacts,
  role: "do" | "avoid",
  order: number,
  group = "career_by_element",
): NewdataBlock[] {
  const dayElement = elementThOfStem(facts.dayMaster);
  if (!dayElement) return [];
  const band = seasonalCareerBand(facts); // ปรับ 得令 (เกิดถูกฤดู) ก่อนจัด band
  const monthPillar = facts.pillars.find((p) => p.position === "month");
  const monthElement = monthPillar ? elementThOfStem(monthPillar.stem) : null;

  let elements: ElementTh[];
  if (role === "do") {
    if (!monthElement) return [];
    elements = doElementsTh(dayElement, band, monthElement);
  } else {
    elements = avoidElementsTh(dayElement, band);
  }

  const element = elements[order - 1];
  if (!element) return [];

  const value = map[group]?.[element];
  if (!value) return [];

  const bandTh = band === "weak" ? "อ่อน" : band === "veryStrong" ? "แข็งเกินไป" : "สมดุล/แข็งแรง";
  const context =
    role === "do"
      ? `ดิถีธาตุ${dayElement} (${bandTh}) · เดือนธาตุ${monthElement} → ธาตุ${element}`
      : `ดิถีธาตุ${dayElement} (${bandTh}) → เลี่ยงธาตุ${element}`;
  return [toBlock(group, element, value, context)];
}

/** engine 5 band id → คีย์/ป้าย band ของตารางดิถี/กำลัง (50 ช่อง) */
const STRENGTH_BAND_KEY: Record<string, { key: string; label: string }> = {
  "very-strong": { key: "over_strong", label: "แข็งเกินไป" },
  strong: { key: "strong", label: "แข็ง" },
  balanced: { key: "balanced", label: "สมดุล" },
  weak: { key: "weak", label: "อ่อน" },
  "very-weak": { key: "over_weak", label: "อ่อนเกินไป" },
};

/** บท 1 · กำลังดิถี — ราศีบนหลักวัน (ก้านดิถี) × กำลังดิถี → คีย์ "{ก้าน}|{band}" */
export function matchDayMasterStrength(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
): NewdataBlock[] {
  const band = STRENGTH_BAND_KEY[seasonalStrengthId(facts)]; // ปรับ 得令 (เกิดถูกฤดู)
  if (!band) return [];
  const key = `${facts.dayMaster}|${band.key}`;
  const value = map[group]?.[key];
  if (!value) return [];
  const elTh = elementThOfStem(facts.dayMaster);
  const label = `ดิถี ${facts.dayMaster}${elTh ? ` (${elTh})` : ""} · ${band.label}`;
  return [toBlock(group, key, value, `ดิถี ${facts.dayMaster} · ${band.label}`, label)];
}

/** ราศีล่างของเสาที่ระบุ → lookup คีย์ราศีล่างเดี่ยว (12 นักษัตร) */
export function matchPillarBranch(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  position: PillarPosition,
): NewdataBlock[] {
  const pillar = facts.pillars.find((p) => p.position === position);
  if (!pillar) return [];
  const value = map[group]?.[pillar.branch];
  if (!value) return [];
  const label = `${THAI_PILLAR_NAME[position]} ${value.label ?? pillar.branch}`;
  return [toBlock(group, pillar.branch, value, `เสา${position}`, label)];
}

/** ราศีบน (ก้าน) ของเสาที่ระบุ → lookup คีย์ราศีบน (นิสัยราศีบน 10 ก้าน) */
export function matchPillarStem(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  position: PillarPosition,
): NewdataBlock[] {
  const pillar = facts.pillars.find((p) => p.position === position);
  if (!pillar) return [];
  const value = map[group]?.[pillar.stem];
  if (!value) return [];
  const label = `ราศีบน${THAI_PILLAR_NAME[position]} ${value.label ?? pillar.stem}`;
  return [toBlock(group, pillar.stem, value, `ราศีบนเสา${position}`, label)];
}

/** กะจื่อ (ราศีบน+ล่าง) ของเสาที่ระบุ → lookup คีย์กะจื่อ (60 กะจื่อ) */
export function matchPillarGanzhi(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  position: PillarPosition,
): NewdataBlock[] {
  const pillar = facts.pillars.find((p) => p.position === position);
  if (!pillar) return [];
  const key = `${pillar.stem}${pillar.branch}`;
  const value = map[group]?.[key];
  // ข้ามแถว placeholder ที่ยังไม่กรอกเนื้อหา (เช่น spouse_knowledge_60 เตรียมคีย์ครบ 60 ไว้ก่อน)
  if (!value?.text?.trim()) return [];
  return [toBlock(group, key, value, `เสา${position}`, pillarLabel(facts, position))];
}

/**
 * ชื่อเสียงและเกียรติยศ (ดาวจิ้งซิ้ง) — จับเมื่อดวงมีกะจื่อพิเศษ (甲子/甲午/己酉/己卯) ในเสาใดก็ได้
 * lookup คีย์ = กะจื่อของเสา (เฉพาะคีย์ที่ซินแสกรอกเนื้อไว้ = 4 กะจื่อ) · ดีดุปตามกะจื่อ (กันเสาซ้ำ)
 */
export function matchFameHonor(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  for (const p of facts.pillars) {
    const key = `${p.stem}${p.branch}`;
    if (seen.has(key)) continue;
    const value = map[group]?.[key];
    if (!value?.text?.trim()) continue;
    seen.add(key);
    out.push(toBlock(group, key, value, THAI_PILLAR_NAME[p.position], `${key} (${THAI_PILLAR_NAME[p.position]})`));
  }
  return out;
}

/**
 * ดิถีถ่ายเท — ก้านดิถี (D) "ถ่ายเท" ไปยังราศีบน/ล่างในดวง → lookup คีย์ "{D}|{ปลายทาง}"
 * scope: "all" = ทั้งราศีบน+ล่าง · "stems" = เฉพาะราศีบน (พรสวรรค์) · "branches" = เฉพาะราศีล่าง (พรแสวง)
 * คืนหลายก้อน (ดีดุปตามคีย์) — match เฉพาะปลายทางที่เป็นธาตุถ่ายเท (มีคีย์ในตาราง)
 */
export function matchDithiTransfer(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  scope: "all" | "stems" | "branches" = "all",
): NewdataBlock[] {
  const day = facts.dayMaster;
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  for (const p of facts.pillars) {
    const targets: Array<{ ch: string; kind: string }> = [];
    if (scope !== "branches") targets.push({ ch: p.stem, kind: "ราศีบน" });
    if (scope !== "stems") targets.push({ ch: p.branch, kind: "ราศีล่าง" });
    for (const { ch, kind } of targets) {
      const key = `${day}|${ch}`;
      if (seen.has(key)) continue;
      const value = map[group]?.[key];
      if (!value) continue;
      seen.add(key);
      out.push(toBlock(group, key, value, `เสา${p.position} ${kind}`));
    }
  }
  return out;
}

// ── ดิถีถ่ายเท "ทุกรูปแบบ" + จัดลำดับกลไก (กติกาซินแส) ───────────────────────
// ธาตุเป้าหมายปรากฏในดวงได้ 4 กลไก จัดลำดับ fallback:
//   1 ธาตุแท้  → ราศีบน/ล่างเป็นธาตุเป้าหมายตรง ๆ
//   2 ภาคี/ไตรภาคี → กิ่ง/ก้านรวมกันเป็นธาตุเป้าหมาย (6合/三合/天干合)
//   3 เชี่ยงแซ → คีย์มีในตำราซินแส แต่ไม่ใช่ธาตุแท้/ไม่มีคู่ภาคีในดวง (residual)
//   4 จิตใต้สำนึก → ธาตุเป้าหมายเป็นราศีแฝง (藏干) ในกิ่ง (คืนแยกเสมอ)
// กติกา: "ใช้ข้อ1 ก่อน ถ้ามี1 ไม่ดูตัวอื่น · ไม่มี1→2 · ไม่มี2→3 · 4 ใช้เฉพาะจิตใต้สำนึก"
// หมายเหตุ: กลไก 3 ไม่คำนวณ 12-qi ตรง ๆ — อาศัย "คีย์มีในข้อมูลซินแส" กรองตอน lookup
// (ซินแสเขียนคีย์เฉพาะปลายทางที่ถ่ายเทได้จริง) → residual ที่ไม่ใช่ 1/2 = กลไก 3
const CN_ELEMENT_TO_EN: Record<string, string> = {
  "木": "wood",
  "火": "fire",
  "土": "earth",
  "金": "metal",
  "水": "water",
};

function elementOfChar(ch: string): string | undefined {
  return (
    STEM_TO_ELEMENT[ch as keyof typeof STEM_TO_ELEMENT] ??
    BRANCH_TO_ELEMENT[ch as keyof typeof BRANCH_TO_ELEMENT]
  );
}

/** ก้าน/กิ่ง ch รวมกับตัวอื่นในดวงเป็น targetEl ไหม (6合 + 三合 + 天干合) */
function combinesToElement(
  ch: string,
  targetEl: string,
  branchSet: Set<string>,
  stemSet: Set<string>,
): boolean {
  // กิ่ง: 6合 คู่
  for (const other of branchSet) {
    if (other === ch) continue;
    if (BRANCH_COMBINATION_TRANSFORMS.get(normalizeBranchPairKey(ch, other)) === targetEl) return true;
  }
  // กิ่ง: 三合 (มีอย่างน้อยอีก 1 ตัวในกลุ่ม = ครึ่งไตรภาคี)
  for (const g of SAN_HE_GROUPS) {
    const branches = g.branches as readonly string[];
    if (g.element !== targetEl || !branches.includes(ch)) continue;
    if (branches.some((b) => b !== ch && branchSet.has(b))) return true;
  }
  // ก้าน: 天干合 คู่
  for (const [pairKey, cn] of STEM_COMBINATION_TRANSFORMS) {
    if (CN_ELEMENT_TO_EN[cn] !== targetEl) continue;
    const [a, b] = pairKey.split("|");
    if (ch === a && stemSet.has(b)) return true;
    if (ch === b && stemSet.has(a)) return true;
  }
  return false;
}

export type MechanismHit = {
  position: PillarPosition;
  /** อักษรปลายทางที่ทำให้ match (ไป lookup "{ดิถี}|{targetChar}") */
  targetChar: string;
  /** "ราศีบน" | "ราศีล่าง" | "ราศีแฝง" */
  kind: string;
};

export type MechanismResult = {
  /** กลไก 1/2/3 — index 0=ธาตุแท้, 1=ภาคี, 2=เชี่ยงแซ (residual) */
  tiers: [MechanismHit[], MechanismHit[], MechanismHit[]];
  /** กลไก 4 จิตใต้สำนึก (ราศีแฝง) — คืนแยกเสมอ */
  subconscious: MechanismHit[];
};

/** หา "ธาตุเป้าหมาย" ในดวงแยกตามกลไก (pure) — ใช้ทั้งบท1 ถ่ายเท, บท3 โชคลาภ, บท4 ผู้อุปถัมป์ */
export function findElementByMechanism(facts: ChartFacts, targetEl: string): MechanismResult {
  const { branchSet, stemSet } = chartSets(facts);
  const tiers: [MechanismHit[], MechanismHit[], MechanismHit[]] = [[], [], []];
  const subconscious: MechanismHit[] = [];
  for (const p of facts.pillars) {
    for (const [ch, kind] of [
      [p.stem, "ราศีบน"],
      [p.branch, "ราศีล่าง"],
    ] as const) {
      const hit: MechanismHit = { position: p.position, targetChar: ch, kind };
      if (elementOfChar(ch) === targetEl) tiers[0].push(hit);
      else if (combinesToElement(ch, targetEl, branchSet, stemSet)) tiers[1].push(hit);
      else tiers[2].push(hit);
    }
    // กลไก 4: ราศีแฝงของกิ่งเสานี้ที่เป็นธาตุเป้าหมาย
    const hidden = BRANCH_HIDDEN_STEMS[p.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];
    for (const h of hidden) {
      if (STEM_TO_ELEMENT[h as keyof typeof STEM_TO_ELEMENT] === targetEl) {
        subconscious.push({ position: p.position, targetChar: h, kind: "ราศีแฝง" });
      }
    }
  }
  return { tiers, subconscious };
}

/**
 * เลือก tier สูงสุดที่ "lookup แล้วเจอจริง" (มี1→ใช้1, ไม่เจอ→2, ไม่เจอ→3) + กลไก4 เสมอ
 * lookupFn(hit) คืน block หรือ null — caller กำหนดว่าจะ lookup ด้วยคีย์อะไร (ดิถี|ปลายทาง หรือ เชี่ยงแซเสา)
 */
function applyMechanismPriority(
  res: MechanismResult,
  lookupFn: (hit: MechanismHit, mechanism: 1 | 2 | 3 | 4) => NewdataBlock | null,
): NewdataBlock[] {
  let primary: NewdataBlock[] = [];
  for (let i = 0; i < 3; i++) {
    const mech = (i + 1) as 1 | 2 | 3;
    const blocks: NewdataBlock[] = [];
    const seen = new Set<string>();
    for (const hit of res.tiers[i]) {
      if (seen.has(hit.targetChar)) continue;
      const b = lookupFn(hit, mech);
      if (!b) continue;
      seen.add(hit.targetChar);
      blocks.push(b);
    }
    if (blocks.length > 0) {
      primary = blocks;
      break;
    }
  }
  const subSeen = new Set<string>();
  const sub: NewdataBlock[] = [];
  for (const hit of res.subconscious) {
    if (subSeen.has(hit.targetChar)) continue;
    const b = lookupFn(hit, 4);
    if (!b) continue;
    subSeen.add(hit.targetChar);
    sub.push(b);
  }
  return [...primary, ...sub];
}

const MECH_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "ธาตุแท้",
  2: "ภาคี",
  3: "เชี่ยงแซ",
  4: "จิตใต้สำนึก",
};

/**
 * lookup ธาตุเป้าหมายแบบ "ทุกรูปแบบ + จัดลำดับกลไก" → คีย์ "{ก้านอ้างอิง}|{ปลายทาง}"
 * refStem = ก้านที่ขึ้นต้นคีย์ (ดิถีถ่ายเท/โชคลาภดิถี = ก้านดิถี · โชคลาภหลักเดือน = ก้านเดือน)
 */
function lookupTransferByMechanism(
  map: NewdataMap,
  group: string,
  refStem: string,
  targetEl: string,
  facts: ChartFacts,
): NewdataBlock[] {
  const res = findElementByMechanism(facts, targetEl);
  return applyMechanismPriority(res, (hit, mech) => {
    const key = `${refStem}|${hit.targetChar}`;
    const value = map[group]?.[key];
    if (!value) return null;
    const ctx =
      mech === 4
        ? `จิตใต้สำนึก · ราศีแฝง ${hit.targetChar}`
        : `เสา${hit.position} ${hit.kind} (${MECH_LABEL[mech]})`;
    return toBlock(group, key, value, ctx);
  });
}

/**
 * ดิถีถ่ายเท "ทุกรูปแบบ" + จัดลำดับกลไก — ธาตุถ่ายเท (食傷 = GENERATES[ดิถี])
 * lookup คีย์ "{ดิถี}|{ปลายทาง}" ในกลุ่ม 118 คีย์เดิม · เลือก tier สูงสุดที่เจอ + จิตใต้สำนึกแยก
 */
export function matchDithiTransferPrioritized(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayEl) return [];
  const outputEl = GENERATES[dayEl as keyof typeof GENERATES];
  if (!outputEl) return [];
  return lookupTransferByMechanism(map, group, facts.dayMaster, outputEl, facts);
}

/**
 * บท 5 · พรในราศีแฝง — ก้านดิถี (D) ถ่ายเทไปยัง "ราศีแฝง" (藏干) ของราศีล่างหลักยาม
 * → lookup คีย์ "{D}|{ราศีแฝง}" ในกลุ่ม dithi_transfer (reuse) · คืนหลายก้อน (ดีดุปตามคีย์)
 */
export function matchHiddenTransfer(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const hour = facts.pillars.find((p) => p.position === "hour");
  if (!hour) return [];
  const hidden = BRANCH_HIDDEN_STEMS[hour.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];
  const day = facts.dayMaster;
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  for (const h of hidden) {
    const key = `${day}|${h}`;
    if (seen.has(key)) continue;
    const value = map[group]?.[key];
    if (!value) continue;
    seen.add(key);
    out.push(toBlock(group, key, value, `ราศีแฝงหลักยาม ${h}`));
  }
  return out;
}

/**
 * ดิถีถ่ายเทตามวัยจร — ก้านดิถี (D) ถ่ายเทไปยังราศีบน/ล่างของแต่ละวัยจร → "{D}|{ปลายทาง}"
 * บท 12: คำอ่านการกระทำในแต่ละช่วงวัย (พร้อมป้ายอายุ + บอกช่วงปัจจุบัน)
 */
export function matchDaYunTransfer(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const day = facts.dayMaster;
  const out: NewdataBlock[] = [];
  for (const d of facts.daYun) {
    const ageCtx = `อายุ ${d.startAge}-${d.endAge}${d.isCurrent ? " (ปัจจุบัน)" : ""}`;
    for (const ch of [d.stem, d.branch]) {
      const value = map[group]?.[`${day}|${ch}`];
      if (value) out.push(toBlock(group, `${day}|${ch}`, value, ageCtx));
    }
  }
  return out;
}

/** ปฏิกิริยาธาตุ (มุมดิถี) → ป้ายบทบาทแบบซินแส สำหรับวัยจร */
const RELATION_ROLE_TH: Record<string, string> = {
  same: "คู่ธาตุ",
  output: "ถ่ายเท",
  resource: "ส่งเสริม",
  wealth: "ลาภ (ดิถีพิฆาต)",
  power: "อำนาจ (พิฆาตดิถี)",
};

/** ธาตุ (อังกฤษ) ของสัญลักษณ์วัยจร — ก้านใช้ STEM, กิ่งใช้ BRANCH */
function elementOfSymbol(symbol: string, source: "stem" | "branch"): string | undefined {
  return source === "stem"
    ? STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT]
    : BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT];
}

// (2026-07-29 ซินแสสั่งเอาระบบเกรด 3/2/1/0 ออก — วัยจร/ปีจรใช้ระบบดาว (group luck_stars) แทน)

/**
 * บท 14 (turning_points) · วัยจรช่วงละ 5 ปี — แตก upperPhase(ก้าน)+lowerPhase(กิ่ง) ของทุกวัยจร
 * แต่ละช่วง: label = "อายุ X-Y ปี[ ช่วงปัจจุบัน] (สัญลักษณ์ บทบาทธาตุ → เชี่ยงแซ)[ ⭐...]"
 * body = ความหมาย 12 เชี่ยงแซ
 */
/**
 * บท 12 · ⭐ ของเชี่ยงแซ ตามตาราง "จำนวนดาวของวัยจร" (group luck_stars — ซินแสแก้ได้ในแอดมิน)
 * คืน "" ถ้ายังไม่มีข้อมูลในกลุ่ม (ป้ายวัยจรก็ไม่โชว์ดาว)
 */
function luckStarsOf(map: NewdataMap, group: string, qi: string | null | undefined): string {
  if (!qi) return "";
  return (map[group]?.[qi]?.text ?? "").trim();
}

/** นับจำนวน ⭐ ในข้อความของตาราง luck_stars */
function starCount(stars: string): number {
  return [...stars].filter((c) => c === "⭐").length;
}

/**
 * ⭐ → ข้อความ "N ดาว" (2026-08-05 ซินแสแจ้งว่าไอคอนดาวไม่แสดงผลตอน save เป็น PDF
 * จึงพิมพ์เป็นตัวหนังสือแทน — ระดับดาว 1-5 ตามตารางเดิมของซินแสไม่เปลี่ยน)
 */
function starsToText(stars: string): string {
  const n = starCount(stars);
  return n ? `${n} ดาว` : "";
}

export function matchDaYun(map: NewdataMap, facts: ChartFacts): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  const out: NewdataBlock[] = [];
  for (const d of facts.daYun) {
    for (const ph of d.phases) {
      if (!ph.qi) continue;
      const value = map.shengxiang?.[ph.qi];
      if (!value) continue;
      const symEl = elementOfSymbol(ph.symbol, ph.source);
      const role = dayEl && symEl ? RELATION_ROLE_TH[elementRelationKey(dayEl, symEl)] : null;
      const current = ph.isCurrent ? " ช่วงปัจจุบัน" : "";
      const roleTxt = role ? ` ${role} →` : " →";
      const stars = starsToText(luckStarsOf(map, "luck_stars", ph.qi));
      const starTxt = stars ? ` · ${stars}` : "";
      const label = `อายุ ${ph.startAge}-${ph.endAge} ปี${current} (${ph.symbol}${roleTxt} ${ph.qi})${starTxt}`;
      out.push({ group: "shengxiang", itemKey: ph.qi, label, text: value.text });
    }
  }
  return out;
}

/**
 * บท 12 · ช่วงวัยที่ดี / ช่วงวัยที่ควรระวัง — ตามระบบดาวใหม่ (group luck_stars)
 * ซินแสสั่ง: ช่วงวัยที่ดี = วัยจร ⭐⭐⭐⭐⭐ · ช่วงที่ควรระวัง = วัยจร ⭐
 * (ยังไม่มีข้อมูลในกลุ่ม → คืน [] กล่องว่างรอเติม เหมือนกลุ่มอื่น)
 */
export function matchLuckStars(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const good: string[] = [];
  const watch: string[] = [];
  for (const d of facts.daYun) {
    for (const ph of d.phases) {
      const stars = luckStarsOf(map, group, ph.qi);
      if (!stars) continue;
      const current = ph.isCurrent ? " (ช่วงปัจจุบัน)" : "";
      const line = `อายุ ${ph.startAge}-${ph.endAge} ปี${current} — ${ph.symbol} เชี่ยงแซ ${ph.qi} · ${starsToText(stars)}`;
      const count = starCount(stars);
      if (count >= 5) good.push(line);
      else if (count === 1) watch.push(line);
    }
  }
  const out: NewdataBlock[] = [];
  if (good.length) {
    out.push({
      group,
      itemKey: "ช่วงวัยที่ดี",
      label: "ช่วงวัยที่ดี (5 ดาว)",
      text: good.join("\n"),
    });
  }
  if (watch.length) {
    out.push({
      group,
      itemKey: "ช่วงวัยที่ควรระวัง",
      label: "ช่วงวัยที่ควรระมัดระวัง (1 ดาว)",
      text: watch.join("\n"),
    });
  }
  return out;
}

// ── บท 12 · ปีจร (annual year pillar) ────────────────────────────────────────
function pairIn(set: Set<string>, a: string, b: string): boolean {
  return set.has(`${a}|${b}`) || set.has(`${b}|${a}`);
}

/**
 * บท 12 · ปีจรปัจจุบัน + พยากรณ์รายปีย่อ + ปีชง/ฮะ/ให้ร้ายกับหลักวัน — ตามโครง PDF ซินแส
 * แต่ละปี: กะจื่อ + บทบาทธาตุ (ก้านปีเทียบดิถี) + เชี่ยงแซ (ดิถี×กิ่งปี)
 * อายุ = นับแบบจีน (ปี - ปีเกิด + 1) โชว์เมื่อ facts.birthYear มี · nowYear ฉีดได้เพื่อเทสต์
 */
export function matchAnnualYears(
  facts: ChartFacts,
  nowYear: number = new Date().getFullYear(),
): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  const dayBranch = facts.pillars.find((p) => p.position === "day")?.branch;
  if (!dayEl || !dayBranch) return [];
  const ageTxt = (y: number) => (facts.birthYear ? `อายุ ${y - facts.birthYear + 1} ปี, ` : "");
  const yearInfo = (y: number) => {
    const { stem, branch } = annualGanzhi(y);
    const stemElEn = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
    const role = stemElEn ? RELATION_ROLE_TH[elementRelationKey(dayEl, stemElEn)] : "";
    const qi = resolveDisplayTwelveQiStage(facts.dayMaster, branch);
    return { stem, branch, role, qi };
  };

  const out: NewdataBlock[] = [];
  // 1) ปีจรปัจจุบัน
  const cur = yearInfo(nowYear);
  out.push({
    group: "annual_year",
    itemKey: `${cur.stem}${cur.branch}`,
    label: `ปีจรปัจจุบัน ${cur.stem}${cur.branch} (พ.ศ. ${nowYear + 543}, ${ageTxt(nowYear)}ค.ศ. ${nowYear})`,
    text: `ก้านปีธาตุ${EN_TO_TH_ELEMENT[STEM_TO_ELEMENT[cur.stem as keyof typeof STEM_TO_ELEMENT]] ?? ""} เป็น${cur.role} → ${cur.qi}`,
  });
  // 2) พยากรณ์รายปีย่อ 10 ปี (ข้อเท็จจริงต่อปี ให้ AI ขยายเป็นคำทำนาย)
  const lines: string[] = [];
  for (let y = nowYear; y < nowYear + 10; y++) {
    const it = yearInfo(y);
    const flags = [
      pairIn(CLASH_PAIRS, it.branch, dayBranch) ? ` · ชง (冲) กับหลักวัน (${it.branch}-${dayBranch})` : "",
      pairIn(SIX_COMBINATION_PAIRS, it.branch, dayBranch) ? ` · ฮะ (六合) กับหลักวัน (${it.branch}-${dayBranch})` : "",
      pairIn(HARM_PAIRS, it.branch, dayBranch) ? ` · ให้ร้าย (害) กับหลักวัน (${it.branch}-${dayBranch})` : "",
    ].join("");
    lines.push(`พ.ศ. ${y + 543} (${ageTxt(y)}ค.ศ. ${y}) ${it.stem}${it.branch} ${it.role} → ${it.qi}${flags}`);
  }
  out.push({ group: "annual_year", itemKey: "yearly", label: "พยากรณ์รายปี (ข้อมูล 10 ปีข้างหน้า)", text: lines.join("\n") });
  // 3) ปีชง/ให้ร้ายกับหลักวัน 20 ปีข้างหน้า (จังหวะต้องระวังพิเศษ — ถ้อยคำเตือนตามซินแส)
  const cautions: string[] = [];
  for (let y = nowYear; y < nowYear + 20; y++) {
    const { branch } = annualGanzhi(y);
    const clash = pairIn(CLASH_PAIRS, branch, dayBranch);
    const harm = pairIn(HARM_PAIRS, branch, dayBranch);
    if (!clash && !harm) continue;
    const kind = clash ? "ชง (冲)" : "ให้ร้าย (害)";
    cautions.push(`ปี พ.ศ. ${y + 543} (${ageTxt(y)}ค.ศ. ${y}) เป็นจังหวะ ${kind} กับหลักวัน (${branch}-${dayBranch})`);
  }
  if (cautions.length) {
    out.push({
      group: "annual_year",
      itemKey: "caution",
      label: "ปีที่ควรระมัดระวังเป็นพิเศษ (ชง/ให้ร้าย กับหลักวัน)",
      text: `${cautions.join("\n")}\nควรระวังการเงิน การตัดสินใจเสี่ยง และความขัดแย้งเป็นพิเศษ`,
    });
  }
  return out;
}

/**
 * บท 15 · ทำบุญเสริมดวง — ธาตุดิถี × กำลัง → ธาตุที่ควรทำบุญ → คำทำบุญรายธาตุ (group merit_by_element)
 * คืน 1 ก้อนต่อธาตุที่แนะนำ (1-2 ธาตุ)
 */
export function matchMerit(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const out: NewdataBlock[] = [];
  // ใช้ useful-god ชุดเดียวกับบทอาชีพ/บท14/15 (favorableElements) เพื่อให้สอดคล้องกัน
  for (const el of favorableElements(facts)) {
    const value = map[group]?.[el];
    if (value) out.push(toBlock(group, el, value, `เสริมธาตุ${el}`));
  }
  return out;
}

/**
 * บท 7 · ลักษณะชีวิตคู่ตามพื้นดวง — ปฏิกิริยาธาตุ ราศีบนหลักวัน(ดิถี) เทียบ ราศีล่างหลักวัน
 * → lookup คีย์ปฏิกิริยา (same/output/resource/wealth/power) ในกลุ่ม love_base
 */
export function matchLoveBase(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  const dayPillar = facts.pillars.find((p) => p.position === "day");
  if (!dayEl || !dayPillar) return [];
  const branchEl = BRANCH_TO_ELEMENT[dayPillar.branch as keyof typeof BRANCH_TO_ELEMENT];
  if (!branchEl) return [];
  const rel = elementRelationKey(dayEl, branchEl);
  const value = map[group]?.[rel];
  if (!value) return [];
  return [toBlock(group, rel, value, "ราศีบน↔ราศีล่างหลักวัน")];
}

/**
 * บท 7 · ลักษณะคู่ครอง — ชาย: ธาตุโชคลาภ(財) · หญิง: ธาตุพิฆาตดิถี(官杀) นั่งเสาไหน
 * → อ่านเชี่ยงแซของเสานั้น (กลุ่ม group เช่น shengxiang) = ลักษณะคู่ครอง
 */
export function matchSpouseStar(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  if (!facts.gender) return [];
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayEl) return [];
  const spouseEl =
    facts.gender === "female"
      ? (Object.keys(CONTROLS) as Array<keyof typeof CONTROLS>).find((x) => CONTROLS[x] === dayEl) // 官杀
      : CONTROLS[dayEl as keyof typeof CONTROLS]; // 財
  if (!spouseEl) return [];
  const roleTh = facts.gender === "female" ? "ธาตุพิฆาตดิถี (คู่ครอง)" : "ธาตุโชคลาภ (คู่ครอง)";
  for (const p of facts.pillars) {
    const onStem = STEM_TO_ELEMENT[p.stem as keyof typeof STEM_TO_ELEMENT] === spouseEl;
    const onBranch = BRANCH_TO_ELEMENT[p.branch as keyof typeof BRANCH_TO_ELEMENT] === spouseEl;
    if (!onStem && !onBranch) continue;
    if (!p.state) continue;
    const value = map[group]?.[p.state];
    if (!value) continue;
    return [toBlock(group, p.state, value, `${roleTh} เสา${p.position} · เชี่ยงแซ${p.state}`)];
  }
  return [];
}

/**
 * บท 7 · โอกาสมีคู่ — เพศ × กำลังดิถี → lookup คีย์ "{male|female}|{band}" ในกลุ่ม love_chance
 */
export function matchLoveChance(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  if (!facts.gender) return [];
  const g = facts.gender === "female" ? "female" : "male";
  const band = classifyOperatorStrengthScore(facts.strengthScore).id;
  const key = `${g}|${band}`;
  const value = map[group]?.[key];
  if (!value) return [];
  return [toBlock(group, key, value, g === "female" ? "เพศหญิง" : "เพศชาย")];
}

/**
 * สถานะ 12 เชี่ยงแซ ของเสาที่ระบุ → lookup ในกลุ่ม state (shengxiang/edu_level/study_style)
 * tier "lower" = ราศีล่าง (ค่าเริ่มต้น) · "upper" = ราศีบน (ก้านเสา) — ใช้บท 6 พ่อ = ราศีบนหลักเดือน
 */
export function matchPillarState(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  position: PillarPosition,
  tier: "upper" | "lower" = "lower",
): NewdataBlock | null {
  const pillar = facts.pillars.find((p) => p.position === position);
  const state = tier === "upper" ? pillar?.upperState : pillar?.state;
  if (!state) return null;
  const value = map[group]?.[state];
  if (!value) return null;
  const ctx = tier === "upper" ? `ราศีบนเสา${position}` : `เสา${position}`;
  const tierTxt = tier === "upper" ? " ราศีบน" : "";
  const label = `${THAI_PILLAR_NAME[position]}${tierTxt} ${pillarGanzhi(facts, position)} (${state})`;
  return toBlock(group, state, value, ctx, label);
}

/** ธาตุอังกฤษ → ไทย (สำหรับคีย์กลุ่มที่ใช้ธาตุไทย เช่น health_by_element) */
const EN_TO_TH_ELEMENT: Record<string, ElementTh> = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
};

/**
 * ธาตุที่ดวงต้องการ (useful god / palette) — บท14 (สี/อัญมณี/รถ ฯลฯ) · บท15 (องค์เทพ/ทำบุญ)
 * palette กว้างตามกำลังดิถี (5 band, ปรับ 得令) ให้ใกล้ที่ซินแสลิสต์จริง:
 *   อ่อน/อ่อนมาก → 印(ส่งเสริม) + 比(คู่ธาตุ)            [เสริมกำลัง]
 *   แข็ง/แข็งมาก → 食傷(ถ่ายเท) + 財(ลาภ)                [ระบายกำลัง]
 *   สมดุล        → 印 + 比 + 食傷 + 財 (ทุกธาตุมิตร ยกเว้น 官杀 ที่พิฆาตดิถี)
 * NB: บท2 career ใช้ doElementsTh (ดิถี×กำลัง×ธาตุเดือน) ตรงในตัว ไม่ผ่านฟังก์ชันนี้
 */
export function favorableElements(facts: ChartFacts): ElementTh[] {
  const dayElEn = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayElEn) return [];
  const th = (en?: string): ElementTh | null => (en ? EN_TO_TH_ELEMENT[en] ?? null : null);
  const self = th(dayElEn); // 比
  const resource = th((Object.keys(GENERATES) as Array<keyof typeof GENERATES>).find((x) => GENERATES[x] === dayElEn)); // 印
  const output = th(GENERATES[dayElEn as keyof typeof GENERATES]); // 食傷
  const wealth = th(CONTROLS[dayElEn as keyof typeof CONTROLS]); // 財
  // 官杀 (ธาตุที่พิฆาตดิถี) = ตัดออกเสมอ
  const id = seasonalStrengthId(facts);
  let picked: Array<ElementTh | null>;
  if (id === "very-weak" || id === "weak") picked = [resource, self];
  else if (id === "very-strong" || id === "strong") picked = [output, wealth];
  else picked = [resource, self, output, wealth]; // สมดุล = มิตรครบ
  const out = [...new Set(picked.filter((e): e is ElementTh => Boolean(e)))];
  // fallback (ดิถีพิเศษ/ตารางว่าง): merit band เดิม
  const dayTh = elementThOfStem(facts.dayMaster);
  return out.length ? out : dayTh ? meritFavorElements(dayTh, meritBandFromScore(facts.strengthScore)) : [];
}

const ALL_ELEMENTS_TH: ElementTh[] = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];

/**
 * ธาตุที่ควรเลี่ยง (忌神) = 5 ธาตุ − ธาตุเสริมดวง (用神)
 * นำด้วยธาตุพิฆาตดิถี (官杀 = ธาตุที่ CONTROLS ดิถี) ก่อน — ตรงกับที่ PDF ซินแสเน้น "ธาตุที่พิฆาตกดดันดิถี"
 */
export function avoidFavorableElements(facts: ChartFacts): ElementTh[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayEl) return [];
  const fav = new Set(favorableElements(facts));
  const avoid = ALL_ELEMENTS_TH.filter((e) => !fav.has(e));
  const powerEn = (Object.keys(CONTROLS) as Array<keyof typeof CONTROLS>).find(
    (x) => CONTROLS[x] === dayEl,
  ); // 官杀 = ธาตุที่พิฆาตดิถี
  const powerTh = powerEn ? EN_TO_TH_ELEMENT[powerEn] : null;
  if (powerTh && avoid.includes(powerTh)) {
    return [powerTh, ...avoid.filter((e) => e !== powerTh)];
  }
  return avoid;
}

/**
 * แกน用神/忌神 ชุดเดียว (canonical) — ใช้ทุกบทให้ "ธาตุเสริมดวง/ธาตุที่ควรเลี่ยง" ตรงกันเสมอ
 * เนื้อเป็น pre-fill generic (favorable-element-reading) → กล่องนี้ถูก mark templatePrefill ให้ AI เกลาใหม่
 */
export function matchFavorableSummary(facts: ChartFacts): NewdataBlock[] {
  const fav = favorableElements(facts);
  const avoid = avoidFavorableElements(facts);
  if (!fav.length && !avoid.length) return [];
  return [
    {
      group: "favorable_element",
      itemKey: "summary",
      text: buildFavorableSummaryText(fav, avoid),
    },
  ];
}

/**
 * บท 14 · สัตว์มงคล — lookup ตาม "ดิถี" (ก้านวัน) ไม่ใช่รายธาตุ
 * (แหล่งจริง Source7 §4 ให้สัตว์มงคลรายดิถี — auspicious_by_element รายธาตุ map ไม่ได้)
 */
export function matchLuckyAnimal(facts: ChartFacts): NewdataBlock[] {
  const text = LUCKY_ANIMAL_BY_DAY_MASTER[facts.dayMaster];
  if (!text) return [];
  return [{ group: "lucky_animal", itemKey: facts.dayMaster, label: "สัตว์มงคล", text }];
}

/**
 * บท 6 · เชี่ยงแซ "โทนครอบครัว" — อ่านสถานะเสาเป็นลักษณะความสัมพันธ์/การฟูมฟัก (ไม่ใช่โรคภัยตาม
 * นิยามวัฏจักรของ shengxiang กลาง) — ตรงกรอบที่ซินแสใช้ในบทครอบครัว (GT 3 ดวง)
 */
export function matchFamilyState(
  facts: ChartFacts,
  position: PillarPosition,
  tier: "upper" | "lower" = "lower",
): NewdataBlock[] {
  const pillar = facts.pillars.find((p) => p.position === position);
  const state = tier === "upper" ? pillar?.upperState : pillar?.state;
  if (!state) return [];
  const text = FAMILY_STATE_READING[state];
  if (!text) return [];
  const tierTxt = tier === "upper" ? " ราศีบน" : "";
  const label = `${THAI_PILLAR_NAME[position]}${tierTxt} ${pillarGanzhi(facts, position)} (${state})`;
  return [{ group: "family_state", itemKey: state, label, text, context: `เสา${position}` }];
}

/**
 * ข้อเสนอแนะรายธาตุ (บท 3 การเงิน / บท 13 สุขภาพ / บท 5 พรสวรรค์) — iterate ตามธาตุปรับดวง (用神)
 * เนื้อ pre-fill generic (element-advice) แบบเดียวกับ develop_by_element (บท 1/6/7)
 */
export function matchElementAdvice(facts: ChartFacts, table: ElementAdviceTable): NewdataBlock[] {
  const tbl = ELEMENT_ADVICE_TABLES[table];
  const out: NewdataBlock[] = [];
  for (const el of favorableElements(facts)) {
    const text = tbl[el];
    if (text) out.push({ group: `${table}_advice`, itemKey: el, label: `ธาตุ${el}`, text });
  }
  return out;
}

/**
 * บท 4 · อุปถัมภ์ (ข้อ 3-4) — หาเสาที่ "ธาตุตามบทบาท" นั่งอยู่ แล้วอ่านเชี่ยงแซของเสานั้น (reuse shengxiang)
 *   role "output"   → ธาตุถ่ายเท (บริวาร 食傷 = ธาตุที่ดิถีก่อเกิด)
 *   role "wealth"   → ธาตุโชคลาภ (ลูกค้า 財 = ธาตุที่ดิถีพิฆาต)
 *   role "resource" → ธาตุส่งเสริม (ผู้อุปถัมภ์ 印 = ธาตุที่ก่อเกิดดิถี)
 * โทนบวก/ลบ = เชี่ยงแซดี/เสียของเสาที่ธาตุนั้นนั่ง (ตรงหลักซินแส ไม่ผูกเสาตายตัว)
 * คืนหลายก้อน (ดีดุปตามเชี่ยงแซ) — ปลายทางว่างถ้า DB ยังไม่มี
 */
export function matchElementRoleState(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  role: "output" | "wealth" | "resource",
): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayEl) return [];
  // 印 = ธาตุที่ "ก่อเกิด" ดิถี → reverse ของ GENERATES
  const resourceEl = (Object.keys(GENERATES) as Array<keyof typeof GENERATES>).find(
    (x) => GENERATES[x] === dayEl,
  );
  const targetEl =
    role === "output"
      ? GENERATES[dayEl as keyof typeof GENERATES]
      : role === "wealth"
        ? CONTROLS[dayEl as keyof typeof CONTROLS]
        : resourceEl;
  if (!targetEl) return [];
  const roleTh =
    role === "output"
      ? "ธาตุถ่ายเท (บริวาร)"
      : role === "wealth"
        ? "ธาตุโชคลาภ (ลูกค้า)"
        : "ธาตุส่งเสริม (ผู้อุปถัมภ์)";
  // อ้าง "ถ่ายเททุกรูปแบบ" + จัดลำดับกลไก: หาเสาที่ธาตุเป้าหมายปรากฏ (แท้→ภาคี→เชี่ยงแซ) + จิตใต้สำนึก
  // อ่านเชี่ยงแซ (12 เชี่ยงแซ) ของเสานั้นจาก shengxiang (ดีดุปตามเชี่ยงแซ คงพฤติกรรมเดิมของกลไก 1)
  const res = findElementByMechanism(facts, targetEl);
  const readPillar = (hit: MechanismHit, mech: 1 | 2 | 3 | 4): NewdataBlock | null => {
    const p = facts.pillars.find((x) => x.position === hit.position);
    if (!p?.state) return null;
    const value = map[group]?.[p.state];
    if (!value) return null;
    const mechSuffix = mech === 1 ? "" : ` (${MECH_LABEL[mech]})`;
    const label = `${roleTh} ${pillarLabel(facts, p.position, p.state)}${mechSuffix}`;
    return toBlock(group, p.state, value, `${roleTh} เสา${p.position} · เชี่ยงแซ${p.state}${mechSuffix}`, label);
  };
  // ดีดุปตามเชี่ยงแซ (state) ข้ามทุกกลไก — กันคำอ่านเชี่ยงแซซ้ำ
  const seenState = new Set<string>();
  const dedupByState = (blocks: NewdataBlock[]) =>
    blocks.filter((b) => (seenState.has(b.itemKey) ? false : (seenState.add(b.itemKey), true)));
  // ใช้แค่ tier1(ธาตุแท้)+tier2(ภาคี) — ข้าม tier3(residual) เพราะ lookup ด้วยเชี่ยงแซเสา
  // ไม่มีคีย์กรอง (จะ match ทุกเสามั่ว) · tier เชี่ยงแซจริงต้องใช้กฎ 12-qi (รอซินแสยืนยัน)
  let primary: NewdataBlock[] = [];
  for (let i = 0; i < 2; i++) {
    const blocks = dedupByState(
      res.tiers[i].map((h) => readPillar(h, (i + 1) as 1 | 2 | 3)).filter((b): b is NewdataBlock => b !== null),
    );
    if (blocks.length > 0) {
      primary = blocks;
      break;
    }
  }
  const sub = dedupByState(
    res.subconscious.map((h) => readPillar(h, 4)).filter((b): b is NewdataBlock => b !== null),
  );
  // ประโยคนำ — template จาก DB (benefactor_lead) ให้ซินแสเปลี่ยนคำ, fallback computed ถ้ายังไม่กรอก
  // template ใช้ {ดิถี} {ธาตุ} แทนชื่อธาตุดิถี/ธาตุเป้าหมาย
  const dmTh = EN_TO_TH_ELEMENT[dayEl] ?? dayEl;
  const targetTh = EN_TO_TH_ELEMENT[targetEl] ?? targetEl;
  const tmpl = map["benefactor_lead"]?.[role]?.text?.trim();
  const leadText = (tmpl || `ดิถีธาตุ{ดิถี} มีธาตุ{ธาตุ} เป็น${roleTh} — อ่านตามเชี่ยงแซดีของเสาที่ธาตุ{ธาตุ}ปรากฏ`)
    .replace(/\{ดิถี\}/g, dmTh)
    .replace(/\{ธาตุ\}/g, targetTh);
  const lead: NewdataBlock = { group, itemKey: "__lead__", text: leadText };
  return [lead, ...primary, ...sub];
}

/**
 * บท 4 · ลูกค้า/บริวาร 60 กะจื่อ — หาเสาที่ธาตุตามบทบาทนั่ง (กลไก priority) แล้วอ่าน "กะจื่อ" ของเสานั้น
 * (ละเอียดกว่า 12 เชี่ยงแซ) · ใช้คู่ matchElementRoleState (เพิ่มต่อ ไม่แทน) · role=wealth → ลูกค้า 60 แบบ
 */
export function matchElementRoleGanzhi(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  role: "output" | "wealth" | "resource" | "peer",
): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayEl) return [];
  const resourceEl = (Object.keys(GENERATES) as Array<keyof typeof GENERATES>).find(
    (x) => GENERATES[x] === dayEl,
  );
  const targetEl =
    role === "output"
      ? GENERATES[dayEl as keyof typeof GENERATES]
      : role === "wealth"
        ? CONTROLS[dayEl as keyof typeof CONTROLS]
        : role === "peer"
          ? dayEl // หุ้นส่วน (比) = ธาตุเดียวกับดิถี
          : resourceEl;
  if (!targetEl) return [];
  const roleTh =
    role === "output"
      ? "บริวาร"
      : role === "wealth"
        ? "ลูกค้า"
        : role === "peer"
          ? "หุ้นส่วน"
          : "ผู้อุปถัมป์";
  const res = findElementByMechanism(facts, targetEl);
  const seen = new Set<string>();
  const readGz = (hit: MechanismHit, mech: 1 | 2 | 3 | 4): NewdataBlock | null => {
    const p = facts.pillars.find((x) => x.position === hit.position);
    if (!p) return null;
    const gz = `${p.stem}${p.branch}`;
    if (seen.has(gz)) return null;
    const value = map[group]?.[gz];
    if (!value) return null;
    seen.add(gz);
    const suffix = mech === 1 ? "" : ` (${MECH_LABEL[mech]})`;
    return toBlock(group, gz, value, `${roleTh} เสา${p.position} ${gz}${suffix}`, `${roleTh} ${pillarLabel(facts, p.position)}${suffix}`);
  };
  let primary: NewdataBlock[] = [];
  for (let i = 0; i < 2; i++) {
    const blocks = res.tiers[i].map((h) => readGz(h, (i + 1) as 1 | 2 | 3)).filter((b): b is NewdataBlock => b !== null);
    if (blocks.length > 0) {
      primary = blocks;
      break;
    }
  }
  const sub = res.subconscious.map((h) => readGz(h, 4)).filter((b): b is NewdataBlock => b !== null);
  return [...primary, ...sub];
}

/**
 * บท 13 · สุขภาพ (ข้อ 2) — โรคจากธาตุที่มากเกินไป / น้อยเกินไป ในพื้นดวง
 * นับธาตุจากราศีบน+ล่าง 4 เสา → ธาตุมากสุด (มากเกินไป) และ น้อยสุด (น้อยเกินไป) → lookup คีย์ธาตุไทย
 */
export function matchHealthElement(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const order: ElementTh[] = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];
  const count: Record<ElementTh, number> = { ไม้: 0, ไฟ: 0, ดิน: 0, ทอง: 0, น้ำ: 0 };
  for (const p of facts.pillars) {
    const se = elementThOfStem(p.stem);
    if (se) count[se] += 1;
    const beEn = BRANCH_TO_ELEMENT[p.branch as keyof typeof BRANCH_TO_ELEMENT];
    const be = beEn ? EN_TO_TH_ELEMENT[beEn] : undefined;
    if (be) count[be] += 1;
  }
  const maxEl = order.reduce((a, b) => (count[b] > count[a] ? b : a));
  const minEl = order.reduce((a, b) => (count[b] < count[a] ? b : a));
  const out: NewdataBlock[] = [];
  // คีย์แยก "มาก"/"น้อย" ต่อธาตุ (เนื้อคนละชุด) — คีย์ "{ธาตุ}|มาก" / "{ธาตุ}|น้อย"
  const push = (el: ElementTh, band: "มาก" | "น้อย", tier: string) => {
    const key = `${el}|${band}`;
    const value = map[group]?.[key];
    if (!value?.text?.trim()) return; // ช่องว่าง (ยังไม่กรอก) = ไม่ขึ้น
    out.push(toBlock(group, key, value, `ธาตุ${el} ${tier} (${count[el]} ตำแหน่ง)`));
  };
  push(maxEl, "มาก", "มากเกินไป");
  if (minEl !== maxEl) push(minEl, "น้อย", "น้อยเกินไป");
  return out;
}

/** ป้ายเสาแบบสั้น (ใช้ประกอบคีย์ health_zoah: "…@ปี") */
const SHORT_PILLAR_NAME: Record<PillarPosition, string> = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "ยาม",
};

/**
 * บท 13 · สุขภาพเจ๊าะ — คำทำนายสุขภาพราย "กะจื่อประจำเสา" และ "ดิถีถ่ายเท" ตามตำแหน่งเสา
 * ดึงเฉพาะคีย์ที่ซินแสกรอกเนื้อแล้ว (ช่องว่างไม่ขึ้น) — 2 รูปแบบคีย์:
 *   "{กะจื่อ}@{เสา}"          เช่น "甲申@ปี"  → เสานั้นเป็นกะจื่อนี้ตรง ๆ (ก้าน+กิ่งครบ)
 *   "{ดิถี}→{ปลายทาง}@{เสา}"  เช่น "甲→申@ปี" → ก้านดิถีถ่ายเทไปยังราศีบน/ล่างของเสานั้น
 */
export function matchHealthZoah(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const day = facts.dayMaster;
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  const emit = (key: string, context: string) => {
    if (seen.has(key)) return;
    const value = map[group]?.[key];
    if (!value?.text?.trim()) return;
    seen.add(key);
    out.push(toBlock(group, key, value, context));
  };
  for (const p of facts.pillars) {
    const pos = SHORT_PILLAR_NAME[p.position];
    const label = THAI_PILLAR_NAME[p.position];
    // กะจื่อประจำเสา (甲申@ปี …)
    emit(`${p.stem}${p.branch}@${pos}`, `${label} ${p.stem}${p.branch}`);
    // ดิถีถ่ายเทไปยังราศีบน/ล่างของเสานี้ (甲→申@ปี …)
    for (const [ch, kind] of [
      [p.stem, "ราศีบน"],
      [p.branch, "ราศีล่าง"],
    ] as const) {
      emit(`${day}→${ch}@${pos}`, `${label} ${kind} · ดิถี ${day}→${ch}`);
    }
  }
  return out;
}

/**
 * บท 8 · มิตรแท้ (เฉลยจาก 8.มิตรแท้-เฉลย.docx) — ดิถีถ่ายเทหาก้าน/กิ่ง "ธาตุเดียวกับดิถี" ตามเสา
 * เงื่อนไขตำรา: นับอักษรธาตุเดียวกับดิถีทั้งดวง (ก้าน+กิ่ง 8 ตัว รวมดิถี)
 *   ≤ 2 ตัว → มิตรแท้ · อ่านรายตำแหน่ง คีย์ "{ดิถี}→{ปลายทาง}@{เสา}" (รูปเดียวกับ healthZoah)
 *   ≥ 3 ตัว → มิตรแย่งผลประโยชน์ · อ่านก้อนเดียว คีย์ "{ดิถี}|มิตรแย่ง"
 * คีย์ที่ธาตุไม่ตรงดิถีจะไม่มี row ใน DB จึงไม่ขึ้นเอง (เช่น 甲→丙)
 */
export function matchFriendTrue(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const day = facts.dayMaster;
  const el = elementThOfStem(day);
  if (!el) return [];
  let count = 0;
  for (const p of facts.pillars) {
    if (elementThOfStem(p.stem) === el) count += 1;
    if (elementThOfBranch(p.branch) === el) count += 1;
  }
  if (count >= 3) {
    const key = `${day}|มิตรแย่ง`;
    const value = map[group]?.[key];
    if (!value?.text?.trim()) return [];
    return [toBlock(group, key, value, `ธาตุ${el}ในดวง ${count} ตัว (รวมดิถี) — เข้าเงื่อนไขมิตรแย่งผลประโยชน์`)];
  }
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  for (const p of facts.pillars) {
    const pos = SHORT_PILLAR_NAME[p.position];
    const label = THAI_PILLAR_NAME[p.position];
    for (const [ch, kind] of [
      [p.stem, "ราศีบน"],
      [p.branch, "ราศีล่าง"],
    ] as const) {
      const key = `${day}→${ch}@${pos}`;
      if (seen.has(key)) continue;
      const value = map[group]?.[key];
      if (!value?.text?.trim()) continue;
      seen.add(key);
      out.push(toBlock(group, key, value, `${label} ${kind} · ดิถี ${day}→${ch}`));
    }
  }
  return out;
}

/**
 * บท 1 · นิสัยด้านมืดตามธาตุ — lookup ตามธาตุของดิถี (ราศีบนหลักวัน) คีย์ = ธาตุไทย
 * คืน 1 ก้อน (ปลายทางว่างถ้า DB ยังไม่มี)
 */
export function matchDayElement(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  opts?: { onlyExtremeStrength?: boolean },
): NewdataBlock[] {
  // ด้านมืด: ซินแสกำหนดว่าเฉพาะดิถี "อ่อนเกินไป/แข็งเกินไป" เท่านั้นถึงมีด้านมืด
  if (opts?.onlyExtremeStrength) {
    const id = seasonalStrengthId(facts);
    if (id !== "very-weak" && id !== "very-strong") return [];
  }
  const el = elementThOfStem(facts.dayMaster);
  if (!el) return [];
  const value = map[group]?.[el];
  return value ? [toBlock(group, el, value, `ธาตุ${el} (ดิถี)`)] : [];
}

/** คีย์กลางของกลุ่ม keyKind "fixed" — เนื้อหาเดียวใช้กับทุกดวง */
export const FIXED_KEY = "ทุกคน";

/**
 * กลุ่มเนื้อหา fix (เหมือนกันทุกดวง) — บทนำบท 14 / ข้อเสนอแนะบท 13 / ความรู้แชท AI
 * lookup คีย์เดียว "ทุกคน" ไม่ขึ้นกับ ChartFacts
 */
export function matchFixed(map: NewdataMap, group: string): NewdataBlock[] {
  const value = map[group]?.[FIXED_KEY];
  return value ? [toBlock(group, FIXED_KEY, value)] : [];
}

/**
 * บท 3 · โชคลาภ (กลุ่มใหม่ keyKind=stemTransfer "{ก้านอ้างอิง}|{ปลายทาง}") — ทุกรูปแบบ+จัดลำดับกลไก
 *   "dithi"    → โชคลาภดิถี = หาธาตุที่ดิถีพิฆาต (財 = CONTROLS[ดิถี]) · อ้างอิง=ก้านดิถี
 *   "business" → โชคลาภธุรกิจ = ลาภของลาภ (財 ของ 財 = CONTROLS²[ดิถี]) · อ้างอิง=ก้านดิถี
 *   "month"    → โชคลาภหลักเดือน = 財 ของก้านเดือน · อ้างอิง=ก้านเดือน (⚠️ สูตรรอซินแสยืนยัน)
 * lookup คีย์ "{ก้านอ้างอิง}|{ปลายทาง}" (ซินแสกรอกครบทุกคีย์ในแอดมิน)
 */
export function matchFortune(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  role: "dithi" | "business" | "month",
): NewdataBlock[] {
  const dayEl = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayEl) return [];
  let refStem = facts.dayMaster;
  let targetEn: string | undefined;
  if (role === "dithi") {
    targetEn = CONTROLS[dayEl as keyof typeof CONTROLS];
  } else if (role === "business") {
    const wealth = CONTROLS[dayEl as keyof typeof CONTROLS];
    targetEn = wealth ? CONTROLS[wealth as keyof typeof CONTROLS] : undefined;
  } else {
    const month = facts.pillars.find((p) => p.position === "month");
    if (!month) return [];
    refStem = month.stem;
    const monthEl = STEM_TO_ELEMENT[month.stem as keyof typeof STEM_TO_ELEMENT];
    targetEn = monthEl ? CONTROLS[monthEl as keyof typeof CONTROLS] : undefined;
  }
  if (!targetEn) return [];
  return lookupTransferByMechanism(map, group, refStem, targetEn, facts);
}

/** เชี่ยงแซ "ดี" (ใช้ได้) ตามตำราองค์เทพ — กวงตั่ว/ลิ่มกัว/ตี้อ๋วง/หมอ/ทอ/เอี้ยง/เชี่ยงแซ */
const GOOD_STATES = new Set(["เชี่ยงแซ", "กวงตั่ว", "ลิ่มกัว", "ตี้อ๋วง", "หมอ", "ทอ", "เอี้ยง"]);
/** ธาตุไทย → ราศีบนหยาง (ตัวแทนเมื่อธาตุนั้นไม่อยู่ในดวง) */
const ELEMENT_TH_TO_YANG_STEM: Record<ElementTh, string> = {
  ไม้: "甲", ไฟ: "丙", ดิน: "戊", ทอง: "庚", น้ำ: "壬",
};
/** องค์มุม 4 ทิศ (fallback เมื่อไม่มีราศีถือธาตุที่ต้องใช้แบบเชี่ยงแซดี) */
const DEITY_CORNER_RULES: Array<{ rasi: string; els: ElementTh[] }> = [
  { rasi: "乾", els: ["ทอง", "น้ำ"] },
  { rasi: "坤", els: ["ดิน", "ทอง"] },
  { rasi: "巽", els: ["ไม้", "ไฟ"] },
  { rasi: "艮", els: ["ไม้", "ดิน"] },
];
function elementThOfBranch(branch: string): ElementTh | undefined {
  const en = BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];
  return en ? EN_TO_TH_ELEMENT[en] : undefined;
}

/**
 * บท 15 · องค์เทพราย "ราศี" (group deity_by_rasi, คีย์ = อักษรราศี 甲..癸/亥..戌/乾坤巽艮)
 * เลือกธาตุเป้าหมายตามบทบาท → หา "ราศี" ที่ถือธาตุนั้นในดวง + เชี่ยงแซดี → องค์เทพของราศีนั้น
 *   role "protect" = ธาตุที่ดวงต้องการ (คุ้มครองดวง) · fallback องค์มุม 4 ทิศ
 *   role "career"  = ธาตุถ่ายเท (เจรจา/ทำงาน/ลงทุน/เดินทาง)
 *   role "wealth"  = ธาตุโชคลาภ (โชคลาภ/เงินเก็บ)
 * career/wealth: ถ้าไม่มีราศีเชี่ยงแซดี → ใช้ราศีที่ถือธาตุ(ทุกเชี่ยงแซ) → ราศีตัวแทนหยาง
 */
export function matchDeityByRasi(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  role: "protect" | "career" | "wealth",
): NewdataBlock[] {
  const dayElEn = STEM_TO_ELEMENT[facts.dayMaster as keyof typeof STEM_TO_ELEMENT];
  if (!dayElEn) return [];
  let targets: ElementTh[];
  let purpose: string;
  if (role === "protect") {
    targets = favorableElements(facts);
    purpose = "องค์เทพคุ้มครองดวง";
  } else if (role === "career") {
    const en = GENERATES[dayElEn as keyof typeof GENERATES];
    targets = en ? [EN_TO_TH_ELEMENT[en]] : [];
    purpose = "ขอพรการงาน/เจรจา/ลงทุน/เดินทาง (ธาตุถ่ายเท)";
  } else {
    const en = CONTROLS[dayElEn as keyof typeof CONTROLS];
    targets = en ? [EN_TO_TH_ELEMENT[en]] : [];
    purpose = "ขอพรโชคลาภ/เงินเก็บ (ธาตุโชคลาภ)";
  }
  if (!targets.length) return [];
  const tset = new Set(targets);
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  const add = (rasi: string, ctx: string) => {
    if (seen.has(rasi)) return;
    const value = map[group]?.[rasi];
    if (!value) return;
    seen.add(rasi);
    out.push(toBlock(group, rasi, value, ctx));
  };
  // 1) ราศีในดวงที่ถือธาตุเป้าหมาย + เชี่ยงแซดี
  for (const p of facts.pillars) {
    const se = elementThOfStem(p.stem);
    if (se && tset.has(se) && p.upperState && GOOD_STATES.has(p.upperState)) {
      add(p.stem, `${purpose} · ราศีบนเสา${p.position} ${p.stem} (เชี่ยงแซ${p.upperState})`);
    }
    const be = elementThOfBranch(p.branch);
    if (be && tset.has(be) && p.state && GOOD_STATES.has(p.state)) {
      add(p.branch, `${purpose} · ราศีล่างเสา${p.position} ${p.branch} (เชี่ยงแซ${p.state})`);
    }
  }
  if (out.length) return out;
  // 2) career/wealth: ราศีที่ถือธาตุ (ทุกเชี่ยงแซ) → ราศีตัวแทนหยาง
  if (role !== "protect") {
    for (const p of facts.pillars) {
      const se = elementThOfStem(p.stem);
      if (se && tset.has(se)) add(p.stem, `${purpose} · ราศีบนเสา${p.position} ${p.stem}`);
      const be = elementThOfBranch(p.branch);
      if (be && tset.has(be)) add(p.branch, `${purpose} · ราศีล่างเสา${p.position} ${p.branch}`);
    }
    if (out.length) return out;
    for (const el of targets) {
      const r = ELEMENT_TH_TO_YANG_STEM[el];
      if (r) add(r, `${purpose} · ธาตุ${el} (ราศีตัวแทน ${r})`);
    }
    return out;
  }
  // 3) protect fallback: องค์มุม ตามคู่ธาตุที่ต้องใช้
  let best = DEITY_CORNER_RULES[0];
  let bestScore = -1;
  for (const rule of DEITY_CORNER_RULES) {
    const score = rule.els.filter((e) => tset.has(e)).length;
    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }
  if (bestScore > 0) add(best.rasi, `${purpose} · องค์มุม ${best.rasi} (ธาตุ${targets.join("/")})`);
  return out;
}

/**
 * บท 14/15 · ตามธาตุที่ดวงต้องการ × หมวด — lookup คีย์ "{หมวด}|{ธาตุ}"
 *   บท 14: หมวด = สี/เสื้อผ้า/เครื่องประดับ/กระเป๋าเงิน/รถ/สัตว์มงคล/ทิศ (group auspicious_by_element)
 *   บท 15: หมวด = คุ้มครอง/การงาน/โชคลาภ (group deity_by_element)
 * คืน 1 ก้อนต่อธาตุที่ดวงต้องการ (1-2 ธาตุ) — ปลายทางว่างถ้า DB ยังไม่มี (รอซินแสเติม)
 */
export function matchElementCategory(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  category: string,
): NewdataBlock[] {
  const out: NewdataBlock[] = [];
  for (const el of favorableElements(facts)) {
    const key = `${category}|${el}`;
    const value = map[group]?.[key];
    if (value) out.push(toBlock(group, key, value, `ธาตุ${el}`));
  }
  return out;
}

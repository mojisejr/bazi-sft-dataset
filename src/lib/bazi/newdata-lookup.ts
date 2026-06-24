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
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_TO_ELEMENT,
  CONTROLS,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

/** ปฏิกิริยาธาตุของ self เทียบ other (มุมดิถี): same/output(ถ่ายเท)/resource(ก่อเกิด)/wealth(ลาภ)/power(พิฆาต) */
function elementRelationKey(self: string, other: string): string {
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

export function extractChartFacts(state: CalculatedStateValue, gender?: string): ChartFacts {
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
  if (!value) return [];
  return [toBlock(group, key, value, `เสา${position}`, pillarLabel(facts, position))];
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

/**
 * บท 14 (turning_points) · วัยจรช่วงละ 5 ปี — แตก upperPhase(ก้าน)+lowerPhase(กิ่ง) ของทุกวัยจร
 * แต่ละช่วง: label = "อายุ X-Y ปี[ ช่วงปัจจุบัน] (สัญลักษณ์ บทบาทธาตุ → เชี่ยงแซ)" · body = ความหมาย 12 เชี่ยงแซ
 * (provisional — ซินแสเขียนคำทำนายจริง + ใส่เกรดทับ) แทน dump เดิมที่ใช้กิ่งช่วง 10 ปีอย่างเดียว
 */
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
      const label = `อายุ ${ph.startAge}-${ph.endAge} ปี${current} (${ph.symbol}${roleTxt} ${ph.qi})`;
      out.push({ group: "shengxiang", itemKey: ph.qi, label, text: value.text });
    }
  }
  return out;
}

/**
 * บท 15 · ทำบุญเสริมดวง — ธาตุดิถี × กำลัง → ธาตุที่ควรทำบุญ → คำทำบุญรายธาตุ (group merit_by_element)
 * คืน 1 ก้อนต่อธาตุที่แนะนำ (1-2 ธาตุ)
 */
export function matchMerit(map: NewdataMap, group: string, facts: ChartFacts): NewdataBlock[] {
  const dayElement = elementThOfStem(facts.dayMaster);
  if (!dayElement) return [];
  const band = meritBandFromScore(facts.strengthScore);
  const out: NewdataBlock[] = [];
  for (const el of meritFavorElements(dayElement, band)) {
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

/** ธาตุที่ดวงต้องการ (useful god) — ธาตุดิถี × กำลัง → 1-2 ธาตุ (reuse ตารางทำบุญ) */
export function favorableElements(facts: ChartFacts): ElementTh[] {
  const dayElement = elementThOfStem(facts.dayMaster);
  if (!dayElement) return [];
  return meritFavorElements(dayElement, meritBandFromScore(facts.strengthScore));
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
  const out: NewdataBlock[] = [];
  const seen = new Set<string>();
  for (const p of facts.pillars) {
    const onStem = STEM_TO_ELEMENT[p.stem as keyof typeof STEM_TO_ELEMENT] === targetEl;
    const onBranch = BRANCH_TO_ELEMENT[p.branch as keyof typeof BRANCH_TO_ELEMENT] === targetEl;
    if (!onStem && !onBranch) continue;
    if (!p.state || seen.has(p.state)) continue;
    const value = map[group]?.[p.state];
    if (!value) continue;
    seen.add(p.state);
    const label = `${roleTh} ${pillarLabel(facts, p.position, p.state)}`;
    out.push(toBlock(group, p.state, value, `${roleTh} เสา${p.position} · เชี่ยงแซ${p.state}`, label));
  }
  return out;
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
  const push = (el: ElementTh, tier: string) => {
    const value = map[group]?.[el];
    if (value) out.push(toBlock(group, el, value, `ธาตุ${el} ${tier} (${count[el]} ตำแหน่ง)`));
  };
  push(maxEl, "มากเกินไป");
  if (minEl !== maxEl) push(minEl, "น้อยเกินไป");
  return out;
}

/**
 * บท 14/15 · ตามธาตุที่ดวงต้องการ × หมวด — lookup คีย์ "{หมวด}|{ธาตุ}"
 *   บท 14: หมวด = สี/เสื้อผ้า/เครื่องประดับ/วัตถุมงคล/กระเป๋าเงิน/รถ/สัตว์มงคล/ทิศ (group auspicious_by_element)
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

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
  careerBandFromScore,
  doElementsTh,
  elementThOfStem,
  type ElementTh,
} from "@/lib/bazi/constants/career-finance-table";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import { meritBandFromScore, meritFavorElements } from "@/lib/bazi/constants/merit-table";

export type PillarPosition = "year" | "month" | "day" | "hour";

export type PillarFact = {
  position: PillarPosition;
  /** ราศีบน (天干) ฮั่นจื้อ */
  stem: string;
  /** ราศีล่าง (地支) ฮั่นจื้อ */
  branch: string;
  /** สถานะ 12 เชี่ยงแซ ของราศีล่างเทียบดิถี (ไทย) เช่น "หมกยก" */
  state: string | null;
};

export type LuckFact = {
  startAge: number;
  endAge: number;
  stem: string;
  branch: string;
  isCurrent: boolean;
  upperState: string | null;
  lowerState: string | null;
};

export type ChartFacts = {
  dayMaster: string;
  /** คะแนนกำลังดิถี (engine strengthScore) — ใช้จัด band บทอาชีพ */
  strengthScore: number;
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

export function extractChartFacts(state: CalculatedStateValue): ChartFacts {
  const fp = state.fourPillars;
  const pillars: PillarFact[] = PILLAR_POSITIONS.map((position) => {
    const p = fp[position];
    return {
      position,
      stem: p.stem.normalize("NFC"),
      branch: p.branch.normalize("NFC"),
      state: p.lowerStagePrimary ?? p.lookingStage ?? null,
    };
  });
  const daYun: LuckFact[] = (state.daYun ?? []).map((d) => ({
    startAge: d.startAge,
    endAge: d.endAge,
    stem: d.stem.normalize("NFC"),
    branch: d.branch.normalize("NFC"),
    isCurrent: Boolean(d.isCurrent),
    upperState: d.upperStageDisplay ?? null,
    lowerState: d.lowerStageDisplay ?? null,
  }));
  return {
    dayMaster: state.dayMaster.normalize("NFC"),
    strengthScore: state.strengthScore,
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
function toBlock(group: string, key: string, value: NewdataValue, context?: string): NewdataBlock {
  return { group, itemKey: key, label: value.label, text: value.text, context };
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
): NewdataBlock[] {
  const dayElement = elementThOfStem(facts.dayMaster);
  if (!dayElement) return [];
  const band = careerBandFromScore(facts.strengthScore);
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

  const value = map.career_by_element?.[element];
  if (!value) return [];

  const bandTh = band === "weak" ? "อ่อน" : band === "veryStrong" ? "แข็งเกินไป" : "สมดุล/แข็งแรง";
  const context =
    role === "do"
      ? `ดิถีธาตุ${dayElement} (${bandTh}) · เดือนธาตุ${monthElement} → ธาตุ${element}`
      : `ดิถีธาตุ${dayElement} (${bandTh}) → เลี่ยงธาตุ${element}`;
  return [toBlock("career_by_element", element, value, context)];
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
  const band = STRENGTH_BAND_KEY[classifyOperatorStrengthScore(facts.strengthScore).id];
  if (!band) return [];
  const key = `${facts.dayMaster}|${band.key}`;
  const value = map[group]?.[key];
  if (!value) return [];
  return [toBlock(group, key, value, `ดิถี ${facts.dayMaster} · ${band.label}`)];
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
  return [toBlock(group, pillar.branch, value, `เสา${position}`)];
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
  return [toBlock(group, key, value, `เสา${position}`)];
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

/** สถานะ 12 เชี่ยงแซ ของเสาที่ระบุ → lookup ในกลุ่ม state (shengxiang/edu_level/study_style) */
export function matchPillarState(
  map: NewdataMap,
  group: string,
  facts: ChartFacts,
  position: PillarPosition,
): NewdataBlock | null {
  const pillar = facts.pillars.find((p) => p.position === position);
  if (!pillar?.state) return null;
  const value = map[group]?.[pillar.state];
  if (!value) return null;
  return toBlock(group, pillar.state, value, `เสา${position}`);
}

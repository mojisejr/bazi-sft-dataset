/**
 * Pair-matching engine (คู่สมพงษ์ การงาน + ความรัก).
 *
 * Deterministic lookups over the distilled Excel knowledge
 * (src/lib/bazi/data/pair/*.json). Given the two people's day pillars (หลักวัน)
 * it returns the spreadsheet-exact compatibility grade + 3 ปฏิกิริยาธาตุ
 * components + linked สี่ซิ้ง, the A↔B five-element interaction, and role readings.
 */
import {
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  RELATION_SEMANTIC_MEANING_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";

import matrixJson from "@/lib/bazi/data/pair/pair-matrix.json";
import ratingJson from "@/lib/bazi/data/pair/rating-scale.json";
import sisingJson from "@/lib/bazi/data/pair/sising.json";
import referenceJson from "@/lib/bazi/data/pair/reference.json";

import type {
  DayPillar,
  ElementInteractionAB,
  ElementRelation,
  ElementRelationKey,
  LoveFacet,
  PairComparisonResult,
  PairDomain,
  PairMatchPair,
  PairMatchResult,
  PairMatrixCell,
  PillarPos,
  RatingScale,
  ReferenceData,
  RoleReading,
  ShengxiaStage,
  SisingStar,
  WorkComparisonResult,
} from "@/lib/bazi/pair-types";

const MATRIX = matrixJson as Record<PairDomain, Record<string, PairMatrixCell>>;
const RATING = ratingJson as RatingScale;
const SISING = sisingJson as SisingStar[];
const REFERENCE = referenceJson as ReferenceData;

const SISING_BY_CODE = new Map(SISING.map((s) => [s.code, s]));

type Element = keyof typeof GENERATES;

/** Consumer-facing Thai names from the ปฏิกิริยาธาตุ infographic (self → other). */
const RELATION_LABEL_TH: Record<ElementRelationKey, string> = {
  output: "ดิถีถ่ายเท",
  resource: "ส่งเสริมดิถี",
  same: "คู่ธาตุดิถี",
  power: "พิฆาตดิถี",
  wealth: "ดิถีพิฆาต",
};

function nfkc(value: string): string {
  return (value ?? "").normalize("NFKC").trim();
}

function stemElement(stem: string): Element | null {
  return (STEM_TO_ELEMENT as Record<string, Element>)[nfkc(stem)] ?? null;
}

/** Relationship of OTHER element relative to SELF (day-master perspective). */
export function relationOf(self: Element, other: Element): ElementRelationKey {
  if (self === other) return "same";
  if (GENERATES[self] === other) return "output"; // self generates other → 食傷
  if (GENERATES[other] === self) return "resource"; // other generates self → 印
  if (CONTROLS[self] === other) return "wealth"; // self controls other → 財
  if (CONTROLS[other] === self) return "power"; // other controls self → 官杀
  return "same";
}

function elementRelation(self: Element, other: Element): ElementRelation {
  const relation = relationOf(self, other);
  return {
    relation,
    labelTh: RELATION_LABEL_TH[relation],
    meaningTh: RELATION_SEMANTIC_MEANING_TH[relation] ?? "",
  };
}

function gradeForPercent(percent: number | null): string {
  if (percent == null) return "-";
  const sorted = [...RATING.grades].sort((a, b) => a.min - b.min);
  for (const g of sorted) {
    if (percent <= g.max) return g.grade;
  }
  return sorted.length ? sorted[sorted.length - 1].grade : "-";
}

function ratingBucket(domain: PairDomain, percent: number | null) {
  if (percent == null) return null;
  const buckets = RATING[domain];
  const sorted = [...buckets].sort((a, b) => a.min - b.min);
  for (const b of sorted) {
    if (percent <= b.max) return b;
  }
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function pillarKey(p: DayPillar): string {
  return `${nfkc(p.stem)}${nfkc(p.branch)}`;
}

/** Spreadsheet-exact compatibility for one domain. */
export function computePairMatch(
  our: DayPillar,
  partner: DayPillar,
  domain: PairDomain,
): PairMatchResult {
  const ourKey = pillarKey(our);
  const partnerKey = pillarKey(partner);
  const cell = MATRIX[domain]?.[`${ourKey}|${partnerKey}`] ?? null;
  const percent = cell?.percent ?? null;
  const bucket = ratingBucket(domain, percent);
  const sisingCode = cell?.sisingCode ?? null;
  const sising = sisingCode ? SISING_BY_CODE.get(sisingCode) ?? null : null;

  return {
    domain,
    ourPillar: ourKey,
    partnerPillar: partnerKey,
    percent,
    grade: gradeForPercent(percent),
    components: cell?.components ?? [],
    emoji: bucket?.emoji ?? null,
    ratingText: bucket?.text ?? "ไม่พบข้อมูลสมพงษ์สำหรับคู่นี้",
    sising,
    found: cell != null,
  };
}

export function buildElementInteractionAB(aStem: string, bStem: string): ElementInteractionAB {
  const aEl = stemElement(aStem);
  const bEl = stemElement(bStem);
  const aLabel = aEl ? ELEMENT_LABELS_TH[aEl] : "-";
  const bLabel = bEl ? ELEMENT_LABELS_TH[bEl] : "-";

  if (!aEl || !bEl) {
    const empty: ElementRelation = { relation: "same", labelTh: "-", meaningTh: "" };
    return { aElementTh: aLabel, bElementTh: bLabel, aToB: empty, bToA: empty, summaryTh: "" };
  }

  const aToB = elementRelation(aEl, bEl);
  const bToA = elementRelation(bEl, aEl);
  const summaryTh =
    `ดิถีเรา (${aLabel}) มองเขา (${bLabel}) เป็น “${aToB.labelTh}” (${aToB.meaningTh}); ` +
    `ส่วนเขามองเรา เป็น “${bToA.labelTh}” (${bToA.meaningTh})`;

  return { aElementTh: aLabel, bElementTh: bLabel, aToB, bToA, summaryTh };
}

function findStageByStemBranch(
  stages: ShengxiaStage[],
  stem: string,
  branch: string,
): ShengxiaStage | null {
  const s = nfkc(stem);
  const b = nfkc(branch);
  return stages.find((stage) => nfkc(stage.branchByStem[s] ?? "") === b) ?? null;
}

function roleReading(
  perspective: string,
  stages: ShengxiaStage[],
  stem: string,
  branch: string,
): RoleReading | null {
  const stage = findStageByStemBranch(stages, stem, branch);
  if (!stage) return null;
  return { perspective, stageName: stage.name, narrative: stage.narrative };
}

/** Work-domain role readings keyed by person A's day stem × person B's day branch. */
export function buildWorkRoleReadings(a: DayPillar, b: DayPillar): RoleReading[] {
  const readings: RoleReading[] = [];
  const boss = roleReading("ตัวเรา → เจ้านาย", REFERENCE.roleBoss, a.stem, b.branch);
  const sub = roleReading("ลูกน้อง → ตัวเรา", REFERENCE.roleSubordinate, a.stem, b.branch);
  const partner = roleReading("หุ้นส่วน/เพื่อนร่วมงาน", REFERENCE.rolePartner, a.stem, b.branch);
  for (const r of [boss, sub, partner]) if (r) readings.push(r);
  return readings;
}

/** Love-domain shengxia readings keyed by person A's day stem × person B's day branch. */
export function buildLoveRoleReadings(a: DayPillar, b: DayPillar): RoleReading[] {
  const r = roleReading("คนรัก (เชี่ยงแซ)", REFERENCE.loveShengxia, a.stem, b.branch);
  return r ? [r] : [];
}

/** Day-pillar personality lines (นิสัยหลักวัน: ก้าน / ราศี / เชี่ยงแซ). */
export function buildNisai(pillar: DayPillar): string[] {
  const lines: string[] = [];
  const stemLine = REFERENCE.nisai.byStem[nfkc(pillar.stem)];
  const branchLine = REFERENCE.nisai.byBranch[nfkc(pillar.branch)];
  const stageTh = resolveDisplayTwelveQiStage(nfkc(pillar.stem), nfkc(pillar.branch));
  const stageLine = stageTh ? REFERENCE.nisai.byStage[stageTh] : undefined;
  if (stemLine) lines.push(stemLine);
  if (branchLine) lines.push(branchLine);
  if (stageLine) lines.push(stageLine);
  return lines;
}

function buildPersonProfile(pillar: DayPillar) {
  const el = stemElement(pillar.stem);
  return {
    dayPillar: pillar,
    elementTh: el ? ELEMENT_LABELS_TH[el] : "-",
    stageTh: resolveDisplayTwelveQiStage(pillar.stem, pillar.branch),
    nisai: buildNisai(pillar),
  };
}

/** Both directional readings + an order-independent average for one domain. */
export function computePairMatchPair(
  a: DayPillar,
  b: DayPillar,
  domain: PairDomain,
): PairMatchPair {
  const forward = computePairMatch(a, b, domain);
  const reverse = computePairMatch(b, a, domain);
  const pcts = [forward.percent, reverse.percent].filter((p): p is number => p != null);
  const overallPercent = pcts.length ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 100) / 100 : null;
  return { forward, reverse, overallPercent, overallGrade: gradeForPercent(overallPercent) };
}

function normPillar(p: DayPillar): DayPillar {
  return { stem: nfkc(p.stem), branch: nfkc(p.branch) };
}

/** Full comparison for both domains given two day pillars. */
export function buildPairComparison(a: DayPillar, b: DayPillar): PairComparisonResult {
  const aPillar = normPillar(a);
  const bPillar = normPillar(b);

  return {
    personA: buildPersonProfile(aPillar),
    personB: buildPersonProfile(bPillar),
    match: {
      work: computePairMatchPair(aPillar, bPillar, "work"),
      love: computePairMatchPair(aPillar, bPillar, "love"),
    },
    elementInteraction: buildElementInteractionAB(aPillar.stem, bPillar.stem),
    workRoles: buildWorkRoleReadings(aPillar, bPillar),
    loveRoles: buildLoveRoleReadings(aPillar, bPillar),
    sisingReference: SISING,
  };
}

/**
 * 5 มิติความเข้ากันด้านความรัก (กราฟแท่ง) — ใช้ตารางความรัก 60×60 ที่มีอยู่
 * โดยจับคู่ "เสาของเรา × เสาของเขา" ต่างกันต่อมิติ (ทิศทางเดียวตามที่ซินแสกำหนด):
 *   วันเรา×วันเขา = มิตรภาพ/ความเข้าใจ · ยามเรา×วันเขา = ความใกล้ชิด/เสน่หาทางกาย
 *   วันเรา×ปีเขา = วาสนาคู่ชีวิต · ปีเรา×ปีเขา = คู่บุญ/คู่กรรม
 *   เดือนเรา×วันเขา = ความเข้ากันของครอบครัว (เสาเดือน = ครอบครัว/พ่อแม่)
 */
const LOVE_FACET_SPECS: ReadonlyArray<{
  key: LoveFacet["key"];
  label: string;
  pairingLabel: string;
  ourPos: PillarPos;
  partnerPos: PillarPos;
}> = [
  { key: "kalyanamitra", label: "🤝 มิตรภาพ / ความเข้าใจ", pairingLabel: "วันเรา × วันเขา", ourPos: "day", partnerPos: "day" },
  { key: "intimacy", label: "❤️ ความใกล้ชิด / เสน่หาทางกาย", pairingLabel: "ยามเรา × วันเขา", ourPos: "hour", partnerPos: "day" },
  { key: "family", label: "🏡 ความเข้ากันของครอบครัว", pairingLabel: "เดือนเรา × วันเขา", ourPos: "month", partnerPos: "day" },
  { key: "lifePartner", label: "💍 วาสนาการเป็นคู่ชีวิต", pairingLabel: "วันเรา × ปีเขา", ourPos: "day", partnerPos: "year" },
  { key: "karmic", label: "☯️ คู่บุญ / คู่กรรม", pairingLabel: "ปีเรา × ปีเขา", ourPos: "year", partnerPos: "year" },
];

/** คำนวณ 4 มิติความเข้ากันจากสี่เสาของสองคน (a = เรา, b = เขา). */
export function buildLoveFacets(
  a: Record<PillarPos, DayPillar>,
  b: Record<PillarPos, DayPillar>,
): LoveFacet[] {
  return LOVE_FACET_SPECS.map((spec) => {
    const m = computePairMatch(a[spec.ourPos], b[spec.partnerPos], "love");
    return {
      key: spec.key,
      label: spec.label,
      pairingLabel: spec.pairingLabel,
      ourPos: spec.ourPos,
      partnerPos: spec.partnerPos,
      ourGanzhi: m.ourPillar,
      partnerGanzhi: m.partnerPillar,
      percent: m.percent,
      grade: m.grade,
      found: m.found,
    };
  });
}

/**
 * Work-domain comparison of "เรา" against up to several candidates
 * (หุ้นส่วน/ลูกน้อง). Ranked best→worst by the forward score (เรา→เขา).
 */
export function buildWorkComparison(self: DayPillar, others: DayPillar[]): WorkComparisonResult {
  const selfPillar = normPillar(self);
  const candidates = others.map((o, index) => {
    const p = normPillar(o);
    const match = computePairMatchPair(selfPillar, p, "work");
    return {
      index,
      profile: buildPersonProfile(p),
      match,
      elementInteraction: buildElementInteractionAB(selfPillar.stem, p.stem),
      roles: buildWorkRoleReadings(selfPillar, p),
      rankScore: match.forward.percent,
    };
  });
  const ranking = [...candidates]
    .sort((a, b) => (b.rankScore ?? -1) - (a.rankScore ?? -1))
    .map((c) => c.index);
  return {
    self: buildPersonProfile(selfPillar),
    candidates,
    ranking,
    sisingReference: SISING,
  };
}

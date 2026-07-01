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
import { DEFAULT_MATCHING_TEXT, type MatchingText } from "@/lib/bazi/matching-overlay";

import type {
  DayPillar,
  ElementInteractionAB,
  ElementRelation,
  ElementRelationKey,
  FacetLine,
  MatchFacet,
  PairComparisonResult,
  PairDomain,
  PairMatchPair,
  PairMatchResult,
  PairMatrixCell,
  PillarPos,
  RatingScale,
  ReferenceData,
  RelationshipType,
  RoleReading,
  ShengxiaStage,
  SisingStar,
  WorkComparisonResult,
} from "@/lib/bazi/pair-types";

const MATRIX = matrixJson as Record<PairDomain, Record<string, PairMatrixCell>>;
const RATING = ratingJson as RatingScale;

/** map โค้ดสี่ซิ้ง → ดาว จากชุดข้อความที่ใช้ (DB overlay หรือ JSON เดิม) */
function sisingByCode(text: MatchingText): Map<string, SisingStar> {
  return new Map(text.sising.map((s) => [s.code, s]));
}

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
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): PairMatchResult {
  const ourKey = pillarKey(our);
  const partnerKey = pillarKey(partner);
  const cell = MATRIX[domain]?.[`${ourKey}|${partnerKey}`] ?? null;
  const percent = cell?.percent ?? null;
  const bucket = ratingBucket(domain, percent);
  const sisingCode = cell?.sisingCode ?? null;
  const sising = sisingCode ? sisingByCode(text).get(sisingCode) ?? null : null;

  return {
    domain,
    ourPillar: ourKey,
    partnerPillar: partnerKey,
    percent,
    grade: gradeForPercent(percent),
    components: cell?.components ?? [],
    stemCode: cell?.stemCode ?? null,
    branchCode: cell?.branchCode ?? null,
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
export function buildWorkRoleReadings(
  a: DayPillar,
  b: DayPillar,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): RoleReading[] {
  const readings: RoleReading[] = [];
  const boss = roleReading("ตัวเรา → เจ้านาย", text.reference.roleBoss, a.stem, b.branch);
  const sub = roleReading("ลูกน้อง → ตัวเรา", text.reference.roleSubordinate, a.stem, b.branch);
  const partner = roleReading("หุ้นส่วน/เพื่อนร่วมงาน", text.reference.rolePartner, a.stem, b.branch);
  for (const r of [boss, sub, partner]) if (r) readings.push(r);
  return readings;
}

/** Love-domain shengxia readings keyed by person A's day stem × person B's day branch. */
export function buildLoveRoleReadings(
  a: DayPillar,
  b: DayPillar,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): RoleReading[] {
  const r = roleReading("คนรัก (เชี่ยงแซ)", text.reference.loveShengxia, a.stem, b.branch);
  return r ? [r] : [];
}

/** Day-pillar personality lines (นิสัยหลักวัน: ก้าน / ราศี / เชี่ยงแซ). */
export function buildNisai(pillar: DayPillar, text: MatchingText = DEFAULT_MATCHING_TEXT): string[] {
  const lines: string[] = [];
  const stemLine = text.reference.nisai.byStem[nfkc(pillar.stem)];
  const branchLine = text.reference.nisai.byBranch[nfkc(pillar.branch)];
  const stageTh = resolveDisplayTwelveQiStage(nfkc(pillar.stem), nfkc(pillar.branch));
  const stageLine = stageTh ? text.reference.nisai.byStage[stageTh] : undefined;
  if (stemLine) lines.push(stemLine);
  if (branchLine) lines.push(branchLine);
  if (stageLine) lines.push(stageLine);
  return lines;
}

function buildPersonProfile(pillar: DayPillar, text: MatchingText = DEFAULT_MATCHING_TEXT) {
  const el = stemElement(pillar.stem);
  return {
    dayPillar: pillar,
    elementTh: el ? ELEMENT_LABELS_TH[el] : "-",
    stageTh: resolveDisplayTwelveQiStage(pillar.stem, pillar.branch),
    nisai: buildNisai(pillar, text),
  };
}

/** Both directional readings + an order-independent average for one domain. */
export function computePairMatchPair(
  a: DayPillar,
  b: DayPillar,
  domain: PairDomain,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): PairMatchPair {
  const forward = computePairMatch(a, b, domain, text);
  const reverse = computePairMatch(b, a, domain, text);
  const pcts = [forward.percent, reverse.percent].filter((p): p is number => p != null);
  const overallPercent = pcts.length ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 100) / 100 : null;
  return { forward, reverse, overallPercent, overallGrade: gradeForPercent(overallPercent) };
}

function normPillar(p: DayPillar): DayPillar {
  return { stem: nfkc(p.stem), branch: nfkc(p.branch) };
}

/** Full comparison for both domains given two day pillars. */
export function buildPairComparison(
  a: DayPillar,
  b: DayPillar,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): PairComparisonResult {
  const aPillar = normPillar(a);
  const bPillar = normPillar(b);

  return {
    personA: buildPersonProfile(aPillar, text),
    personB: buildPersonProfile(bPillar, text),
    match: {
      work: computePairMatchPair(aPillar, bPillar, "work", text),
      love: computePairMatchPair(aPillar, bPillar, "love", text),
    },
    elementInteraction: buildElementInteractionAB(aPillar.stem, bPillar.stem),
    workRoles: buildWorkRoleReadings(aPillar, bPillar, text),
    loveRoles: buildLoveRoleReadings(aPillar, bPillar, text),
    sisingReference: text.sising,
  };
}

/** สเปกหนึ่งมิติความเข้ากัน: จับเสาของเรา (ourPos) × เสาของเขา (partnerPos). */
export type FacetSpec = {
  key: string;
  label: string;
  pairingLabel: string;
  ourPos: PillarPos;
  partnerPos: PillarPos;
  /** มิติ "คำทำนายหลัก" (ใช้เป็นหัวข้อ/คะแนนรวม). */
  isMain?: boolean;
};

export type RelationshipSpec = {
  /** ป้ายความสัมพันธ์ (เช่น "คู่รัก"). */
  label: string;
  ourLabel: string;
  partnerLabel: string;
  /** ตาราง 60×60 ที่ใช้ (love/work). */
  domain: PairDomain;
  facets: FacetSpec[];
};

/**
 * สเปกความเข้ากันต่อความสัมพันธ์ (จาก Matching.xlsx) — ใช้ตาราง 60×60 เดิม
 * โดยจับ "เสาของเรา(M) × เสาของเขา(W)" ต่างกันต่อมิติ (ทิศทางเดียวตามที่ซินแสกำหนด).
 * ⭐ = มิติคำทำนายหลัก (isMain) ที่ใช้เป็นหัวข้อ.
 */
export const RELATIONSHIP_SPECS: Record<RelationshipType, RelationshipSpec> = {
  love: {
    label: "คู่รัก",
    ourLabel: "ตัวเรา",
    partnerLabel: "เขา",
    domain: "love",
    facets: [
      { key: "intimacy", label: "❤️ ความใกล้ชิด / เสน่หาทางกาย", pairingLabel: "ยามเรา × วันเขา", ourPos: "hour", partnerPos: "day" },
      { key: "kalyanamitra", label: "🤝 มิตรภาพ / ความเข้าใจ", pairingLabel: "วันเรา × วันเขา", ourPos: "day", partnerPos: "day" },
      { key: "family", label: "🏡 ความเข้ากันของครอบครัว", pairingLabel: "เดือนเรา × วันเขา", ourPos: "month", partnerPos: "day" },
      { key: "lifePartner", label: "💍 วาสนาการเป็นคู่ชีวิต", pairingLabel: "วันเรา × ปีเขา", ourPos: "day", partnerPos: "year", isMain: true },
      { key: "karmic", label: "☯️ คู่บุญ / คู่กรรม", pairingLabel: "ปีเรา × ปีเขา", ourPos: "year", partnerPos: "year" },
    ],
  },
  partner: {
    label: "หุ้นส่วน",
    ourLabel: "เรา",
    partnerLabel: "หุ้นส่วน",
    domain: "work",
    facets: [
      { key: "entourage", label: "👥 เข้ากับบริวารเรา", pairingLabel: "ยามเรา × เดือนหุ้นส่วน", ourPos: "hour", partnerPos: "month" },
      { key: "partner", label: "🤝 เป็นหุ้นส่วนเรา", pairingLabel: "วันเรา × วันหุ้นส่วน", ourPos: "day", partnerPos: "day", isMain: true },
      { key: "business", label: "🏢 ส่งเสริมธุรกิจเรา", pairingLabel: "เดือนเรา × เดือนหุ้นส่วน", ourPos: "month", partnerPos: "month" },
      { key: "customer", label: "🛍️ ส่งเสริมลูกค้าเรา", pairingLabel: "ปีเรา × เดือนหุ้นส่วน", ourPos: "year", partnerPos: "month" },
    ],
  },
  boss: {
    label: "เจ้านาย",
    ourLabel: "เรา (ลูกน้อง)",
    partnerLabel: "เจ้านาย",
    domain: "work",
    facets: [
      { key: "entourage", label: "👥 ทำงานกับบริวารเจ้านาย", pairingLabel: "เดือนเรา × ยามเจ้านาย", ourPos: "month", partnerPos: "hour" },
      { key: "boss", label: "🧑‍💼 ทำงานร่วมกับเจ้านาย", pairingLabel: "วันเรา × เดือนเจ้านาย", ourPos: "day", partnerPos: "month" },
      { key: "business", label: "🏢 ส่งเสริมธุรกิจเจ้านาย", pairingLabel: "เดือนเรา × เดือนเจ้านาย", ourPos: "month", partnerPos: "month", isMain: true },
      { key: "customer", label: "🛍️ ส่งเสริมลูกค้าเจ้านาย", pairingLabel: "เดือนเรา × ปีเจ้านาย", ourPos: "month", partnerPos: "year" },
    ],
  },
  subordinate: {
    label: "ลูกน้อง",
    ourLabel: "เรา",
    partnerLabel: "ลูกน้อง",
    domain: "work",
    facets: [
      { key: "entourage", label: "👥 เข้ากับบริวารเรา", pairingLabel: "ยามเรา × เดือนลูกน้อง", ourPos: "hour", partnerPos: "month" },
      { key: "org", label: "🏛️ เข้ากับองค์กรเรา", pairingLabel: "เดือนเรา × วันลูกน้อง", ourPos: "month", partnerPos: "day" },
      { key: "business", label: "🏢 ส่งเสริมธุรกิจเรา", pairingLabel: "เดือนเรา × เดือนลูกน้อง", ourPos: "month", partnerPos: "month", isMain: true },
      { key: "customer", label: "🛍️ ส่งเสริมลูกค้าเรา", pairingLabel: "ปีเรา × เดือนลูกน้อง", ourPos: "year", partnerPos: "month" },
    ],
  },
  // ชีต DAYMATE — จับ 4 เสาของเจ้าของ × "เสาวัน" ของวันที่เลือกจากปฏิทิน (partnerPos=day ทุกมิติ).
  day: {
    label: "ดวงกับวัน",
    ourLabel: "เรา",
    partnerLabel: "วันนี้",
    domain: "love",
    facets: [
      { key: "home", label: "🏠 อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง", pairingLabel: "ยามเรา × วัน", ourPos: "hour", partnerPos: "day" },
      { key: "companions", label: "🤝 อยู่กับเพื่อน / พี่น้อง / คู่ครอง", pairingLabel: "วันเรา × วัน", ourPos: "day", partnerPos: "day", isMain: true },
      { key: "workplace", label: "🏢 ไปที่ทำงาน / สถานศึกษา / พ่อแม่", pairingLabel: "เดือนเรา × วัน", ourPos: "month", partnerPos: "day" },
      { key: "outside", label: "🌏 ไปลูกค้า / งานสังคม / สื่อ / ต่างถิ่น", pairingLabel: "ปีเรา × วัน", ourPos: "year", partnerPos: "day" },
    ],
  },
};

/** list คำทำนายต่อมุมความสัมพันธ์ จากชุดข้อความที่ใช้ (DB overlay หรือ JSON เดิม). */
function roleListFor(reference: ReferenceData, relationship: RelationshipType): ShengxiaStage[] {
  switch (relationship) {
    case "love":
      return reference.loveShengxia;
    case "partner":
      return reference.rolePartner;
    case "boss":
      return reference.roleBoss;
    case "subordinate":
      return reference.roleSubordinate;
    case "day":
      return reference.loveShengxia; // DAYMATE reuse ชุดคำทำนายเชี่ยงแซความรัก
  }
}

/** Map โค้ด→stage (เก็บ occurrence แรก กันโค้ดซ้ำในชีตความรัก). */
function roleMapFor(reference: ReferenceData, relationship: RelationshipType): Map<string, ShengxiaStage> {
  const map = new Map<string, ShengxiaStage>();
  for (const st of roleListFor(reference, relationship)) {
    if (st.code && !map.has(st.code)) map.set(st.code, st);
  }
  return map;
}

/** คำทำนายรายแท่ง 3 บรรทัด (ก้าน/กิ่ง/สี่ซิ้ง) ตามโค้ดในเซลล์ matrix. */
function facetLines(
  relationship: RelationshipType,
  m: PairMatchResult,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): FacetLine[] {
  const map = roleMapFor(text.reference, relationship);
  const slots: { slot: string; code: string | null }[] = [
    { slot: "ก้าน", code: m.stemCode },
    { slot: "กิ่ง", code: m.branchCode },
    { slot: "สี่ซิ้ง", code: m.sising?.code ?? null },
  ];
  const lines: FacetLine[] = [];
  for (const { slot, code } of slots) {
    if (!code) continue;
    const st = map.get(code);
    lines.push({
      slot,
      code,
      name: st?.name ?? m.sising?.nameTh ?? "",
      score: st?.score ?? null,
      text: st?.narrative ?? "",
    });
  }
  return lines;
}

/** คำนวณมิติความเข้ากันตามความสัมพันธ์ จากสี่เสาของสองคน (a = เรา, b = เขา). */
export function buildFacets(
  relationship: RelationshipType,
  a: Record<PillarPos, DayPillar>,
  b: Record<PillarPos, DayPillar>,
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): MatchFacet[] {
  const spec = RELATIONSHIP_SPECS[relationship];
  return spec.facets.map((f) => {
    const m = computePairMatch(a[f.ourPos], b[f.partnerPos], spec.domain, text);
    return {
      key: f.key,
      label: f.label,
      pairingLabel: f.pairingLabel,
      ourPos: f.ourPos,
      partnerPos: f.partnerPos,
      ourGanzhi: m.ourPillar,
      partnerGanzhi: m.partnerPillar,
      percent: m.percent,
      grade: m.grade,
      found: m.found,
      isMain: f.isMain === true,
      domain: spec.domain,
      emoji: m.emoji,
      ratingText: m.ratingText,
      sising: m.sising,
      lines: facetLines(relationship, m, text),
    };
  });
}

/** มิติคำทำนายหลัก (isMain) — fallback เป็นมิติแรกถ้าไม่ได้ระบุ. */
export function mainFacetOf(facets: MatchFacet[]): MatchFacet | null {
  return facets.find((f) => f.isMain) ?? facets[0] ?? null;
}

/** @deprecated ใช้ buildFacets("love", a, b) — คง wrapper ไว้กัน caller เดิมพัง. */
export function buildLoveFacets(
  a: Record<PillarPos, DayPillar>,
  b: Record<PillarPos, DayPillar>,
): MatchFacet[] {
  return buildFacets("love", a, b);
}

/**
 * Work-domain comparison of "เรา" against up to several candidates
 * (หุ้นส่วน/ลูกน้อง). Ranked best→worst by the forward score (เรา→เขา).
 */
export function buildWorkComparison(
  self: DayPillar,
  others: DayPillar[],
  text: MatchingText = DEFAULT_MATCHING_TEXT,
): WorkComparisonResult {
  const selfPillar = normPillar(self);
  const candidates = others.map((o, index) => {
    const p = normPillar(o);
    const match = computePairMatchPair(selfPillar, p, "work", text);
    return {
      index,
      profile: buildPersonProfile(p, text),
      match,
      elementInteraction: buildElementInteractionAB(selfPillar.stem, p.stem),
      roles: buildWorkRoleReadings(selfPillar, p, text),
      rankScore: match.forward.percent,
    };
  });
  const ranking = [...candidates]
    .sort((a, b) => (b.rankScore ?? -1) - (a.rankScore ?? -1))
    .map((c) => c.index);
  return {
    self: buildPersonProfile(selfPillar, text),
    candidates,
    ranking,
    sisingReference: text.sising,
  };
}

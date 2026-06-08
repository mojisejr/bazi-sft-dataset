/**
 * Types for the 2-person pair-matching feature (คู่สมพงษ์ การงาน + ความรัก).
 * Mirrors the JSON assets distilled from the Excel knowledge base
 * (see scripts/distill-pair-knowledge.py and src/lib/bazi/data/pair/).
 */

export type PairDomain = "work" | "love";

/** One combo cell from pair-matrix.json. */
export type PairMatrixCell = {
  domain: PairDomain;
  percent: number | null;
  components: number[];
  points: number | null;
  ratio: number | null;
  sisingCode: string | null;
  sisingName: string | null;
};

/** rating-scale.json shape. */
export type RatingBucket = { min: number; max: number; emoji: string | null; text: string };
export type GradeBucket = { min: number; max: number; grade: string };
export type RatingScale = {
  grades: GradeBucket[];
  work: RatingBucket[];
  love: RatingBucket[];
};

/** sising.json entry (12 deity stars, codes B1..B12). */
export type SisingStar = {
  code: string;
  score: number | null;
  branchPositions: string[];
  nameCn: string;
  nameTh: string;
  short: string;
  long: string;
  aspects: {
    work: string;
    money: string;
    love: string;
    family: string;
    business: string;
    health: string;
  };
  summary: string;
};

/** reference.json shapes. */
export type ShengxiaStage = {
  code: string;
  name: string;
  score: number | null;
  narrative: string;
  branchByStem: Record<string, string>;
};
export type ReferenceData = {
  nisai: {
    byStem: Record<string, string>;
    byBranch: Record<string, string>;
    byStage: Record<string, string>;
  };
  roleBoss: ShengxiaStage[];
  roleSubordinate: ShengxiaStage[];
  rolePartner: ShengxiaStage[];
  loveShengxia: ShengxiaStage[];
  kubunRaw: string[][];
};

// --- Engine output -------------------------------------------------------

/** Pillar identity used as the matrix key half (e.g. stem 甲, branch 子). */
export type DayPillar = { stem: string; branch: string };

/** Five-element relationship of the OTHER element relative to SELF. */
export type ElementRelationKey =
  | "same" // คู่ธาตุ (比劫)
  | "resource" // ส่งเสริมดิถี (印) — other generates self
  | "output" // ดิถีถ่ายเท (食傷) — self generates other
  | "power" // พิฆาตดิถี (官杀) — other controls self
  | "wealth"; // ดิถีพิฆาต (財) — self controls other

export type ElementRelation = {
  relation: ElementRelationKey;
  /** Consumer-facing Thai name from the ปฏิกิริยาธาตุ infographic. */
  labelTh: string;
  /** Short semantic meaning (reused from RELATION_SEMANTIC_MEANING_TH). */
  meaningTh: string;
};

export type ElementInteractionAB = {
  aElementTh: string;
  bElementTh: string;
  /** How B is positioned relative to A (B is the "ลูก/ผู้อื่น" of A). */
  aToB: ElementRelation;
  /** How A is positioned relative to B. */
  bToA: ElementRelation;
  summaryTh: string;
};

export type PairMatchResult = {
  domain: PairDomain;
  ourPillar: string;
  partnerPillar: string;
  percent: number | null;
  grade: string;
  components: number[];
  emoji: string | null;
  ratingText: string;
  sising: SisingStar | null;
  found: boolean;
};

export type RoleReading = { perspective: string; stageName: string; narrative: string };

/** Both directional readings for a domain + an order-independent overall. */
export type PairMatchPair = {
  /** คนที่ 1 มองคนที่ 2 (เรา = A). */
  forward: PairMatchResult;
  /** คนที่ 2 มองคนที่ 1 (เรา = B). */
  reverse: PairMatchResult;
  /** ค่าเฉลี่ยสองทิศ (ไม่ขึ้นกับลำดับการกรอก) — null ถ้าหาคู่ไม่เจอ. */
  overallPercent: number | null;
  overallGrade: string;
};

export type PersonProfile = {
  dayPillar: DayPillar;
  /** ธาตุของดิถี (ไทย). */
  elementTh: string;
  /** เชี่ยงแซของหลักวัน (ไทย เช่น หมกยก). */
  stageTh: string;
  /** นิสัยพื้นฐาน 3 บรรทัด: ก้าน / ราศี / เชี่ยงแซ. */
  nisai: string[];
};

export type PairComparisonResult = {
  personA: PersonProfile;
  personB: PersonProfile;
  match: { work: PairMatchPair; love: PairMatchPair };
  elementInteraction: ElementInteractionAB;
  workRoles: RoleReading[];
  loveRoles: RoleReading[];
  /** Full 12-สี่ซิ้ง reference knowledge for the popup. */
  sisingReference: SisingStar[];
};

// Hour Rectification (สอบยาม) — domain types (#hour-rectification-engine), v1 personal
// signature-matching.
//
// Pure data shapes + pure element math only. No LLM/engine/file dependency — this whole domain/
// folder must stay importable and testable in total isolation. The small element/branch maps below
// are duplicated here deliberately (not imported from symbolic-engine.constants.ts) to keep this
// folder decoupled from the main engine's module graph — the same discipline that already keeps
// HOUR_BRANCHES local rather than importing it, and trace.ts standalone rather than extending
// CalculationTraceSchema.
//
// === v0 → v1 ===
// v0 mapped each answer PATH to a fixed hourBranch derived from ONE sample person's chart, so it
// could never predict a different real user's hour. v1 instead reads STRUCTURAL SIGNATURE
// properties (element / role-vs-day-master / strength) that are universal — every person's hour
// pillar has them — and matches the accumulated signature against THAT user's own 12 real hour
// charts at runtime. Questions are pre-generated and person-agnostic; the hour result is personal.

export const HOUR_BRANCHES = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

export type HourBranch = (typeof HOUR_BRANCHES)[number];

export const HOUR_BRANCH_LABELS_TH: Record<HourBranch, string> = {
  子: "ชวด",
  丑: "ฉลู",
  寅: "ขาล",
  卯: "เถาะ",
  辰: "มะโรง",
  巳: "มะเส็ง",
  午: "มะเมีย",
  未: "มะแม",
  申: "วอก",
  酉: "ระกา",
  戌: "จอ",
  亥: "กุน",
};

// Representative mid-double-hour time for each branch (HH:00, even hours only) — deliberately
// never an odd hour like 01:00/03:00, which sits exactly on a branch boundary and would make the
// chart-profile-adapter's calculateBaziChart call ambiguous about which branch it landed in.
export const HOUR_BRANCH_MID_TIME: Record<HourBranch, string> = {
  子: "00:00",
  丑: "02:00",
  寅: "04:00",
  卯: "06:00",
  辰: "08:00",
  巳: "10:00",
  午: "12:00",
  未: "14:00",
  申: "16:00",
  酉: "18:00",
  戌: "20:00",
  亥: "22:00",
};

export function isHourBranch(value: string): value is HourBranch {
  return (HOUR_BRANCHES as readonly string[]).includes(value);
}

// === structural signature primitives (pure element math) ===

export const ELEMENTS = ["wood", "fire", "earth", "metal", "water"] as const;
export type Element = (typeof ELEMENTS)[number];

// Role of some element RELATIVE TO the day master element. Vocabulary matches the main engine's
// doctrine-config ROLE_KEYS exactly: same(比劫) resource(印) output(食伤) wealth(财) power(官杀).
export const ELEMENT_ROLES = ["same", "resource", "output", "wealth", "power"] as const;
export type ElementRole = (typeof ELEMENT_ROLES)[number];

export const STRENGTH_BUCKETS = ["strong", "balanced", "weak"] as const;
export type StrengthBucket = (typeof STRENGTH_BUCKETS)[number];

// Duplicated from symbolic-engine.constants.ts on purpose (domain-decoupling discipline).
export const STEM_TO_ELEMENT: Record<string, Element> = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
};

export const BRANCH_TO_ELEMENT: Record<HourBranch, Element> = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
};

// 生 (generates) and 克 (controls) cycles.
export const GENERATES: Record<Element, Element> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

export const CONTROLS: Record<Element, Element> = {
  wood: "earth",
  earth: "water",
  water: "fire",
  fire: "metal",
  metal: "wood",
};

// role(dayMaster, other): where `other` stands relative to the day master. Verified against the
// engine's own tenGod field on a real chart (壬→same/劫财, 甲→output/伤官, 戊→power/正官,
// 庚→resource/正印, 丙→wealth/正财 for a 癸 day master).
export function computeElementRole(dayMasterElement: Element, other: Element): ElementRole {
  if (other === dayMasterElement) return "same";
  if (GENERATES[other] === dayMasterElement) return "resource"; // other feeds the day master
  if (GENERATES[dayMasterElement] === other) return "output"; // day master feeds other
  if (CONTROLS[dayMasterElement] === other) return "wealth"; // day master controls other
  if (CONTROLS[other] === dayMasterElement) return "power"; // other controls the day master
  // Unreachable for the 5-element cycle, but keep total rather than throw in a pure helper.
  return "same";
}

export type StructuralSignature = {
  stemElement: Element;
  stemRole: ElementRole;
  branchRole: ElementRole;
  strengthBucket: StrengthBucket;
};

// One of the user's 12 candidate hours, with its computed real-chart signature. Produced by the
// chart-profile-adapter at runtime (still pure math, no LLM).
export type HourSignature = {
  hourBranch: HourBranch;
  signature: StructuralSignature;
  strengthScore: number; // raw score kept for relative bucketing + tie-break transparency
};

// The four dimensions a question option may vote on. Kept as a const so validate-tree can check an
// option never votes on a dimension match.ts can't interpret.
export const SIGNATURE_DIMENSIONS = [
  "stemElement",
  "stemRole",
  "branchRole",
  "strengthBucket",
] as const;
export type SignatureDimension = (typeof SIGNATURE_DIMENSIONS)[number];

// The allowed values per dimension — the shared vocabulary between the generator (what it may tag),
// validate-tree (what it accepts) and match.ts (what it can score). One source of truth.
export const SIGNATURE_VOCAB: Record<SignatureDimension, readonly string[]> = {
  stemElement: ELEMENTS,
  stemRole: ELEMENT_ROLES,
  branchRole: ELEMENT_ROLES,
  strengthBucket: STRENGTH_BUCKETS,
};

// A single piece of evidence an answer contributes: "this answer suggests `dimension` = `value`",
// weighted (some answers are stronger signals than others).
export type SignatureVote = {
  dimension: SignatureDimension;
  value: string;
  weight: number;
};

export type QuestionOption = {
  id: string;
  label: string;
  evidence: SignatureVote[];
};

export type BankQuestion = {
  id: string;
  question: string;
  options: QuestionOption[];
};

// The pre-generated, person-agnostic question bank. Replaces v0's QuestionNetwork tree. Runtime
// selects a discriminating subset per user; the bank itself carries no hour results.
export type QuestionBank = {
  version: string;
  generatedAt: string;
  questions: BankQuestion[];
  meta?: {
    model?: string;
    llmCallsUsed?: number;
    sampleBirthDates?: string[];
  };
};

// One answered step in the stateless trail the client resends each request: which bank question,
// which option. Carries the questionId (not just an option index) so replay can verify the client
// answered the questions the deterministic selector would actually have asked.
export type AnsweredStep = {
  questionId: string;
  optionId: string;
};

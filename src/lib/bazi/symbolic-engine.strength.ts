import type {
  CalculatedStateValue,
  ExplainableValue,
} from "@/lib/bazi/schema-types";
import {
  BRANCH_HIDDEN_STEMS,
  STEM_METAPHORS,
  STEM_TO_ELEMENT,
  SUPPORT_ELEMENT_METAPHORS,
  CLASH_PAIRS,
  GENERATES,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  OPERATOR_DOMINANCE,
  OPERATOR_FAVORABLE_BRANCHES,
  OPERATOR_FAVORABLE_STEMS,
  OPERATOR_PO_STEM_BRANCH,
  OPERATOR_RELATION_PENALTIES,
  OPERATOR_STRENGTH_POSITION_WEIGHTS,
} from "@/lib/bazi/constants";
import type {
  BranchInteractionResolution,
  GeneralizedInteractionState,
  StrengthStageSnapshot,
  SupportedElement,
} from "@/lib/bazi/symbolic-engine.types";
import {
  TRACE_RULE_NAMES,
  TRACE_STEP_KEYS,
} from "@/lib/bazi/trace-keys";

function getElement(stem: string): SupportedElement {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported heavenly stem: ${stem}`);
  }

  return element;
}

type OperatorContribution = {
  label: string;
  symbol: string;
  weight: number;
  source: "stem" | "branch" | "zone" | "relation";
};

type OperatorStrengthBreakdown = {
  score: number;
  stageContribution: number;
  visibleContributions: OperatorContribution[];
  hiddenContributions: OperatorContribution[];
  qiAdjustments: OperatorContribution[];
  relationAdjustments: OperatorContribution[];
  penalties: {
    clashes: number;
    punishments: number;
    harms: number;
    destructions: number;
  };
};

function isOperatorContribution(
  value: OperatorContribution | null,
): value is OperatorContribution {
  return value !== null;
}

// เชี่ยงแซตัวดีตามสเปก: เชี่ยงแซ(长生) กวงตั่ว(冠带) ลิ่มกัว(临官) ตี้อ๋วง(帝旺) ทอ(胎) เอี้ยง(养)
const GOOD_QI_STAGE_LABELS = new Set(["长生", "冠带", "临官", "帝旺", "胎", "养"]);
const BAD_QI_STAGE_LABELS = new Set(["沐浴", "衰", "病", "死", "绝"]);

function hasFavorableStem(dayMasterElement: SupportedElement, stem: string) {
  return OPERATOR_FAVORABLE_STEMS[dayMasterElement].includes(stem);
}

function hasFavorableBranch(dayMasterElement: SupportedElement, branch: string) {
  return OPERATOR_FAVORABLE_BRANCHES[dayMasterElement].includes(branch);
}

function normalizePairKey(left: string, right: string) {
  const pairKey = [left, right].sort().join("|");

  if (CLASH_PAIRS.has(pairKey)) {
    return pairKey;
  }

  return [right, left].sort().join("|");
}

function hasGeneralizedBranchClash(
  interactionState: GeneralizedInteractionState | undefined,
  left: string,
  right: string,
) {
  if (!interactionState) {
    return false;
  }

  const label = normalizePairKey(left, right).replace("|", "");

  return interactionState.relations.some((relation) => (
    relation.familyKey === "earthly-branch-clash"
    && relation.label === label
  )) || interactionState.outcomes.some((outcome) => (
    outcome.status !== "blocked"
    && interactionState.relations.some((relation) => (
      relation.id === outcome.relationId
      && relation.familyKey === "earthly-branch-clash"
      && relation.label === label
    ))
  ));
}

/** ตรวจว่าคู่กิ่งนี้อยู่ใน active list ใด (ชง/เฮ้ง/ผั่ว) — เทียบทั้งสองทิศ */
function pairInList(list: string[], left: string, right: string) {
  return list.includes(`${left}${right}`) || list.includes(`${right}${left}`);
}

/** "ชง" (冲 clash) หรือ "เฮ้ง" (刑 punishment) ระหว่างสองกิ่ง */
function hasActiveConflict(
  interactionResolution: BranchInteractionResolution,
  left: string,
  right: string,
) {
  if (hasGeneralizedBranchClash(interactionResolution.interactionState, left, right)) {
    return true;
  }

  const label = normalizePairKey(left, right).replace("|", "");
  if (interactionResolution.activeClashes.includes(label)) {
    return true;
  }

  return pairInList(interactionResolution.activePunishments, left, right);
}

/**
 * "ผั่ว" (破) ตามตำราเคี้ยงคุง = คู่ "ราศีบน(ก้าน) × ราศีล่าง(กิ่ง)" เฉพาะคู่
 * เช่น 戊×寅, 乙×巳, 丙×辰 — ใช้ตรวจ "ดิถี (ก้านหลักวัน) ผั่วกับราศีล่าง" ของตำแหน่งนั้น
 */
function isPoStemBranch(stem: string, branch: string) {
  return (OPERATOR_PO_STEM_BRANCH[stem] ?? []).includes(branch);
}

/**
 * โซนเชี่ยงแซ ±0.25 ตามสเปก: ในหนึ่งโซน ถ้ามีตำแหน่งใดเป็น "เชี่ยงแซตัวดี" ให้ +0.25
 * และถ้ามีตำแหน่งใดเป็น "เชี่ยงแซตัวเสีย" ให้ −0.25 (เป็นอิสระต่อกัน → โซนผสมหักลบเป็น 0)
 *   ตัวดี = เชี่ยงแซ/กวงตั่ว/ลิ่มกัว/ตี้อ๋วง/ทอ/เอี้ยง ; ตัวเสีย = หมกยก/ซวย/แป่/ซี่/เจ๊าะ
 */
function resolveZoneQiAdjustments(zoneLabel: string, stages: string[]): OperatorContribution[] {
  const out: OperatorContribution[] = [];
  const symbol = stages.join(",");
  if (stages.some((stage) => GOOD_QI_STAGE_LABELS.has(stage))) {
    out.push({ label: `${zoneLabel}:good`, symbol, weight: 0.25, source: "zone" });
  }
  if (stages.some((stage) => BAD_QI_STAGE_LABELS.has(stage))) {
    out.push({ label: `${zoneLabel}:bad`, symbol, weight: -0.25, source: "zone" });
  }
  return out;
}

/**
 * โบนัสครอบงำ 从强 (印比ครอบงำ) — เมื่อธาตุพวกพ้อง (比劫) + ธาตุอุปถัมภ์ (印) ครอบงำผัง
 * จนเกือบไร้ธาตุถ่ายเท/ข่ม (食傷財官) ดิถีย่อมยกขึ้นแดน "แข็งมาก" ตามตำรา
 * นับหน่วยธาตุจากราศีบนทั้ง 4 + ราศีล่างชั้น 本气 ทั้ง 4 (รวม 8 หน่วย) แล้ววัดสัดส่วนฝ่ายหนุน
 * เปิดเฉพาะดวงที่ฐานคะแนนแตะแดน "แข็ง" แล้ว (baseScore >= minBaseScore) จึงไม่กระทบดวงสมดุล/อ่อน
 */
function resolveDominanceBonus(
  dayMasterElement: SupportedElement,
  pillars: CalculatedStateValue["fourPillars"],
  baseScore: number,
): OperatorContribution | null {
  if (baseScore < OPERATOR_DOMINANCE.minBaseScore) {
    return null;
  }

  const resourceElement = (Object.keys(GENERATES) as SupportedElement[]).find(
    (element) => GENERATES[element] === dayMasterElement,
  );
  const isSupportive = (element: SupportedElement | undefined) =>
    element === dayMasterElement || element === resourceElement;

  let supportive = 0;
  let total = 0;
  for (const key of ["year", "month", "day", "hour"] as const) {
    const stemElement = STEM_TO_ELEMENT[pillars[key].stem as keyof typeof STEM_TO_ELEMENT];
    if (stemElement) {
      total += 1;
      if (isSupportive(stemElement)) {
        supportive += 1;
      }
    }

    const mainHidden = (BRANCH_HIDDEN_STEMS[pillars[key].branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [])[0];
    const branchElement = STEM_TO_ELEMENT[mainHidden as keyof typeof STEM_TO_ELEMENT];
    if (branchElement) {
      total += 1;
      if (isSupportive(branchElement)) {
        supportive += 1;
      }
    }
  }

  if (total === 0) {
    return null;
  }

  const supportiveShare = supportive / total;
  const tier = OPERATOR_DOMINANCE.tiers.find((candidate) => supportiveShare >= candidate.minSupportiveShare);
  if (!tier) {
    return null;
  }

  return {
    label: "dominance",
    symbol: `${supportive}/${total}`,
    weight: tier.bonus,
    source: "zone",
  };
}

function computeStrengthScoreBreakdown(
  dayMasterStem: string,
  pillars: CalculatedStateValue["fourPillars"],
  stages: StrengthStageSnapshot,
  interactionResolution: BranchInteractionResolution,
): OperatorStrengthBreakdown {
  const dayMasterElement = getElement(dayMasterStem);
  let score = 0;

  const visibleContributions = [
    {
      source: "branch" as const,
      label: "monthBranch",
      symbol: pillars.month.branch,
      weight: hasFavorableBranch(dayMasterElement, pillars.month.branch)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.monthBranch
        : 0,
    },
    {
      source: "branch" as const,
      label: "dayBranch",
      symbol: pillars.day.branch,
      weight: hasFavorableBranch(dayMasterElement, pillars.day.branch)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.dayBranch
        : 0,
    },
    {
      source: "stem" as const,
      label: "yearStem",
      symbol: pillars.year.stem,
      weight: hasFavorableStem(dayMasterElement, pillars.year.stem)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.yearStem
        : 0,
    },
    {
      source: "stem" as const,
      label: "monthStem",
      symbol: pillars.month.stem,
      weight: hasFavorableStem(dayMasterElement, pillars.month.stem)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.monthStem
        : 0,
    },
    {
      source: "stem" as const,
      label: "hourStem",
      symbol: pillars.hour.stem,
      weight: hasFavorableStem(dayMasterElement, pillars.hour.stem)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.hourStem
        : 0,
    },
    {
      source: "branch" as const,
      label: "hourBranch",
      symbol: pillars.hour.branch,
      weight: hasFavorableBranch(dayMasterElement, pillars.hour.branch)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.hourBranch
        : 0,
    },
    {
      source: "branch" as const,
      label: "yearBranch",
      symbol: pillars.year.branch,
      weight: hasFavorableBranch(dayMasterElement, pillars.year.branch)
        ? OPERATOR_STRENGTH_POSITION_WEIGHTS.yearBranch
        : 0,
    },
  ];

  for (const contribution of visibleContributions) {
    score += contribution.weight;
  }

  // สเปกความแข็งแรงไม่นับโบนัสรากธาตุ (通根) — ใช้เฉพาะคะแนนตำแหน่ง 7 ช่อง + เชี่ยงแซ + ความสัมพันธ์
  const hiddenContributions: OperatorContribution[] = [];

  // โซนเชี่ยงแซ ±0.25 (อิสระต่อโซน): โซนใดมีเชี่ยงแซตัวดี +0.25, มีเชี่ยงแซตัวเสีย −0.25
  //  โซน A = ราศีล่างหลักวัน + ราศีล่างหลักเดือน ; โซน B = หลักยาม + ราศีบนหลักเดือน ; โซน C = หลักปี
  const qiAdjustments = [
    ...resolveZoneQiAdjustments("dayMonthBranchZone", [stages.day, stages.month]),
    ...resolveZoneQiAdjustments("hourMonthStemZone", [stages.hour, stages.month]),
    ...resolveZoneQiAdjustments("yearZone", [stages.year]),
  ];

  for (const adjustment of qiAdjustments) {
    score += adjustment.weight;
  }

  // ความสัมพันธ์ที่หักคะแนน (−0.25 ต่อรายการ ตามสเปก):
  //  • ดิถี (ก้านหลักวัน) "ผั่ว" (破) กับราศีล่างหลักวัน และ/หรือ ราศีล่างหลักเดือน (ก้าน×กิ่ง)
  //  • ราศีล่างหลักเดือน–หลักวัน และ ราศีล่างหลักวัน–หลักยาม "ชง/เฮ้ง" (冲/刑)
  const relationAdjustments = [
    isPoStemBranch(dayMasterStem, pillars.day.branch)
      ? {
          label: "dayBranchVsDayMasterPo",
          symbol: `${dayMasterStem}破${pillars.day.branch}`,
          weight: -OPERATOR_RELATION_PENALTIES.dayBranchVsDayMasterPo,
          source: "relation" as const,
        }
      : null,
    isPoStemBranch(dayMasterStem, pillars.month.branch)
      ? {
          label: "monthBranchVsDayMasterPo",
          symbol: `${dayMasterStem}破${pillars.month.branch}`,
          weight: -OPERATOR_RELATION_PENALTIES.monthBranchVsDayMasterPo,
          source: "relation" as const,
        }
      : null,
    hasActiveConflict(interactionResolution, pillars.month.branch, pillars.day.branch)
      ? {
          label: "monthBranchVsDayBranchConflict",
          symbol: `${pillars.month.branch}${pillars.day.branch}`,
          weight: -OPERATOR_RELATION_PENALTIES.monthBranchVsDayBranchConflict,
          source: "relation" as const,
        }
      : null,
    hasActiveConflict(interactionResolution, pillars.day.branch, pillars.hour.branch)
      ? {
          label: "dayBranchVsHourBranchConflict",
          symbol: `${pillars.day.branch}${pillars.hour.branch}`,
          weight: -OPERATOR_RELATION_PENALTIES.dayBranchVsHourBranchConflict,
          source: "relation" as const,
        }
      : null,
  ].filter(isOperatorContribution) as OperatorContribution[];

  const penalties = {
    clashes: 0,
    punishments: 0,
    harms: 0,
    destructions: 0,
  };

  for (const adjustment of relationAdjustments) {
    score += adjustment.weight;
    penalties.clashes += Math.abs(adjustment.weight);
  }

  // 从强 dominance: คิดจากฐานคะแนนหลังรวมทุกปัจจัย แล้วยกแดนแข็ง → แข็งมาก
  const dominanceBonus = resolveDominanceBonus(dayMasterElement, pillars, score);
  if (dominanceBonus) {
    score += dominanceBonus.weight;
    qiAdjustments.push(dominanceBonus);
  }

  return {
    score: Number(score.toFixed(2)),
    stageContribution: 0,
    visibleContributions,
    hiddenContributions,
    qiAdjustments,
    relationAdjustments,
    penalties,
  };
}

export function buildStrengthScoreExplainable(
  dayMasterStem: string,
  pillars: CalculatedStateValue["fourPillars"],
  stages: StrengthStageSnapshot,
  interactionResolution: BranchInteractionResolution,
): ExplainableValue<number> {
  const breakdown = computeStrengthScoreBreakdown(
    dayMasterStem,
    pillars,
    stages,
    interactionResolution,
  );

  return {
    value: breakdown.score,
    trace: {
      engine: "orthodox-override",
      ruleName: TRACE_RULE_NAMES.strengthScore,
      steps: [],
      stepKeys: [
        TRACE_STEP_KEYS.strengthScore.weightStages,
        TRACE_STEP_KEYS.strengthScore.addRelations,
        TRACE_STEP_KEYS.strengthScore.applyPenalties,
      ],
      rawVariables: {
        dayMasterStem,
        stages,
        monthBranchTwelveQiStage: stages.month,
        activeCombinations: interactionResolution.activeCombinations,
        activeClashes: interactionResolution.activeClashes,
        activePunishments: interactionResolution.activePunishments,
        activeHarms: interactionResolution.activeHarms,
        activeDestructions: interactionResolution.activeDestructions,
        visibleContributions: breakdown.visibleContributions,
        qiAdjustments: breakdown.qiAdjustments,
        relationAdjustments: breakdown.relationAdjustments,
        result: breakdown.score,
      },
    },
  };
}

export function buildElementMetaphors(dayMasterStem: string) {
  const dayMasterElement = getElement(dayMasterStem);
  const resourceElement = Object.entries(GENERATES).find(([, produced]) => produced === dayMasterElement)?.[0];

  return [
    {
      element: dayMasterElement,
      metaphor: STEM_METAPHORS[dayMasterStem as keyof typeof STEM_METAPHORS],
    },
    ...(resourceElement
      ? [
          {
            element: resourceElement,
            metaphor:
              SUPPORT_ELEMENT_METAPHORS[
                resourceElement as keyof typeof SUPPORT_ELEMENT_METAPHORS
              ],
          },
        ]
      : []),
  ];
}

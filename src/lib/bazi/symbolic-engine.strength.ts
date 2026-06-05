import type {
  CalculatedStateValue,
  ExplainableValue,
} from "@/lib/bazi/schema-types";
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_TO_ELEMENT,
  STEM_METAPHORS,
  STEM_TO_ELEMENT,
  SUPPORT_ELEMENT_METAPHORS,
  CLASH_PAIRS,
  GENERATES,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  OPERATOR_BAD_QI_PENALTIES,
  OPERATOR_DOMINANCE,
  OPERATOR_FAVORABLE_BRANCHES,
  OPERATOR_FAVORABLE_STEMS,
  OPERATOR_GOOD_QI_BONUSES,
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

const GOOD_QI_STAGE_LABELS = new Set(["冠带", "临官", "帝旺", "胎", "养"]);
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

function hasActiveClash(
  interactionResolution: BranchInteractionResolution,
  left: string,
  right: string,
) {
  if (hasGeneralizedBranchClash(interactionResolution.interactionState, left, right)) {
    return true;
  }

  const label = normalizePairKey(left, right).replace("|", "");

  return interactionResolution.activeClashes.includes(label);
}

function resolveZoneAdjustment(
  zoneLabel: string,
  stages: string[],
  bonusWeight: number,
  penaltyWeight: number,
): OperatorContribution | null {
  const hasGoodQi = stages.some((stage) => GOOD_QI_STAGE_LABELS.has(stage));
  const hasBadQi = stages.some((stage) => BAD_QI_STAGE_LABELS.has(stage));

  if (hasGoodQi && !hasBadQi) {
    return {
      label: zoneLabel,
      symbol: stages.join(","),
      weight: bonusWeight,
      source: "zone",
    };
  }

  if (hasBadQi && !hasGoodQi) {
    return {
      label: zoneLabel,
      symbol: stages.join(","),
      weight: -penaltyWeight,
      source: "zone",
    };
  }

  return null;
}

function resolveDayMonthZoneAdjustment(stages: [string, string]) {
  const [dayStage, monthStage] = stages;
  const bothGood = GOOD_QI_STAGE_LABELS.has(dayStage) && GOOD_QI_STAGE_LABELS.has(monthStage);
  const bothBad = BAD_QI_STAGE_LABELS.has(dayStage) && BAD_QI_STAGE_LABELS.has(monthStage);

  if (bothGood) {
    return {
      label: "dayMonthBranchZone",
      symbol: stages.join(","),
      weight: OPERATOR_GOOD_QI_BONUSES.dayMonthBranchZone,
      source: "zone" as const,
    };
  }

  if (bothBad) {
    return {
      label: "dayMonthBranchZone",
      symbol: stages.join(","),
      weight: -OPERATOR_BAD_QI_PENALTIES.dayMonthBranchZone,
      source: "zone" as const,
    };
  }

  return null;
}

function resolveHourMonthZoneAdjustment(stages: [string, string]) {
  const [hourStage, monthStage] = stages;
  const hourGood = GOOD_QI_STAGE_LABELS.has(hourStage);
  const monthGood = GOOD_QI_STAGE_LABELS.has(monthStage);
  const hourBad = BAD_QI_STAGE_LABELS.has(hourStage);
  const monthBad = BAD_QI_STAGE_LABELS.has(monthStage);

  if (hourGood || monthGood) {
    return {
      label: "hourMonthStemZone",
      symbol: stages.join(","),
      weight: OPERATOR_GOOD_QI_BONUSES.hourMonthStemZone,
      source: "zone" as const,
    };
  }

  if (hourBad && monthBad) {
    return {
      label: "hourMonthStemZone",
      symbol: stages.join(","),
      weight: -OPERATOR_BAD_QI_PENALTIES.hourZone,
      source: "zone" as const,
    };
  }

  return null;
}

/** น้ำหนัก 得令 (月令) — เกิดตรงฤดูธาตุตัวเอง คือปัจจัยกำลังดิถีที่ตำราให้น้ำหนักสูงสุด */
const SEASONAL_COMMAND_SAME_SEASON_WEIGHT = 2;

/**
 * โบนัสฤดู 得令 (月令) — เพิ่มน้ำหนักเมื่อดิถีเกิดในฤดูของธาตุตัวเอง (เช่น ไฟเกิดหน้าร้อน 巳午)
 * เป็นโบนัสบวกล้วน ไม่ลงโทษ เพื่อไม่ให้ดวงอ่อนยิ่งอ่อนและคุม blast radius
 */
function resolveSeasonalCommand(
  dayMasterElement: SupportedElement,
  monthBranch: string,
): OperatorContribution | null {
  const seasonElement = BRANCH_TO_ELEMENT[monthBranch as keyof typeof BRANCH_TO_ELEMENT];
  if (seasonElement && seasonElement === dayMasterElement) {
    return {
      label: "seasonalCommand",
      symbol: monthBranch,
      weight: SEASONAL_COMMAND_SAME_SEASON_WEIGHT,
      source: "zone",
    };
  }
  return null;
}

/**
 * โบนัสราก 得地 (通根) — นับ hidden stems ในกิ่งทั้ง 4 เสาที่เป็นธาตุดิถี (比劫根) หรือธาตุส่งเสริม (印根)
 * ถ่วงตามตำแหน่ง 本气/中气/余气 — ปิดเสาที่ 3 ของกำลังดิถี (得令/得势 มีแล้ว)
 */
const ROOT_WEIGHT_BY_POSITION = [0.3, 0.15, 0.1] as const; // 本气, 中气, 余气

function resolveRootContributions(
  dayMasterElement: SupportedElement,
  pillars: CalculatedStateValue["fourPillars"],
): OperatorContribution[] {
  const resourceElement = (Object.keys(GENERATES) as SupportedElement[]).find(
    (element) => GENERATES[element] === dayMasterElement,
  );
  const out: OperatorContribution[] = [];
  for (const key of ["year", "month", "day", "hour"] as const) {
    const branch = pillars[key].branch;
    const hidden = BRANCH_HIDDEN_STEMS[branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];
    hidden.forEach((stem, index) => {
      const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
      // 比劫根 (พ้องธาตุดิถี) ได้เต็มน้ำหนัก, 印根 (ธาตุส่งเสริม) ได้ครึ่งหนึ่ง
      const factor = element === dayMasterElement ? 1 : element === resourceElement ? 0.5 : 0;
      if (factor === 0) {
        return;
      }
      const positionWeight = ROOT_WEIGHT_BY_POSITION[index] ?? 0.1;
      out.push({
        label: `root:${key}`,
        symbol: `${branch}(${stem})`,
        weight: Number((positionWeight * factor).toFixed(3)),
        source: "branch",
      });
    });
  }
  return out;
}

/**
 * โบนัสครอบงำ 从强 (得势 ขั้นสุด) — เมื่อธาตุพวกพ้อง (比劫) + ธาตุอุปถัมภ์ (印) ครอบงำผัง
 * จนเกือบไร้ธาตุถ่ายเท/ข่ม (食傷財官) ดิถีย่อมยกจาก "แข็ง" → "แข็งมาก" ตามตำรา
 * นับหน่วยธาตุจากราศีบนทั้ง 4 + ราศีล่างชั้น本气 ทั้ง 4 (รวม 8 หน่วย) แล้ววัดสัดส่วนฝ่ายหนุน
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

  const hiddenContributions = resolveRootContributions(dayMasterElement, pillars);
  for (const contribution of hiddenContributions) {
    score += contribution.weight;
  }

  const qiAdjustments = [
    resolveSeasonalCommand(dayMasterElement, pillars.month.branch),
    resolveDayMonthZoneAdjustment([stages.day, stages.month]),
    resolveHourMonthZoneAdjustment([stages.hour, stages.month]),
    resolveZoneAdjustment(
      "yearZone",
      [stages.year],
      OPERATOR_GOOD_QI_BONUSES.yearZone,
      OPERATOR_BAD_QI_PENALTIES.yearZone,
    ),
  ].filter(isOperatorContribution) as OperatorContribution[];

  for (const adjustment of qiAdjustments) {
    score += adjustment.weight;
  }

  const relationAdjustments = [
    hasActiveClash(interactionResolution, pillars.month.branch, pillars.day.branch)
      ? {
          label: "monthBranchVsDayBranchConflict",
          symbol: `${pillars.month.branch}${pillars.day.branch}`,
          weight: -OPERATOR_RELATION_PENALTIES.monthBranchVsDayBranchConflict,
          source: "relation" as const,
        }
      : null,
    hasActiveClash(interactionResolution, pillars.day.branch, pillars.hour.branch)
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

  // 从强 dominance: คิดจากฐานคะแนนหลังรวมทุกปัจจัย แล้วยก band แข็ง → แข็งมาก
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

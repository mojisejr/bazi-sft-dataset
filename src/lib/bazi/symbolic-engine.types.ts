import type {
  CalculatedStateValue,
  ContextRuleNoteValue,
  GeneralizedElementInteractionTypeValue,
  GeneralizedInteractionDayMasterEffectValue,
  GeneralizedInteractionEntityTypeValue,
  GeneralizedInteractionFamilyKeyValue,
  GeneralizedInteractionOutcomeStatusValue,
  GeneralizedInteractionPrecedenceLevelValue,
  GeneralizedInteractionQualifierKeyValue,
  GeneralizedInteractionQualifierLaneValue,
  InteractionEntityValue,
  InteractionOutcomeValue,
  InteractionQualifierValue,
  InteractionRelationValue,
  InteractionStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

export type MatrixDomain = "love" | "work";

export type SupportedElement = "wood" | "fire" | "earth" | "metal" | "water";

export type JieQiSolarLike = {
  toYmdHms(): string;
};

export type EightCharLike = {
  getYear(): string;
  getMonth(): string;
  getDay(): string;
  getTime(): string;
  getMingGong(): string;
  getYearHideGan(): string[] | string;
  getMonthHideGan(): string[] | string;
  getDayHideGan(): string[] | string;
  getTimeHideGan(): string[] | string;
  getYearShiShenGan(): string;
  getMonthShiShenGan(): string;
  getDayShiShenGan(): string;
  getTimeShiShenGan(): string;
  getYearShiShenZhi(): string[] | string;
  getMonthShiShenZhi(): string[] | string;
  getDayShiShenZhi(): string[] | string;
  getTimeShiShenZhi(): string[] | string;
  getYearDiShi(): string;
  getMonthDiShi(): string;
  getDayDiShi(): string;
  getTimeDiShi(): string;
  getYun(gender: number, sect?: number): YunLike;
};

export type LiuNianLike = {
  getYear(): number;
  getAge(): number;
  getGanZhi(): string;
};

export type DaYunLike = {
  getIndex(): number;
  getStartAge(): number;
  getEndAge(): number;
  getGanZhi(): string;
  getLiuNian(count?: number): LiuNianLike[];
};

export type YunLike = {
  getStartYear(): number;
  getStartMonth(): number;
  getStartDay(): number;
  getDaYun(count?: number): DaYunLike[];
};

export type SolarInstance = {
  getLunar(): {
    getEightChar(): EightCharLike;
  };
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
};

export type SolarConstructor = {
  fromYmdHms(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): SolarInstance;
};

export type LunarConstructor = {
  fromYmdHms(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
  ): {
    getSolar(): SolarInstance;
  };
};

export type PillarKey = keyof CalculatedStateValue["fourPillars"];

export type PairInteraction = {
  leftPillar: PillarKey;
  rightPillar: PillarKey;
  leftBranch: string;
  rightBranch: string;
  label: string;
};

export type MultiBranchInteraction = {
  pillars: PillarKey[];
  branches: string[];
  label: string;
};

export type InteractionTier = "primary" | "secondary" | "tertiary";

export type GeneralizedInteractionEntityType =
  GeneralizedInteractionEntityTypeValue;

export type GeneralizedInteractionFamilyKey =
  GeneralizedInteractionFamilyKeyValue;

export type GeneralizedElementInteractionType =
  GeneralizedElementInteractionTypeValue;

export type GeneralizedInteractionOutcomeStatus =
  GeneralizedInteractionOutcomeStatusValue;

export type GeneralizedInteractionDayMasterEffect =
  GeneralizedInteractionDayMasterEffectValue;

export type GeneralizedInteractionPrecedenceLevel =
  GeneralizedInteractionPrecedenceLevelValue;

export type GeneralizedInteractionQualifierLane =
  GeneralizedInteractionQualifierLaneValue;

export type GeneralizedInteractionQualifierKey =
  GeneralizedInteractionQualifierKeyValue;

export type InteractionEntity = InteractionEntityValue;

export type InteractionRelation = InteractionRelationValue;

export type InteractionOutcome = InteractionOutcomeValue;

export type InteractionQualifier = InteractionQualifierValue;

export type GeneralizedInteractionState = InteractionStateValue;

export type BranchInteractionResolution = {
  activeCombinations: string[];
  neutralizedClashes: string[];
  activeClashes: string[];
  activePunishments: string[];
  activeHarms: string[];
  activeDestructions: string[];
  intraPillarDestructions: string[];
  monthBranchSeasonalFactor: number;
  precedenceNotes: string[];
  precedenceSignals: ContextRuleNoteValue[];
  interactionTiers: Record<string, InteractionTier>;
  interactionState?: GeneralizedInteractionState;
};

export type ReferencePillar = {
  label: string;
  pillar: Pick<PillarValue, "stem" | "branch">;
};

export type StrengthStageSnapshot = {
  year: string;
  month: string;
  day: string;
  hour: string;
};

export type StrengthContribution = {
  label: string;
  stem: string;
  hidden: boolean;
  weight: number;
};

export type StrengthScoreBreakdown = {
  score: number;
  stageContribution: number;
  visibleContributions: StrengthContribution[];
  hiddenContributions: StrengthContribution[];
  penalties: {
    clashes: number;
    punishments: number;
    harms: number;
    destructions: number;
  };
};

export type SolarTermBoundaryRecord = {
  label: string;
  solarTermName: string | null;
  boundaryAt: string | null;
};

export type SolarTermBoundaryContext = {
  previous: SolarTermBoundaryRecord | null;
  next: SolarTermBoundaryRecord | null;
};

export type SixtyJiaziPersonaRecord = {
  dayMasterChinese: string;
  branchChinese: string;
  elementTone: string | null;
  twelveQiLabel: string | null;
  dayMasterNarrative: string | null;
  branchNarrative: string | null;
  combinedNarrative: string | null;
};

export type DayMasterStrengthProfileRecord = {
  dayMaster: string;
  strengthState: string;
  sourceState: string | null;
  lookupState: string;
  narrative: string;
  qiLabel: string | null;
  scoreText: string | null;
};

export type DomainMatrixRecord = {
  domain: MatrixDomain;
  sourceVariant: string;
  pairKey: string | null;
  rowOrder: number;
  code: string | null;
  label: string | null;
  scoreText: string | null;
  narrative: string | null;
  rawCells: string[];
};

export type BaziKnowledgeRepository = {
  findSolarTermBoundaryContext(birthAtHongKong: string): Promise<SolarTermBoundaryContext>;
  findDayMasterStrengthProfile(dayMasterChinese: string, strengthState: string, strengthScore?: number): Promise<DayMasterStrengthProfileRecord | null>;
  findSixtyJiaziPersona(dayMasterChinese: string, branchChinese: string): Promise<SixtyJiaziPersonaRecord | null>;
  findDomainMatrixRows(domain: MatrixDomain): Promise<DomainMatrixRecord[]>;
};

export type NormalizedBirthContext = {
  solar: SolarInstance;
  birthAtHongKong: string;
};

export type MingGongMonthAdjustment = {
  monthBranch: string;
  adjustedMonthBranch: string;
  zhongQiName: string | null;
  boundaryAt: string | null;
  isPastZhongQi: boolean;
};

export type BaziStructuralState = Pick<CalculatedStateValue, "fourPillars" | "dayMaster">;

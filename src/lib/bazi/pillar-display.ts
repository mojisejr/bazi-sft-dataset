import {
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  CONTROLS,
  ELEMENT_LABELS_TH,
  GENERATES,
  STEM_TO_ELEMENT,
  TWELVE_QI_LABELS_TH,
} from "@/lib/bazi/symbolic-engine.constants";

const STEM_ORDER = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCH_ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const TWELVE_QI_ORDER = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"] as const;
const TWELVE_QI_OFFSETS = {
  甲: 1,
  乙: 6,
  丙: 10,
  丁: 9,
  戊: 10,
  己: 9,
  庚: 7,
  辛: 0,
  壬: 4,
  癸: 3,
} as const;

/** เสียงอ่านแต้จิ๋วของราศีบน (ตัวหลักที่ซินแสใช้เรียก) */
const STEM_NAME_TH: Record<string, string> = {
  甲: "เจี่ย",
  乙: "อิก",
  丙: "เปี้ย",
  丁: "เต็ง",
  戊: "โบ่ว",
  己: "กี้",
  庚: "แก",
  辛: "ซิง",
  壬: "ยิ่ม",
  癸: "กุ่ย",
};

/**
 * คำอ่านไทยของกะจื่อ 1 ตัว (เช่น "甲子") — ใช้กำกับคีย์ในหน้าแอดมิน NewData
 * คืน "บน 甲 เจี่ย (ไม้หยาง) · ล่าง 子 ชวด (น้ำ)" หรือ null ถ้าไม่ใช่กะจื่อ
 */
export function ganzhiThaiLabel(ganzhi: string): string | null {
  const chars = [...ganzhi.normalize("NFC")];
  if (chars.length !== 2) return null;
  const [stem, branch] = chars as [string, string];
  const stemName = STEM_NAME_TH[stem];
  const branchName = BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH];
  if (!stemName || !branchName) return null;
  const stemEl = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
  const branchEl = BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];
  const stemElTh = stemEl ? ELEMENT_LABELS_TH[stemEl] : "";
  const branchElTh = branchEl ? ELEMENT_LABELS_TH[branchEl] : "";
  const polarity = YANG_STEMS.has(stem) ? "หยาง" : "ยิน";
  return `บน ${stem} ${stemName} (${stemElTh}${polarity}) · ล่าง ${branch} ${branchName} (${branchElTh})`;
}

export function getStemElementTranslation(stem: string) {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  return element ? ELEMENT_LABELS_TH[element] : null;
}

export function getBranchTranslation(branch: string) {
  return BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH] ?? null;
}

export function localizeTwelveQiLabel(stage: string) {
  return TWELVE_QI_LABELS_TH[stage as keyof typeof TWELVE_QI_LABELS_TH] ?? stage;
}

export function resolveCanonicalTwelveQiStage(stem: string, branch: string) {
  const stemIndex = STEM_ORDER.indexOf(stem as (typeof STEM_ORDER)[number]);
  const branchIndex = BRANCH_ORDER.indexOf(branch as (typeof BRANCH_ORDER)[number]);
  const offset = TWELVE_QI_OFFSETS[stem as keyof typeof TWELVE_QI_OFFSETS];

  if (stemIndex < 0 || branchIndex < 0 || offset === undefined) {
    return "";
  }

  const rawIndex = YANG_STEMS.has(stem)
    ? offset + branchIndex
    : offset - branchIndex;
  const stageIndex = ((rawIndex % 12) + 12) % 12;

  return TWELVE_QI_ORDER[stageIndex] ?? "";
}

export function resolveDisplayTwelveQiStage(stem: string, branch: string) {
  return localizeTwelveQiLabel(resolveCanonicalTwelveQiStage(stem, branch));
}

export function resolveStemReferenceBranch(targetStem: string) {
  return BRANCH_ORDER.find((branch) => resolveCanonicalTwelveQiStage(targetStem, branch) === "长生") ?? "";
}

export function resolveCanonicalStemPairStage(dayMasterStem: string, targetStem: string) {
  const referenceBranch = resolveStemReferenceBranch(targetStem);

  if (!referenceBranch) {
    return "";
  }

  return resolveCanonicalTwelveQiStage(dayMasterStem, referenceBranch);
}

export function resolveDisplayStemPairStage(dayMasterStem: string, targetStem: string) {
  return localizeTwelveQiLabel(resolveCanonicalStemPairStage(dayMasterStem, targetStem));
}

export function formatStagePair(primary?: string, context?: string) {
  if (primary && context) {
    return `${primary}/${context}`;
  }

  return primary ?? context ?? "";
}

export function resolveTenGodForStem(dayMasterStem: string, targetStem: string) {
  const dayMasterElement = STEM_TO_ELEMENT[dayMasterStem as keyof typeof STEM_TO_ELEMENT];
  const targetElement = STEM_TO_ELEMENT[targetStem as keyof typeof STEM_TO_ELEMENT];

  if (!dayMasterElement || !targetElement) {
    return "";
  }

  const samePolarity = YANG_STEMS.has(dayMasterStem) === YANG_STEMS.has(targetStem);

  if (dayMasterElement === targetElement) {
    return samePolarity ? "比肩" : "劫财";
  }

  if (GENERATES[dayMasterElement] === targetElement) {
    return samePolarity ? "食神" : "伤官";
  }

  if (CONTROLS[dayMasterElement] === targetElement) {
    return samePolarity ? "偏财" : "正财";
  }

  if (GENERATES[targetElement] === dayMasterElement) {
    return samePolarity ? "偏印" : "正印";
  }

  if (CONTROLS[targetElement] === dayMasterElement) {
    return samePolarity ? "七杀" : "正官";
  }

  return "";
}

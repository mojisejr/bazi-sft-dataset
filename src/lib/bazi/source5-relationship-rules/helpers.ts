import {
  localizeTwelveQiLabel,
  resolveCanonicalTwelveQiStage,
} from "@/lib/bazi/pillar-display";
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  CONTROLS,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type { BaziCallerContract } from "@/lib/bazi/symbolic-engine.caller-contract";
import type { BaziSharedPacket } from "@/lib/bazi/symbolic-engine.shared-packets";

import {
  CANONICAL_TWELVE_QI_ORDER,
  FAVORABLE_CHEINGSAE_ORDERS,
  RELATIONSHIP_CHEINGSAE_MEANINGS,
} from "@/lib/bazi/source5-relationship-rules/constants";
import type {
  Source5CheingsaeStage,
  Source5ConflictConsequence,
  Source5Element,
  Source5Pillar,
  Source5PillarKey,
  Source5RelationshipRole,
} from "@/lib/bazi/source5-relationship-rules/schemas";

export function findPacket<F extends BaziSharedPacket["family"]>(
  packets: readonly BaziSharedPacket[],
  family: F,
): Extract<BaziSharedPacket, { family: F }> {
  const packet = packets.find(
    (candidate): candidate is Extract<BaziSharedPacket, { family: F }> => candidate.family === family,
  );

  if (!packet) {
    throw new Error(`Source 5 rules are missing required packet family: ${family}`);
  }

  return packet;
}

export function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

export function getElementFromStem(stem: string): Source5Element {
  const element = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 5 stem element lookup: ${stem}`);
  }

  return element;
}

export function getElementFromBranch(branch: string): Source5Element {
  const element = BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT];

  if (!element) {
    throw new Error(`Unsupported Source 5 branch element lookup: ${branch}`);
  }

  return element;
}

function invertMapLookup(
  map: Record<Source5Element, Source5Element>,
  target: Source5Element,
): Source5Element {
  const entry = Object.entries(map).find(([, value]) => value === target);

  if (!entry) {
    throw new Error(`Unsupported Source 5 inverse map lookup: ${target}`);
  }

  return entry[0] as Source5Element;
}

export function resolveReactionLane(dayMasterElement: Source5Element, spouseBaseElement: Source5Element) {
  if (dayMasterElement === spouseBaseElement) {
    return "parallel" as const;
  }

  if (GENERATES[dayMasterElement] === spouseBaseElement) {
    return "output" as const;
  }

  if (GENERATES[spouseBaseElement] === dayMasterElement) {
    return "resource" as const;
  }

  if (CONTROLS[dayMasterElement] === spouseBaseElement) {
    return "wealth" as const;
  }

  if (CONTROLS[spouseBaseElement] === dayMasterElement) {
    return "power" as const;
  }

  throw new Error(`Unsupported Source 5 reaction lane: ${dayMasterElement} -> ${spouseBaseElement}`);
}

export function getTargetRoleForSpouse(gender: string) {
  return gender === "female" ? "power" as const : "wealth" as const;
}

export function getTargetElementForRole(dayMasterElement: Source5Element, role: Source5RelationshipRole) {
  if (role === "parallel") {
    return dayMasterElement;
  }

  if (role === "output") {
    return GENERATES[dayMasterElement];
  }

  if (role === "wealth") {
    return CONTROLS[dayMasterElement];
  }

  if (role === "resource") {
    return invertMapLookup(GENERATES, dayMasterElement);
  }

  return invertMapLookup(CONTROLS, dayMasterElement);
}

export function getStemSymbolsForElement(element: Source5Element) {
  return Object.entries(STEM_TO_ELEMENT)
    .filter(([, value]) => value === element)
    .map(([stem]) => stem);
}

export function getBranchSymbolsForElement(element: Source5Element) {
  return Object.entries(BRANCH_TO_ELEMENT)
    .filter(([, value]) => value === element)
    .map(([branch]) => branch);
}

export function getChartPillars(contract: BaziCallerContract) {
  return Object.entries(contract.sharedPacketSpine.chartIdentity.fourPillars) as Array<[Source5PillarKey, Source5Pillar]>;
}

export function buildPillarCode(pillar: Source5Pillar) {
  return `${pillar.stem}${pillar.branch}`;
}

export function buildVisibleMatches(
  pillars: Array<[Source5PillarKey, Source5Pillar]>,
  key: "stem" | "branch",
  symbols: readonly string[],
) {
  return pillars.flatMap(([pillarKey, pillar]) => (
    symbols.includes(pillar[key])
      ? [{ pillarKey, symbol: pillar[key], pillarCode: buildPillarCode(pillar) }]
      : []
  ));
}

export function buildHiddenStemMatches(
  pillars: Array<[Source5PillarKey, Source5Pillar]>,
  symbols: readonly string[],
) {
  return pillars.flatMap(([pillarKey, pillar]) => {
    const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];

    return hiddenStems.flatMap((hiddenStem) => (
      symbols.includes(hiddenStem)
        ? [{ pillarKey, branch: pillar.branch, hiddenStem, pillarCode: buildPillarCode(pillar) }]
        : []
    ));
  });
}

export function lookupCheingsaeStage(dayMaster: string, branch: string): Source5CheingsaeStage {
  const stageNameChinese = resolveCanonicalTwelveQiStage(dayMaster, branch);

  if (!stageNameChinese) {
    throw new Error(`Missing canonical Source 5 cheingsae row for ${dayMaster}/${branch}`);
  }

  const stageOrder = CANONICAL_TWELVE_QI_ORDER.indexOf(
    stageNameChinese as (typeof CANONICAL_TWELVE_QI_ORDER)[number],
  ) + 1;

  if (stageOrder <= 0) {
    throw new Error(`Unsupported canonical Source 5 cheingsae stage for ${dayMaster}/${branch}: ${stageNameChinese}`);
  }

  return {
    source: "pillar-display.resolveCanonicalTwelveQiStage",
    branch,
    branchLabel: BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH] ?? branch,
    stageOrder,
    stageNameChinese,
    stageNameThai: localizeTwelveQiLabel(stageNameChinese),
    meaning: RELATIONSHIP_CHEINGSAE_MEANINGS[stageOrder as keyof typeof RELATIONSHIP_CHEINGSAE_MEANINGS],
    qualityBand: FAVORABLE_CHEINGSAE_ORDERS.has(stageOrder) ? "favorable" : "challenging",
  };
}

export function summarizeQualityBand(stages: Source5CheingsaeStage[]) {
  const favorableCount = stages.filter((stage) => stage.qualityBand === "favorable").length;

  if (favorableCount === stages.length) {
    return "favorable" as const;
  }

  if (favorableCount === 0) {
    return "challenging" as const;
  }

  return "mixed" as const;
}

export function categorizeConflictFamily(familyKey: string) {
  if (familyKey.includes("punishment")) {
    return "punishment" as const;
  }

  if (familyKey.includes("clash")) {
    return "clash" as const;
  }

  if (familyKey.includes("destruction")) {
    return "destruction" as const;
  }

  if (familyKey.includes("harm")) {
    return "harm" as const;
  }

  if (familyKey.includes("he") || familyKey.includes("san-he") || familyKey.includes("san-hui")) {
    return "combination" as const;
  }

  return "other" as const;
}

export function getAudienceLabels(
  relationType: Source5ConflictConsequence["relationType"],
  pillarKey: Source5PillarKey,
) {
  const audienceMap = {
    punishment: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า/สังคม"],
      month: ["แม่", "ครอบครัว", "ธุรกิจครอบครัว"],
      day: ["ตัวเจ้าชะตา", "ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    clash: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า/สังคม"],
      month: ["แม่", "ครอบครัว", "ที่ทำงาน"],
      day: ["ตัวเจ้าชะตา", "ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    destruction: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า/สังคม"],
      month: ["พ่อ", "เจ้านาย", "ธุรกิจ"],
      day: ["ตัวเจ้าชะตา", "ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    combination: {
      year: ["ปู่ย่า/ตายาย", "ลูกค้า"],
      month: ["แม่", "ครอบครัว", "ธุรกิจ"],
      day: ["ตัวเจ้าชะตา", "คู่ครอง"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    harm: {
      year: ["ญาติผู้ใหญ่", "สังคม"],
      month: ["ครอบครัว", "งาน"],
      day: ["ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
    other: {
      year: ["ญาติผู้ใหญ่", "สังคม"],
      month: ["ครอบครัว", "งาน"],
      day: ["ชีวิตคู่"],
      hour: ["ลูกหลาน", "บริวาร"],
    },
  } as const;

  return audienceMap[relationType][pillarKey];
}

export function buildConflictMeaning(
  relationType: Source5ConflictConsequence["relationType"],
  affectedPillars: Source5PillarKey[],
) {
  if (relationType === "punishment" && affectedPillars.includes("month") && affectedPillars.includes("hour")) {
    return {
      consequenceKey: "punishment-month-hour-no-spouse-risk",
      meaning: "ฐานคู่เฮ้งเดือนและยามพร้อมกัน เป็นสัญญาณว่ามีคู่ยากหรือความสัมพันธ์อยู่ยาก",
    };
  }

  if (relationType === "destruction" && affectedPillars.length === 1 && affectedPillars[0] === "day") {
    return {
      consequenceKey: "day-internal-destruction",
      meaning: "ราศีบนวันผั่วราศีล่างวัน ชีวิตคู่มีรอยร้าว ทะเลาะง่าย หรือมีระยะห่างแรง",
    };
  }

  const leadPillar = affectedPillars[0] ?? "day";

  if (relationType === "combination") {
    return {
      consequenceKey: `combination-${leadPillar}`,
      meaning: "ฐานคู่เกิดภาคีหรือการร่วมมือกับอีกหลักหนึ่ง ความสัมพันธ์จึงผูกกับเครือข่ายคนกลุ่มนั้นชัดเจน",
    };
  }

  if (relationType === "clash") {
    return {
      consequenceKey: `clash-${leadPillar}`,
      meaning: "ฐานคู่เจอแรงปะทะ ทำให้ความสัมพันธ์มีการเปลี่ยนแปลงหรือเสียดสีตามคน/บริบทที่เกี่ยวข้อง",
    };
  }

  if (relationType === "punishment") {
    return {
      consequenceKey: `punishment-${leadPillar}`,
      meaning: "ฐานคู่เจอเฮ้ง เป็นแรงอึดอัดเงียบ ๆ ที่ค่อย ๆ กดความสัมพันธ์ในบริบทนี้",
    };
  }

  if (relationType === "harm") {
    return {
      consequenceKey: `harm-${leadPillar}`,
      meaning: "มีแรงบาดลึกเชิงความรู้สึกหรือความคาดหวังแทรกในความสัมพันธ์",
    };
  }

  return {
    consequenceKey: `destruction-${leadPillar}`,
    meaning: "มีแรงผั่วหรือแรงแตกหักที่ทำให้ความสัมพันธ์เปราะและมีรอยร้าวสะสม",
  };
}

export function dedupeWindowAssessments<T extends { pillarCode: string; startAge: number; endAge: number }>(values: T[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.pillarCode}|${value.startAge}|${value.endAge}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
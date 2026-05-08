import type {
  BaseChartDetailItemValue,
  BaseChartReadingValue,
  BaseChartReactionBadgeValue,
  ContextRuleNoteValue,
  InteractionTierValue,
  InteractionOutcomeValue,
  InteractionRelationValue,
  PillarValue,
  ShenShaValue,
} from "@/lib/bazi/schema-types";

import {
  CLASH_PAIRS,
  DESTRUCTION_PAIRS,
  HARM_PAIRS,
  BRANCH_HIDDEN_STEMS,
  BRANCH_LABELS_TH,
  PUNISHMENT_PAIR_KEYS,
  PUNISHMENT_TRIOS,
  SELF_PUNISHMENT_BRANCHES,
  SIX_COMBINATION_PAIRS,
  STEM_BRANCH_DESTRUCTION_PAIRS,
  STEM_CLASH_PAIRS,
  STEM_COMBINATION_TRANSFORMS,
  BRANCH_COMBINATION_TRANSFORMS,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";
import type { BranchInteractionResolution, GeneralizedInteractionState } from "@/lib/bazi/symbolic-engine.types";
import { renderContextRuleNoteThai } from "@/lib/bazi/context-dictionary";
import { getStemElementTranslation, resolveTenGodForStem } from "@/lib/bazi/pillar-display";

type BaseChartPillarKey = "year" | "month" | "day" | "hour";

type BaseChartPillars = Record<BaseChartPillarKey, PillarValue>;

type InteractionKind = "combination" | "clash" | "harm" | "destruction" | "punishment";

type PairRecord = {
  leftKey: BaseChartPillarKey;
  rightKey: BaseChartPillarKey;
  leftPillar: PillarValue;
  rightPillar: PillarValue;
  label: string;
};

type MultiRecord = {
  kind: InteractionKind;
  keys: BaseChartPillarKey[];
  pillars: PillarValue[];
  branches: string[];
  label: string;
};

const PILLAR_LABELS: Record<BaseChartPillarKey, string> = {
  year: "ปี",
  month: "เดือน",
  day: "วัน",
  hour: "ยาม",
};

const TEN_GOD_SCHOOL_LABELS: Record<string, string> = {
  比肩: "ปี่เกียง",
  劫财: "เกี๊ยบไช้",
  食神: "เจี้ยซิ้ง",
  伤官: "เซียกัว",
  偏财: "เพียงไช้",
  正财: "เจี้ยไช้",
  偏印: "เพียงอิ่ง",
  正印: "เจี้ยอิ่ง",
  七杀: "ชิกสัวะ",
  正官: "เจี้ยกัว",
};

const TEN_GOD_MEANING_SHORT: Record<string, string> = {
  比肩: "พวกเดียวกัน การช่วยเหลือและการแย่งแรงกันของคนระดับเดียวกัน",
  劫财: "คู่ธาตุต่างพลัง แรงแข่ง แรงแชร์ทรัพยากร และคู่แข่งใกล้ตัว",
  食神: "แรงถ่ายเท การแสดงออก ผลงาน การพูด และสิ่งที่เราปล่อยออกไป",
  伤官: "แรงถ่ายเทต่างพลัง ความคิดคม การแสดงออกแรง และแรงท้าทายกรอบ",
  偏财: "ลาภแบบพลิกเร็ว โอกาส เงินหมุน และผลประโยชน์ที่จับฉวย",
  正财: "ลาภที่เป็นระบบ การเงิน ทรัพย์ และผลประโยชน์ที่ต้องรักษา",
  偏印: "แรงหนุนเชิงเฉพาะทาง การคิด การศึกษา และแรงอุปถัมภ์แบบไม่ตรงเส้น",
  正印: "แรงหนุนตรง ผู้ใหญ่ ครู อุปถัมภ์ และความชอบธรรม",
  七杀: "แรงกด แรงเสี่ยง และอำนาจกดดันที่ต้องรับมืออย่างมีวินัย",
  正官: "หน้าที่ ระเบียบ กติกา ตำแหน่ง และความรับผิดชอบที่ต้องถือไว้",
};

const INTERACTION_META: Record<InteractionKind, { title: string; meaning: string; priority: "primary" | "secondary" }> = {
  combination: {
    title: "ภาคี",
    meaning: "คู่ที่ดึงเข้าหากัน มีแรงร่วมมือ และบางกรณีส่งผลให้สภาพธาตุเปลี่ยนหรือเบนแรงเดิม",
    priority: "primary",
  },
  clash: {
    title: "ชง",
    meaning: "แรงปะทะโดยตรง ทำให้เกิดการกระแทก เปลี่ยนแปลง เคลื่อนไหว หรือเสียสมดุลเดิม",
    priority: "primary",
  },
  harm: {
    title: "ไห่",
    meaning: "แรงให้ร้าย กล่าวหา หรือทำให้เสียหายเชิงความสัมพันธ์ เป็นสัญญาณรองถ้าไม่มีแรงที่สูงกว่า",
    priority: "secondary",
  },
  destruction: {
    title: "ผั่ว",
    meaning: "แรงทำให้รั่ว แตก หรือเสียหายในจุดที่สัมพันธ์กัน มักอ่านเป็นสัญญาณรองหรือตัวแทรก",
    priority: "secondary",
  },
  punishment: {
    title: "เฮ้ง",
    meaning: "แรงเบียดเบียน อึดอัด โต้เถียง หรือทำร้ายกันตามกฎของชุดราศีล่าง",
    priority: "secondary",
  },
};

function makeDetail(label: string, value: string): BaseChartDetailItemValue {
  return { label, value };
}

function resolveMarkerDoctrineKey(starName: string) {
  if (starName.includes("天乙") || starName.includes("ขุนนาง") || starName.includes("กุ้ยนั้ง")) {
    return { doctrineKey: "marker:nobleman", semanticKind: "marker-nobleman" as const };
  }

  if (starName.includes("文昌") || starName.includes("บุ่งเชียง") || starName.includes("วิชาการ")) {
    return { doctrineKey: "marker:wenchang", semanticKind: "marker-wenchang" as const };
  }

  return { doctrineKey: "marker:generic", semanticKind: "marker-generic" as const };
}

function buildPairRecords(pillars: BaseChartPillars, relationKeys: Set<string>) {
  const entries = Object.entries(pillars) as Array<[BaseChartPillarKey, PillarValue]>;
  const pairs: PairRecord[] = [];

  for (let leftIndex = 0; leftIndex < entries.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftKey, leftPillar] = entries[leftIndex];
      const [rightKey, rightPillar] = entries[rightIndex];
      const pairKey = normalizeBranchPairKey(leftPillar.branch, rightPillar.branch);

      if (!relationKeys.has(pairKey)) {
        continue;
      }

      pairs.push({
        leftKey,
        rightKey,
        leftPillar,
        rightPillar,
        label: pairKey.replace("|", ""),
      });
    }
  }

  return pairs;
}

function buildPunishmentRecords(pillars: BaseChartPillars) {
  const entries = Object.entries(pillars) as Array<[BaseChartPillarKey, PillarValue]>;
  const records: MultiRecord[] = [];

  for (const pair of buildPairRecords(pillars, PUNISHMENT_PAIR_KEYS)) {
    records.push({
      kind: "punishment",
      keys: [pair.leftKey, pair.rightKey],
      pillars: [pair.leftPillar, pair.rightPillar],
      branches: [pair.leftPillar.branch, pair.rightPillar.branch],
      label: pair.label,
    });
  }

  for (const trio of PUNISHMENT_TRIOS) {
    const trioSet = new Set<string>(trio);
    const matches = entries.filter(([, pillar]) => trioSet.has(pillar.branch));

    if (matches.length === trio.length) {
      records.push({
        kind: "punishment",
        keys: matches.map(([key]) => key),
        pillars: matches.map(([, pillar]) => pillar),
        branches: [...trio],
        label: trio.join(""),
      });
    }
  }

  for (const branch of SELF_PUNISHMENT_BRANCHES) {
    const matches = entries.filter(([, pillar]) => pillar.branch === branch);

    if (matches.length >= 2) {
      records.push({
        kind: "punishment",
        keys: matches.map(([key]) => key),
        pillars: matches.map(([, pillar]) => pillar),
        branches: matches.map(([, pillar]) => pillar.branch),
        label: `${branch}${branch}`,
      });
    }
  }

  return records;
}

function parsePrimaryBranchTenGod(dayMasterStem: string, pillar: PillarValue) {
  const primaryHiddenStem = pillar.hiddenStems?.[0] ?? BRANCH_HIDDEN_STEMS[pillar.branch as keyof typeof BRANCH_HIDDEN_STEMS]?.[0];

  if (!primaryHiddenStem) {
    return null;
  }

  const tenGod = resolveTenGodForStem(dayMasterStem, primaryHiddenStem);

  if (!tenGod) {
    return null;
  }

  return {
    hiddenStem: primaryHiddenStem,
    tenGod,
  };
}

function buildRoleBadge(dayMasterStem: string, pillarKey: BaseChartPillarKey, pillar: PillarValue, target: "stem" | "branch"): BaseChartReactionBadgeValue | null {
  if (target === "stem") {
    const tenGod = pillar.tenGod && pillar.tenGod !== "ดิถี"
      ? pillar.tenGod
      : resolveTenGodForStem(dayMasterStem, pillar.stem);

    if (!tenGod) {
      return null;
    }

    const schoolLabel = TEN_GOD_SCHOOL_LABELS[tenGod] ?? tenGod;
    const pillarLabel = PILLAR_LABELS[pillarKey];

    return {
      id: `${pillarKey}-stem-role`,
      family: "role",
      label: `${pillarLabel}บน · ${schoolLabel}`,
      shortLabel: schoolLabel,
      priority: pillarKey === "day" ? "primary" : "secondary",
      status: "active",
      meaningShort: TEN_GOD_MEANING_SHORT[tenGod] ?? "บทบาทของราศีบนนี้เมื่อเทียบกับดิถี",
      schoolLabel,
      doctrineKey: `ten-god:${tenGod}`,
      semanticKind: "role-stem",
      hierarchyLevel: "day-master",
      readingOrder: 2,
      participants: [{
        pillarKey,
        pillarLabel,
        type: "stem",
        symbol: pillar.stem,
        translation: pillar.stemTranslation ?? getStemElementTranslation(pillar.stem) ?? undefined,
      }],
      modal: {
        title: `${pillarLabel}บน · ${schoolLabel}`,
        family: "role",
        summary: `ราศีบนของ${pillarLabel}ทำหน้าที่แบบ ${schoolLabel} เมื่อเทียบกับดิถี`,
        explanation: TEN_GOD_MEANING_SHORT[tenGod] ?? "ใช้เพื่อบอกบทบาทของธาตุนี้ต่อดิถี",
        readingOrderHint: "อ่านชั้นบทบาทนี้หลังดู ribbon แล้ว ก่อนดูชง/ภาคี/เฮ้ง/ไห่/ผั่ว",
        details: [
          makeDetail("ราศีบน", pillar.stem),
          makeDetail("ฐาน", pillarLabel),
          makeDetail("จับซิ้ง", schoolLabel),
        ],
      },
    };
  }

  const branchRole = parsePrimaryBranchTenGod(dayMasterStem, pillar);

  if (!branchRole) {
    return null;
  }

  const schoolLabel = TEN_GOD_SCHOOL_LABELS[branchRole.tenGod] ?? branchRole.tenGod;
  const pillarLabel = PILLAR_LABELS[pillarKey];
  const branchTranslation = BRANCH_LABELS_TH[pillar.branch as keyof typeof BRANCH_LABELS_TH];

  return {
    id: `${pillarKey}-branch-role`,
    family: "role",
    label: `${pillarLabel}ล่าง · ${schoolLabel}`,
    shortLabel: schoolLabel,
    priority: "secondary",
    status: "active",
    meaningShort: `${TEN_GOD_MEANING_SHORT[branchRole.tenGod] ?? "บทบาทของราศีล่างนี้ต่อดิถี"} โดยอ่านผ่านราศีแฝงหลัก`,
    schoolLabel,
    doctrineKey: `ten-god:${branchRole.tenGod}`,
    semanticKind: "role-branch",
    hierarchyLevel: "day-master",
    readingOrder: 2,
    participants: [{
      pillarKey,
      pillarLabel,
      type: "branch",
      symbol: pillar.branch,
      translation: branchTranslation,
    }],
    modal: {
      title: `${pillarLabel}ล่าง · ${schoolLabel}`,
      family: "role",
      summary: `ราศีล่างของ${pillarLabel}ส่งบทบาท ${schoolLabel} เมื่อเทียบกับดิถี`,
      explanation: `${TEN_GOD_MEANING_SHORT[branchRole.tenGod] ?? "อ่านบทบาทของกิ่งนี้ผ่านดิถี"} โดยใช้ราศีแฝงหลัก ${branchRole.hiddenStem}`,
      readingOrderHint: "ใช้เพื่อเสริมความเข้าใจว่าฐานล่างของแต่ละเสากำลังเป็นแรงแบบไหนต่อดิถี",
      details: [
        makeDetail("ราศีล่าง", `${pillar.branch}${branchTranslation ? ` (${branchTranslation})` : ""}`),
        makeDetail("ราศีแฝงหลัก", branchRole.hiddenStem),
        makeDetail("จับซิ้ง", schoolLabel),
      ],
    },
  };
}

function buildStemInteractionBadges(pillars: BaseChartPillars) {
  const entries = Object.entries(pillars) as Array<[BaseChartPillarKey, PillarValue]>;
  const badges: BaseChartReactionBadgeValue[] = [];

  for (let leftIndex = 0; leftIndex < entries.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const [leftKey, leftPillar] = entries[leftIndex];
      const [rightKey, rightPillar] = entries[rightIndex];
      const key = normalizeBranchPairKey(leftPillar.stem, rightPillar.stem);
      const leftLabel = PILLAR_LABELS[leftKey];
      const rightLabel = PILLAR_LABELS[rightKey];

      if (STEM_COMBINATION_TRANSFORMS.has(key)) {
        const transformTo = STEM_COMBINATION_TRANSFORMS.get(key) ?? "-";
        badges.push({
          id: `stem-combo-${leftKey}-${rightKey}`,
          family: "interaction",
          label: `ฟ้าภาคี ${leftPillar.stem}${rightPillar.stem}`,
          shortLabel: `${leftPillar.stem}${rightPillar.stem}`,
          priority: "primary",
          status: "active",
          meaningShort: `ราศีบน ${leftLabel}/${rightLabel} จับคู่ภาคีกันและมีแนวโน้มดึงแรงไปทางธาตุ ${transformTo}`,
          schoolLabel: "ภาคีราศีบน",
          doctrineKey: "interaction:stem-combination",
          semanticKind: "stem-combination",
          hierarchyLevel: "interaction",
          readingOrder: 3,
          participants: [
            { pillarKey: leftKey, pillarLabel: leftLabel, type: "stem", symbol: leftPillar.stem, translation: leftPillar.stemTranslation },
            { pillarKey: rightKey, pillarLabel: rightLabel, type: "stem", symbol: rightPillar.stem, translation: rightPillar.stemTranslation },
          ],
          modal: {
            title: `ฟ้าภาคี ${leftPillar.stem}${rightPillar.stem}`,
            family: "interaction",
            summary: `ราศีบน ${leftLabel} กับ ${rightLabel} อยู่ในคู่ภาคี`,
            explanation: `คู่ภาคีราศีบนนี้เป็นแรงหลักของชั้นฟ้า และตามตำรามีแนวโน้มเบนแรงไปทางธาตุ ${transformTo} หากบริบทเอื้อ`,
            readingOrderHint: "อ่านหลังจากดูบทบาทต่อดิถี เพื่อดูว่าราศีบนแต่ละตัวมาร่วมมือหรือเปลี่ยนแรงกันอย่างไร",
            details: [
              makeDetail("คู่ราศีบน", `${leftPillar.stem} + ${rightPillar.stem}`),
              makeDetail("ฐานที่เกี่ยวข้อง", `${leftLabel}, ${rightLabel}`),
              makeDetail("ธาตุปลายทาง", transformTo),
            ],
          },
        });
      }

      if (STEM_CLASH_PAIRS.has(key)) {
        badges.push({
          id: `stem-clash-${leftKey}-${rightKey}`,
          family: "interaction",
          label: `ฟ้าพิฆาต ${leftPillar.stem}${rightPillar.stem}`,
          shortLabel: `${leftPillar.stem}${rightPillar.stem}`,
          priority: "primary",
          status: "active",
          meaningShort: `ราศีบน ${leftLabel}/${rightLabel} มีแรงพิฆาตกันโดยตรง เป็นแรงชั้นฟ้าที่ควรอ่านก่อนแรงรอง`,
          schoolLabel: "พิฆาตราศีบน",
          doctrineKey: "interaction:stem-clash",
          semanticKind: "stem-clash",
          hierarchyLevel: "interaction",
          readingOrder: 3,
          participants: [
            { pillarKey: leftKey, pillarLabel: leftLabel, type: "stem", symbol: leftPillar.stem, translation: leftPillar.stemTranslation },
            { pillarKey: rightKey, pillarLabel: rightLabel, type: "stem", symbol: rightPillar.stem, translation: rightPillar.stemTranslation },
          ],
          modal: {
            title: `ฟ้าพิฆาต ${leftPillar.stem}${rightPillar.stem}`,
            family: "interaction",
            summary: `ราศีบน ${leftLabel} กับ ${rightLabel} ทำร้ายกันโดยตรง`,
            explanation: "นี่คือแรงพิฆาตของชั้นฟ้า ใช้เพื่ออ่านการหักล้างหรือแรงกดที่เกิดขึ้นบนราศีบนของดวงกำเนิด",
            readingOrderHint: "อ่านในชั้น interaction หลังจากเข้าใจบทบาทของราศีบนแต่ละตัวต่อดิถีแล้ว",
            details: [
              makeDetail("คู่ราศีบน", `${leftPillar.stem} ↔ ${rightPillar.stem}`),
              makeDetail("ฐานที่เกี่ยวข้อง", `${leftLabel}, ${rightLabel}`),
            ],
          },
        });
      }
    }
  }

  return badges;
}

function buildOutcomeMap(interactionState?: GeneralizedInteractionState) {
  return new Map<string, InteractionOutcomeValue>(
    (interactionState?.outcomes ?? []).map((outcome) => [outcome.relationId, outcome]),
  );
}

function resolvePillarParticipants(
  pillars: BaseChartPillars,
  relation: InteractionRelationValue,
) : BaseChartReactionBadgeValue["participants"] {
  const participants: BaseChartReactionBadgeValue["participants"] = [];

  for (const entityId of relation.participantEntityIds) {
    const [, pillarKey] = entityId.split("-");
    const typedPillarKey = pillarKey as BaseChartPillarKey;
    const pillar = pillars[typedPillarKey];

    if (!pillar) {
      continue;
    }

    if (entityId.startsWith("stem-")) {
      participants.push({
        pillarKey: typedPillarKey,
        pillarLabel: PILLAR_LABELS[typedPillarKey],
        type: "stem" as const,
        symbol: pillar.stem,
        translation: pillar.stemTranslation,
      });
      continue;
    }

    if (entityId.startsWith("branch-")) {
      participants.push({
        pillarKey: typedPillarKey,
        pillarLabel: PILLAR_LABELS[typedPillarKey],
        type: "branch" as const,
        symbol: pillar.branch,
        translation: BRANCH_LABELS_TH[pillar.branch as keyof typeof BRANCH_LABELS_TH],
      });
    }

  }

  return participants;
}

function resolveInteractionPriority(outcome?: InteractionOutcomeValue): BaseChartReactionBadgeValue["priority"] {
  if (outcome?.status === "blocked") {
    return "neutralized";
  }

  return outcome?.precedence === "secondary" || outcome?.precedence === "tertiary"
    ? "secondary"
    : "primary";
}

function resolveInteractionStatus(outcome?: InteractionOutcomeValue): BaseChartReactionBadgeValue["status"] {
  return outcome?.status === "blocked" ? "neutralized" : "active";
}

function buildGeneralizedInteractionBadge(args: {
  relation: InteractionRelationValue;
  outcome?: InteractionOutcomeValue;
  pillars: BaseChartPillars;
}): BaseChartReactionBadgeValue | null {
  const { relation, outcome, pillars } = args;
  const participants = resolvePillarParticipants(pillars, relation);

  if (participants.length === 0) {
    return null;
  }

  const status = resolveInteractionStatus(outcome);
  const priority = resolveInteractionPriority(outcome);
  const tier = outcome?.precedence as InteractionTierValue | undefined;
  const transformElement = relation.transformElement;
  const transformText = transformElement ? ` → ${transformElement}` : "";
  const supportText = outcome?.supportReasons.length
    ? `เงื่อนไข: ${outcome.supportReasons.join(" · ")}`
    : "";
  const blockedText = outcome?.blockedByRelationIds.length
    ? `ถูกบังโดย ${outcome.blockedByRelationIds.join(" · ")}`
    : "";

  const metaByFamily: Partial<Record<InteractionRelationValue["familyKey"], {
    label: string;
    schoolLabel: string;
    semanticKind: BaseChartReactionBadgeValue["semanticKind"];
    summary: string;
  }>> = {
    "heavenly-stem-he": {
      label: `ฟ้าภาคี ${relation.label}`,
      schoolLabel: "ภาคีราศีบน",
      semanticKind: "stem-combination",
      summary: `ราศีบนในคู่ ${relation.label} เกิดภาคี${transformText}`,
    },
    "heavenly-stem-clash": {
      label: `ฟ้าพิฆาต ${relation.label}`,
      schoolLabel: "พิฆาตราศีบน",
      semanticKind: "stem-clash",
      summary: `ราศีบนในคู่ ${relation.label} ปะทะกันโดยตรง`,
    },
    "earthly-branch-liu-he": {
      label: `六合 ${relation.label}`,
      schoolLabel: "六合",
      semanticKind: "branch-liu-he",
      summary: `ราศีล่างในคู่ ${relation.label} เกิด六合`,
    },
    "earthly-branch-san-he": {
      label: `三合 ${relation.label}`,
      schoolLabel: "三合",
      semanticKind: "branch-san-he",
      summary: `ราศีล่างชุด ${relation.label} เกิดสามภาคี${transformText}`,
    },
    "earthly-branch-ban-san-he": {
      label: `半三合 ${relation.label}`,
      schoolLabel: "半三合",
      semanticKind: "branch-ban-san-he",
      summary: `ราศีล่างคู่ ${relation.label} เป็นครึ่งสามภาคี${transformText}`,
    },
    "element-generate": {
      label: `相生 ${relation.label}`,
      schoolLabel: "相生",
      semanticKind: "element-generate",
      summary: `คู่ธาตุ ${relation.label} ส่งเสริมกัน`,
    },
    "element-control": {
      label: `相克 ${relation.label}`,
      schoolLabel: "相克",
      semanticKind: "element-control",
      summary: `คู่ธาตุ ${relation.label} กดหรือคุมกัน`,
    },
  };

  const meta = metaByFamily[relation.familyKey];

  if (!meta) {
    return null;
  }

  const effectText = outcome?.dayMasterEffect
    ? `ผลต่อดิถี: ${outcome.dayMasterEffect}`
    : "";
  const explanation = [
    meta.summary,
    outcome?.status === "transformed" ? "ผลลัพธ์รอบนี้ผ่านเกณฑ์แปรสภาพแล้ว" : "",
    outcome?.status === "supported" ? "ผลลัพธ์รอบนี้มีแรงหนุนพอจะนับเป็น supported" : "",
    outcome?.status === "blocked" ? "ผลลัพธ์รอบนี้ถูก relation ที่แรงกว่าบังไว้" : "",
    supportText,
    blockedText,
    effectText,
  ].filter(Boolean).join(" ");

  return {
    id: relation.id,
    family: "interaction",
    label: meta.label,
    shortLabel: relation.label,
    priority,
    status,
    meaningShort: explanation || meta.summary,
    schoolLabel: meta.schoolLabel,
    doctrineKey: `interaction:${relation.familyKey}`,
    semanticKind: meta.semanticKind,
    hierarchyLevel: "interaction",
    readingOrder: relation.familyKey.startsWith("element-") ? 4 : 3,
    tier,
    sourceRelationId: relation.id,
    sourceFamilyKey: relation.familyKey,
    sourceOutcomeStatus: outcome?.status,
    participants,
    modal: {
      title: meta.label,
      family: "interaction",
      summary: meta.summary,
      explanation: explanation || meta.summary,
      readingOrderHint: relation.familyKey.startsWith("element-")
        ? "อ่าน lane ธาตุหลังดู family interaction เพื่อแยกแรงธาตุออกจาก school family"
        : "อ่าน family interaction นี้หลังบทบาทต่อดิถี และก่อนดู marker ประกอบ",
      details: [
        makeDetail("family", relation.familyKey),
        makeDetail("คู่/ชุด", relation.label),
        ...(outcome?.status ? [makeDetail("สถานะ outcome", outcome.status)] : []),
        ...(transformElement ? [makeDetail("ธาตุปลายทาง", transformElement)] : []),
        ...(outcome?.dayMasterEffect ? [makeDetail("ผลต่อดิถี", outcome.dayMasterEffect)] : []),
        ...(outcome?.supportReasons.length ? [makeDetail("เหตุผลหนุน", outcome.supportReasons.join(" · "))] : []),
        ...(outcome?.blockedByRelationIds.length ? [makeDetail("ถูกบังโดย", outcome.blockedByRelationIds.join(" · "))] : []),
      ],
    },
  };
}

function buildGeneralizedInteractionBadges(
  pillars: BaseChartPillars,
  interactionState?: GeneralizedInteractionState,
) {
  if (!interactionState) {
    return {
      stemBadges: [] as BaseChartReactionBadgeValue[],
      branchBadges: [] as BaseChartReactionBadgeValue[],
      elementalBadges: [] as BaseChartReactionBadgeValue[],
    };
  }

  const outcomeMap = buildOutcomeMap(interactionState);
  const stemBadges: BaseChartReactionBadgeValue[] = [];
  const branchBadges: BaseChartReactionBadgeValue[] = [];
  const elementalBadges: BaseChartReactionBadgeValue[] = [];

  for (const relation of interactionState.relations) {
    const badge = buildGeneralizedInteractionBadge({
      relation,
      outcome: outcomeMap.get(relation.id),
      pillars,
    });

    if (!badge) {
      continue;
    }

    if (relation.familyKey.startsWith("heavenly-stem")) {
      stemBadges.push(badge);
    } else if (relation.familyKey.startsWith("element-")) {
      elementalBadges.push(badge);
    } else {
      branchBadges.push(badge);
    }
  }

  return { stemBadges, branchBadges, elementalBadges };
}

function buildBranchInteractionBadges(
  pillars: BaseChartPillars,
  resolution: BranchInteractionResolution,
  precedenceSignals: ContextRuleNoteValue[],
  interactionState?: GeneralizedInteractionState,
) {
  const combinationPairs = buildPairRecords(pillars, SIX_COMBINATION_PAIRS);
  const clashPairs = buildPairRecords(pillars, CLASH_PAIRS);
  const harmPairs = buildPairRecords(pillars, HARM_PAIRS);
  const destructionPairs = buildPairRecords(pillars, DESTRUCTION_PAIRS);
  const punishmentRecords = buildPunishmentRecords(pillars);
  const neutralizedLabels = new Set(resolution.neutralizedClashes);
  const activeClashLabels = new Set(resolution.activeClashes);
  const activePunishmentLabels = new Set(resolution.activePunishments);
  const activeClashes = clashPairs.filter((pair) => activeClashLabels.has(pair.label));
  const neutralizedClashes = clashPairs.filter((pair) => neutralizedLabels.has(pair.label));
  const activePunishments = punishmentRecords.filter((record) => activePunishmentLabels.has(record.label));
  const combinationKeys = new Set(combinationPairs.flatMap((pair) => [pair.leftKey, pair.rightKey]));
  const activeClashKeys = new Set(activeClashes.flatMap((pair) => [pair.leftKey, pair.rightKey]));
  const generalizedBranchLabels = new Set(
    (interactionState?.relations ?? [])
      .filter((relation) => relation.familyKey === "earthly-branch-liu-he")
      .map((relation) => relation.label),
  );
  const badges: BaseChartReactionBadgeValue[] = [];

  const tierForKind = (kind: string, status: string): InteractionTierValue => {
    if (kind === "punishment") return "tertiary";
    if (status === "neutralized") return "secondary";
    if (kind === "combination") return "primary";
    if (kind === "clash" && status === "active") return "primary";
    return "secondary";
  };

  const pushPairBadge = (kind: Exclude<InteractionKind, "punishment">, pair: PairRecord, status: "active" | "supplementary" | "neutralized") => {
    
    const meta = INTERACTION_META[kind];
    const leftLabel = PILLAR_LABELS[pair.leftKey];
    const rightLabel = PILLAR_LABELS[pair.rightKey];
    const priority = status === "neutralized"
      ? "neutralized"
      : meta.priority;
    const note = precedenceSignals
      .map((signal) => renderContextRuleNoteThai(signal))
      .find((text) => text.includes(pair.label));

    let displayLabel = `${meta.title} ${pair.label}`;
    if (kind === "combination") {
      const pairKey = `${pair.leftPillar.branch}|${pair.rightPillar.branch}`;
      const transformEn = BRANCH_COMBINATION_TRANSFORMS.get(pairKey) ?? BRANCH_COMBINATION_TRANSFORMS.get(`${pair.rightPillar.branch}|${pair.leftPillar.branch}`);
      if (transformEn) {
        const transformTh = { water: "น้ำ", wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง" }[transformEn] ?? transformEn;
        displayLabel = `${meta.title} ${pair.label} (ฮะสำเร็จได้${transformTh})`;
      }
    }
badges.push({
      id: `${kind}-${pair.leftKey}-${pair.rightKey}`,
      family: "interaction",
      label: displayLabel,
      shortLabel: pair.label,
      priority,
      status,
      meaningShort: note ?? `${meta.meaning} เกิดขึ้นระหว่างฐาน ${leftLabel} และ ${rightLabel}`,
      schoolLabel: meta.title,
      doctrineKey: `interaction:branch-${kind}`,
      semanticKind: kind === "combination"
        ? "branch-combination"
        : kind === "clash"
          ? "branch-clash"
          : kind === "harm"
            ? "branch-harm"
            : "branch-destruction",
      hierarchyLevel: "interaction",
      readingOrder: 3,
      tier: tierForKind(kind, status),
      participants: [
        { pillarKey: pair.leftKey, pillarLabel: leftLabel, type: "branch", symbol: pair.leftPillar.branch, translation: BRANCH_LABELS_TH[pair.leftPillar.branch as keyof typeof BRANCH_LABELS_TH] },
        { pillarKey: pair.rightKey, pillarLabel: rightLabel, type: "branch", symbol: pair.rightPillar.branch, translation: BRANCH_LABELS_TH[pair.rightPillar.branch as keyof typeof BRANCH_LABELS_TH] },
      ],
      modal: {
        title: `${meta.title} ${pair.label}`,
        family: "interaction",
        summary: `${leftLabel} กับ ${rightLabel} เกิดปฏิกิริยาแบบ ${meta.title}`,
        explanation: note ?? meta.meaning,
        readingOrderHint: "อ่านชั้นนี้หลังดูบทบาทต่อดิถี เพื่อเข้าใจว่า node ในดวงกำลังกระทบกันเองอย่างไร",
        details: [
          makeDetail("คู่ราศีล่าง", `${pair.leftPillar.branch} ↔ ${pair.rightPillar.branch}`),
          makeDetail("ฐานที่เกี่ยวข้อง", `${leftLabel}, ${rightLabel}`),
          makeDetail("สถานะ", status === "neutralized" ? "ถูก neutralize ด้วยแรงที่สูงกว่า" : status === "supplementary" ? "แรงรอง" : "แรงหลัก"),
        ],
      },
    });
  };

  combinationPairs
    .filter((pair) => !generalizedBranchLabels.has(pair.label))
    .forEach((pair) => pushPairBadge("combination", pair, "active"));
  activeClashes.forEach((pair) => pushPairBadge("clash", pair, "active"));
  neutralizedClashes.forEach((pair) => pushPairBadge("clash", pair, "neutralized"));
  harmPairs.forEach((pair) => pushPairBadge("harm", pair, combinationKeys.has(pair.leftKey) || combinationKeys.has(pair.rightKey) || activeClashKeys.has(pair.leftKey) || activeClashKeys.has(pair.rightKey) ? "supplementary" : "active"));
  destructionPairs.forEach((pair) => pushPairBadge("destruction", pair, combinationKeys.has(pair.leftKey) || combinationKeys.has(pair.rightKey) || activeClashKeys.has(pair.leftKey) || activeClashKeys.has(pair.rightKey) ? "supplementary" : "active"));

  activePunishments.forEach((record) => {
    const bases = record.keys.map((key) => PILLAR_LABELS[key]).join(", ");

    badges.push({
      id: `punishment-${record.label}-${record.keys.join("-")}`,
      family: "interaction",
      label: `เฮ้ง ${record.label}`,
      shortLabel: record.label,
      priority: "secondary",
      status: "active",
      meaningShort: `ชุด ${record.label} เป็นแรงเฮ้งที่ยังทำงานอยู่ในฐาน ${bases}`,
      schoolLabel: "เฮ้ง",
      doctrineKey: record.keys.length >= 3
        ? "interaction:branch-punishment-trio"
        : record.keys.length === 2 && record.branches[0] === record.branches[1]
          ? "interaction:branch-punishment-self"
          : "interaction:branch-punishment-pair",
      semanticKind: record.keys.length >= 3
        ? "branch-punishment-trio"
        : record.keys.length === 2 && record.branches[0] === record.branches[1]
          ? "branch-punishment-self"
          : "branch-punishment-pair",
      hierarchyLevel: "interaction",
      readingOrder: 3,
      tier: "tertiary",
      participants: record.keys.map((key, index) => ({
        pillarKey: key,
        pillarLabel: PILLAR_LABELS[key],
        type: "branch" as const,
        symbol: record.branches[index] ?? pillars[key].branch,
        translation: BRANCH_LABELS_TH[(record.branches[index] ?? pillars[key].branch) as keyof typeof BRANCH_LABELS_TH],
      })),
      modal: {
        title: `เฮ้ง ${record.label}`,
        family: "interaction",
        summary: `ชุด ${record.label} สร้างแรงเฮ้งในดวงกำเนิด`,
        explanation: "อ่านเป็นแรงเบียดเบียน โต้เถียง อึดอัด หรือกดดันกันระหว่างฐานที่เข้าเงื่อนไขของเฮ้ง",
        readingOrderHint: "เฮ้งเป็นชั้นรองเมื่อเทียบกับฮะและชง แต่ควรเปิดดูเมื่อปฏิกิริยานี้ยัง active จริง",
        details: [
          makeDetail("ชุดราศีล่าง", record.branches.join(" · ")),
          makeDetail("ฐานที่เกี่ยวข้อง", bases),
          makeDetail("สถานะ", "แรงรองที่ยังทำงานอยู่"),
        ],
      },
    });
  });

  for (const [pillarKey, pillar] of Object.entries(pillars) as Array<[BaseChartPillarKey, PillarValue]>) {
    const key = `${pillar.stem}|${pillar.branch}`;

    if (STEM_BRANCH_DESTRUCTION_PAIRS.has(key)) {
      const pillarLabel = PILLAR_LABELS[pillarKey];
      const label = `${pillar.stem}${pillar.branch}`;

      badges.push({
        id: `intra-destruction-${pillarKey}`,
        family: "interaction",
        label: `ผั่ว ${label}`,
        shortLabel: label,
        priority: "secondary",
        status: "active",
        meaningShort: `ราศีบนผั่วราศีล่างในฐาน${pillarLabel} ทำให้เกิดความเสียหายในจุดนั้น`,
        schoolLabel: "ผั่ว",
        doctrineKey: "interaction:intra-pillar-destruction",
        semanticKind: "intra-pillar-destruction",
        hierarchyLevel: "interaction",
        readingOrder: 3,
        tier: "secondary",
        participants: [
          {
            pillarKey,
            pillarLabel,
            type: "stem",
            symbol: pillar.stem,
            translation: pillar.stemTranslation,
          },
          {
            pillarKey,
            pillarLabel,
            type: "branch",
            symbol: pillar.branch,
            translation: BRANCH_LABELS_TH[pillar.branch as keyof typeof BRANCH_LABELS_TH],
          },
        ],
        modal: {
          title: `ผั่ว ${label}`,
          family: "interaction",
          summary: `ราศีบน${pillar.stem} ผั่วราศีล่าง${pillar.branch} ในฐาน${pillarLabel}`,
          explanation: "ราศีบนทำร้ายราศีล่างในฐานเดียวกัน ทำให้เกิดความเสียหายหรือรั่วไหลในจุดนั้น",
          readingOrderHint: "ผั่วเป็นแรงรอง เหมือนกับไห่และเฮ้ง ควรอ่านหลังจากเข้าใจภาคีและชงแล้ว",
          details: [
            makeDetail("ราศีบน", pillar.stem),
            makeDetail("ราศีล่าง", pillar.branch),
            makeDetail("ฐาน", pillarLabel),
          ],
        },
      });
    }
  }

  return badges;
}

function buildMarkerBadges(shenSha: ShenShaValue[]): BaseChartReactionBadgeValue[] {
  return shenSha.map((entry, index) => {
    const markerSemantics = resolveMarkerDoctrineKey(entry.starName);

    return {
      id: `marker-${index}-${entry.relatedPillar}`,
      family: "marker" as const,
      label: entry.starName,
      shortLabel: entry.starName,
      priority: "secondary" as const,
      status: "active" as const,
      meaningShort: entry.meaning,
      schoolLabel: entry.starName,
      doctrineKey: markerSemantics.doctrineKey,
      semanticKind: markerSemantics.semanticKind,
      hierarchyLevel: "overlay",
      readingOrder: 4,
      participants: [{
        pillarLabel: entry.relatedPillar,
        type: "marker" as const,
        symbol: entry.starName,
      }],
      modal: {
        title: entry.starName,
        family: "marker" as const,
        summary: `${entry.starName} ปรากฏที่ ${entry.relatedPillar}`,
        explanation: entry.meaning,
        readingOrderHint: "marker ใช้เป็นชั้นเสริมหลังจากอ่าน role และ interaction หลักแล้ว",
        details: [
          makeDetail("ผูกกับฐาน", entry.relatedPillar),
          makeDetail("ความหมาย", entry.meaning),
        ],
      },
    };
  });
}

export function buildBaseChartReading(args: {
  dayMasterStem: string;
  pillars: BaseChartPillars;
  shenSha: ShenShaValue[];
  resolution: BranchInteractionResolution;
  precedenceSignals: ContextRuleNoteValue[];
  interactionState?: GeneralizedInteractionState;
}) : BaseChartReadingValue {
  const { dayMasterStem, pillars, shenSha, resolution, precedenceSignals, interactionState } = args;
  const roleBadges = (Object.entries(pillars) as Array<[BaseChartPillarKey, PillarValue]>)
    .flatMap(([pillarKey, pillar]) => {
      const stemBadge = buildRoleBadge(dayMasterStem, pillarKey, pillar, "stem");
      const branchBadge = buildRoleBadge(dayMasterStem, pillarKey, pillar, "branch");
      return [stemBadge, branchBadge].filter((badge): badge is BaseChartReactionBadgeValue => Boolean(badge));
    });
  const generalizedBadges = buildGeneralizedInteractionBadges(pillars, interactionState);
  const stemInteractionBadges = generalizedBadges.stemBadges.length > 0 || generalizedBadges.elementalBadges.length > 0
    ? [...generalizedBadges.stemBadges, ...generalizedBadges.elementalBadges]
    : buildStemInteractionBadges(pillars);
  const branchInteractionBadges = [
    ...generalizedBadges.branchBadges,
    ...buildBranchInteractionBadges(pillars, resolution, precedenceSignals, interactionState),
  ];
  const markerBadges = buildMarkerBadges(
    shenSha.filter((entry) => ["ปี", "เดือน", "วัน", "ยาม"].includes(entry.relatedPillar)),
  );

  return {
    roleBadges,
    stemInteractionBadges,
    branchInteractionBadges,
    markerBadges,
    groups: [
      {
        key: "roles",
        title: "บทบาทต่อดิถี",
        description: "อ่านว่าแต่ละตัวทำหน้าที่แบบไหนเมื่อเทียบกับดิถี",
        family: "role",
        hierarchyLevel: "day-master",
        readingOrder: 2,
        badges: roleBadges,
      },
      {
        key: "stem-interactions",
        title: "ฟ้า-ฟ้า interactions",
        description: "ภาคี พิฆาต และ lane ธาตุที่ engine ยืนยันแล้วจาก interactionState",
        family: "interaction",
        hierarchyLevel: "interaction",
        readingOrder: 3,
        badges: stemInteractionBadges,
      },
      {
        key: "branch-interactions",
        title: "ดิน-ดิน interactions",
        description: "六合 三合 半三合 และแรง legacy residual ของราศีล่างในดวงกำเนิด",
        family: "interaction",
        hierarchyLevel: "interaction",
        readingOrder: 3,
        badges: branchInteractionBadges,
      },
      {
        key: "markers",
        title: "ตัวประกอบพิเศษ",
        description: "กุ้ยนั้ง บุ่งเชียง และ marker เชิงสัญลักษณ์ที่ใช้ประกอบการอ่าน",
        family: "marker",
        hierarchyLevel: "overlay",
        readingOrder: 4,
        badges: markerBadges,
      },
    ],
    legendItems: [
      makeDetail("route", "ชั้นคุณภาพของเส้นทางผ่าน 12 เชี่ยงแซใน ribbon"),
      makeDetail("role", "บทบาทของตัวนั้นเมื่อเทียบกับดิถี"),
      makeDetail("interaction", "แรงที่ตัวในดวงกระทบหรือดึงกันเอง"),
      makeDetail("marker", "ตัวประกอบพิเศษที่ช่วยขยายบริบทการอ่าน"),
    ],
    readingOrderSteps: [
      "เริ่มจากดิถีและ ribbon พื้นดวงก่อน",
      "อ่านบทบาทต่อดิถีของตัวสำคัญ",
      "อ่าน interaction ชั้นฟ้าและชั้นดินตามลำดับ",
      "ดู marker พิเศษเป็นชั้นเสริมท้ายสุด",
    ],
  };
}

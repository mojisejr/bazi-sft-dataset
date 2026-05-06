import type {
  BaseChartDetailItemValue,
  BaseChartReadingValue,
  BaseChartReactionBadgeValue,
  BaseChartSchoolSectionValue,
  BaseChartStrengthGateValue,
  ContextRuleNoteValue,
  DayMasterStrengthProfileValue,
  InteractionTierValue,
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
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  resolveInteractionSemantic,
  resolveMarkerSemantic,
  resolveRoleSemantic,
} from "@/lib/bazi/symbolic-engine.reaction-resolver";
import type { BranchInteractionResolution } from "@/lib/bazi/symbolic-engine.types";
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

function buildStrengthGate(
  strengthScore: number | undefined,
  dayMasterStrengthProfile: DayMasterStrengthProfileValue | undefined,
): BaseChartStrengthGateValue | undefined {
  if (typeof strengthScore !== "number" && !dayMasterStrengthProfile) {
    return undefined;
  }

  const displayLabel = dayMasterStrengthProfile?.displayLabel ?? dayMasterStrengthProfile?.displayBand;
  const strengthState = dayMasterStrengthProfile?.strengthState ?? dayMasterStrengthProfile?.lookupState;
  const scoreText = typeof strengthScore === "number"
    ? strengthScore.toFixed(2)
    : dayMasterStrengthProfile?.scoreText;
  const summaryParts = [
    displayLabel,
    strengthState,
    dayMasterStrengthProfile?.qiLabel ? `อ้างอิง 12 เชี่ยงแซ ${dayMasterStrengthProfile.qiLabel}` : null,
    dayMasterStrengthProfile?.narrative,
  ].filter(Boolean);

  return {
    title: "กำลังดิถี",
    summary: summaryParts.join(" • ") || "ใช้กำลังดิถีเป็นด่านแรกก่อนตีความ role, interaction และ marker",
    displayLabel,
    strengthState,
    qiLabel: dayMasterStrengthProfile?.qiLabel,
    scoreText,
    score: strengthScore,
    readingOrderHint: "อ่านกำลังดิถีก่อนเสมอ เพื่อรู้ว่าดิถีรับแรง ส่งแรง หรือถูกกดอยู่ในระดับไหน",
  };
}

function buildSchoolSections(args: {
  strengthGate?: BaseChartStrengthGateValue;
  roleBadges: BaseChartReactionBadgeValue[];
  stemInteractionBadges: BaseChartReactionBadgeValue[];
  branchInteractionBadges: BaseChartReactionBadgeValue[];
  markerBadges: BaseChartReactionBadgeValue[];
}): BaseChartSchoolSectionValue[] {
  const { strengthGate, roleBadges, stemInteractionBadges, branchInteractionBadges, markerBadges } = args;
  const sections: BaseChartSchoolSectionValue[] = [];
  let readingOrder = 1;

  if (strengthGate) {
    sections.push({
      key: "strength-gate",
      title: "กำลังดิถี",
      description: strengthGate.summary,
      readingOrder,
      badges: [],
    });
    readingOrder += 1;
  }

  sections.push(
    {
      key: "roles",
      title: "จับซิ้ง / บทบาทต่อดิถี",
      description: "อ่านว่าราศีบนและฐานล่างแต่ละตัวทำหน้าที่แบบไหนเมื่อเทียบกับดิถี",
      readingOrder,
      badges: roleBadges,
    },
    {
      key: "stem-interactions",
      title: "ปฏิกิริยาชั้นฟ้า",
      description: "ดูภาคีหรือพิฆาตของราศีบนก่อน เพื่อจับแรงหลักที่กระทบบนชั้นฟ้า",
      readingOrder: readingOrder + 1,
      badges: stemInteractionBadges,
    },
    {
      key: "branch-interactions",
      title: "ปฏิกิริยาชั้นดิน",
      description: "อ่านภาคี ชง ไห่ ผั่ว และเฮ้งของราศีล่าง หลังจากเข้าใจชั้นฟ้าแล้ว",
      readingOrder: readingOrder + 2,
      badges: branchInteractionBadges,
    },
    {
      key: "markers",
      title: "ตัวประกอบพิเศษ",
      description: "marker ใช้เสริมการอ่านท้ายสุด ไม่ใช่แกนหลักของการชี้ขาด",
      readingOrder: readingOrder + 3,
      badges: markerBadges,
    },
  );

  return sections;
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

    const semantic = resolveRoleSemantic(tenGod);

    if (!semantic) {
      return null;
    }

    const schoolLabel = semantic.schoolLabel;
    const pillarLabel = PILLAR_LABELS[pillarKey];

    return {
      id: `${pillarKey}-stem-role`,
      family: "role",
      label: `${pillarLabel}บน · ${schoolLabel}`,
      shortLabel: schoolLabel,
      priority: pillarKey === "day" ? "primary" : "secondary",
      status: "active",
      meaningShort: semantic.meaningShort,
      schoolLabel,
      semantic: {
        kind: "role",
        schoolKey: semantic.schoolKey,
        summary: semantic.summary,
        schoolLabel,
        sourceKind: "doctrine-role",
        flowCategory: semantic.flowCategory,
        flowCycleType: semantic.flowCycleType,
        flowDirection: semantic.flowDirection,
        flowLabel: semantic.flowLabel,
      },
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
        explanation: semantic.meaningShort,
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

  const semantic = resolveRoleSemantic(branchRole.tenGod);

  if (!semantic) {
    return null;
  }

  const schoolLabel = semantic.schoolLabel;
  const pillarLabel = PILLAR_LABELS[pillarKey];
  const branchTranslation = BRANCH_LABELS_TH[pillar.branch as keyof typeof BRANCH_LABELS_TH];

  return {
    id: `${pillarKey}-branch-role`,
    family: "role",
    label: `${pillarLabel}ล่าง · ${schoolLabel}`,
    shortLabel: schoolLabel,
    priority: "secondary",
    status: "active",
    meaningShort: `${semantic.meaningShort} โดยอ่านผ่านราศีแฝงหลัก`,
    schoolLabel,
    semantic: {
      kind: "role",
      schoolKey: semantic.schoolKey,
      summary: semantic.summary,
      schoolLabel,
      sourceKind: "doctrine-role",
      flowCategory: semantic.flowCategory,
      flowCycleType: semantic.flowCycleType,
      flowDirection: semantic.flowDirection,
      flowLabel: semantic.flowLabel,
    },
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
      explanation: `${semantic.meaningShort} โดยใช้ราศีแฝงหลัก ${branchRole.hiddenStem}`,
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
        const semantic = resolveInteractionSemantic({ kind: "combination", isStemLevel: true, participantCount: 2 });
        badges.push({
          id: `stem-combo-${leftKey}-${rightKey}`,
          family: "interaction",
          label: `ฟ้าภาคี ${leftPillar.stem}${rightPillar.stem}`,
          shortLabel: `${leftPillar.stem}${rightPillar.stem}`,
          priority: "primary",
          status: "active",
          meaningShort: `ราศีบน ${leftLabel}/${rightLabel} จับคู่ภาคีกันและมีแนวโน้มดึงแรงไปทางธาตุ ${transformTo}`,
          schoolLabel: "ภาคีราศีบน",
          semantic: {
            ...semantic,
            schoolLabel: "ภาคีราศีบน",
          },
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
        const semantic = resolveInteractionSemantic({ kind: "clash", isStemLevel: true, participantCount: 2 });
        badges.push({
          id: `stem-clash-${leftKey}-${rightKey}`,
          family: "interaction",
          label: `ฟ้าพิฆาต ${leftPillar.stem}${rightPillar.stem}`,
          shortLabel: `${leftPillar.stem}${rightPillar.stem}`,
          priority: "primary",
          status: "active",
          meaningShort: `ราศีบน ${leftLabel}/${rightLabel} มีแรงพิฆาตกันโดยตรง เป็นแรงชั้นฟ้าที่ควรอ่านก่อนแรงรอง`,
          schoolLabel: "พิฆาตราศีบน",
          semantic: {
            ...semantic,
            schoolLabel: "พิฆาตราศีบน",
          },
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

function buildBranchInteractionBadges(
  pillars: BaseChartPillars,
  resolution: BranchInteractionResolution,
  precedenceSignals: ContextRuleNoteValue[],
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

    badges.push({
      semantic: {
        ...resolveInteractionSemantic({
          kind,
          isStemLevel: false,
          participantCount: 2,
        }),
        schoolLabel: meta.title,
      },
      id: `${kind}-${pair.leftKey}-${pair.rightKey}`,
      family: "interaction",
      label: `${meta.title} ${pair.label}`,
      shortLabel: pair.label,
      priority,
      status,
      meaningShort: note ?? `${meta.meaning} เกิดขึ้นระหว่างฐาน ${leftLabel} และ ${rightLabel}`,
      schoolLabel: meta.title,
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

  combinationPairs.forEach((pair) => pushPairBadge("combination", pair, "active"));
  activeClashes.forEach((pair) => pushPairBadge("clash", pair, "active"));
  neutralizedClashes.forEach((pair) => pushPairBadge("clash", pair, "neutralized"));
  harmPairs.forEach((pair) => pushPairBadge("harm", pair, combinationKeys.has(pair.leftKey) || combinationKeys.has(pair.rightKey) || activeClashKeys.has(pair.leftKey) || activeClashKeys.has(pair.rightKey) ? "supplementary" : "active"));
  destructionPairs.forEach((pair) => pushPairBadge("destruction", pair, combinationKeys.has(pair.leftKey) || combinationKeys.has(pair.rightKey) || activeClashKeys.has(pair.leftKey) || activeClashKeys.has(pair.rightKey) ? "supplementary" : "active"));

  activePunishments.forEach((record) => {
    const bases = record.keys.map((key) => PILLAR_LABELS[key]).join(", ");

      badges.push({
        semantic: {
          ...resolveInteractionSemantic({
            kind: "punishment",
            isStemLevel: false,
            participantCount: record.keys.length,
          }),
          schoolLabel: record.keys.length >= 3 ? "ซำเฮ้ง" : "เฮ้ง",
        },
      id: `punishment-${record.label}-${record.keys.join("-")}`,
      family: "interaction",
      label: `เฮ้ง ${record.label}`,
      shortLabel: record.label,
      priority: "secondary",
      status: "active",
      meaningShort: `ชุด ${record.label} เป็นแรงเฮ้งที่ยังทำงานอยู่ในฐาน ${bases}`,
      schoolLabel: "เฮ้ง",
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
        semantic: {
          ...resolveInteractionSemantic({ kind: "destruction", isStemLevel: false, participantCount: 2 }),
          schoolLabel: "ผั่ว",
        },
        id: `intra-destruction-${pillarKey}`,
        family: "interaction",
        label: `ผั่ว ${label}`,
        shortLabel: label,
        priority: "secondary",
        status: "active",
        meaningShort: `ราศีบนผั่วราศีล่างในฐาน${pillarLabel} ทำให้เกิดความเสียหายในจุดนั้น`,
        schoolLabel: "ผั่ว",
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
    const semantic = resolveMarkerSemantic(entry.starName);

    return {
      id: `marker-${index}-${entry.relatedPillar}`,
      family: "marker" as const,
      label: entry.starName,
      shortLabel: entry.starName,
      priority: "secondary" as const,
      status: "active" as const,
      meaningShort: entry.meaning,
      schoolLabel: entry.starName,
      semantic,
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
  strengthScore?: number;
  dayMasterStrengthProfile?: DayMasterStrengthProfileValue;
}) : BaseChartReadingValue {
  const {
    dayMasterStem,
    pillars,
    shenSha,
    resolution,
    precedenceSignals,
    strengthScore,
    dayMasterStrengthProfile,
  } = args;
  const roleBadges = (Object.entries(pillars) as Array<[BaseChartPillarKey, PillarValue]>)
    .flatMap(([pillarKey, pillar]) => {
      const stemBadge = buildRoleBadge(dayMasterStem, pillarKey, pillar, "stem");
      const branchBadge = buildRoleBadge(dayMasterStem, pillarKey, pillar, "branch");
      return [stemBadge, branchBadge].filter((badge): badge is BaseChartReactionBadgeValue => Boolean(badge));
    });
  const stemInteractionBadges = buildStemInteractionBadges(pillars);
  const branchInteractionBadges = buildBranchInteractionBadges(pillars, resolution, precedenceSignals);
  const markerBadges = buildMarkerBadges(
    shenSha.filter((entry) => ["ปี", "เดือน", "วัน", "ยาม"].includes(entry.relatedPillar)),
  );
  const strengthGate = buildStrengthGate(strengthScore, dayMasterStrengthProfile);
  const schoolSections = buildSchoolSections({
    strengthGate,
    roleBadges,
    stemInteractionBadges,
    branchInteractionBadges,
    markerBadges,
  });

  return {
    roleBadges,
    stemInteractionBadges,
    branchInteractionBadges,
    markerBadges,
    groups: [],
    strengthGate,
    schoolSections,
    legendItems: [
      makeDetail("strength", "กำลังดิถีเป็นด่านแรกก่อนอ่าน role และ interaction"),
      makeDetail("route", "ชั้นคุณภาพของเส้นทางผ่าน 12 เชี่ยงแซใน ribbon"),
      makeDetail("role", "บทบาทของตัวนั้นเมื่อเทียบกับดิถี"),
      makeDetail("interaction", "แรงที่ตัวในดวงกระทบหรือดึงกันเอง"),
      makeDetail("marker", "ตัวประกอบพิเศษที่ช่วยขยายบริบทการอ่าน"),
    ],
    readingOrderSteps: [
      "เริ่มจากดิถีและ ribbon พื้นดวงก่อน",
      "ล็อกกำลังดิถีให้ชัดก่อน ว่าดิถีแข็ง อ่อน หรือสมดุล",
      "อ่านจับซิ้งและบทบาทต่อดิถีของตัวสำคัญ",
      "อ่านปฏิกิริยาชั้นฟ้า แล้วค่อยลงชั้นดินตามลำดับ",
      "ดู marker พิเศษเป็นชั้นเสริมท้ายสุด",
    ],
  };
}

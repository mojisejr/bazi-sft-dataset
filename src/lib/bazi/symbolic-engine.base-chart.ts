import type {
  BaseChartDetailItemValue,
  BaseChartReadingValue,
  BaseChartReactionBadgeValue,
  ContextRuleNoteValue,
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
  STEM_CLASH_PAIRS,
  STEM_COMBINATION_TRANSFORMS,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";
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
        label: `${leftPillar.branch}${rightPillar.branch}`,
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
      id: `${kind}-${pair.leftKey}-${pair.rightKey}`,
      family: "interaction",
      label: `${meta.title} ${pair.label}`,
      shortLabel: pair.label,
      priority,
      status,
      meaningShort: note ?? `${meta.meaning} เกิดขึ้นระหว่างฐาน ${leftLabel} และ ${rightLabel}`,
      schoolLabel: meta.title,
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
      id: `punishment-${record.label}-${record.keys.join("-")}`,
      family: "interaction",
      label: `เฮ้ง ${record.label}`,
      shortLabel: record.label,
      priority: "secondary",
      status: "active",
      meaningShort: `ชุด ${record.label} เป็นแรงเฮ้งที่ยังทำงานอยู่ในฐาน ${bases}`,
      schoolLabel: "เฮ้ง",
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

  return badges;
}

function buildMarkerBadges(shenSha: ShenShaValue[]): BaseChartReactionBadgeValue[] {
  return shenSha.map((entry, index) => ({
    id: `marker-${index}-${entry.relatedPillar}`,
    family: "marker" as const,
    label: entry.starName,
    shortLabel: entry.starName,
    priority: "secondary" as const,
    status: "active" as const,
    meaningShort: entry.meaning,
    schoolLabel: entry.starName,
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
  }));
}

export function buildBaseChartReading(args: {
  dayMasterStem: string;
  pillars: BaseChartPillars;
  shenSha: ShenShaValue[];
  resolution: BranchInteractionResolution;
  precedenceSignals: ContextRuleNoteValue[];
}) : BaseChartReadingValue {
  const { dayMasterStem, pillars, shenSha, resolution, precedenceSignals } = args;
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
        badges: roleBadges,
      },
      {
        key: "stem-interactions",
        title: "ฟ้า-ฟ้า interactions",
        description: "ภาคีหรือพิฆาตกันของราศีบนที่มองเห็นได้ตรง ๆ",
        family: "interaction",
        badges: stemInteractionBadges,
      },
      {
        key: "branch-interactions",
        title: "ดิน-ดิน interactions",
        description: "ภาคี ชง ไห่ ผั่ว และเฮ้งของราศีล่างในดวงกำเนิด",
        family: "interaction",
        badges: branchInteractionBadges,
      },
      {
        key: "markers",
        title: "ตัวประกอบพิเศษ",
        description: "กุ้ยนั้ง บุ่งเชียง และ marker เชิงสัญลักษณ์ที่ใช้ประกอบการอ่าน",
        family: "marker",
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
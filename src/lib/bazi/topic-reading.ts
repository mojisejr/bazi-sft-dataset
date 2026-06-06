import {
  buildDayMasterRelationPacket,
  type RelationReadingPacket,
} from "@/lib/bazi/day-master-relation-reading-poc";
import { ANNOTATION_DIMENSION_TITLE_MAP } from "@/lib/bazi/annotation-dimension-meta";
import {
  getTopicDefinition,
  selectTopicEvidenceDimension,
  type TopicDefinition,
} from "@/lib/bazi/topic-path";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { resolveDaYunReaction } from "@/lib/bazi/topic-knowledge";

export {
  TOPIC_PATH,
  getTopicDefinition,
  selectTopicEvidenceDimension,
} from "@/lib/bazi/topic-path";
export type {
  TopicDefinition,
  TopicKind,
  TopicRelationKey,
} from "@/lib/bazi/topic-path";

/**
 * Stepwise "path reading" model (server-side builder).
 *
 * แต่ละหัวข้อ (บท) ถูกอ่านทีละหัวข้อ โดยทุกบล็อกต้อง ground จาก engine truth
 * ({@link CalculatedStateValue}) + relation packet ที่ deterministic เท่านั้น
 * ห้ามมี fact ใหม่จาก AI. โหมด LLM ใช้ข้อมูลชุดเดียวกันเป็น brief.
 *
 * โครงสร้างผลลัพธ์ต่อหัวข้อ = 3 บล็อกตามตัวอย่าง M.docx + 1.docx:
 *  - A `table`  : ตารางความสัมพันธ์ 4 คอลัมน์ (อักษรจีนต้นทาง | ทิศทาง | ผลลัพธ์ | ช่วงเวลาจร)
 *  - B `method` : วิธีการอ่าน/หลักการ (จาก stepInsight ของ relation packet)
 *  - C `prose`  : ร้อยแก้วบรรยาย (จาก narrative ที่ engine ผลิตไว้แล้วใน calculatedState)
 */

/** แถวของตารางความสัมพันธ์แบบ M.docx (4 คอลัมน์) */
export type TopicRelationRow = {
  sourceSymbol: string;
  pointsTo: string;
  relationResult: string;
  timing: string;
};

/** แถวตาราง 4 เสา ของ Calculated Basis */
export type BasisPillarRow = {
  pillarLabel: string;
  stem: string;
  branch: string;
  hiddenStems: string;
  tenGod: string;
  upperStage: string;
  lowerStage: string;
};

/** แถวตารางวัยจรแบบ 5 ปี (Da Yun แตก phase ก้าน/กิ่ง) */
export type DaYunRow = {
  ageRange: string;
  /** ก้านหรือกิ่งของช่วง 5 ปีนี้ */
  symbol: string;
  /** ราศีบน (ก้าน) หรือ ราศีล่าง (กิ่ง) */
  source: string;
  /** ปฏิกิริยา (บทบาทธาตุของช่วงนี้เทียบดิถี) — แสดงก่อนสภาวะตามวิธีอ่าน M.docx */
  reaction: string;
  /** สภาวะ 12 เชี่ยงแซของช่วงนี้ */
  stage: string;
  isCurrent: boolean;
};

export type TopicEngineReading = {
  topicId: string;
  chapter: number;
  title: string;
  lens: string;
  /** A: ตารางความสัมพันธ์ */
  table: TopicRelationRow[];
  /** Calculated Basis เท่านั้น: ตาราง 4 เสา + วัยจร */
  basis?: {
    pillars: BasisPillarRow[];
    daYun: DaYunRow[];
  };
  /** บท 12: ตารางวัยจรเชิงลึก */
  daYunTimeline?: DaYunRow[];
  /** B: วิธีการอ่าน */
  method: string[];
  /** C: ร้อยแก้วบรรยายจาก engine narrative */
  prose: string[];
};

function emptyToDash(value: string | undefined | null): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "-";
}

function buildBasisPillarRows(calculatedState: CalculatedStateValue): BasisPillarRow[] {
  const labels: Record<string, string> = {
    year: "เสาปี",
    month: "เสาเดือน",
    day: "เสาวัน (ดิถี)",
    hour: "เสายาม",
  };

  return (["year", "month", "day", "hour"] as const).map((key) => {
    const pillar = calculatedState.fourPillars[key];
    const branchStage = calculatedState.twelveQi[`${key}Branch`];

    return {
      pillarLabel: labels[key],
      stem: pillar.stem,
      branch: pillar.branch,
      hiddenStems: emptyToDash((pillar.hiddenStems ?? []).join(", ")),
      tenGod: emptyToDash(pillar.tenGod),
      upperStage: emptyToDash(pillar.upperStageDisplay),
      lowerStage: emptyToDash(pillar.lowerStageDisplay ?? branchStage),
    };
  });
}

/**
 * ช่วงอายุของวัยจรบนหน้า /reading ถูก normalize ให้ "เริ่ม 5-9 เสมอ"
 * (ตามที่ผู้ใช้ยืนยัน) โดยอิงดัชนีลำดับเสา ไม่ใช่ค่า startAge จาก engine:
 * เสาที่ index → base = 5 + index*10 ; ครึ่งก้าน base..base+4, ครึ่งกิ่ง base+5..base+9
 */
export function normalizedDaYunAgeRange(pillarIndex: number, half: "stem" | "branch" | "full") {
  const base = 5 + pillarIndex * 10;
  if (half === "stem") {
    return `${base}-${base + 4} ปี`;
  }
  if (half === "branch") {
    return `${base + 5}-${base + 9} ปี`;
  }
  return `${base}-${base + 9} ปี`;
}

/**
 * แตกวัยจรเป็นช่วง 5 ปี ตามวิธีอ่าน M.docx: เสาวัยจร 10 ปี แบ่งเป็น
 * ครึ่งก้าน (5 ปีแรก) + ครึ่งกิ่ง (5 ปีหลัง). ใช้ upperPhase/lowerPhase
 * ที่ engine ผลิตไว้แล้ว; ถ้าไม่มี phase → fallback เป็นแถวเดียวต่อเสา.
 * อายุถูก normalize ให้เริ่ม 5-9 ตามดัชนีลำดับเสา.
 */
function buildDaYunRows(calculatedState: CalculatedStateValue): DaYunRow[] {
  const rows: DaYunRow[] = [];
  const pillars = [...calculatedState.daYun].sort((a, b) => a.startAge - b.startAge);

  pillars.forEach((pillar, index) => {
    if (pillar.upperPhase && pillar.lowerPhase) {
      rows.push({
        ageRange: normalizedDaYunAgeRange(index, "stem"),
        symbol: pillar.upperPhase.symbol,
        source: "ราศีบน (ก้าน)",
        reaction: resolveDaYunReaction(calculatedState, pillar.upperPhase.symbol, "stem"),
        stage: emptyToDash(pillar.upperPhase.twelveQiDisplay),
        isCurrent: pillar.upperPhase.isCurrent ?? false,
      });
      rows.push({
        ageRange: normalizedDaYunAgeRange(index, "branch"),
        symbol: pillar.lowerPhase.symbol,
        source: "ราศีล่าง (กิ่ง)",
        reaction: resolveDaYunReaction(calculatedState, pillar.lowerPhase.symbol, "branch"),
        stage: emptyToDash(pillar.lowerPhase.twelveQiDisplay),
        isCurrent: pillar.lowerPhase.isCurrent ?? false,
      });
      return;
    }

    // fallback: ไม่มี phase แยก → แสดงเสา 10 ปีเป็นแถวเดียว
    rows.push({
      ageRange: normalizedDaYunAgeRange(index, "full"),
      symbol: `${pillar.stem}${pillar.branch}`,
      source: "เสาวัยจร",
      reaction: resolveDaYunReaction(calculatedState, pillar.stem, "stem"),
      stage: emptyToDash(pillar.upperStageDisplay ?? pillar.lowerStageDisplay),
      isCurrent: pillar.isCurrent ?? false,
    });
  });

  return rows;
}

function buildRelationRows(
  topic: TopicDefinition,
  packet: RelationReadingPacket,
): TopicRelationRow[] {
  const dayMasterSymbol = packet.chartAnchor.dayMasterStem;

  return topic.relationKeys
    .map((relationKey) => {
      const summary = packet.relationSummary.find((entry) => entry.relationKey === relationKey);

      if (!summary || summary.targetCount === 0) {
        return null;
      }

      return {
        sourceSymbol: `${dayMasterSymbol} (ดิถี)`,
        pointsTo: emptyToDash(summary.strongestCarrierThai),
        relationResult: `${summary.relationLabelThai} — ${summary.semanticMeaningThai} (ธาตุ${summary.targetElementLabelThai}, พบ ${summary.targetCount} จุด)`,
        timing: "ตลอดชีวิต",
      } satisfies TopicRelationRow;
    })
    .filter((row): row is TopicRelationRow => row !== null);
}

function buildMethodLines(
  topic: TopicDefinition,
  packet: RelationReadingPacket,
): string[] {
  const lines = [`หลักการอ่าน: ${topic.lens}`];

  for (const stepNumber of topic.stepNumbers) {
    const step = packet.stepInsights.find((entry) => entry.stepNumber === stepNumber);

    if (step) {
      lines.push(`ขั้นที่ ${step.stepNumber} (${step.titleThai}): ${step.auditFocusThai}`);
    }
  }

  return lines;
}

function pushUnique(target: string[], value: string | null | undefined) {
  const normalized = value?.trim();
  if (normalized && normalized.length > 0 && !target.includes(normalized)) {
    target.push(normalized);
  }
}

const ELEMENT_TOPIC_IDS = new Set([
  "wealth_and_investment",
  "health",
  "career_potential",
  "colors_directions",
  "guardian_deities",
]);

/**
 * ร้อยแก้ว engine mode แบบ "สัญญาณ + คำอธิบายว่าทำไม" (deterministic ล้วน)
 * เพื่อไม่ให้เหลือแค่การแปลศัพท์: ดึง semantic meaning ของ relation, ประโยค
 * อธิบายจาก evidenceLines, narrative ของกำลังดิถี/persona/ฤดูกาล และ context note.
 */
function buildEngineProse(
  topic: TopicDefinition,
  calculatedState: CalculatedStateValue,
  packet: RelationReadingPacket,
): string[] {
  const prose: string[] = [];

  // 1) แกนตัวตน + กำลังดิถี (ดิถีเป็นแกนทำนายหลัก) — ใส่ในบทต้น ๆ และบทที่อิงกำลังดิถี
  if (topic.chapter <= 1 || topic.relationKeys.includes("same")) {
    pushUnique(prose, packet.chartAnchor.balanceNarrativeThai);
    pushUnique(prose, calculatedState.dayMasterStrengthProfile?.narrative);
    pushUnique(prose, calculatedState.dayMasterStrengthProfile?.narrativeReason);
  }
  if (topic.chapter <= 1) {
    pushUnique(prose, packet.chartAnchor.identityNarrativeThai);
    pushUnique(prose, calculatedState.sixtyJiaziCorePersona?.narrative);
  }

  // 2) สัญญาณ relation ของหัวข้อนี้ + คำอธิบายความหมาย และจุดที่พบ
  for (const relationKey of topic.relationKeys) {
    const summary = packet.relationSummary.find((entry) => entry.relationKey === relationKey);
    if (!summary || summary.targetCount === 0) {
      continue;
    }
    pushUnique(
      prose,
      `ด้าน${summary.relationLabelThai}: มองหาธาตุ${summary.targetElementLabelThai} `
        + `พบที่ ${summary.carrierSummaryThai} (เด่นสุดที่ ${summary.strongestCarrierThai}). `
        + `ความหมายคือ ${summary.semanticMeaningThai}`,
    );
  }

  // 3) คำอธิบายสั้นจากขั้นที่หัวข้อนี้อ้างอิง — กระชับ: ใช้ summary + evidence เพียง 1 บรรทัด/step
  for (const stepNumber of topic.stepNumbers) {
    const step = packet.stepInsights.find((entry) => entry.stepNumber === stepNumber);
    if (!step) {
      continue;
    }
    pushUnique(prose, step.summaryThai);
    pushUnique(prose, step.evidenceLines[0]);
  }

  // 4) บริบทฤดูกาล (สำหรับบทธาตุ/สุขภาพ/โชคลาภ/อาชีพ) — เฉพาะอุปมาฤดูกาล ไม่สาดทุกธาตุ
  if (ELEMENT_TOPIC_IDS.has(topic.id)) {
    pushUnique(prose, calculatedState.seasonalInteraction?.metaphor);
  }

  // หมายเหตุ: ตัด precedenceNoteSignals (ข้อความ "โทษ/ชง ... ยังทำงาน") ออก
  // เพื่อไม่ให้คำอ่านมีโทนโทษ/อ้างกฎบ่อยเกินจำเป็น (engine = กระชับ)

  if (prose.length === 0) {
    pushUnique(prose, packet.chartAnchor.balanceNarrativeThai);
  }

  // คุมความยาว engine ให้กระชับ
  return prose.slice(0, 5);
}

/**
 * สร้างผลอ่านแบบ deterministic ของหัวข้อเดียว (engine mode).
 * รับ relation packet ที่ build ไว้แล้วเพื่อเลี่ยงการ recompute ซ้ำเมื่ออ่านหลายหัวข้อ.
 */
export function buildTopicEngineReading(
  calculatedState: CalculatedStateValue,
  topicId: string,
  packet: RelationReadingPacket = buildDayMasterRelationPacket(calculatedState),
): TopicEngineReading {
  const topic = getTopicDefinition(topicId);

  const reading: TopicEngineReading = {
    topicId: topic.id,
    chapter: topic.chapter,
    title: topic.title,
    lens: topic.lens,
    table: buildRelationRows(topic, packet),
    method: buildMethodLines(topic, packet),
    prose: buildEngineProse(topic, calculatedState, packet),
  };

  if (topic.kind === "basis") {
    reading.basis = {
      pillars: buildBasisPillarRows(calculatedState),
      daYun: buildDaYunRows(calculatedState),
    };
  }

  if (topic.usesDaYunTimeline) {
    reading.daYunTimeline = buildDaYunRows(calculatedState);
  }

  return reading;
}

/** title ของมิติ retrieval (เผื่อแสดงที่มาของ prose) */
export function getTopicEvidenceTitle(topicId: string): string | null {
  const dimension = selectTopicEvidenceDimension(topicId);
  return dimension ? ANNOTATION_DIMENSION_TITLE_MAP[dimension] : null;
}

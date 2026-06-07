import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS_TH,
  GENERATES,
  PILLAR_CONTEXT_MAP,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import type { PillarContextKey } from "@/lib/bazi/symbolic-engine.constants";
import type { SupportedElement } from "@/lib/bazi/symbolic-engine.types";
import {
  YANG_STEMS,
  localizeTwelveQiLabel,
  resolveCanonicalTwelveQiStage,
} from "@/lib/bazi/pillar-display";

/**
 * Step 6.2 — การทายผลการศึกษา/นิสัยจากการถ่ายเท (Reading Output via 12 Life Stages)
 *
 * นำ "ธาตุถ่ายเท" (output element / 食傷) ของดิถี ไปดูว่าตกที่เชี่ยงแซ (12 ชีพแซ) ตัวใด
 * ในแต่ละหลัก (ปี/เดือน/วัน/ยาม) แล้วสร้างคำทำนายเรื่องการเรียน/การพูด/การฟัง
 * โดยขยายความ "ความหมายเชี่ยงแซ" ลงบน "บริบทของหลัก" (Step 6.0) ที่ธาตุถ่ายเทไปสัมพันธ์ด้วย
 */

const PILLAR_SEQUENCE: PillarContextKey[] = ["year", "month", "day", "hour"];

/** ราศีบนตัวแทนของแต่ละธาตุ แยกตามขั้ว หยาง/หยิน (ใช้คำนวณเชี่ยงแซของธาตุถ่ายเท) */
const ELEMENT_STEMS: Record<SupportedElement, { yang: string; yin: string }> = {
  wood: { yang: "甲", yin: "乙" },
  fire: { yang: "丙", yin: "丁" },
  earth: { yang: "戊", yin: "己" },
  metal: { yang: "庚", yin: "辛" },
  water: { yang: "壬", yin: "癸" },
};

/** ตาราง Step 6.2: เชี่ยงแซ → คำทำนายเรื่องการเรียน / การพูด-การฟัง */
export type OutputStageReading = {
  /** ชื่อจีนของเชี่ยงแซ (长生 ฯลฯ) */
  stageChinese: string;
  /** ชื่อไทยของเชี่ยงแซ (เชี่ยงแซ/หมกยก ฯลฯ) */
  stageThai: string;
  /** คำทำนายเรื่องการเรียน */
  education: string;
  /** คำทำนายเรื่องการพูด/การฟัง */
  speech: string;
};

const STAGE_READING_TABLE: Record<string, Omit<OutputStageReading, "stageChinese" | "stageThai">> = {
  长生: {
    education: "การเรียนที่มีการพัฒนา จบปริญญาตรี",
    speech: "พูดจาดี สร้างสรรค์",
  },
  沐浴: {
    education: "เรียนซ้ำ เรียนเรื่องลึกลับ/ไสยศาสตร์ มัวเมา",
    speech: "พูดโผงผาง",
  },
  冠带: {
    education: "ใฝ่เรียนรู้ จบปริญญาตรี (สายวิชาการ)",
    speech: "พูดมีหลักการ",
  },
  临官: {
    education: "เรียนจบสูง (ปริญญาโท) เรียนเพื่อสร้างอำนาจ",
    speech: "พูดมีพลัง น่าเชื่อถือ",
  },
  帝旺: {
    education: "เรียนจบสูงมาก (ปริญญาเอก) มีศักดิ์ศรี",
    speech: "พูดใช้อารมณ์รุนแรง/ดราม่า",
  },
  衰: {
    education: "เรียนรู้ช้า เรียนประวัติศาสตร์/ของเก่า",
    speech: "พูดช้า/บ่น",
  },
  病: {
    education: "เรียนทางไกล (Online) เรียนหลากหลายแต่ไม่ลึก",
    speech: "พูดมาก/น้ำไหลไฟดับ",
  },
  死: {
    education: "ขี้เกียจเรียน ไม่ใฝ่หาความรู้",
    speech: "เฉยชา/ถามคำตอบคำ",
  },
  墓: {
    education: "เรียนได้เรื่อยๆ จบตามเกณฑ์",
    speech: "เป็นผู้ฟังที่ดี/เก็บกด",
  },
  绝: {
    education: "มีปัญหาการเรียน เรียนรู้ยาก",
    speech: "พูดขวานผ่าซาก/หยาบคาย",
  },
  胎: {
    education: "เรียนรู้ผิดวิธี เรียนสิ่งแปลกๆ",
    speech: "พูดจาเรียบร้อย/ขี้อ้อน",
  },
  养: {
    education: "เรียนเรื่อยๆ เฉื่อยๆ ไม่กระตือรือร้น",
    speech: "พูดจาเอาใจ/จู้จี้เหมือนเด็ก",
  },
};

/** คำทำนาย Step 6.2 ราย "หลัก" — ธาตุถ่ายเทตกเชี่ยงแซตัวใด ขยายความบนบริบทของหลักนั้น */
export type OutputTransferPillarReading = OutputStageReading & {
  pillarKey: PillarContextKey;
  /** ราศีล่าง (กิ่ง) ที่ใช้เทียบเชี่ยงแซในหลักนี้ */
  branch: string;
  /** ธาตุถ่ายเทปรากฏ (ราศีบน/ราศีล่าง/แฝง) ในหลักนี้หรือไม่ */
  carriesOutputElement: boolean;
  /** บริบทบุคคล/เรื่องราวของหลัก (Step 6.0) */
  context: string;
  /** ประโยคคำทำนายที่ประกอบเชี่ยงแซ + บริบทหลักเข้าด้วยกัน */
  sentence: string;
};

export type OutputTransferReading = {
  dayMaster: string;
  dayMasterElement: SupportedElement;
  /** ธาตุถ่ายเท (output / 食傷) */
  outputElement: SupportedElement;
  outputElementLabelThai: string;
  /** ราศีบนตัวแทนของธาตุถ่ายเท (ขั้วเดียวกับดิถี = 食神) */
  outputStem: string;
  pillars: OutputTransferPillarReading[];
};

function getStageReading(stageChinese: string): OutputStageReading {
  const base = STAGE_READING_TABLE[stageChinese];
  return {
    stageChinese,
    stageThai: localizeTwelveQiLabel(stageChinese),
    education: base?.education ?? "ไม่พบคำทำนายการเรียนสำหรับเชี่ยงแซนี้",
    speech: base?.speech ?? "ไม่พบคำทำนายการพูดสำหรับเชี่ยงแซนี้",
  };
}

/** ธาตุถ่ายเทปรากฏในหลักนี้หรือไม่ (ราศีบน, ราศีล่าง-ธาตุหลัก, หรือราศีแฝง) */
function pillarCarriesElement(
  stem: string,
  branch: string,
  outputElement: SupportedElement,
): boolean {
  if (STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT] === outputElement) {
    return true;
  }
  if (BRANCH_TO_ELEMENT[branch as keyof typeof BRANCH_TO_ELEMENT] === outputElement) {
    return true;
  }
  const hidden = BRANCH_HIDDEN_STEMS[branch as keyof typeof BRANCH_HIDDEN_STEMS] ?? [];
  return hidden.some(
    (hiddenStem) => STEM_TO_ELEMENT[hiddenStem as keyof typeof STEM_TO_ELEMENT] === outputElement,
  );
}

/**
 * สร้างคำทำนาย Step 6.2 จากธาตุถ่ายเทของดิถี
 *
 * @param calculatedState ฐานคำนวณของดวง (ใช้ dayMaster + fourPillars)
 */
export function buildOutputTransferReading(
  calculatedState: Pick<CalculatedStateValue, "dayMaster" | "fourPillars">,
): OutputTransferReading {
  const dayMaster = calculatedState.dayMaster;
  const dayMasterElement = STEM_TO_ELEMENT[dayMaster as keyof typeof STEM_TO_ELEMENT];

  if (!dayMasterElement) {
    throw new Error(`Unsupported day master stem: ${dayMaster}`);
  }

  const outputElement = GENERATES[dayMasterElement];
  // 食神: ธาตุถ่ายเทขั้วเดียวกับดิถี — ใช้ราศีบนตัวแทนนี้คำนวณเชี่ยงแซของธาตุถ่ายเท
  const outputStem = YANG_STEMS.has(dayMaster)
    ? ELEMENT_STEMS[outputElement].yang
    : ELEMENT_STEMS[outputElement].yin;

  const pillars = PILLAR_SEQUENCE.map<OutputTransferPillarReading>((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const stageChinese = resolveCanonicalTwelveQiStage(outputStem, pillar.branch);
    const stageReading = getStageReading(stageChinese);
    const context = PILLAR_CONTEXT_MAP[pillarKey].traditionalPerson;
    const carriesOutputElement = pillarCarriesElement(
      pillar.stem,
      pillar.branch,
      outputElement,
    );

    return {
      ...stageReading,
      pillarKey,
      branch: pillar.branch,
      carriesOutputElement,
      context,
      sentence:
        `${context}: ธาตุถ่ายเทตกเชี่ยงแซ "${stageReading.stageThai}" ` +
        `→ ${stageReading.education}; ${stageReading.speech}`,
    };
  });

  return {
    dayMaster,
    dayMasterElement,
    outputElement,
    outputElementLabelThai: ELEMENT_LABELS_TH[outputElement],
    outputStem,
    pillars,
  };
}

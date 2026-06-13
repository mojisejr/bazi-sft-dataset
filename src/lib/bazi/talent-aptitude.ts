import type { SupportedElementValue } from "@/lib/bazi/schema-types";
import { ELEMENT_LABELS_TH, TWELVE_QI_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import { K, KC } from "@/lib/bazi/knowledge/knowledge-overlay-context";

/**
 * พรสวรรค์ 12 เซี่ยงแซ ผสาน 5 ธาตุ (Talent = 12 Life Stages × 5 Elements)
 *
 * แก่นของตำรา: การอ่านพรสวรรค์จาก 12 เซี่ยงแซ ต้องพิจารณาร่วมกับธาตุทั้ง 5 เสมอ
 *   - "เซี่ยงแซ" บอก "รูปแบบพลังของความสามารถ" (ผู้เริ่มต้น/ผู้ฝึกฝน/ผู้นำ ฯลฯ)
 *   - "ธาตุ" บอกว่า "ความสามารถนั้นควรไปแสดงออกในอาชีพหรือกิจการประเภทใด"
 * คนที่อยู่เซี่ยงแซเดียวกันแต่ธาตุต่างกัน จึงออกมาเป็นคนละสายงาน/คนละความถนัด
 *
 * ในเอนจินนี้ "ธาตุ" ที่ใช้ผูกตาราง = ธาตุถ่ายเท (ดาวถ่ายเท / 食傷) ของดิถี
 * ส่วน "เซี่ยงแซ" = สภาวะ 12 ชีพแซที่ดาวถ่ายเทตกในแต่ละหลัก
 */

/** หัวเรื่อง "รูปแบบพลังของความสามารถ" ต่อเซี่ยงแซ (คีย์ = ชื่อจีน canonical) */
export const STAGE_APTITUDE_HEADLINE_TH: Record<string, string> = {
  长生: "ผู้เริ่มต้น ผู้เรียนรู้เร็ว และมีพลังเติบโตสูง",
  沐浴: "เสน่ห์ ความเปลี่ยนแปลง ความสวยงาม และการสะสาง",
  冠带: "ผู้ฝึกฝน ผู้มีวินัย เปลี่ยนความสามารถให้เป็นรูปเป็นร่าง",
  临官: "มีอาชีพ รับผิดชอบงานจริง และบริหารงานได้",
  帝旺: "พลังสูงสุด ผู้นำ ผู้สร้างผลงานใหญ่และมีอิทธิพล",
  衰: "ประสบการณ์ ความรอบคอบ การถ่ายทอดสิ่งที่เคยผ่านมา",
  病: "เข้าใจปัญหา ความบกพร่อง และการเยียวยา",
  死: "ความนิ่ง อดทน ปิดจบ รักษาระบบเดิม",
  墓: "คลังเก็บ สะสม เก็บรักษา ความเชี่ยวชาญที่ซ่อนอยู่",
  绝: "ตัดขาด เปลี่ยนผ่าน เริ่มใหม่ รับมือความไม่แน่นอน",
  胎: "ศักยภาพกำลังก่อตัว มีของดีรออยู่ในอนาคต",
  养: "เลี้ยงดู ประคับประคอง รักษาสิ่งที่มีให้เติบโต",
};

/**
 * ตาราง 60 ช่อง: เซี่ยงแซ (ชื่อจีน) × ธาตุถ่ายเท → ความถนัด/พรสวรรค์ที่ควรไปแสดงออก
 * อ่านตามภาพ "พรสวรรค์ 12 เซี่ยงแซ ผสาน 5 ธาตุ"
 */
export const TALENT_APTITUDE_TH: Record<string, Record<SupportedElementValue, string>> = {
  长生: {
    wood: "ปลูกปั้น พัฒนา สร้างสิ่งใหม่",
    fire: "ถ่ายทอด จุดประกายความคิด",
    earth: "วางรากฐานให้มั่นคง",
    metal: "ทำงานมีวินัยและมาตรฐาน",
    water: "ปรับตัวไว มองหาโอกาสใหม่",
  },
  沐浴: {
    wood: "รสนิยมดี ออกแบบ สื่อสาร",
    fire: "นำเสนอ สร้างภาพลักษณ์",
    earth: "ปรับสภาพแวดล้อม จัดระเบียบ",
    metal: "ประณีต เฉียบคม แต่งเติมให้มีมูลค่า",
    water: "เสน่ห์ พบปะ จับกระแสตลาด",
  },
  冠带: {
    wood: "เรียนรู้และจัดระบบความรู้",
    fire: "อบรม ถ่ายทอด ยกระดับผู้อื่น",
    earth: "สร้างฐานและวางระบบ",
    metal: "ทำตามระเบียบและมาตรฐาน",
    water: "วิเคราะห์ข่าวสาร ต่อยอดโอกาส",
  },
  临官: {
    wood: "บริหารการเติบโต พัฒนาคน",
    fire: "นำทีม ผลักดันผลงาน",
    earth: "จัดการทรัพยากรให้มั่นคง",
    metal: "ควบคุม ตัดสินใจ จัดระบบ",
    water: "บริหารโอกาส การเงิน เครือข่าย",
  },
  帝旺: {
    wood: "ขยายกิจการ สร้างเครือข่าย",
    fire: "ชื่อเสียง ศรัทธา นำสังคม",
    earth: "ครอบครองทรัพยากร สร้างฐานใหญ่",
    metal: "ปกครอง เด็ดขาด ตัดสินใจในจุดวิกฤต",
    water: "การค้า การเงิน หมุนเวียนทรัพย์ก้อนใหญ่",
  },
  衰: {
    wood: "ให้คำปรึกษา ถ่ายทอดความรู้",
    fire: "สอนจากประสบการณ์ชีวิต",
    earth: "ประคองระบบ รักษาทรัพย์",
    metal: "ชำนาญเฉพาะทาง ตัดสินใจแม่นยำ",
    water: "มองสถานการณ์ วิเคราะห์ลึก",
  },
  病: {
    wood: "ฟื้นฟูจิตใจ พัฒนาศักยภาพผู้อื่น",
    fire: "ให้กำลังใจ รักษา เปลี่ยนปัญหาเป็นบทเรียน",
    earth: "ดูแลผู้ขาดโอกาสและคนที่ต้องการความช่วยเหลือ",
    metal: "วินิจฉัย แก้ปัญหาเฉพาะจุด",
    water: "เข้าใจความผันผวน จัดการปัญหา",
  },
  死: {
    wood: "รักษาความรู้และข้อมูล",
    fire: "สรุปบทเรียน ถ่ายทอดความจริง",
    earth: "เฝ้ารักษา ควบคุมทรัพย์สิน",
    metal: "หยุดปัญหา รักษาระเบียบ",
    water: "ทำงานเบื้องหลัง วิเคราะห์เชิงลึก",
  },
  墓: {
    wood: "สะสมและจัดเก็บองค์ความรู้",
    fire: "เก็บเรื่องราว ถ่ายทอดความรู้ถึงต้นตำรับ",
    earth: "ดูแลคลังและทรัพย์สิน",
    metal: "เก็บของมีค่า ตรวจสอบมาตรฐาน",
    water: "เก็บข้อมูลลึก การเงิน ทรัพย์หมุนเวียน",
  },
  绝: {
    wood: "บุกเบิก เปลี่ยนทิศทาง",
    fire: "สร้างกระแส พลิกสถานการณ์",
    earth: "จัดการวิกฤต สร้างฐานใหม่",
    metal: "ตัดปัญหา ยุติความเสียหาย",
    water: "เอาตัวรอด พลิกเป็นโอกาส",
  },
  胎: {
    wood: "เติบโตแบบค่อยเป็นค่อยไป",
    fire: "ไอเดียใหม่ จุดแรงบันดาลใจ",
    earth: "สร้างฐานระยะยาว",
    metal: "ฝึกฝนทักษะจนชำนาญ",
    water: "ซึมซับข้อมูล เรียนรู้ได้ไว",
  },
  养: {
    wood: "ดูแลใกล้ชิด ส่งเสริมการเติบโต",
    fire: "ให้กำลังใจ โอบเลี้ยงจิตใจให้อบอุ่น",
    earth: "รับผิดชอบ ดูแลระยะยาว",
    metal: "ซื่อสัตย์ ปกป้อง รักษาระบบ",
    water: "บริการ รับฟัง ดูแลความสัมพันธ์",
  },
};

/** flatten "เซี่ยงแซจีน|ธาตุ" (60 ช่อง) สำหรับตัวแก้ — อ่านจริงผ่าน KC ใน resolveTalentAptitude */
export const TALENT_APTITUDE_FLAT_TH: Record<string, string> = Object.fromEntries(
  Object.entries(TALENT_APTITUDE_TH).flatMap(([stage, byElement]) =>
    Object.entries(byElement).map(([element, text]) => [`${stage}|${element}`, text]),
  ),
);

/**
 * "ธาตุบอกว่าความสามารถควรไปแสดงออกในกิจการประเภทใด" (สรุปสายอาชีพต่อธาตุ ตามภาพ)
 * ใช้เป็นสะพานเชื่อมพรสวรรค์ → แนวอาชีพ ในบทการงาน
 */
export const ELEMENT_APTITUDE_FIELD_TH: Record<SupportedElementValue, string> = {
  wood: "งานเติบโต/การศึกษา หนังสือ สื่อสิ่งพิมพ์ จิตวิทยา งานพัฒนาคน สมุนไพร อินเทอร์เน็ต และงานมูลนิธิ",
  fire: "งานสอน บรรยาย โรงเรียน โรงพยาบาล ไฟฟ้า/แสงสว่าง การแสดงออก ศาสนา และพลังงานสะอาด",
  earth: "งานที่ดิน อาคาร ก่อสร้าง โกดัง อสังหาริมทรัพย์ เกษตรกรรม และทรัพย์สินที่จับต้องได้",
  metal: "งานโลหะ เครื่องมือ ยานยนต์ การเงิน/ทอง ทหาร ตำรวจ ราชการ และงานสายมาตรฐาน/ความยุติธรรม",
  water: "งานค้าขาย เดินทาง โรงแรม อาหาร-เครื่องดื่ม การเงิน-ธนาคาร ข่าวสาร และงานอิสระ",
};

const THAI_STAGE_TO_CANONICAL: Record<string, string> = Object.fromEntries(
  Object.entries(TWELVE_QI_LABELS_TH).map(([chinese, thai]) => [thai, chinese]),
);

/** แปลงชื่อเซี่ยงแซ (ไทยหรือจีน) เป็นคีย์ canonical (จีน) — คืน "" ถ้าไม่รู้จัก */
function toCanonicalStage(stage: string): string {
  const trimmed = stage.trim();
  if (TALENT_APTITUDE_TH[trimmed]) {
    return trimmed;
  }
  return THAI_STAGE_TO_CANONICAL[trimmed] ?? "";
}

/**
 * คืนความถนัด/พรสวรรค์ของช่อง (เซี่ยงแซ × ธาตุถ่ายเท)
 * รับชื่อเซี่ยงแซเป็นไทยหรือจีนก็ได้ — คืน null ถ้าไม่พบ
 */
export function resolveTalentAptitude(
  stage: string,
  outputElement: SupportedElementValue,
): string | null {
  const canonical = toCanonicalStage(stage);
  const base = TALENT_APTITUDE_TH[canonical]?.[outputElement];
  if (base == null) return null;
  return KC("TALENT_APTITUDE_TH", base, canonical, outputElement);
}

/** คืนหัวเรื่อง "รูปแบบพลังของความสามารถ" ต่อเซี่ยงแซ (ไทย/จีน) — null ถ้าไม่พบ */
export function resolveStageHeadline(stage: string): string | null {
  const canonical = toCanonicalStage(stage);
  const base = STAGE_APTITUDE_HEADLINE_TH[canonical];
  if (base == null) return null;
  return KC("STAGE_APTITUDE_HEADLINE_TH", base, canonical);
}

/** ประโยคพรสวรรค์ → แนวอาชีพ สำหรับแทรกในบทการงาน (ธาตุถ่ายเท × เซี่ยงแซที่ปรากฏจริง) */
export function buildAptitudeCareerBridge(
  stage: string,
  outputElement: SupportedElementValue,
): string | null {
  const aptitude = resolveTalentAptitude(stage, outputElement);
  if (!aptitude) {
    return null;
  }
  const field = K("ELEMENT_APTITUDE_FIELD_TH", ELEMENT_APTITUDE_FIELD_TH)[outputElement];
  const elementTh = ELEMENT_LABELS_TH[outputElement];
  return (
    `พรสวรรค์ → แนวอาชีพ (ดาวถ่ายเท ธาตุ${elementTh}, เซี่ยงแซ ${toCanonicalStage(stage) ? TWELVE_QI_LABELS_TH[toCanonicalStage(stage) as keyof typeof TWELVE_QI_LABELS_TH] : stage}): ` +
    `จุดแข็งคือ${aptitude} ซึ่งเหมาะนำไปต่อยอดในสาย${field}`
  );
}

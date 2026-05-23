import {
  ACTIVE_RLHF_DIMENSION_NAMES,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
} from "@/lib/bazi/schema-types";
import { getBaziTopicDefinition } from "@/lib/bazi/knowledge/topic-registry";
import { getTopicIdsForAnnotationDimension } from "@/lib/bazi/knowledge/topic-dimension-bridge";

export type AnnotationDimensionMeta = {
  dimensionName: AnnotationDimensionName;
  step: number;
  title: string;
  guidance: string;
  thoughtPrompt: string;
  predictionPrompt: string;
};

export const PROOF_WORKSPACE_DIMENSION_ORDER = [
  "personality_psychology",
  "chart_foundation",
  "ten_gods_reaction",
  "balance_element",
  "love_and_family",
  "career_potential",
  "wealth_and_investment",
  "health_overview",
  "pillar_relations",
  "twelve_qi_cycle",
  "major_luck_cycles",
  "annual_star_energy",
  "red_flags",
  "actionable_advice",
  "core_prediction",
] as const satisfies readonly AnnotationDimensionName[];

const LEGACY_ANNOTATION_DIMENSION_META: readonly AnnotationDimensionMeta[] = [
  {
    dimensionName: "chart_foundation",
    step: 1,
    title: "ฐานดวงเดิม และภาพรวม",
    guidance: "สรุปโครงสร้างหลักของดวงนี้ก่อนแตะหัวข้อย่อยอื่น",
    thoughtPrompt: "ดวงนี้ตั้งอยู่บนรูปแบบใด อะไรคือภาพรวมที่ต้องเห็นก่อน",
    predictionPrompt: "สรุปภาพรวมดวงให้เป็นภาษาที่ซินแสพร้อมส่งต่อได้ทันที",
  },
  {
    dimensionName: "balance_element",
    step: 2,
    title: "ธาตุปรับสมดุล (ย่งซิ้ง)",
    guidance: "จับแกนธาตุให้คุณและธาตุที่ต้องระวังแบบตรงไปตรงมา",
    thoughtPrompt: "ธาตุใดช่วยพยุงดวงนี้ และธาตุใดทำให้เสียสมดุล",
    predictionPrompt: "สรุปสิ่งที่ควรเสริมและสิ่งที่ควรหลีกเลี่ยงจากมุมธาตุ",
  },
  {
    dimensionName: "ten_gods_reaction",
    step: 3,
    title: "ปฏิกิริยา 10 เทพ",
    guidance: "มองบทบาทตัวเด่น ตัวแฝง และแรงตีกันของ 10 เทพ",
    thoughtPrompt: "10 เทพตัวไหนเป็นตัวหลัก และมันกำลังผลักชีวิตไปทางใด",
    predictionPrompt: "แปลผล 10 เทพให้อยู่ในภาษาการใช้ชีวิตจริง",
  },
  {
    dimensionName: "twelve_qi_cycle",
    step: 4,
    title: "วัฏจักร 12 เชี่ยงแซ",
    guidance: "ใช้รอบพลังเพื่อบอกระดับแรงของสถานการณ์และอายุจร",
    thoughtPrompt: "เชี่ยงแซแต่ละหลักกำลังส่งเสริมหรือกดดันเจ้าชะตาอย่างไร",
    predictionPrompt: "สรุประดับพลังของดวงนี้จากมุม 12 เชี่ยงแซ",
  },
  {
    dimensionName: "pillar_relations",
    step: 5,
    title: "ความสัมพันธ์ระดับราศี",
    guidance: "ตรวจชง ภาคี เฮ้ง ไห่ ผั่ว แบบไม่ข้ามบริบท",
    thoughtPrompt: "มีคู่ปะทะหรือการจับคู่ใดที่ต้องยกเป็นประเด็นหลัก",
    predictionPrompt: "สรุปผลกระทบจากความสัมพันธ์ของราศีต่อชีวิตจริง",
  },
  {
    dimensionName: "health_overview",
    step: 6,
    title: "ภาพรวมสุขภาพ",
    guidance: "เน้นจุดอ่อนไหวและสิ่งที่ต้องเฝ้าระวังแบบจับต้องได้",
    thoughtPrompt: "องค์ประกอบไหนในดวงชี้ไปยังภาวะสุขภาพที่ต้องดูแลเป็นพิเศษ",
    predictionPrompt: "สรุปคำเตือนและแนวทางดูแลสุขภาพอย่างกระชับ",
  },
  {
    dimensionName: "career_potential",
    step: 7,
    title: "ศักยภาพและการงาน",
    guidance: "ชี้ภาพงานที่เหมาะกับโครงสร้างดวงจริง ไม่ขายฝัน",
    thoughtPrompt: "จุดเด่นในดวงนี้ส่งให้เหมาะกับงานหรือบทบาทแบบใด",
    predictionPrompt: "สรุปทิศทางอาชีพที่ควรไปและสิ่งที่ไม่ควรฝืน",
  },
  {
    dimensionName: "wealth_and_investment",
    step: 8,
    title: "การเงินและการลงทุน",
    guidance: "ดูวิธีหาเงิน ความเสี่ยง และจังหวะการถือทรัพย์",
    thoughtPrompt: "โครงสร้างเงินของดวงนี้ได้มาจากทางไหนและเสี่ยงตรงจุดใด",
    predictionPrompt: "สรุปภาพการเงินและแนวทางลงทุนที่เหมาะกับเจ้าชะตา",
  },
  {
    dimensionName: "love_and_family",
    step: 9,
    title: "ความรักและครอบครัว",
    guidance: "อ่านความสัมพันธ์ให้ลึกแต่ไม่ล้นเกินข้อเท็จจริงของดวง",
    thoughtPrompt: "ดวงนี้สะท้อนรูปแบบความรัก คู่ครอง หรือครอบครัวอย่างไร",
    predictionPrompt: "สรุปแนวโน้มความรักและบทเรียนเรื่องครอบครัวอย่างชัดเจน",
  },
  {
    dimensionName: "personality_psychology",
    step: 10,
    title: "นิสัยพื้นฐาน",
    guidance: "แปลแกนนิสัยให้เป็นภาษาที่ซินแสใช้สนทนากับลูกค้าได้",
    thoughtPrompt: "จุดแข็ง จุดอ่อน และแรงขับลึกของเจ้าชะตาอยู่ตรงไหน",
    predictionPrompt: "สรุปลักษณะนิสัยและภาวะทางใจที่ควรรู้",
  },
  {
    dimensionName: "major_luck_cycles",
    step: 11,
    title: "ช่วงวัยจร",
    guidance: "จับภาพถนนชีวิตใหญ่ 10 ปีแบบเห็นทิศทาง ไม่หลุดบริบท",
    thoughtPrompt: "วัยจรใหญ่กำลังพาเจ้าชะตาไปทิศไหน และมีอะไรต้องระวัง",
    predictionPrompt: "สรุปภาพรวมถนนชีวิตใหญ่ในช่วงที่เกี่ยวข้อง",
  },
  {
    dimensionName: "annual_star_energy",
    step: 12,
    title: "พลังดาวประจำปีจร",
    guidance: "ระบุแรงกระทบของปีนี้ให้เชื่อมกับดวงเดิมอย่างมีหลัก",
    thoughtPrompt: "ปีจรปัจจุบันกระทบโครงดวงเดิมตรงจุดไหนบ้าง",
    predictionPrompt: "สรุปจังหวะปีนี้ว่าควรรับมือหรือใช้โอกาสอย่างไร",
  },
  {
    dimensionName: "red_flags",
    step: 13,
    title: "คำเตือน (Red Flags)",
    guidance: "ยกเฉพาะเรื่องที่ถ้าไม่เตือนจะเสี่ยงจริง",
    thoughtPrompt: "สัญญาณอันตรายหรือข้อห้ามในดวงนี้คืออะไร",
    predictionPrompt: "สรุปสิ่งที่เจ้าชะตาต้องเลี่ยงอย่างตรงประเด็น",
  },
  {
    dimensionName: "actionable_advice",
    step: 14,
    title: "คำแนะนำ (Actionable Advice)",
    guidance: "เปลี่ยนการอ่านดวงให้เป็นการลงมือทำที่จับต้องได้",
    thoughtPrompt: "ถ้าจะช่วยเจ้าชะตาให้ขยับชีวิต ควรเริ่มจากอะไร",
    predictionPrompt: "สรุปคำแนะนำที่นำไปใช้ได้จริงทันที",
  },
  {
    dimensionName: "core_prediction",
    step: 15,
    title: "คำตอบตรงธง",
    guidance: "ปิดท้ายด้วยคำทำนายสรุปที่ตอบโจทย์หลักของเคสนี้",
    thoughtPrompt: "เมื่อรวมทุกมิติแล้ว คำตอบกลางของดวงนี้คืออะไร",
    predictionPrompt: "สรุปฟันธงคำตอบสุดท้ายแบบมั่นใจและกระชับ",
  },
] as const;

function buildRegistryBackedTitle(
  dimensionName: AnnotationDimensionName,
  fallbackTitle: string,
) {
  const topicIds = getTopicIdsForAnnotationDimension(dimensionName);

  if (topicIds.length === 0) {
    return fallbackTitle;
  }

  const topicLabels = [...new Set(topicIds.map((topicId) => getBaziTopicDefinition(topicId).thaiLabel))];

  return topicLabels.join(" / ");
}

export const ANNOTATION_DIMENSION_META: readonly AnnotationDimensionMeta[] =
  LEGACY_ANNOTATION_DIMENSION_META.map((dimension) => ({
    ...dimension,
    title: buildRegistryBackedTitle(dimension.dimensionName, dimension.title),
  }));

export const ANNOTATION_DIMENSION_TITLE_MAP = Object.fromEntries(
  LEGACY_ANNOTATION_DIMENSION_META.map((dimension) => [dimension.dimensionName, dimension.title]),
) as Record<AnnotationDimensionName, string>;

export const ACTIVE_ANNOTATION_DIMENSION_META = ANNOTATION_DIMENSION_META.filter((dimension) =>
  ACTIVE_RLHF_DIMENSION_NAMES.includes(
    dimension.dimensionName as (typeof ACTIVE_RLHF_DIMENSION_NAMES)[number],
  ),
);

export const REQUIRED_ANNOTATION_DIMENSION_META = ANNOTATION_DIMENSION_META.filter((dimension) =>
  REQUIRED_ANNOTATION_DIMENSION_NAMES.includes(
    dimension.dimensionName as (typeof REQUIRED_ANNOTATION_DIMENSION_NAMES)[number],
  ),
);

export const PROOF_WORKSPACE_DIMENSION_META = PROOF_WORKSPACE_DIMENSION_ORDER.map((dimensionName) => {
  const dimension = ANNOTATION_DIMENSION_META.find((entry) => entry.dimensionName === dimensionName);

  if (!dimension) {
    throw new Error(`Missing annotation dimension metadata for proof workspace order: ${dimensionName}`);
  }

  return dimension;
});

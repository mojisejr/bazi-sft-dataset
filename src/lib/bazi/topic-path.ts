import type { AnnotationDimensionName } from "@/lib/bazi/schema-types";

/**
 * Client-safe definition ของ stepwise reading path.
 *
 * แยกออกจาก {@link import("@/lib/bazi/topic-reading")} เพราะ topic-reading
 * import relation-reading engine (ดึง GoogleGenAI + node:crypto) ซึ่งห้ามเข้า
 * client bundle. โมดูลนี้มีแต่ข้อมูลล้วน จึงใช้ได้ทั้ง client และ server.
 */

export type TopicRelationKey = "same" | "resource" | "output" | "power" | "wealth";

export type TopicKind = "basis" | "predict";

export type TopicDefinition = {
  id: string;
  chapter: number;
  title: string;
  lens: string;
  kind: TopicKind;
  relationKeys: readonly TopicRelationKey[];
  stepNumbers: readonly number[];
  evidenceDimension: AnnotationDimensionName | null;
  usesDaYunTimeline?: boolean;
  usefulGodLookup?: "color-direction" | "deity";
};

/**
 * Calculated Basis (header) + 14 บท (ฉบับซินแสปรับ: 7 ขั้น canonical, รวมบทการพูดเข้าบทพื้นฐานดวง)
 * lens ทุกบท (ยกเว้นบท 0) นำหน้าด้วย "ดิถีแข็ง/อ่อน +"; stepNumbers อ้างอิงสคีมา 7 ขั้นใหม่
 * (ขั้น 4 = การอ่านตัวถ่ายเท, ขั้น 5 = ผลลัพธ์/โชคลาภ, ขั้น 6 = บริบทสี่เสา, ขั้น 7 = สัญญาณขั้นสูง)
 */
export const TOPIC_PATH: readonly TopicDefinition[] = [
  {
    id: "calculated_basis",
    chapter: 0,
    title: "โครงสร้างดวงชะตาพื้นฐาน (Calculated Basis)",
    lens: "4 เสา + สภาวะ 12 เชี่ยงแซ + ตารางวัยจร 5 ปี",
    kind: "basis",
    relationKeys: [],
    stepNumbers: [1, 2],
    evidenceDimension: null,
  },
  {
    id: "chart_foundation",
    chapter: 1,
    title: "พื้นฐานดวงชะตาที่ถูกกำหนด",
    lens: "ดิถีแข็ง/อ่อน + นิสัยพื้นฐานจากหลักวัน + ถ่ายเท/12 เชี่ยงแซ (รวมการพูด/การสื่อสาร)",
    kind: "predict",
    relationKeys: ["output", "same"],
    stepNumbers: [1, 2, 3, 4],
    evidenceDimension: "personality_psychology",
  },
  {
    id: "career_potential",
    chapter: 2,
    title: "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ",
    lens: "ดิถีแข็ง/อ่อน + ดาวถ่ายเท (วิธีหาเงิน) + ธาตุเสริม — เอาราศีบนหลักวันกับราศีบนหลักเดือนมาคิดร่วม ธาตุที่ใช้ได้ต้องเป็นธาตุส่งเสริมหรือคู่ธาตุหรือโชคลาภให้ทั้งสองหลักนี้",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [3, 4],
    evidenceDimension: "career_potential",
  },
  {
    id: "wealth_and_investment",
    chapter: 3,
    title: "โชคลาภที่ถูกทาง โอกาสรวยอยู่แค่เอื้อม",
    lens: "ดิถีแข็ง/อ่อน + ถ่ายเท + โชคลาภ + 12 เชี่ยงแซ",
    kind: "predict",
    relationKeys: ["wealth"],
    stepNumbers: [4, 5],
    evidenceDimension: "wealth_and_investment",
  },
  {
    id: "benefactor",
    chapter: 4,
    title: "ผู้อุปถัมภ์ที่พร้อมช่วยเหลือคือใคร",
    lens: "ดิถีแข็ง/อ่อน + ดูธาตุส่งเสริม + 12 เชี่ยงแซ / หลักปี-เดือน-วัน-ยาม ที่เป็นประโยชน์ (ส่งเสริม/คู่ธาตุ/โชคลาภ) ให้กับดิถีแล้วเป็นเชี่ยงแซดี",
    kind: "predict",
    relationKeys: ["resource", "power"],
    stepNumbers: [3],
    evidenceDimension: "ten_gods_reaction",
  },
  {
    id: "talent",
    chapter: 5,
    title: "พรสวรรค์ที่คุณค้นหามาตลอดทั้งชีวิต",
    lens: "ดิถีแข็ง/อ่อน + ตัวถ่ายเทที่ดี + ผลลัพธ์ที่ดีในระบบ 12 เชี่ยงแซ (ตัวถ่ายเทเสียให้ทายด้านดีของเชี่ยงแซเสีย; ตัวถ่ายเทราศีแฝง/ราศีบนเทียบกับหลักยาม + 12 เชี่ยงแซ)",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [3, 4, 7],
    evidenceDimension: "personality_psychology",
  },
  {
    id: "family",
    chapter: 6,
    title: "ครอบครัวอันเป็นพื้นฐานสำคัญสำหรับชีวิต",
    lens: "ดิถีแข็ง/อ่อน + ทายตามความหมายเสาปี/เสาเดือน (เสาปีคือบรรพบุรุษ เสาเดือนคือพ่อแม่) + 12 เชี่ยงแซ + ปฏิกิริยาธาตุ",
    kind: "predict",
    relationKeys: ["resource"],
    stepNumbers: [6],
    evidenceDimension: "love_and_family",
  },
  {
    id: "love_partner",
    chapter: 7,
    title: "ความรัก / คู่ครองที่เหมาะสม",
    lens: "ดิถีแข็ง/อ่อน + ฐานคู่ (ราศีล่างหลักวัน) + ธาตุคู่ครองตามเพศ + วัยจรกระทบคู่ (การถ่ายเทเทียบกับคู่ครอง + 12 เชี่ยงแซ)",
    kind: "predict",
    relationKeys: ["wealth", "power"],
    stepNumbers: [2, 4, 5],
    evidenceDimension: "love_and_family",
  },
  {
    id: "friends_foes",
    chapter: 8,
    title: "เพื่อนแท้ ศัตรู คือใคร และควรทำอย่างไร",
    lens: "ดิถีแข็ง/อ่อน + คู่ธาตุ + 12 เชี่ยงแซดี/เสีย + ปฏิกิริยา (ตำแหน่งหลักปี/เดือน/วัน/ยาม + 12 เชี่ยงแซ ความหมายดี=มิตร ความหมายเสีย=ศัตรู)",
    kind: "predict",
    relationKeys: ["same"],
    stepNumbers: [3],
    evidenceDimension: "pillar_relations",
  },
  {
    id: "partnership",
    chapter: 9,
    title: "หุ้นส่วนควรมีหรือไม่ / จะทำธุรกิจ",
    lens: "ดิถีแข็ง/อ่อน → ความจำเป็นของคู่ธาตุและธาตุเสริม — ดูหลักวัน เชี่ยงแซดีมีหุ้นส่วนได้ เชี่ยงแซไม่ดีไม่ควรมีหุ้นส่วน ดิถีนั่งบนธาตุพิฆาตไม่ควรมีหุ้นส่วน ดูเรื่องผั่วไฉ่โข่ว",
    kind: "predict",
    relationKeys: ["same", "resource"],
    stepNumbers: [1, 3],
    evidenceDimension: "career_potential",
  },
  {
    id: "subordinates",
    chapter: 10,
    title: "ลูกน้องบริวารที่ดีย่อมทำให้ธุรกิจรุ่งเรือง",
    lens: "ดิถีแข็ง/อ่อน + เสายาม (ฐานบริวาร) + ดาวถ่ายเท + 12 เชี่ยงแซ — ดูเรื่องผั่วไฉ่โข่ว/ธาตุถ่ายเทคือบริวาร + ความหมาย 12 เชี่ยงแซ",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [4, 6],
    evidenceDimension: "pillar_relations",
  },
  {
    id: "education",
    chapter: 11,
    title: "การเรียนที่ตรงสายจะช่วยให้เราร่ำรวยขึ้น",
    lens: "ดิถีแข็ง/อ่อน + ธาตุถ่ายเท + เชี่ยงแซดี + วิชาธาตุที่เสริมดิถีให้แข็งแรง วิชาที่ทำให้ธาตุถ่ายเทแข็งแรง วิชาที่ทำให้โชคลาภแข็งแรง",
    kind: "predict",
    relationKeys: ["output", "resource"],
    stepNumbers: [3, 4],
    evidenceDimension: "career_potential",
  },
  {
    id: "turning_points",
    chapter: 12,
    title: "ช่วงอายุที่ดี และช่วงที่ควรระมัดระวัง",
    lens: "ดิถีแข็ง/อ่อน + ตารางวัยจรเชิงลึก: เสาวัยจร × ปฏิกิริยาธาตุ 5 ธาตุ × 12 เชี่ยงแซ + ผั่วไฉ่โข่ว/กึ่งผั่วไฉ่โข่ว",
    kind: "predict",
    relationKeys: [],
    stepNumbers: [7],
    evidenceDimension: "major_luck_cycles",
    usesDaYunTimeline: true,
  },
  {
    id: "health",
    chapter: 13,
    title: "การดูแลสุขภาพ เพื่อเตรียมความพร้อม",
    lens: "ดิถีแข็ง/อ่อน + ธาตุน้อย=ป่วย / ธาตุเกิน=เสียสมดุล + เจ๊าะ/ซวย/ผั่ว ตามตำแหน่ง",
    kind: "predict",
    relationKeys: ["power"],
    stepNumbers: [7],
    evidenceDimension: "health_overview",
  },
  {
    id: "colors_directions",
    chapter: 14,
    title: "สี และทิศมงคล (สีกระเป๋า / สีรถ)",
    lens: "ดิถีแข็ง/อ่อน + ธาตุที่ดิถีอ่อนต้องการ (ธาตุส่งเสริม และ/หรือ คู่ธาตุ) ดิถีแข็งต้องการธาตุถ่ายเท และ/หรือ ธาตุโชคลาภ → ตารางสี/ทิศสำเร็จรูป",
    kind: "predict",
    relationKeys: [],
    stepNumbers: [1],
    evidenceDimension: "actionable_advice",
    usefulGodLookup: "color-direction",
  },
  {
    id: "guardian_deities",
    chapter: 15,
    title: "องค์เทพที่คุ้มครองดวง ช่วยหนุนให้สำเร็จ",
    lens: "ดิถีแข็ง/อ่อน + useful god (ธาตุที่ต้องการ) → ตารางองค์เทพสำเร็จรูป + เทียบกับ 12 เชี่ยงแซ ในดวง",
    kind: "predict",
    relationKeys: [],
    stepNumbers: [1],
    evidenceDimension: "actionable_advice",
    usefulGodLookup: "deity",
  },
];

export function getTopicDefinition(topicId: string): TopicDefinition {
  const topic = TOPIC_PATH.find((entry) => entry.id === topicId);

  if (!topic) {
    throw new Error(`Unknown reading topic id: ${topicId}`);
  }

  return topic;
}

export function selectTopicEvidenceDimension(topicId: string): AnnotationDimensionName | null {
  return getTopicDefinition(topicId).evidenceDimension;
}

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

/** Calculated Basis (header) + 15 บท ตามโครงสร้างรายงานมาตรฐาน */
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
    lens: "ดิถีแข็ง/อ่อน และนิสัยพื้นฐานจากหลักวัน",
    kind: "predict",
    relationKeys: ["output", "same"],
    stepNumbers: [1, 2, 3],
    evidenceDimension: "personality_psychology",
  },
  {
    id: "career_potential",
    chapter: 2,
    title: "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ",
    lens: "ดิถีแข็ง/อ่อน + ดาวถ่ายเท (วิธีหาเงิน) + ธาตุเสริม",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [3],
    evidenceDimension: "career_potential",
  },
  {
    id: "wealth_and_investment",
    chapter: 3,
    title: "โชคลาภที่ถูกทาง โอกาสรวยอยู่แค่เอื้อม",
    lens: "ธาตุโชคลาภ (สิ่งที่ดิถีพิฆาต) + ศักยภาพคว้าโชค + สภาวะ 12 เชี่ยงแซ",
    kind: "predict",
    relationKeys: ["wealth"],
    stepNumbers: [4],
    evidenceDimension: "wealth_and_investment",
  },
  {
    id: "benefactor",
    chapter: 4,
    title: "ผู้อุปถัมภ์ที่พร้อมช่วยเหลือคือใคร",
    lens: "ดาวส่งเสริม (ธาตุที่สร้างดิถี) + ดาวอำนาจ + ปฏิกิริยา 10 เทพ",
    kind: "predict",
    relationKeys: ["resource", "power"],
    stepNumbers: [3],
    evidenceDimension: "ten_gods_reaction",
  },
  {
    id: "talent",
    chapter: 5,
    title: "พรสวรรค์ที่คุณค้นหามาตลอดทั้งชีวิต",
    lens: "ดาวถ่ายเท + สภาวะ 12 เชี่ยงแซ (วิธีใช้สมอง/ทักษะ)",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [3, 6],
    evidenceDimension: "personality_psychology",
  },
  {
    id: "family",
    chapter: 6,
    title: "ครอบครัวอันเป็นพื้นฐานสำคัญสำหรับชีวิต",
    lens: "เสาปี/เดือน + ธาตุน้ำรอบตัว + ปฏิกิริยาราศี (ฐานครอบครัว)",
    kind: "predict",
    relationKeys: ["resource"],
    stepNumbers: [5],
    evidenceDimension: "love_and_family",
  },
  {
    id: "love_partner",
    chapter: 7,
    title: "ความรัก / คู่ครองที่เหมาะสม",
    lens: "ฐานคู่ (ราศีล่างหลักวัน) + ธาตุคู่ครองตามเพศ + วัยจรกระทบคู่",
    kind: "predict",
    relationKeys: ["wealth", "power"],
    stepNumbers: [2, 4],
    evidenceDimension: "love_and_family",
  },
  {
    id: "friends_foes",
    chapter: 8,
    title: "เพื่อนแท้ ศัตรู คือใคร และควรทำอย่างไร",
    lens: "คู่ธาตุ (same) + สภาวะ 12 เชี่ยงแซดี/เสีย + ปฏิกิริยา",
    kind: "predict",
    relationKeys: ["same"],
    stepNumbers: [3],
    evidenceDimension: "pillar_relations",
  },
  {
    id: "partnership",
    chapter: 9,
    title: "หุ้นส่วนควรมีหรือไม่ / จะทำธุรกิจ",
    lens: "ดิถีแข็ง/อ่อน → ความจำเป็นของคู่ธาตุและธาตุเสริม",
    kind: "predict",
    relationKeys: ["same", "resource"],
    stepNumbers: [1, 3],
    evidenceDimension: "career_potential",
  },
  {
    id: "subordinates",
    chapter: 10,
    title: "ลูกน้องบริวารที่ดีย่อมทำให้ธุรกิจรุ่งเรือง",
    lens: "เสายาม (ฐานบริวาร) + ดาวถ่ายเท + สภาวะ 12 เชี่ยงแซ",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [5],
    evidenceDimension: "pillar_relations",
  },
  {
    id: "education",
    chapter: 11,
    title: "การเรียนที่ตรงสายจะช่วยให้เราร่ำรวยขึ้น",
    lens: "ดาวถ่ายเท + สภาวะเชี่ยงแซดี + วิชาธาตุที่เสริมดิถี",
    kind: "predict",
    relationKeys: ["output", "resource"],
    stepNumbers: [3],
    evidenceDimension: "career_potential",
  },
  {
    id: "turning_points",
    chapter: 12,
    title: "ช่วงอายุที่ดี และช่วงที่ควรระมัดระวัง (Key Turning Points)",
    lens: "ตารางวัยจรเชิงลึก: เสาวัยจร × ปฏิกิริยา 10 เทพ × สภาวะ 12 เชี่ยงแซ",
    kind: "predict",
    relationKeys: [],
    stepNumbers: [6],
    evidenceDimension: "major_luck_cycles",
    usesDaYunTimeline: true,
  },
  {
    id: "health",
    chapter: 13,
    title: "การดูแลสุขภาพ เพื่อเตรียมความพร้อม",
    lens: "ธาตุน้อย=ป่วย / ธาตุเกิน=เสียสมดุล + เจ๊าะ/ซวย/ผั่ว ตามตำแหน่ง",
    kind: "predict",
    relationKeys: ["power"],
    stepNumbers: [6],
    evidenceDimension: "health_overview",
  },
  {
    id: "colors_directions",
    chapter: 14,
    title: "สี และทิศมงคล (สีกระเป๋า / สีรถ)",
    lens: "ธาตุที่ดิถีอ่อนต้องการ (useful god) → ตารางสี/ทิศสำเร็จรูป",
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
    lens: "useful god (ธาตุที่ต้องการ) → ตารางองค์เทพสำเร็จรูป",
    kind: "predict",
    relationKeys: [],
    stepNumbers: [1],
    evidenceDimension: "actionable_advice",
    usefulGodLookup: "deity",
  },
  {
    id: "speech",
    chapter: 16,
    title: "การพูดและการสื่อสาร (ตามธาตุถ่ายเท)",
    lens: "ดาวถ่ายเท (食傷) + สภาวะ 12 เชี่ยงแซรายหลัก → ลักษณะการพูด/การฟัง",
    kind: "predict",
    relationKeys: ["output"],
    stepNumbers: [6],
    evidenceDimension: "personality_psychology",
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

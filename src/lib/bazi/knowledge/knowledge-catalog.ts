/**
 * Catalog ของ "ตารางองค์ความรู้" ที่แก้ออนไลน์ได้ (เฟส 2) — แหล่งความจริงสำหรับ UI/GET API
 * tableId ต้องตรงกับที่ใช้ใน K("...") ใน topic-knowledge.ts
 *
 * server-only (import ค่าคงที่จาก topic-knowledge ที่อ่าน fs) — UI รับข้อมูลผ่าน GET API เป็น JSON
 */
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { TWELVE_QI_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import {
  CHAPTER_ASPECT_TH,
  CHAPTER_HEADLINE_TH,
  CHAPTER_INTRO_TH,
  CHAPTER_SUMMARY_TH,
} from "@/lib/bazi/reading-phrases";
import {
  BAND_OPENING_TH,
  BENEFACTOR_PERSON_TH,
  CHONG_POSITION_TH,
  DEITY_ROLE_BENEFIT_TH,
  ELEMENT_COLOR_BENEFIT_TH,
  ELEMENT_DIRECTION_TH,
  ELEMENT_HEALTH_BEHAVIOR_TH,
  ELEMENT_IMAGERY_TH,
  ELEMENT_SHAPE_TH,
  ELEMENT_TEMPER_FLAT_TH,
  EXCESS_HEALTH_TH,
  FACULTY_BY_ELEMENT_TH,
  FAMILY_KINSHIP_TH,
  FRIEND_POSITION_TH,
  HENG_PAIR_MEANING_TH,
  OUTPUT_CHANNEL_TH,
  OUTPUT_STAR_TALENT_TH,
  PO_PILLAR_MEANING_TH,
  QI_FAMILY_TH,
  QI_MARKET_TH,
  QI_TALENT_POS_TH,
  QI_TIER_OUTCOME_TH,
  QI_WEALTH_TH,
  RESOURCE_VIRTUE_TH,
  ROLE_OUTCOME_FLAT_TH,
  ROLE_OUTCOME_SCHOOL_FLAT_TH,
  STEM_NATURE_TH,
  WEALTH_SOURCE_TH,
  YEAR_CUSTOMER_TH,
} from "@/lib/bazi/topic-knowledge";
import {
  BAND_LIFE_TH,
  ELEMENT_CLOSING_SIMILE_FLAT_TH,
  ELEMENT_DEITY_BENEFIT_TH,
  TOPIC_CLOSING_SIMILE_TH,
} from "@/lib/bazi/reading-phrases";
import {
  ELEMENT_APTITUDE_FIELD_TH,
  STAGE_APTITUDE_HEADLINE_TH,
  TALENT_APTITUDE_FLAT_TH,
} from "@/lib/bazi/talent-aptitude";

export type KnowledgeKeyKind =
  | "topic"
  | "element"
  | "qi"
  | "role"
  | "stem"
  | "ganzhi"
  | "pillar"
  | "raw";

export type KnowledgeCatalogEntry = {
  tableId: string;
  label: string;
  keyKind: KnowledgeKeyKind;
  /** ค่าเริ่มต้น (default) ของแต่ละคีย์ */
  defaults: Record<string, string>;
};

export const KNOWLEDGE_CATALOG: readonly KnowledgeCatalogEntry[] = [
  { tableId: "CHAPTER_INTRO_TH", label: "เกริ่นนำบท (intro)", keyKind: "topic", defaults: CHAPTER_INTRO_TH },
  { tableId: "CHAPTER_SUMMARY_TH", label: "สรุปท้ายบท (advice)", keyKind: "topic", defaults: CHAPTER_SUMMARY_TH },
  { tableId: "CHAPTER_HEADLINE_TH", label: "หัวข้อเจาะลึก (headline)", keyKind: "topic", defaults: CHAPTER_HEADLINE_TH },
  { tableId: "CHAPTER_ASPECT_TH", label: "ป้ายแง่มุม (aspect)", keyKind: "topic", defaults: CHAPTER_ASPECT_TH },
  { tableId: "QI_WEALTH_TH", label: "ลักษณะการเงินตาม 12 เชี่ยงแซ", keyKind: "qi", defaults: QI_WEALTH_TH },
  { tableId: "QI_MARKET_TH", label: "กลุ่มตลาดตาม 12 เชี่ยงแซ", keyKind: "qi", defaults: QI_MARKET_TH },
  { tableId: "YEAR_CUSTOMER_TH", label: "กลุ่มลูกค้าตามธาตุ (เสาปี)", keyKind: "element", defaults: YEAR_CUSTOMER_TH },
  { tableId: "OUTPUT_CHANNEL_TH", label: "ช่องทางสื่อสาร/การตลาดตามธาตุถ่ายเท", keyKind: "element", defaults: OUTPUT_CHANNEL_TH },
  { tableId: "ELEMENT_HEALTH_BEHAVIOR_TH", label: "พฤติกรรม → สุขภาพ ตามธาตุดิถี", keyKind: "element", defaults: ELEMENT_HEALTH_BEHAVIOR_TH },
  { tableId: "RESOURCE_VIRTUE_TH", label: "คุณธรรมเรียกผู้อุปถัมภ์ ตามธาตุ", keyKind: "element", defaults: RESOURCE_VIRTUE_TH },
  { tableId: "FAMILY_KINSHIP_TH", label: "เครือญาติ ตามบทบาทธาตุ", keyKind: "role", defaults: FAMILY_KINSHIP_TH },

  // — เฟส 3: ดึงตารางคำทำนายที่เหลือเข้าตัวแก้ทั้งหมด —
  { tableId: "STEM_NATURE_TH", label: "ภาพธาตุประจำราศีบน (10 ก้าน)", keyKind: "stem", defaults: STEM_NATURE_TH },
  { tableId: "ELEMENT_IMAGERY_TH", label: "ภาพธาตุที่ล้อมรอบในดวง", keyKind: "element", defaults: ELEMENT_IMAGERY_TH },
  { tableId: "EXCESS_HEALTH_TH", label: "สุขภาพเมื่อธาตุมากเกิน", keyKind: "element", defaults: EXCESS_HEALTH_TH },
  { tableId: "ELEMENT_COLOR_BENEFIT_TH", label: "สีมงคลตามธาตุ", keyKind: "element", defaults: ELEMENT_COLOR_BENEFIT_TH },
  { tableId: "ELEMENT_SHAPE_TH", label: "รูปทรง/สไตล์ตามธาตุ", keyKind: "element", defaults: ELEMENT_SHAPE_TH },
  { tableId: "ELEMENT_DIRECTION_TH", label: "ทิศมงคลตามธาตุ", keyKind: "element", defaults: ELEMENT_DIRECTION_TH },
  { tableId: "FACULTY_BY_ELEMENT_TH", label: "สายการเรียนตามธาตุ", keyKind: "element", defaults: FACULTY_BY_ELEMENT_TH },
  { tableId: "RESOURCE_VIRTUE_TH", label: "คุณธรรมเรียกผู้อุปถัมภ์ (ซ้ำ)", keyKind: "element", defaults: RESOURCE_VIRTUE_TH },
  { tableId: "PO_PILLAR_MEANING_TH", label: "ความหมายเสาผั่ว (破) ราย 60 กะจื่อ", keyKind: "ganzhi", defaults: PO_PILLAR_MEANING_TH },
  { tableId: "CHONG_POSITION_TH", label: "ผลการชง (冲) ตามตำแหน่งเสา", keyKind: "raw", defaults: CHONG_POSITION_TH },
  { tableId: "HENG_PAIR_MEANING_TH", label: "ความหมายคู่เฮ้ง (刑)", keyKind: "raw", defaults: HENG_PAIR_MEANING_TH },
  { tableId: "QI_TIER_OUTCOME_TH", label: "ผลวัยจรตามระดับเชี่ยงแซ", keyKind: "raw", defaults: QI_TIER_OUTCOME_TH },
  { tableId: "QI_TALENT_POS_TH", label: "พรสวรรค์ตาม 12 เชี่ยงแซ", keyKind: "qi", defaults: QI_TALENT_POS_TH },
  { tableId: "QI_FAMILY_TH", label: "บรรยากาศครอบครัวตาม 12 เชี่ยงแซ", keyKind: "qi", defaults: QI_FAMILY_TH },
  { tableId: "WEALTH_SOURCE_TH", label: "แหล่งที่มาของเงินตามตำแหน่งเสา", keyKind: "pillar", defaults: WEALTH_SOURCE_TH },
  { tableId: "FRIEND_POSITION_TH", label: "มิตร/บริวารตามตำแหน่งเสา", keyKind: "pillar", defaults: FRIEND_POSITION_TH },
  { tableId: "DEITY_ROLE_BENEFIT_TH", label: "สิ่งเสริมดวงตามบทบาทธาตุ", keyKind: "role", defaults: DEITY_ROLE_BENEFIT_TH },
  { tableId: "BENEFACTOR_PERSON_TH", label: "ผู้อุปถัมภ์ตามบทบาทธาตุ", keyKind: "raw", defaults: BENEFACTOR_PERSON_TH },
  { tableId: "OUTPUT_STAR_TALENT_TH", label: "พรสวรรค์ตามดาวถ่ายเท (食神/傷官)", keyKind: "raw", defaults: OUTPUT_STAR_TALENT_TH },
  { tableId: "BAND_OPENING_TH", label: "ประโยคเปิดตามกำลังดิถี", keyKind: "raw", defaults: BAND_OPENING_TH },
  // nested (แตกเป็นช่องย่อยทุก combination ด้วย compositeKey "a|b")
  { tableId: "ELEMENT_TEMPER_TH", label: "นิสัยตามธาตุดิถี × แข็ง/อ่อน", keyKind: "raw", defaults: ELEMENT_TEMPER_FLAT_TH },
  { tableId: "ROLE_OUTCOME_TH", label: "ผลวัยจรตามบทบาทธาตุ × ดี/ร้าย", keyKind: "raw", defaults: ROLE_OUTCOME_FLAT_TH },
  { tableId: "ROLE_OUTCOME_SCHOOL_TH", label: "ผลวัยจร (วัยเรียน) × ดี/ร้าย", keyKind: "raw", defaults: ROLE_OUTCOME_SCHOOL_FLAT_TH },

  // — เฟส 4: คำทำนายจาก reading-phrases + talent-aptitude —
  { tableId: "ELEMENT_DEITY_BENEFIT_TH", label: "สรรพคุณองค์เทพตามธาตุ", keyKind: "element", defaults: ELEMENT_DEITY_BENEFIT_TH },
  { tableId: "TOPIC_CLOSING_SIMILE_TH", label: "ประโยคปิดบทเฉพาะหัวข้อ", keyKind: "topic", defaults: TOPIC_CLOSING_SIMILE_TH },
  { tableId: "ELEMENT_CLOSING_SIMILE_TH", label: "ประโยคปิดบทเชิงเปรียบ ตามธาตุ (หลายแบบ)", keyKind: "raw", defaults: ELEMENT_CLOSING_SIMILE_FLAT_TH },
  { tableId: "BAND_LIFE_TH", label: "สรุปรวมดวงตามกำลังดิถี", keyKind: "raw", defaults: BAND_LIFE_TH },
  { tableId: "STAGE_APTITUDE_HEADLINE_TH", label: "หัวเรื่องพรสวรรค์ตามเชี่ยงแซ", keyKind: "raw", defaults: STAGE_APTITUDE_HEADLINE_TH },
  { tableId: "ELEMENT_APTITUDE_FIELD_TH", label: "สายอาชีพตามธาตุถ่ายเท", keyKind: "element", defaults: ELEMENT_APTITUDE_FIELD_TH },
  { tableId: "TALENT_APTITUDE_TH", label: "พรสวรรค์ 12 เชี่ยงแซ × 5 ธาตุ (60 ช่อง)", keyKind: "raw", defaults: TALENT_APTITUDE_FLAT_TH },
];

export function getCatalogEntry(tableId: string): KnowledgeCatalogEntry | undefined {
  return KNOWLEDGE_CATALOG.find((entry) => entry.tableId === tableId);
}

const ROLE_LABEL_TH: Record<string, string> = {
  same: "คู่ธาตุ (พี่น้อง/เพื่อน)",
  resource: "ธาตุส่งเสริม (แม่/ครู)",
  output: "ธาตุถ่ายเท (ผลงาน/ลูก)",
  power: "ธาตุพิฆาต (เจ้านาย/แรงกดดัน)",
  wealth: "ธาตุลาภ (พ่อ/ทรัพย์)",
};

/** ป้ายไทยของคีย์ในตาราง (สำหรับโชว์ในตัวแก้) */
export function keyLabel(keyKind: KnowledgeKeyKind, key: string): string {
  if (keyKind === "topic") {
    const topic = TOPIC_PATH.find((entry) => entry.id === key);
    return topic ? `บท ${topic.chapter}: ${topic.title}` : key;
  }
  if (keyKind === "qi") {
    return (TWELVE_QI_LABELS_TH as Record<string, string>)[key] ?? key;
  }
  if (keyKind === "role") {
    return ROLE_LABEL_TH[key] ?? key;
  }
  if (keyKind === "pillar") {
    return PILLAR_LABEL_TH[key] ?? key;
  }
  // stem / ganzhi / raw → คีย์อ่านได้อยู่แล้ว (อักษรจีน หรือ composite "a|b" หรือ key ไทย)
  return key;
}

const PILLAR_LABEL_TH: Record<string, string> = {
  year: "เสาปี",
  month: "เสาเดือน",
  day: "เสาวัน",
  hour: "เสายาม",
};

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
  DAYUN_DIMENSION_TH,
  DEITY_ROLE_BENEFIT_TH,
  FOUNDATION_TEMPLATE_TH,
  HEALTH_TEMPLATE_TH,
  LOVE_TEMPLATE_TH,
  MISC_TEMPLATE_TH,
  TIMING_TEMPLATE_TH,
  WEALTH_TEMPLATE_TH,
  STRENGTH_BALANCE_TH,
  USEFUL_BALANCE_TEMPLATE_TH,
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
  ANIMAL_LUCKY_TH,
  CAREER_BUSINESS_BAND_TH,
  CAREER_RELATION_TH,
  COLOR_BAG_TH,
  COLOR_CAR_TH,
  DEITY_LOWER_TH,
  DEITY_UPPER_TH,
  ELEMENT_COLOR_GEM_TH,
  ELEMENT_MERIT_DEITY_TH,
  HEALTH_BY_ELEMENT_TH,
  LOVE_DAY_REACTION_TH,
  LOVE_DAY_SPOUSE_TH,
  LOVE_GENDER_BAND_TH,
  VAULT_DAMAGE_TH,
  RELATION_KIN_TH,
  ROLE_OUTCOME_FLAT_TH,
  ROLE_OUTCOME_SCHOOL_FLAT_TH,
  SEASON_LABEL_TH,
  SELF_HENG_MEANING_TH,
  SISING_STAR_TH,
  SOURCE7_CAREER_TH,
  STEM_NATURE_TH,
  WEALTH_BAND_TH,
  WEALTH_SOURCE_TH,
  YEAR_CUSTOMER_TH,
} from "@/lib/bazi/topic-knowledge";
import {
  ELEMENT_CLOSING_SIMILE_FLAT_TH,
  ELEMENT_DEITY_BENEFIT_TH,
  TOPIC_CLOSING_SIMILE_TH,
} from "@/lib/bazi/reading-phrases";
import {
  ELEMENT_APTITUDE_FIELD_TH,
  STAGE_APTITUDE_HEADLINE_TH,
  TALENT_APTITUDE_FLAT_TH,
  TALENT_BRIDGE_TH,
} from "@/lib/bazi/talent-aptitude";

import {
  FOUNDATION_TEMPLATE_LABELS_TH,
  HEALTH_TEMPLATE_LABELS_TH,
  LOVE_TEMPLATE_LABELS_TH,
  MISC_TEMPLATE_LABELS_TH,
  STRENGTH_BALANCE_LABELS_TH,
  TALENT_BRIDGE_LABELS_TH,
  TIMING_TEMPLATE_LABELS_TH,
  USEFUL_BALANCE_LABELS_TH,
  WEALTH_TEMPLATE_LABELS_TH,
} from "@/lib/bazi/knowledge/template-labels";

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
  /** ป้ายชื่อรายช่อง (สำหรับตาราง template ที่ใช้ label ตารางร่วมกัน) — key เดียวกับ defaults */
  entryLabels?: Record<string, string>;
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
  { tableId: "PO_PILLAR_MEANING_TH", label: "ความหมายเสาผั่ว (破) ราย 60 กะจื่อ", keyKind: "ganzhi", defaults: PO_PILLAR_MEANING_TH },
  { tableId: "CHONG_POSITION_TH", label: "ผลการชง (冲) ตามตำแหน่งเสา", keyKind: "raw", defaults: CHONG_POSITION_TH },
  { tableId: "HENG_PAIR_MEANING_TH", label: "ความหมายคู่เฮ้ง (刑)", keyKind: "raw", defaults: HENG_PAIR_MEANING_TH },
  { tableId: "SELF_HENG_MEANING_TH", label: "ความหมายการเฮ้งตนเอง (自刑)", keyKind: "raw", defaults: SELF_HENG_MEANING_TH },
  { tableId: "QI_TIER_OUTCOME_TH", label: "ผลวัยจรตามระดับเชี่ยงแซ", keyKind: "raw", defaults: QI_TIER_OUTCOME_TH },
  { tableId: "DAYUN_DIMENSION_TH", label: "มิติชีวิตแต่ละเสาในวัยจร", keyKind: "pillar", defaults: DAYUN_DIMENSION_TH },
  { tableId: "STRENGTH_BALANCE_TH", label: "คำบรรยายสมดุลตามกำลังดิถี (อ่อน/แข็ง/สมดุล)", keyKind: "raw", defaults: STRENGTH_BALANCE_TH, entryLabels: STRENGTH_BALANCE_LABELS_TH },
  { tableId: "USEFUL_BALANCE_TEMPLATE_TH", label: "ประโยคธาตุที่ช่วยปรับสมดุล ({ธาตุ} = ธาตุประโยชน์)", keyKind: "raw", defaults: USEFUL_BALANCE_TEMPLATE_TH, entryLabels: USEFUL_BALANCE_LABELS_TH },
  { tableId: "HEALTH_TEMPLATE_TH", label: "โครงประโยคบทสุขภาพ (มี placeholder {…})", keyKind: "raw", defaults: HEALTH_TEMPLATE_TH, entryLabels: HEALTH_TEMPLATE_LABELS_TH },
  { tableId: "WEALTH_TEMPLATE_TH", label: "โครงประโยคบทโชคลาภ (มี placeholder {…})", keyKind: "raw", defaults: WEALTH_TEMPLATE_TH, entryLabels: WEALTH_TEMPLATE_LABELS_TH },
  { tableId: "FOUNDATION_TEMPLATE_TH", label: "โครงประโยคบทพื้นฐานชะตา/นิสัย (มี placeholder {…})", keyKind: "raw", defaults: FOUNDATION_TEMPLATE_TH, entryLabels: FOUNDATION_TEMPLATE_LABELS_TH },
  { tableId: "TIMING_TEMPLATE_TH", label: "โครงประโยคบทจังหวะชีวิต/วัยจร (มี placeholder {…})", keyKind: "raw", defaults: TIMING_TEMPLATE_TH, entryLabels: TIMING_TEMPLATE_LABELS_TH },
  { tableId: "LOVE_TEMPLATE_TH", label: "โครงประโยคบทความรัก (มี placeholder {…})", keyKind: "raw", defaults: LOVE_TEMPLATE_TH, entryLabels: LOVE_TEMPLATE_LABELS_TH },
  { tableId: "MISC_TEMPLATE_TH", label: "โครงประโยคบทสี/สิ่งศักดิ์สิทธิ์/อาชีพ/ผู้อุปถัมภ์/มิตร/การศึกษา (มี placeholder {…})", keyKind: "raw", defaults: MISC_TEMPLATE_TH, entryLabels: MISC_TEMPLATE_LABELS_TH },
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
  { tableId: "STAGE_APTITUDE_HEADLINE_TH", label: "หัวเรื่องพรสวรรค์ตามเชี่ยงแซ", keyKind: "raw", defaults: STAGE_APTITUDE_HEADLINE_TH },
  { tableId: "ELEMENT_APTITUDE_FIELD_TH", label: "สายอาชีพตามธาตุถ่ายเท", keyKind: "element", defaults: ELEMENT_APTITUDE_FIELD_TH },
  { tableId: "SOURCE7_CAREER_TH", label: "ลิสต์อาชีพตามธาตุ (useful god)", keyKind: "element", defaults: SOURCE7_CAREER_TH },
  { tableId: "HEALTH_BY_ELEMENT_TH", label: "สุขภาพ/อวัยวะตามธาตุที่อ่อนแอ", keyKind: "element", defaults: HEALTH_BY_ELEMENT_TH },
  { tableId: "SEASON_LABEL_TH", label: "ป้ายฤดูเกิด (ฤดู → บรรยากาศ)", keyKind: "raw", defaults: SEASON_LABEL_TH },
  { tableId: "SISING_STAR_TH", label: "ดาวสี่ซิ้ง 12 ดาว (ชื่อ/พลัง/6 ด้าน)", keyKind: "raw", defaults: SISING_STAR_TH },
  { tableId: "RELATION_KIN_TH", label: "วงศาคณาญาติตามปฏิกิริยาธาตุ", keyKind: "role", defaults: RELATION_KIN_TH },
  { tableId: "WEALTH_BAND_TH", label: "หลักการเงินตามกำลังดิถี", keyKind: "raw", defaults: WEALTH_BAND_TH },
  { tableId: "CAREER_BUSINESS_BAND_TH", label: "อาชีพ/ธุรกิจตามกำลังดิถี", keyKind: "raw", defaults: CAREER_BUSINESS_BAND_TH },
  { tableId: "LOVE_GENDER_BAND_TH", label: "โอกาสมีคู่ตามเพศ × กำลังดิถี", keyKind: "raw", defaults: LOVE_GENDER_BAND_TH },
  { tableId: "COLOR_BAG_TH", label: "สีกระเป๋า/อุปกรณ์ ตามดิถี × ราศีบนเดือน", keyKind: "raw", defaults: COLOR_BAG_TH },
  { tableId: "COLOR_CAR_TH", label: "สีรถ/ของเคลื่อนที่ ตามดิถี × ราศีบนยาม", keyKind: "raw", defaults: COLOR_CAR_TH },
  { tableId: "ANIMAL_LUCKY_TH", label: "สัตว์มงคล ตามดิถี × ราศีบนเดือน", keyKind: "raw", defaults: ANIMAL_LUCKY_TH },
  { tableId: "CAREER_RELATION_TH", label: "คำทำนายความสัมพันธ์การงาน (คู่รัก/หุ้นส่วน/ลูกน้อง × เชี่ยงแซ)", keyKind: "raw", defaults: CAREER_RELATION_TH },
  { tableId: "VAULT_DAMAGE_TH", label: "ผลขุมคลังถูกทำลาย ตามดิถี × ก้านรั่ว", keyKind: "raw", defaults: VAULT_DAMAGE_TH },
  { tableId: "LOVE_DAY_SPOUSE_TH", label: "ลักษณะคู่ครอง ตามดิถี × ราศีล่างวัน", keyKind: "raw", defaults: LOVE_DAY_SPOUSE_TH },
  { tableId: "LOVE_DAY_REACTION_TH", label: "ปฏิกิริยาคู่ครอง ตามดิถี × ราศีล่างวัน", keyKind: "raw", defaults: LOVE_DAY_REACTION_TH },
  { tableId: "ELEMENT_COLOR_GEM_TH", label: "สี/อัญมณี/วัตถุมงคล ตามธาตุ", keyKind: "raw", defaults: ELEMENT_COLOR_GEM_TH },
  { tableId: "ELEMENT_MERIT_DEITY_TH", label: "การทำบุญ/สิ่งศักดิ์สิทธิ์ ตามธาตุ", keyKind: "raw", defaults: ELEMENT_MERIT_DEITY_TH },
  { tableId: "DEITY_UPPER_TH", label: "เทพประจำราศีบน (10 ก้าน)", keyKind: "stem", defaults: DEITY_UPPER_TH },
  { tableId: "DEITY_LOWER_TH", label: "เทพประจำราศีล่าง (12 กิ่ง)", keyKind: "raw", defaults: DEITY_LOWER_TH },
  { tableId: "TALENT_APTITUDE_TH", label: "พรสวรรค์ 12 เชี่ยงแซ × 5 ธาตุ (60 ช่อง)", keyKind: "raw", defaults: TALENT_APTITUDE_FLAT_TH },
  { tableId: "TALENT_BRIDGE_TH", label: "โครงประโยคพรสวรรค์→แนวอาชีพ (มี placeholder {…})", keyKind: "raw", defaults: TALENT_BRIDGE_TH, entryLabels: TALENT_BRIDGE_LABELS_TH },
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

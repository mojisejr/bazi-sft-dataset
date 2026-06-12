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
  ELEMENT_HEALTH_BEHAVIOR_TH,
  FAMILY_KINSHIP_TH,
  OUTPUT_CHANNEL_TH,
  QI_MARKET_TH,
  QI_WEALTH_TH,
  RESOURCE_VIRTUE_TH,
  YEAR_CUSTOMER_TH,
} from "@/lib/bazi/topic-knowledge";

export type KnowledgeKeyKind = "topic" | "element" | "qi" | "role";

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
  return key; // element keys เป็นไทยอยู่แล้ว (ไม้/ไฟ/ดิน/ทอง/น้ำ)
}

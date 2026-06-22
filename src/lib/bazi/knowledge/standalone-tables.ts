/**
 * Registry ของ "ตารางอิสระ" ที่แก้ออนไลน์ได้ แต่ "ไม่ผูกกับ engine" (free-form core data)
 * — ใช้ shape เดียวกับ KnowledgeCatalogEntry แต่อยู่นอก KNOWLEDGE_CATALOG โดยตั้งใจ
 *   (ถ้าใส่ใน catalog จะชน guardrail ทิศ B ใน knowledge-catalog-coverage.test.ts เพราะ engine ไม่อ้าง tableId)
 *
 * ใช้กลไกบันทึก/เผยแพร่เดิมทุกอย่าง: surface="knowledge", kind="table",
 *   entityKey = `table|{tableId}|{key}` → เก็บใน bazi_doctrine_draft / bazi_knowledge_override (kind="table")
 *
 * pure data — import ได้ทั้ง server (route) และ client เพราะดึงแค่ค่าคงที่บริสุทธิ์
 */
import type { KnowledgeCatalogEntry } from "@/lib/bazi/knowledge/knowledge-catalog";

// หมายเหตุ: ตาราง 50 ดิถี/กำลัง · 12 นักษัตร · 60 กะจื่อ ถูกย้ายไป NewData แล้ว
// (group daymaster_strength / zodiac_nisai / ganzhi_nisai) — แก้ในแอดมิน "ข้อมูลใหม่" แทน
/** บท 10 บริวาร — ลักษณะบริวารจาก 60 กะจื่อ (matching เสายาม) ให้ซินแสแก้รายกะจื่อ */
export const SUBORDINATE_MATCHING_ID = "SUBORDINATE_MATCHING_TH";
/** บท 11 การเรียน — คลังความรู้ 5 ธาตุ (วิชา/ทักษะ/แนวเรียนต่อธาตุ) */
export const ELEMENT_LEARNING_BANK_ID = "ELEMENT_LEARNING_BANK_TH";

/** 10 ราศีบน (天干) ตามลำดับ */
export const STEM_ORDER = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

/** 12 ราศีล่าง (地支) ตามลำดับ */
export const BRANCH_ORDER = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
] as const;

/** 5 ระดับกำลังดิถี (คอลัมน์ของตารางเมทริกซ์) */
export const STRENGTH_BANDS = [
  { key: "over_strong", label: "แข็งเกินไป" },
  { key: "strong", label: "แข็ง" },
  { key: "balanced", label: "สมดุล" },
  { key: "weak", label: "อ่อน" },
  { key: "over_weak", label: "อ่อนเกินไป" },
] as const;

/**
 * 60 กะจี่อ (六十甲子) — จัดเรียง+ให้เลขตาม "ตารางจัดกลุ่มตามราศีบน":
 * ไล่ทีละก้าน (10 ก้าน) แต่ละก้านมี 6 กะจื่อเรียงตามราศีล่าง (parity ของ index ก้าน=กิ่ง จึงเป็นคู่ที่ถูกต้องในวัฏจักร)
 * → ordinal เดินต่อเนื่อง 1..60 ตรงกับลำดับช่องในตาราง (甲=1–6, 乙=7–12, … 癸=55–60)
 */
export const SIXTY_JIAZI: { ordinal: number; ganzhi: string }[] = (() => {
  const list: { ordinal: number; ganzhi: string }[] = [];
  let ordinal = 1;
  STEM_ORDER.forEach((stem, si) => {
    BRANCH_ORDER.forEach((branch, bi) => {
      if (si % 2 !== bi % 2) return; // คู่ก้าน-กิ่งที่ถูกต้องในวัฏจักร 60
      list.push({ ordinal: ordinal++, ganzhi: stem + branch });
    });
  });
  return list;
})();

/** บท 10 · ลักษณะบริวาร 60 กะจื่อ (matching เสายาม) — default = ตัวกะจื่อเอง ให้ซินแสเติมคำอ่าน */
function buildSubordinateMatchingEntry(): KnowledgeCatalogEntry {
  const defaults: Record<string, string> = {};
  const entryLabels: Record<string, string> = {};
  for (const { ordinal, ganzhi } of SIXTY_JIAZI) {
    defaults[ganzhi] = "";
    entryLabels[ganzhi] = `#${ordinal} ${ganzhi}`;
  }
  return {
    tableId: SUBORDINATE_MATCHING_ID,
    label: "บท 10 · ลักษณะบริวาร (60 กะจื่อ — matching เสายาม)",
    keyKind: "raw",
    defaults,
    entryLabels,
  };
}

/** บท 11 · คลังความรู้ 5 ธาตุ — วิชา/ทักษะ/แนวการเรียนตามธาตุ (key = ชื่อธาตุไทย)
 *  export เพื่อใช้เป็น defaults ของ K() ใน topic-knowledge (overlay override ทับได้) */
export const ELEMENT_LEARNING_BANK_DEFAULTS: Record<string, string> = {
  "ไม้": "สายภาษา/การสื่อสาร/การศึกษา/งานเขียน-สร้างสรรค์ และความรู้ที่ต่อยอดเติบโตได้เรื่อย ๆ เรียนแบบค่อยเป็นค่อยไปสะสมทีละขั้น",
  "ไฟ": "สายสื่อ/ศิลปะ/การนำเสนอ/วิชาที่ใช้ความคิดสร้างสรรค์และพลังแสดงออก เรียนได้ดีเมื่อมีเวทีให้โชว์และแรงบันดาลใจ",
  "ดิน": "สายปฏิบัติ/วิศวกรรม/อสังหาฯ/บริหารจัดการที่จับต้องได้ เรียนแบบลงมือทำซ้ำจนชำนาญ มั่นคงเป็นระบบ",
  "ทอง": "สายตรรกะ/เทคนิค/กฎเกณฑ์/วิเคราะห์-ตัดสินใจเฉียบคม (วิศวะ/คอม/กฎหมาย/การเงินเชิงระบบ) เรียนแบบมีโครงสร้างชัด",
  "น้ำ": "สายการค้า/บริการ/ข้อมูล/การเงิน-การลงทุน/เครือข่าย เรียนแบบยืดหยุ่นปรับตัวไว เก่งเชื่อมโยงและต่อรอง",
};
function buildElementLearningBankEntry(): KnowledgeCatalogEntry {
  const defaults: Record<string, string> = {};
  const entryLabels: Record<string, string> = {};
  for (const el of ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"]) {
    defaults[el] = ELEMENT_LEARNING_BANK_DEFAULTS[el] ?? "";
    entryLabels[el] = `ธาตุ${el}`;
  }
  return {
    tableId: ELEMENT_LEARNING_BANK_ID,
    label: "บท 11 · คลังความรู้ 5 ธาตุ (วิชา/ทักษะ/แนวเรียน)",
    keyKind: "raw",
    defaults,
    entryLabels,
  };
}

export const STANDALONE_EDITABLE_TABLES: readonly KnowledgeCatalogEntry[] = [
  buildSubordinateMatchingEntry(),
  buildElementLearningBankEntry(),
];

export const STANDALONE_TABLE_IDS = new Set(
  STANDALONE_EDITABLE_TABLES.map((entry) => entry.tableId),
);

export function getStandaloneEntry(tableId: string): KnowledgeCatalogEntry | undefined {
  return STANDALONE_EDITABLE_TABLES.find((entry) => entry.tableId === tableId);
}

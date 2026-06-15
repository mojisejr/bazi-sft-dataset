/**
 * Registry ของ "ตารางอิสระ" ที่แก้ออนไลน์ได้ แต่ "ไม่ผูกกับ engine" (free-form core data)
 * — ใช้ shape เดียวกับ KnowledgeCatalogEntry แต่อยู่นอก KNOWLEDGE_CATALOG โดยตั้งใจ
 *   (ถ้าใส่ใน catalog จะชน guardrail ทิศ B ใน knowledge-catalog-coverage.test.ts เพราะ engine ไม่อ้าง tableId)
 *
 * ใช้กลไกบันทึก/เผยแพร่เดิมทุกอย่าง: surface="knowledge", kind="table",
 *   entityKey = `table|{tableId}|{key}` → เก็บใน bazi_doctrine_draft / bazi_knowledge_override (kind="table")
 *
 * pure data — import ได้ทั้ง server (route) และ client (CoreDataPanel) เพราะดึงแค่ค่าคงที่บริสุทธิ์
 */
import {
  BRANCH_LABELS_TH,
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS_TH,
} from "@/lib/bazi/symbolic-engine.constants";
import type { KnowledgeCatalogEntry } from "@/lib/bazi/knowledge/knowledge-catalog";

export const STEM_STRENGTH_MATRIX_ID = "STEM_STRENGTH_MATRIX_TH";
export const TWELVE_NAKSHATRA_ID = "TWELVE_NAKSHATRA_TH";
export const SIXTY_JIAZI_ID = "SIXTY_JIAZI_TH";

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

/** ตารางเมทริกซ์ 10 ราศีบน × 5 ดิถี = 50 ช่องว่าง (key=`{ก้าน}|{band}`) — ใช้ซ้ำกับกล่อง 1/5/6 */
function buildStemBandEntry(tableId: string, label: string): KnowledgeCatalogEntry {
  const defaults: Record<string, string> = {};
  const entryLabels: Record<string, string> = {};
  for (const stem of STEM_ORDER) {
    for (const band of STRENGTH_BANDS) {
      const key = `${stem}|${band.key}`;
      defaults[key] = "";
      entryLabels[key] = `${stem} × ${band.label}`;
    }
  }
  return { tableId, label, keyKind: "raw", defaults, entryLabels };
}

/** ตาราง 2: 12 นักษัตร — แต่ละช่อง default = จีน + ชื่อไทย + ธาตุ */
function buildNakshatraEntry(): KnowledgeCatalogEntry {
  const defaults: Record<string, string> = {};
  const entryLabels: Record<string, string> = {};
  for (const branch of BRANCH_ORDER) {
    const thai = BRANCH_LABELS_TH[branch];
    const elementTh = ELEMENT_LABELS_TH[BRANCH_TO_ELEMENT[branch]];
    defaults[branch] = `${branch} · ${thai} · ธาตุ${elementTh}`;
    entryLabels[branch] = `${branch} ${thai}`;
  }
  return {
    tableId: TWELVE_NAKSHATRA_ID,
    label: "12 นักษัตร (จีน · ชื่อไทย · ธาตุ)",
    keyKind: "raw",
    defaults,
    entryLabels,
  };
}

/** ตาราง 3: 60 กะจี่อ — default = ตัวกะจี่อเอง */
function buildJiaziEntry(): KnowledgeCatalogEntry {
  const defaults: Record<string, string> = {};
  const entryLabels: Record<string, string> = {};
  for (const { ordinal, ganzhi } of SIXTY_JIAZI) {
    defaults[ganzhi] = ganzhi;
    entryLabels[ganzhi] = `#${ordinal} ${ganzhi}`;
  }
  return {
    tableId: SIXTY_JIAZI_ID,
    label: "60 กะจี่อ (六十甲子)",
    keyKind: "raw",
    defaults,
    entryLabels,
  };
}

export const STANDALONE_EDITABLE_TABLES: readonly KnowledgeCatalogEntry[] = [
  buildStemBandEntry(
    STEM_STRENGTH_MATRIX_ID,
    "บท 1 · กล่อง 1 — ดิถี/กำลัง (10 ราศีบน × 5 ดิถี)",
  ),
  buildNakshatraEntry(),
  buildJiaziEntry(),
];

export const STANDALONE_TABLE_IDS = new Set(
  STANDALONE_EDITABLE_TABLES.map((entry) => entry.tableId),
);

export function getStandaloneEntry(tableId: string): KnowledgeCatalogEntry | undefined {
  return STANDALONE_EDITABLE_TABLES.find((entry) => entry.tableId === tableId);
}

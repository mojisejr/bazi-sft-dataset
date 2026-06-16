/**
 * Entity registry — catalog ของ node ที่ derive จากค่าคงที่ (ไม่สร้างข้อมูลใหม่)
 *
 * ครอบ node ที่มาจาก constants: ก้าน/กิ่ง/ธาตุ/12จี้/สิบเทพ/60กะจื่อ/แบนด์กำลัง/ศาสตร์
 * ส่วน node ที่มาจาก JSON (ไพ่/เซียมซี/เทพปฏิทิน/เลขโทร) compiler เติมทับใน compile-knowledge-graph.ts
 *
 * pure + ไม่อ่าน fs → ทดสอบได้ตรง ๆ (Phase 0)
 */
import {
  BRANCH_LABELS_TH,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
  TWELVE_QI_LABELS_TH,
  TWELVE_QI_MEANINGS_TH,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  BRANCH_ORDER,
  SIXTY_JIAZI,
  STEM_ORDER,
  STRENGTH_BANDS,
} from "@/lib/bazi/knowledge/standalone-tables";

import type { GraphEntityKind, GraphNode } from "./graph-types";

/** สิบเทพ (十神) ตามที่ resolveTenGodForStem คืน */
export const TEN_GODS = [
  "比肩",
  "劫财",
  "食神",
  "伤官",
  "偏财",
  "正财",
  "七杀",
  "正官",
  "偏印",
  "正印",
] as const;

/** ศาสตร์/ด้าน ที่กราฟ tag ได้ — labelTh + คำค้น (resolver ใช้ผูกคำถาม → discipline) */
export const DISCIPLINES: { id: string; labelTh: string; keywords: string[] }[] = [
  { id: "career", labelTh: "การงาน", keywords: ["การงาน", "งาน", "อาชีพ", "ธุรกิจ", "หน้าที่"] },
  { id: "wealth", labelTh: "การเงิน/โชคลาภ", keywords: ["เงิน", "ทรัพย์", "โชคลาภ", "การเงิน", "ลงทุน", "รายได้"] },
  { id: "learning", labelTh: "การเรียน", keywords: ["เรียน", "การศึกษา", "วิชา", "สอบ", "คณะ", "สาขา"] },
  { id: "friends", labelTh: "เพื่อน/บริวาร", keywords: ["เพื่อน", "บริวาร", "มิตร", "ลูกน้อง", "หุ้นส่วน"] },
  { id: "love", labelTh: "ความรัก/คู่ครอง", keywords: ["ความรัก", "คู่", "คู่ครอง", "แฟน", "สามี", "ภรรยา", "สมพงษ์"] },
  { id: "health", labelTh: "สุขภาพ", keywords: ["สุขภาพ", "ป่วย", "โรค", "อวัยวะ", "ร่างกาย"] },
  { id: "family", labelTh: "ครอบครัว", keywords: ["ครอบครัว", "พ่อแม่", "ญาติ", "ลูก", "เครือญาติ"] },
  { id: "talent", labelTh: "พรสวรรค์", keywords: ["พรสวรรค์", "ความสามารถ", "ศักยภาพ", "ทักษะ"] },
  { id: "benefactor", labelTh: "ผู้อุปถัมภ์", keywords: ["ผู้อุปถัมภ์", "คนหนุน", "อุปถัมภ์", "ผู้ใหญ่"] },
  { id: "colors", labelTh: "สี/ทิศมงคล", keywords: ["สี", "ทิศ", "มงคล", "อัญมณี", "เครื่องแต่งกาย"] },
  { id: "deities", labelTh: "องค์เทพ/สิ่งศักดิ์สิทธิ์", keywords: ["องค์เทพ", "เทพ", "สิ่งศักดิ์สิทธิ์", "ทำบุญ", "ขอพร"] },
  { id: "timing", labelTh: "จังหวะชีวิต/วัยจร", keywords: ["วัยจร", "จังหวะ", "ช่วงอายุ", "ดวงปี", "ปีจร", "ดาว"] },
  { id: "almanac", labelTh: "ฤกษ์/วันมงคล", keywords: ["ฤกษ์", "วันมงคล", "วันดี", "ปฏิทิน", "เวลามงคล"] },
  { id: "phone", labelTh: "เลขโทรศัพท์", keywords: ["เบอร์", "โทรศัพท์", "เลขมงคล", "ตัวเลข"] },
  { id: "cards", labelTh: "ไพ่เทวะ", keywords: ["ไพ่"] },
  { id: "sticks", labelTh: "เซียมซี", keywords: ["เซียมซี", "เสี่ยงทาย", "เซียน"] },
  { id: "pair-work", labelTh: "สมพงษ์การงาน", keywords: ["สมพงษ์การงาน", "เข้ากันงาน", "คู่งาน"] },
  { id: "pair-love", labelTh: "สมพงษ์ความรัก", keywords: ["สมพงษ์รัก", "คู่สมพงษ์", "ดวงสมพงษ์"] },
  { id: "personality", labelTh: "พื้นฐานนิสัย", keywords: ["นิสัย", "ตัวตน", "บุคลิก", "พื้นดวง"] },
  { id: "knowledge", labelTh: "องค์ความรู้ทั่วไป", keywords: [] },
];

export function entityIdFor(kind: GraphEntityKind, key: string): string {
  return `${kind}:${key}`;
}

/** สร้าง catalog ของ node จากค่าคงที่ — pure */
export function buildEntityRegistry(): GraphNode[] {
  const nodes: GraphNode[] = [];

  for (const stem of STEM_ORDER) {
    nodes.push({
      id: entityIdFor("stem", stem),
      kind: "stem",
      labelZh: stem,
      labelTh: ELEMENT_LABELS_TH[STEM_TO_ELEMENT[stem]],
      aliases: [stem],
    });
  }

  for (const branch of BRANCH_ORDER) {
    const animal = BRANCH_LABELS_TH[branch];
    nodes.push({
      id: entityIdFor("branch", branch),
      kind: "branch",
      labelZh: branch,
      labelTh: animal,
      aliases: [branch, animal],
    });
  }

  for (const [en, th] of Object.entries(ELEMENT_LABELS_TH)) {
    nodes.push({
      id: entityIdFor("element", en),
      kind: "element",
      labelTh: th,
      aliases: [th, en],
    });
  }

  for (const [zh, meaning] of Object.entries(TWELVE_QI_LABELS_TH)) {
    const detail = TWELVE_QI_MEANINGS_TH[zh];
    nodes.push({
      id: entityIdFor("qi-stage", zh),
      kind: "qi-stage",
      labelZh: zh,
      labelTh: meaning,
      meaningTh: detail?.summary ?? "",
      aliases: [zh, meaning, ...(detail?.keywords ?? [])],
    });
  }

  for (const god of TEN_GODS) {
    nodes.push({
      id: entityIdFor("ten-god", god),
      kind: "ten-god",
      labelZh: god,
      aliases: [god],
    });
  }

  for (const { ganzhi } of SIXTY_JIAZI) {
    nodes.push({
      id: entityIdFor("sixty-jiazi", ganzhi),
      kind: "sixty-jiazi",
      labelZh: ganzhi,
      aliases: [ganzhi],
    });
  }

  for (const band of STRENGTH_BANDS) {
    nodes.push({
      id: entityIdFor("strength-band", band.key),
      kind: "strength-band",
      labelTh: band.label,
      aliases: [band.label],
    });
  }

  for (const discipline of DISCIPLINES) {
    nodes.push({
      id: entityIdFor("discipline", discipline.id),
      kind: "discipline",
      labelTh: discipline.labelTh,
      aliases: [discipline.labelTh, ...discipline.keywords],
    });
  }

  return nodes;
}

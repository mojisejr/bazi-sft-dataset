// นิสัย 5 ธาตุ (แข็ง/อ่อน) — แหล่งความจริงเดียว ใช้ทั้งหน้า "ดวงของฉัน" (แถว 5 ธาตุ) และบท 1 (chart_foundation)
// ของอ่านดวง 15 บท. เนื้อหาย่อมาจากเอกสารซินแส (Google Docs "นิสัย 5 ธาตุอ่อนแอ/แข็งแรง") — สั้น 1-2 บรรทัด
// ต่อธาตุ; ซินแสตรวจ/ปรับถ้อยคำได้ (เป็น string ล้วน).
//
// กฎแข็ง/อ่อน (ตามเอกสาร): ธาตุ X "แข็ง" เมื่อ นับได้ ≥ 2 ธาตุ  หรือ  นับได้ ≥ 1 และมี "ธาตุส่งเสริม" ของ X ≥ 1
// ธาตุส่งเสริมของ X = ธาตุที่ generate X (ผกผันของ GENERATES) — เช่น ไฟส่งเสริมดิน, ไม้ส่งเสริมไฟ
import { FIVE_ELEMENT_ORDER, GENERATES } from "./symbolic-engine.constants";

export type SupportedElement = (typeof FIVE_ELEMENT_ORDER)[number];
export type NisaiTier = "strong" | "weak";
export type ElementNisai = { element: SupportedElement; tier: NisaiTier; text: string; strongText?: string; weakText?: string };

// ธาตุที่ generate X (ผกผันของ GENERATES): wood←water, fire←wood, earth←fire, metal←earth, water←metal
const SUPPORTER: Record<SupportedElement, SupportedElement> = (() => {
  const m = {} as Record<SupportedElement, SupportedElement>;
  for (const from of FIVE_ELEMENT_ORDER) {
    m[GENERATES[from] as SupportedElement] = from;
  }
  return m;
})();

export function elementTier(element: SupportedElement, totalCounts: Record<string, number>): NisaiTier {
  const count = totalCounts[element] ?? 0;
  if (count >= 2) return "strong";
  if (count >= 1 && (totalCounts[SUPPORTER[element]] ?? 0) >= 1) return "strong";
  return "weak";
}

// ข้อความตรงจากเอกสารซินแส (Google Docs "นิสัย 5 ธาตุแข็งแรง" / "นิสัย 5 ธาตุอ่อนแอ" — ส่วนที่ระบายสีน้ำเงิน = ที่แสดงผล)
// สำเนาเอกสาร: knownlage/nisai/nisai-5-element-{strong,weak}.txt (ดึงใหม่ 2026-10-11, ซินแสนุ้ย: "ธาตุ 0 ต้องขึ้นธาตุอ่อนแอ")
export const ELEMENT_NISAI: Record<SupportedElement, { strong: string; weak: string }> = {
  wood: {
    strong: "เมตตาธรรมและการเติบโต — มีน้ำใจ เปิดโอกาสให้ผู้อื่น และพัฒนาตัวเองอย่างต่อเนื่อง",
    weak: "เมตตาธรรมและการเติบโต — อาจรู้สึกว่าตัวเองเติบโตช้าหรือถูกเอาเปรียบเสมอ จึงควรสร้างความมั่นใจทีละขั้น",
  },
  fire: {
    strong: "มารยาทและวัฒนธรรม — แสดงออกเหมาะสม อบอุ่น และให้เกียรติคนรอบข้าง",
    weak: "มารยาทและวัฒนธรรม — อาจไม่มั่นใจในการแสดงออกหรือพูดไม่ตรงความรู้สึก จึงควรสื่อสารให้ชัดเจน",
  },
  earth: {
    strong: "สัจจะและความเชื่อถือ — หนักแน่น รับผิดชอบ และรักษาคำพูดจนได้รับความไว้วางใจ",
    weak: "สัจจะและความเชื่อถือ — อาจจะลังเลหรือเปลี่ยนใจง่ายเมื่อถูกกดดัน จึงควรวางหลักเกณฑ์ให้ชัดก่อนตัดสินใจ",
  },
  metal: {
    strong: "ความยุติธรรมและความเด็ดขาด — ยึดหลักการ ตัดสินใจชัด และปกป้องความถูกต้อง",
    weak: "ความยุติธรรมและความเด็ดขาด — อาจคิดวนหรือไม่กล้าตัดสินใจในเรื่องสำคัญ จึงควรแยกข้อเท็จจริงออกจากความกังวล",
  },
  water: {
    strong: "สติปัญญาและความฉลาด — เรียนรู้เร็ว เชื่อมโยงข้อมูลเก่งและปรับตัวตามสถานการณ์ได้ดี",
    weak: "สติปัญญาและความฉลาด — อาจคิดมากหรือไม่เชื่อมั่นในการตัดสินใจ จึงควรจัดลำดับข้อมูลก่อนลงมือ",
  },
};

export function nisaiForElement(element: SupportedElement, totalCounts: Record<string, number>): ElementNisai {
  const tier = elementTier(element, totalCounts);
  return { element, tier, text: ELEMENT_NISAI[element][tier], strongText: ELEMENT_NISAI[element].strong, weakText: ELEMENT_NISAI[element].weak };
}

export function buildElementNisai(totalCounts: Record<string, number>): ElementNisai[] {
  return FIVE_ELEMENT_ORDER.map((element) => nisaiForElement(element, totalCounts));
}

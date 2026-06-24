/**
 * ตารางหาอาชีพ/ธุรกิจตามธาตุ (บท 2) — สกัดจาก knownlage/NewData/หาอาชีพ.txt (ตารางใหญ่ B)
 *
 * กฎ: ธาตุดิถี (ราศีบนหลักวัน) × กำลังดิถี (3 ระดับ) × ธาตุราศีบนหลักเดือน
 *      → "ธาตุที่ควรทำอาชีพ/ธุรกิจ" (เรียงลำดับความเหมาะ 1..n)
 * นี่คือ "กฎโหร" (ค่าคงที่) ไม่ใช่เนื้อหาที่ซินแสแก้ — เนื้อรายชื่ออาชีพต่อธาตุอยู่ใน
 * NewData group `career_by_element` (แก้ในแอดมินได้)
 *
 * pure + client-safe
 */
import { CONTROLS, GENERATES, STEM_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";

/** ธาตุไทย 5 ธาตุ — ใช้เป็นคีย์ทั้งตารางนี้และ group career_by_element */
export type ElementTh = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

/** กำลังดิถี 3 ระดับตามตาราง B (รวม 5 band ของ engine → 3) */
export type CareerBand = "weak" | "balanced" | "veryStrong";

const EN_TO_TH: Record<string, ElementTh> = {
  wood: "ไม้",
  fire: "ไฟ",
  earth: "ดิน",
  metal: "ทอง",
  water: "น้ำ",
};

/** ธาตุไทยของราศีบน (ก้าน) ตัวหนึ่ง — null ถ้าก้านไม่รู้จัก */
export function elementThOfStem(stem: string): ElementTh | null {
  const en = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
  return en ? EN_TO_TH[en] ?? null : null;
}

/** จัด band 3 ระดับของตาราง B จาก id 5-band ของ engine (operator-strength) */
export function careerBandFromId(id: string): CareerBand {
  if (id === "very-weak" || id === "weak") return "weak";
  if (id === "very-strong") return "veryStrong";
  return "balanced"; // balanced | strong
}

/** จัดกำลังดิถี (คะแนน engine 5 band) → 3 band ของตาราง B */
export function careerBandFromScore(score: number): CareerBand {
  return careerBandFromId(classifyOperatorStrengthScore(score).id);
}

/**
 * ธาตุที่ "ไม่ควรทำ" (heuristic — ไฟล์ต้นทางมีแต่ "ควรทำ"):
 * ปรับให้ตรง ground-truth ซินแส (4 ดวง 庚/辛/甲/丁): อันดับ 1 = ธาตุพิฆาตดิถี (官杀) เสมอ
 * ทุก band · อันดับ 2 = ธาตุส่งเสริมดิถี (印) เฉพาะดวงไม่อ่อน (สมดุล/แข็ง ยิ่งเติมกำลังล้น)
 *   - ดวงอ่อน → คืนแค่ [官杀] (อ่อนยังต้องพึ่ง 印 จึงไม่เลี่ยง)
 * ซินแสปรับ/ลบได้ในตัวแก้ (กล่องแก้ไขได้)
 */
export function avoidElementsTh(dayElement: ElementTh, band: CareerBand): ElementTh[] {
  const en = (Object.entries(EN_TO_TH).find(([, th]) => th === dayElement)?.[0]) as
    | keyof typeof GENERATES
    | undefined;
  if (!en) return [];
  const resourceEn = (Object.keys(GENERATES) as Array<keyof typeof GENERATES>).find(
    (x) => GENERATES[x] === en,
  );
  const powerEn = (Object.keys(CONTROLS) as Array<keyof typeof CONTROLS>).find(
    (x) => CONTROLS[x] === en,
  );
  const resource = resourceEn ? EN_TO_TH[resourceEn] : null; // ส่งเสริมดิถี (印)
  const power = powerEn ? EN_TO_TH[powerEn] : null; // พิฆาตดิถี (官杀)

  // อันดับ 1 = 官杀 เสมอ · อันดับ 2 = 印 เฉพาะดวงไม่อ่อน
  const list = band === "weak" ? [power] : [power, resource];
  return list.filter((x): x is ElementTh => Boolean(x));
}

/**
 * ตารางใหญ่ B — [ธาตุดิถี][กำลัง][ธาตุราศีบนหลักเดือน] = ธาตุที่ควรทำ (เรียงลำดับ)
 * สกัดตรงจาก หาอาชีพ.txt (จุดที่ต้นฉบับพิมพ์เพี้ยน ใช้ดุลพินิจตามบริบทบรรทัดข้างเคียง)
 */
export const CAREER_FINANCE_TABLE: Record<
  ElementTh,
  Record<CareerBand, Record<ElementTh, ElementTh[]>>
> = {
  ไม้: {
    weak: { ไม้: ["น้ำ", "ไม้"], ไฟ: ["ไม้"], ดิน: ["น้ำ", "ไม้"], ทอง: ["น้ำ"], น้ำ: ["น้ำ"] },
    balanced: { ไม้: ["ไฟ", "ดิน"], ไฟ: ["ไฟ", "ดิน"], ดิน: ["ดิน"], ทอง: ["ไม้"], น้ำ: ["ไม้", "ไฟ"] },
    veryStrong: { ไม้: ["ไฟ"], ไฟ: ["ไฟ"], ดิน: ["ไฟ"], ทอง: ["ดิน"], น้ำ: ["ไฟ"] },
  },
  ไฟ: {
    weak: { ไม้: ["ไม้"], ไฟ: ["ไม้", "ไฟ"], ดิน: ["ไฟ"], ทอง: ["ไม้"], น้ำ: ["ไม้", "ไฟ"] },
    balanced: { ไม้: ["ดิน"], ไฟ: ["ดิน", "ทอง"], ดิน: ["ไฟ"], ทอง: ["ไม้", "ดิน", "ทอง"], น้ำ: ["ไฟ", "ทอง"] },
    veryStrong: { ไม้: ["ดิน"], ไฟ: ["ดิน"], ดิน: ["ดิน"], ทอง: ["ดิน"], น้ำ: ["ทอง"] },
  },
  ดิน: {
    weak: { ไม้: ["ไฟ", "ดิน"], ไฟ: ["ไฟ"], ดิน: ["ไฟ", "ดิน"], ทอง: ["ดิน"], น้ำ: ["ไฟ"] },
    balanced: { ไม้: ["ไฟ", "ดิน", "น้ำ"], ไฟ: ["ดิน", "ทอง"], ดิน: ["น้ำ"], ทอง: ["ทอง", "น้ำ"], น้ำ: ["น้ำ"] },
    veryStrong: { ไม้: ["น้ำ"], ไฟ: ["ทอง"], ดิน: ["ทอง"], ทอง: ["ทอง"], น้ำ: ["ทอง"] },
  },
  ทอง: {
    weak: { ไม้: ["ดิน"], ไฟ: ["ทอง"], ดิน: ["ดิน"], ทอง: ["ดิน", "ทอง"], น้ำ: ["ทอง"] },
    balanced: { ไม้: ["ไม้"], ไฟ: ["ไม้"], ดิน: ["ดิน", "น้ำ"], ทอง: ["ไม้"], น้ำ: ["ทอง", "น้ำ"] },
    veryStrong: { ไม้: ["น้ำ"], ไฟ: ["ทอง"], ดิน: ["น้ำ"], ทอง: ["น้ำ"], น้ำ: ["น้ำ"] },
  },
  น้ำ: {
    weak: { ไม้: ["น้ำ"], ไฟ: ["ทอง"], ดิน: ["ทอง"], ทอง: ["ทอง"], น้ำ: ["ทอง", "น้ำ"] },
    balanced: { ไม้: ["ไฟ"], ไฟ: ["ไฟ"], ดิน: ["ทอง"], ทอง: ["ไม้"], น้ำ: ["ไฟ"] },
    veryStrong: { ไม้: ["ไม้"], ไฟ: ["ไม้"], ดิน: ["ทอง", "น้ำ"], ทอง: ["ไม้"], น้ำ: ["ไม้"] },
  },
};

/** ธาตุที่ควรทำ (เรียงลำดับ) สำหรับดิถี/กำลัง/ธาตุเดือน — [] ถ้าหาไม่เจอ */
export function doElementsTh(
  dayElement: ElementTh,
  band: CareerBand,
  monthElement: ElementTh,
): ElementTh[] {
  return CAREER_FINANCE_TABLE[dayElement]?.[band]?.[monthElement] ?? [];
}

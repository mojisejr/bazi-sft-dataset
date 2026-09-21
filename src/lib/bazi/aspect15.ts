/**
 * 15 ด้าน canonical (mirror จาก oracle-cards aspects) — ใช้ร่วมกันทั้ง divine + sage
 * เพื่อให้ AI ร้อยเรื่องรายด้านได้สม่ำเสมอทุกสำรับ (เอ็ม/ซินแสนุ้ย 2026-09-21)
 */
export const ASPECT15_LABELS = {
  person: "ลักษณะคน",
  work: "การงาน",
  wealth: "การเงิน",
  love: "ความรัก",
  health: "สุขภาพ",
  disease: "โรคภัย",
  family: "ครอบครัว",
  location: "สถานที่",
  direction: "ทิศ",
  element: "ธาตุ",
  color: "สี",
  form: "รูปลักษณ์",
  occupation: "อาชีพ",
  god: "เทพ",
  animal: "สัตว์",
} as const;

export type Aspect15Key = keyof typeof ASPECT15_LABELS;
export type Aspect15 = Record<Aspect15Key, string>;

export const ASPECT15_KEYS = Object.keys(ASPECT15_LABELS) as Aspect15Key[];

export const EMPTY_ASPECT15: Aspect15 = ASPECT15_KEYS.reduce((acc, k) => {
  acc[k] = "";
  return acc;
}, {} as Aspect15);

/** true ถ้ามีอย่างน้อย 1 ด้านที่เติมแล้ว */
export function hasAspect15(a: Aspect15 | undefined | null): boolean {
  return !!a && ASPECT15_KEYS.some((k) => (a[k] ?? "").trim().length > 0);
}

/** normalize object ที่โหลดจาก JSON ให้ครบ 15 คีย์เสมอ */
export function coerceAspect15(raw: Partial<Aspect15> | undefined | null): Aspect15 {
  return { ...EMPTY_ASPECT15, ...(raw ?? {}) };
}

/** ประกอบบล็อก "คำทำนายรายด้าน" (เฉพาะด้านที่เติมแล้ว) สำหรับป้อน LLM; ว่าง = คืน "" */
export function aspect15Lines(a: Aspect15 | undefined | null): string {
  if (!a) return "";
  const lines = ASPECT15_KEYS.map((k) => {
    const v = (a[k] ?? "").trim();
    return v ? `${ASPECT15_LABELS[k]}: ${v}` : null;
  }).filter((l): l is string => l !== null);
  return lines.length ? `คำทำนายรายด้าน:\n${lines.join("\n")}` : "";
}

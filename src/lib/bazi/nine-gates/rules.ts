/**
 * เก้าประตู เปิดชะตา (ซินแสนุ้ย 2026-10-29 · layer 1) — กติกาผังหลอซู + 8 ประตู + ดิถี
 * ถอดจากต้นแบบ kiang-kung-astrology.fengshui12.chatgpt.site (app.js) ให้ตรงทุกค่า:
 *   - เลขดิถี: ทอย 0–9 → ธาตุ (0/5 ดิน · 1/6 น้ำ · 2/7 ไฟ · 3/8 ไม้ · 4/9 ทอง)
 *   - ตำแหน่งดิถี: ทอยวัง 1–9 ตามผังหลอซู
 *   - ตำแหน่ง 開 ไค: ทอย 0–9 · 0 → ใช้วัง 9 · 5 (กลาง) → ย้ายไปวัง 2 · แล้ววาง 8 ประตูตามเข็มนาฬิกา
 *   - วังกลาง (5 · ความในใจ) แสดงประตูของวังที่ดิถีสถิต (ถ้าดิถีอยู่วัง 5 → อ้างวัง 2)
 * pure ทั้งไฟล์ — เทสได้ ไม่แตะ DOM/สุ่ม
 */

export type Palace = { number: number; direction: string; shortDirection: string };

/** ลำดับช่องบนกระดาน 3×3 (แถวบน→ล่าง ซ้าย→ขวา) = ผังหลอซู 4 9 2 / 3 5 7 / 8 1 6 */
export const PALACES: readonly Palace[] = [
  { number: 4, direction: "ทิศตะวันออกเฉียงใต้", shortDirection: "ตะวันออกเฉียงใต้" },
  { number: 9, direction: "ทิศใต้", shortDirection: "ทิศใต้" },
  { number: 2, direction: "ทิศตะวันตกเฉียงใต้", shortDirection: "ตะวันตกเฉียงใต้" },
  { number: 3, direction: "ทิศตะวันออก", shortDirection: "ทิศตะวันออก" },
  { number: 5, direction: "ความในใจ", shortDirection: "ความในใจ" },
  { number: 7, direction: "ทิศตะวันตก", shortDirection: "ทิศตะวันตก" },
  { number: 8, direction: "ทิศตะวันออกเฉียงเหนือ", shortDirection: "ตะวันออกเฉียงเหนือ" },
  { number: 1, direction: "ทิศเหนือ", shortDirection: "ทิศเหนือ" },
  { number: 6, direction: "ทิศตะวันตกเฉียงเหนือ", shortDirection: "ตะวันตกเฉียงเหนือ" },
];

/** วังรอบนอกเรียงตามเข็มนาฬิกา (เริ่มตะวันตกเฉียงเหนือ) */
export const CLOCKWISE_PALACES = [6, 1, 8, 3, 4, 9, 2, 7] as const;

export type Gate = { gate: string; thai: string };
/** 8 ประตูเรียงตามลำดับวาง เริ่มจาก 開 */
export const GATE_SEQUENCE: readonly Gate[] = [
  { gate: "開", thai: "ไค" },
  { gate: "休", thai: "ฮิว" },
  { gate: "生", thai: "แซ" },
  { gate: "傷", thai: "เซีย" },
  { gate: "杜", thai: "โต๋ว" },
  { gate: "景", thai: "เก้ง" },
  { gate: "死", thai: "ซี่" },
  { gate: "驚", thai: "เกีย" },
];

export const ELEMENT_BY_DIGIT: Readonly<Record<number, string>> = {
  0: "ธาตุดิน", 1: "ธาตุน้ำ", 2: "ธาตุไฟ", 3: "ธาตุไม้", 4: "ธาตุทอง",
  5: "ธาตุดิน", 6: "ธาตุน้ำ", 7: "ธาตุไฟ", 8: "ธาตุไม้", 9: "ธาตุทอง",
};

export function palaceByNumber(n: number): Palace | undefined {
  return PALACES.find((p) => p.number === n);
}

/** วังเริ่มของ 開 จากแต้มที่ทอย (0 → 9 · 5 → 2) */
export function effectiveGateStart(roll: number): number {
  if (roll === 0) return 9;
  if (roll === 5) return 2;
  return roll;
}

/** วัง → ประตู สำหรับวังรอบนอกทั้ง 8 */
export function gateAssignments(gateRoll: number | null): Map<number, Gate> {
  const out = new Map<number, Gate>();
  if (gateRoll === null) return out;
  const start = CLOCKWISE_PALACES.indexOf(effectiveGateStart(gateRoll) as (typeof CLOCKWISE_PALACES)[number]);
  GATE_SEQUENCE.forEach((g, i) => out.set(CLOCKWISE_PALACES[(start + i) % CLOCKWISE_PALACES.length], g));
  return out;
}

/** ประตูที่แสดงในวัง (วังกลางสะท้อนประตูของวังดิถี · ดิถีอยู่กลาง → อ้างวัง 2) */
export function displayedGate(assignments: Map<number, Gate>, palace: number, dayMasterPosition: number | null): Gate | undefined {
  if (palace === 5 && dayMasterPosition !== null) return assignments.get(dayMasterPosition === 5 ? 2 : dayMasterPosition);
  return assignments.get(palace);
}

export function gateRollLabel(roll: number): string {
  if (roll === 0) return "ทอยได้ 0 · ใช้วังเลข 9";
  if (roll === 5) return "ทอยได้ 5 · ย้ายไปวังเลข 2";
  return `วังเลข ${roll}`;
}

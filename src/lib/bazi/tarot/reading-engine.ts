/**
 * Engine อ่าน "ไพ่ทาโรต์วิถีเต๋า" (deterministic — ไม่เรียก LLM)
 *
 * ซินแสนุ้ย 2026-09-29: สเปรด 3 ใบถ่วงน้ำหนัก — ใบแรก 50% · ใบสอง 30% · ใบสาม 20% แล้วสรุป
 * + ไพ่กลับหัวได้ (กลับหัว = ใช้ universalReversed + caution แทนความหมายหงาย)
 * เนื้อหาไพ่ใน JSON เป็นภาษาอังกฤษ → engineProse เป็นอังกฤษ (เวอร์ชันต่างประเทศเทสต์ก่อน)
 * engineProse คือ ground truth ที่ส่งให้ LLM ไป "เกลาคำ" ต่อ (ห้ามแต่งเติมนอกความหมายไพ่)
 */
import type { TarotCard } from "@/lib/bazi/tarot/deck";

/** น้ำหนักตามตำแหน่ง (3 ใบ) — 1 ใบ = 100 */
export const TAROT_WEIGHTS = [50, 30, 20] as const;
export const TAROT_ROLES = ["Primary", "Secondary", "Supporting"] as const;

export type TarotRole = (typeof TAROT_ROLES)[number];

export type TarotSlot = {
  position: 1 | 2 | 3;
  role: TarotRole;
  /** น้ำหนักของใบนี้ในคำอ่าน (%) */
  weight: number;
  reversed: boolean;
  card: TarotCard;
};

export type TarotReading = {
  slots: TarotSlot[];
  engineProse: string;
};

function cardBlock(slot: TarotSlot): string {
  const c = slot.card;
  const orient = slot.reversed ? "REVERSED" : "Upright";
  return [
    `[${slot.role} · ${slot.weight}%] ${c.name} — ${orient}${c.virtue ? ` · ${c.virtue}` : ""}`,
    `Essence: ${c.tagline}`,
    slot.reversed
      ? `Reversed meaning: ${c.universalReversed}`
      : `Upright meaning: ${c.universalUpright}`,
    `Tao reading: ${c.meaning}`,
    ...(c.caution ? [`${slot.reversed ? "Shadow (active — card is reversed)" : "Caution"}: ${c.caution}`] : []),
    ...(c.koan ? [`Koan: ${c.koan}`] : []),
  ].join("\n");
}

/**
 * สร้างการอ่านจากไพ่ที่จั่ว/เลือกมา (1 หรือ 3 ใบ)
 * reversed[i] = ใบ i กลับหัว (ไม่ส่ง = หงายทั้งหมด)
 */
export function buildTarotReading(
  cards: TarotCard[],
  question?: string,
  reversed: boolean[] = [],
): TarotReading {
  const slots: TarotSlot[] = cards.map((card, index) => ({
    position: (index + 1) as 1 | 2 | 3,
    role: cards.length === 1 ? "Primary" : (TAROT_ROLES[index] ?? "Supporting"),
    weight: cards.length === 1 ? 100 : (TAROT_WEIGHTS[index] ?? 0),
    reversed: Boolean(reversed[index]),
    card,
  }));

  const q = question?.trim();
  const parts = [
    ...(q ? [`Question: ${q}`] : []),
    cards.length === 1
      ? "One card drawn from The Oriental Charm Tarot:"
      : `${cards.length} cards drawn (weighted ${slots.map((s) => `${s.weight}%`).join(" / ")}):`,
    ...slots.map(cardBlock),
  ];

  return { slots, engineProse: parts.join("\n\n") };
}

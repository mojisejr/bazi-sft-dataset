/**
 * Deck loader สำหรับ "ไพ่ทาโรต์วิถีเต๋า — The Oriental Charm Tarot" (78 ใบ)
 *
 * ข้อมูลมาจาก src/lib/bazi/data/tarot-tao.json (คู่มือไพ่วิถีเต๋าของโหราศาสตร์เคี้ยงคุง
 * แปล/เรียบเรียงเป็นคีย์อังกฤษ + วางเทียบความหมายสากล Rider-Waite-Smith — เข้าระบบ 2026-09-24)
 *
 * โครงไพ่คง RWS (22 Major, 56 Minor; Strength=8, Justice=11) แต่ตีความผ่านปรัชญาเต๋า+กตัญญู
 * ยังไม่ผูกเข้าแชท — ใช้เป็นฟีเจอร์หลังบ้านแยก (ซินแสนุ้ย 2026-09-24)
 *
 * มิเรอร์โครงสร้าง fengshui/deck.ts + divine-cards/deck.ts (จั่วไม่ซ้ำ count ใบ)
 */
import cardsJson from "@/lib/bazi/data/tarot-tao.json";

export type TarotSuit = "major" | "pentacles" | "cups" | "swords" | "wands";

export type TarotCard = {
  no: number;
  /** กอง: major / pentacles(ดิน) / cups(น้ำ) / swords(ลม) / wands(ไฟ) */
  group: TarotSuit;
  /** ลำดับในกอง เช่น "0","I".."XXI" (major) หรือ "Ace","2".."King" (minor) */
  rank: string;
  /** ชื่อไพ่ เช่น "The Fool — the Wayfarer" */
  name: string;
  /** แกน/คุณธรรมประจำใบ (เช่น เบญจธรรม 五常, wu wei) — วิถีเต๋า */
  virtue: string;
  /** ประโยคสั้นสรุปใจความ */
  tagline: string;
  /** ความหมายโดยรวม (คำบรรยายภาพ + สาระ) */
  meaning: string;
  /** ข้อควรระวัง = ใช้เป็นเงา/กลับหัวของไพ่ (คู่มือไม่ให้ความหมายกลับหัวแยก) */
  caution: string;
  /** ประโยคปริศนาธรรม/koan ประจำใบ */
  koan: string;
  /** ความหมายสากล RWS — หงาย(upright) */
  universalUpright: string;
  /** ความหมายสากล RWS — กลับหัว (reversed) */
  universalReversed: string;
  /** โน้ตเทียบสองระบบ (เต๋า vs สากล ต่าง/เหมือนตรงไหน) */
  integration: string;
};

const CARDS: readonly TarotCard[] = cardsJson as TarotCard[];
const BY_NO = new Map<number, TarotCard>(CARDS.map((card) => [card.no, card]));

export function getAllCards(): readonly TarotCard[] {
  return CARDS;
}

export function getCardByNo(no: number): TarotCard | undefined {
  return BY_NO.get(no);
}

export function getCardsByGroup(group: TarotSuit): readonly TarotCard[] {
  return CARDS.filter((c) => c.group === group);
}

/** ค่าสุ่ม deterministic จาก seed (mulberry32) — ให้เทสต์ reproducible (มิเรอร์ fengshui/divine-cards) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * จั่วไพ่ไม่ซ้ำ `count` ใบ (ค่าเริ่มต้น 3 — สเปรด อดีต/ปัจจุบัน/อนาคต)
 * - ไม่ส่ง seed → สุ่มจริง (ฝั่ง client)
 * - ส่ง seed → ผลคงที่ (เทสต์/server; คำถามเดิม = ไพ่เดิม)
 */
export function drawRandom(count = 3, seed?: number): TarotCard[] {
  if (count > CARDS.length) {
    throw new Error(`drawRandom: requested ${count} cards but deck has ${CARDS.length}`);
  }
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const pool = CARDS.slice();
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

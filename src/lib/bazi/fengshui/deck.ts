/**
 * Deck loader สำหรับ "ไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง" (78 ใบ)
 *
 * ข้อมูลมาจาก src/lib/bazi/data/fengshui-cards.json (ตำราชัยภูมิ/ฮวงจุ้ยจากซินแสนุ้ย 2026-09-22)
 * 1 ใบ = ความหมายโดยรวม + ข้อควรระวัง + คำแนะนำแก้ไข (ตำแหน่ง/จุดเสียในสถานที่)
 *
 * ใช้ในแชท: คำถามเรื่องบ้าน/ที่ดิน/ที่ทำงาน/ห้อง/สถานที่ → จั่ว 3 ใบ (สถานที่นึงมักผิดฮวงจุ้ย >1 จุด)
 * มิเรอร์โครงสร้าง divine-cards/deck.ts (จั่วไม่ซ้ำ count ใบ)
 */
import cardsJson from "@/lib/bazi/data/fengshui-cards.json";

export type FengshuiCard = {
  no: number;
  /** ชื่อไพ่ เช่น "เสาไฟฟ้า" "ตรงข้ามโรงพยาบาล" */
  name: string;
  /** ความหมายโดยรวม = แกนพลังงาน/ผลกระทบของจุดนั้น */
  meaning: string;
  /** ข้อควรระวัง */
  caution: string;
  /** คำแนะนำแก้ไข */
  advice: string;
};

const CARDS: readonly FengshuiCard[] = cardsJson as FengshuiCard[];
const BY_NO = new Map<number, FengshuiCard>(CARDS.map((card) => [card.no, card]));

export function getAllCards(): readonly FengshuiCard[] {
  return CARDS;
}

export function getCardByNo(no: number): FengshuiCard | undefined {
  return BY_NO.get(no);
}

/** ค่าสุ่ม deterministic จาก seed (mulberry32) — ให้เทสต์ reproducible (มิเรอร์ divine-cards/deck.ts) */
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
 * จั่วไพ่ไม่ซ้ำ `count` ใบ (ค่าเริ่มต้น 3 — สถานที่ 1 แห่งมักผิดฮวงจุ้ยหลายจุด)
 * - ไม่ส่ง seed → สุ่มจริง
 * - ส่ง seed → ผลคงที่ (เทสต์/server; คำถามเดิม = ไพ่เดิม)
 */
export function drawRandom(count = 3, seed?: number): FengshuiCard[] {
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

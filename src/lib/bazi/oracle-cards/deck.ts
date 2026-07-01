/**
 * Deck loader สำหรับฟีเจอร์ "ไพ่ออราเคิลเคี้ยงคุง" (120 ใบ)
 *
 * ข้อมูลมาจาก src/lib/bazi/data/oracle-cards.json (สร้างด้วย scripts/extract-oracle-cards.py
 * จาก knownlage/ไพ่ออราเคิลเคี้ยงคุง/ไพ่ออราเคิลเคี้ยงคุง.xlsx)
 * มิเรอร์โครงสร้างจากฟีเจอร์ "โหมดเซียน" (divine-cards)
 */
import cardsJson from "@/lib/bazi/data/oracle-cards.json";

/** คำทำนายรายด้าน (คอลัมน์เสริมจากชีต — sparsely filled) — ป้อนให้ LLM เป็นบริบท */
export type OracleAspects = {
  person?: string;
  work?: string;
  wealth?: string;
  love?: string;
  health?: string;
  disease?: string;
  family?: string;
  location?: string;
  direction?: string;
  element?: string;
  color?: string;
  form?: string;
  occupation?: string;
  god?: string;
  animal?: string;
};

export type OracleCard = {
  no: number;
  name: string;
  keyword: string;
  /** สรุปสั้น (คำสำคัญ/ภาพรวม) */
  meaning: string;
  /** คำอธิบายละเอียด = แกนคำทำนายหลัก */
  book1: string;
  book2: string;
  aspects: OracleAspects;
};

export type OracleDraw = readonly [OracleCard, OracleCard, OracleCard];

const CARDS: readonly OracleCard[] = cardsJson as OracleCard[];
const BY_NO = new Map<number, OracleCard>(CARDS.map((card) => [card.no, card]));

export function getAllCards(): readonly OracleCard[] {
  return CARDS;
}

export function getCardByNo(no: number): OracleCard | undefined {
  return BY_NO.get(no);
}

/**
 * สร้างค่าสุ่ม deterministic จาก seed (mulberry32) — ให้เทสต์ reproducible
 * (มิเรอร์ divine-cards/deck.ts)
 */
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
 * จั่วไพ่ไม่ซ้ำ `count` ใบ (ค่าเริ่มต้น 3)
 * - ไม่ส่ง seed → ใช้ความสุ่มจริง (ฝั่ง client เท่านั้น)
 * - ส่ง seed → ผลคงที่ (เทสต์/ฝั่ง server)
 */
export function drawRandom(count = 3, seed?: number): OracleCard[] {
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

/**
 * Deck loader สำหรับ "ไพ่เซียมซีเคี้ยงคุง" (80 ใบ)
 *
 * ข้อมูลมาจาก src/lib/bazi/data/siamsi-kiangkung.json
 * (แปลงจาก "AI CHAT ไพ่เซียมซีเคี้ยงคุง.txt" ที่เจ้าของให้ไว้ที่ repo root — 1 ใบ = สถานการณ์ + ข้อควรระวัง + คำแนะนำ)
 *
 * ใช้ได้ทั้ง chat (จั่วเมื่อดวงตอบไม่ได้) และ API กลาง /api/siamsi-kiangkung/predict.
 * มิเรอร์โครงสร้าง oracle-cards/deck.ts แต่จั่ว "ทีละ 1 ใบ/1 คำถาม" ตามกติกาเจ้าของ.
 */
import cardsJson from "@/lib/bazi/data/siamsi-kiangkung.json";

export type SiamsiCard = {
  no: number;
  /** ชื่อไพ่ เช่น "ไม้แห้งผลิใบใหม่" */
  name: string;
  /** ธีม/หัวเรื่องสั้น เช่น "การฟื้นคืนและโอกาสแห่งความหวัง" */
  theme: string;
  /** ความหมายโดยรวม = แกนสถานการณ์ */
  situation: string;
  /** ข้อควรระวัง */
  caution: string;
  /** คำแนะนำ */
  advice: string;
};

const CARDS: readonly SiamsiCard[] = cardsJson as SiamsiCard[];
const BY_NO = new Map<number, SiamsiCard>(CARDS.map((card) => [card.no, card]));

export function getAllCards(): readonly SiamsiCard[] {
  return CARDS;
}

export function getCardByNo(no: number): SiamsiCard | undefined {
  return BY_NO.get(no);
}

/** ค่าสุ่ม deterministic จาก seed (mulberry32) — ให้เทสต์ reproducible (มิเรอร์ oracle-cards/deck.ts) */
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
 * จั่วไพ่ 1 ใบ (1 คำถาม 1 ใบ ตามกติกาไพ่เซียมซีเคี้ยงคุง)
 * - ไม่ส่ง seed → สุ่มจริง
 * - ส่ง seed → ผลคงที่ (เทสต์/server)
 */
export function drawOne(seed?: number): SiamsiCard {
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const index = Math.floor(rng() * CARDS.length);
  return CARDS[index];
}

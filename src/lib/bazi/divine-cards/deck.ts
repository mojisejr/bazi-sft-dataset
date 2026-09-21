/**
 * Deck loader สำหรับฟีเจอร์ "โหมดเซียน" — ไพ่จิตวิญญาณแดนสวรรค์ (80 ใบ)
 *
 * ข้อมูลมาจาก src/lib/bazi/data/divine-cards.json (สร้างด้วย scripts/extract-divine-cards.py
 * จาก knownlage/ไพ่เทพ/ไพ่จิตวิญญาณแดนสวรรค์.xlsx)
 */
import cardsJson from "@/lib/bazi/data/divine-cards.json";
import topicsJson from "@/lib/bazi/data/divine-cards-topics.json";

/** keyword รายด้านต่อใบ (คลังที่ซินแสเติมทีหลัง; ว่าง = ให้ AI ตีความจาก prophecy เอง) */
export type DivineTopics = {
  finance: string; // การเงิน
  career: string; // การงาน
  love: string; // ความรัก
  health: string; // สุขภาพ
  travel: string; // การเดินทาง
  other: string; // อื่นๆ
};

export type DivineCard = {
  no: number;
  group: string;
  name: string;
  keywordEn: string;
  keywords: string;
  lifeImage: string;
  prophecy: string;
  /** keyword รายด้าน (อาจว่างทุกด้านถ้าซินแสยังไม่เติม) */
  topics: DivineTopics;
};

const EMPTY_TOPICS: DivineTopics = { finance: "", career: "", love: "", health: "", travel: "", other: "" };

/** true ถ้ามีอย่างน้อย 1 ด้านที่ซินแสเติมแล้ว */
export function hasTopics(topics: DivineTopics): boolean {
  return Object.values(topics).some((v) => v.trim().length > 0);
}

type RawCard = Omit<DivineCard, "topics">;
const TOPICS_BANK = topicsJson as Record<string, Partial<DivineTopics>>;

function topicsForCard(no: number): DivineTopics {
  const raw = TOPICS_BANK[String(no)];
  return raw ? { ...EMPTY_TOPICS, ...raw } : EMPTY_TOPICS;
}

export type DivineDraw = readonly [DivineCard, DivineCard, DivineCard];

const CARDS: readonly DivineCard[] = (cardsJson as RawCard[]).map((c) => ({
  ...c,
  topics: topicsForCard(c.no),
}));
const BY_NO = new Map<number, DivineCard>(CARDS.map((card) => [card.no, card]));

export function getAllCards(): readonly DivineCard[] {
  return CARDS;
}

export function getCardByNo(no: number): DivineCard | undefined {
  return BY_NO.get(no);
}

/**
 * สร้างค่าสุ่ม deterministic จาก seed (mulberry32) — ให้เทสต์ reproducible
 * และผูกผลจั่วกับ seed ได้ (มิเรอร์แนวคิด generationSeed ใน gemini-runner.ts)
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
export function drawRandom(count = 3, seed?: number): DivineCard[] {
  if (count > CARDS.length) {
    throw new Error(`drawRandom: requested ${count} cards but deck has ${CARDS.length}`);
  }
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const pool = CARDS.slice();
  // Fisher–Yates partial shuffle
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

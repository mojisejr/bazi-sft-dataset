/**
 * Deck loader สำหรับฟีเจอร์ "เซียนเสี่ยงทาย" — เสี่ยงทายสไตล์เซียมซี (60 หัวเซี่ยงแซ / กะจื่อ)
 *
 * ข้อมูลมาจาก src/lib/bazi/data/fortune-sage.json (สร้างด้วย scripts/import-fortune-sage.ts
 * จาก knownlage/เซียนเสี่ยงทาย/เซียนเสี่ยงทาย.xlsx) — แสดงข้อความดิบ ไม่แต่งคำ
 */
import sticksJson from "@/lib/bazi/data/fortune-sage.json";

export type TopicKey = "career" | "finance" | "health" | "love" | "family";

export type FortuneStick = {
  no: number;
  stem: string;
  branch: string;
  pillar: string;
  nayin: string;
  personality: string;
  deity: string;
  topics: Record<TopicKey, string>;
  imageUrl: string | null;
};

/** หัวข้อทำนาย (key + label ภาษาไทย) เรียงตามลำดับที่แสดงผล */
export const TOPICS: readonly { key: TopicKey; label: string }[] = [
  { key: "career", label: "การงาน" },
  { key: "finance", label: "การเงิน" },
  { key: "health", label: "สุขภาพ" },
  { key: "love", label: "ความรัก" },
  { key: "family", label: "ครอบครัว" },
];

const STICKS: readonly FortuneStick[] = sticksJson as FortuneStick[];
const BY_NO = new Map<number, FortuneStick>(STICKS.map((s) => [s.no, s]));

export function getAllSticks(): readonly FortuneStick[] {
  return STICKS;
}

export function getStickByNo(no: number): FortuneStick | undefined {
  return BY_NO.get(no);
}

/**
 * สร้างค่าสุ่ม deterministic จาก seed (mulberry32) — ให้เทสต์ reproducible
 * (มิเรอร์แนวคิดจาก src/lib/bazi/divine-cards/deck.ts)
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
 * เสี่ยงทาย — สุ่ม 1 หัวเซี่ยงแซ
 * - ไม่ส่ง seed → ความสุ่มจริง
 * - ส่ง seed → ผลคงที่ (เทสต์/ฝั่ง server)
 */
export function drawRandom(seed?: number): FortuneStick {
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const idx = Math.floor(rng() * STICKS.length);
  return STICKS[idx];
}

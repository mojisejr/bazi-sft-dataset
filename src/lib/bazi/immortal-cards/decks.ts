/**
 * ไพ่ออราเคิลเทพเซียน (ซินแสนุ้ย 2026-11-02) — วิชาละ 21 ใบ เพิ่มชุดใหม่ได้เรื่อย ๆ
 * เพิ่มวิชา: สร้าง JSON ด้วย scripts/extract-immortal-deck.cjs แล้วเติมแถวใน IMMORTAL_DECKS บรรทัดเดียว
 * ไม่มีไพ่กลับหัว (ซินแสสั่ง) · รูปอยู่ใน Supabase bucket immortal-cards
 */
import poysianJson from "@/lib/bazi/data/immortal-cards/poysian.json";
import jigongJson from "@/lib/bazi/data/immortal-cards/jigong.json";

export type ImmortalDeep = { history?: string; philosophy?: string; meaning?: string; byQuestion?: string; relation?: string; teaching?: string };
export type ImmortalCard = {
  no: number;
  name: string;
  imageUrl?: string;
  category?: string;
  deity?: string;
  keywords?: string;
  overall?: string;
  work?: string;
  money?: string;
  health?: string;
  mind?: string;
  family?: string;
  loveCouple?: string;
  loveSingle?: string;
  advice?: string;
  deep?: ImmortalDeep;
};
export type ImmortalDeck = { key: string; name: string; cards: readonly ImmortalCard[]; hasContent: boolean };

export const IMMORTAL_DECKS: readonly ImmortalDeck[] = [
  { key: "poysian", name: "ไพ่ออราเคิลโป๊ยเซียน", cards: poysianJson as ImmortalCard[], hasContent: true },
  { key: "jigong", name: "ไพ่ออราเคิลพระอาจารย์จี้กง", cards: jigongJson as ImmortalCard[], hasContent: true },
];

export function getImmortalDeck(key: string): ImmortalDeck | undefined {
  return IMMORTAL_DECKS.find((d) => d.key === key);
}

export function drawImmortal(deck: ImmortalDeck, count: number, rand: () => number = Math.random): ImmortalCard[] {
  const pool = deck.cards.slice();
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

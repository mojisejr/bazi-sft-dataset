/**
 * ไพ่ทาโรต์ในแชท (ซินแสนุ้ย 2026-10-07): ตอบ "ทุกคำถามที่ไม่ใช่ดวงปาจื่อ" — จั่ว 3 ใบ ถ่วง 50/30/20 + กลับหัว 50%
 * เนื้อจากตำราซินแสนุ้ย (เล่ม 2, ไทย) ตามหัวข้อของคำถาม (การเงิน/การงาน/สุขภาพ/ครอบครัว/ความรัก/ทั่วไป)
 * "ซ่อนชื่อ/เลขไพ่" เหมือนเซียมซี/ฮวงจุ้ย (แชทพูดเป็นคำทำนาย ไม่เอ่ยชื่อไพ่) — LLM ใช้เป็นแหล่งความจริงของคำตอบ
 */
import { drawRandom, drawReversals, type TarotCard } from "@/lib/bazi/tarot/deck";
import { TAROT_WEIGHTS } from "@/lib/bazi/tarot/reading-engine";
import { getSinsaeCard, sinsaeTopicLabel, topicOfQuestion } from "@/lib/bazi/tarot/sinsae-book";

const ROLE_TH = ["ใบหลัก", "ใบรอง", "ใบเสริม"] as const;
const MAX_TOPIC_CHARS = 700;

export type TarotChatReading = {
  /** ข้อความสำหรับ prompt (ไม่มีชื่อ/เลขไพ่) */
  chatProse: string;
  /** เลขไพ่ 1-78 ตามลำดับที่จั่ว (log/เทสต์เท่านั้น — ไม่ส่งให้ LLM) */
  cardNos: number[];
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ซ่อนชื่อไพ่ที่ตำราเขียนไว้ในเนื้อ (เช่น "ในทางสากล Queen of Wands คือ...") — แชทเล่าเป็นคำทำนาย ไม่เอ่ยชื่อไพ่ */
function scrub(text: string, cardName: string): string {
  let out = text;
  for (const part of cardName.split("—")) {
    const n = part.trim().replace(/^the\s+/i, "");
    if (n.length >= 3) out = out.replace(new RegExp(escapeRe(n), "gi"), "พลังงานนี้");
  }
  return out.replace(/ไพ่ใบนี้|ไพ่ใบนั้น/g, "พลังงานนี้");
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}…` : s);

/** จั่ว 3 ใบแล้วสร้างข้อความสำหรับแชท */
export function buildTarotChatReading(question: string, seed?: number): TarotChatReading {
  return tarotChatProseFor(drawRandom(3, seed), drawReversals(3, seed), question);
}

/** สร้างข้อความสำหรับแชทจากไพ่ที่จั่ว/เลือกมาแล้ว (3 ใบ ตามลำดับ ใบหลัก/ใบรอง/ใบเสริม) — หลังบ้านใช้ให้คำตอบตรงกับไพ่ที่โชว์ */
export function tarotChatProseFor(cards: TarotCard[], flips: boolean[], question: string): TarotChatReading {
  const topic = topicOfQuestion(question);
  const blocks = cards.map((card, i) => {
    const hide = (t: string) => scrub(t, card.name);
    const book = getSinsaeCard(card.no);
    const reversed = flips[i];
    const head = `[${ROLE_TH[i]} · น้ำหนัก ${TAROT_WEIGHTS[i]}% · ${reversed ? "กลับหัว" : "หงาย"}]`;
    if (!book) return `${head}\n${hide(card.meaning)}`;
    const side = reversed ? book.reversedCore : book.core;
    const energy = side.energy ? `บวก ${side.energy.positive}% / ลบ ${side.energy.negative}%` : null;
    const topicText = book[topic] || book.general;
    return [
      head,
      reversed
        ? `ความหมาย (กลับหัว): ${hide(clip(book.reversed, 500))}`
        : `ความหมาย: ${hide(clip(book.meaning, 500))}`,
      side.positive ? `ด้านดี: ${hide(side.positive)}` : null,
      side.negative ? `ด้านลบ: ${hide(side.negative)}` : null,
      energy ? `พลังงานของใบ: ${energy}` : null,
      `เรื่อง${sinsaeTopicLabel(topic)}: ${hide(clip(topicText, MAX_TOPIC_CHARS))}`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");
  });
  const chatProse = [
    ...blocks,
    `วิธีสรุป: ถ่วงน้ำหนัก ใบหลัก ${TAROT_WEIGHTS[0]}% · ใบรอง ${TAROT_WEIGHTS[1]}% · ใบเสริม ${TAROT_WEIGHTS[2]}% — ใบหลักเป็นแกนของคำตอบ ใบรอง/ใบเสริมช่วยเสริมหรือเตือน ใบกลับหัวให้ใช้ความหมายกลับหัวและน้ำหนักด้านลบ`,
  ].join("\n\n");
  return { chatProse, cardNos: cards.map((c) => c.no) };
}

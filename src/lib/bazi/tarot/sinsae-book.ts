/**
 * ตำราไพ่ทาโรต์ของซินแสนุ้ย (เล่ม 2) — ข้อมูลรายใบจาก scripts/import-tarot-sinsae.ts → data/tarot-sinsae.json
 * ใช้คู่กับคู่มือวิถีเต๋า (เล่ม 1, tarot-tao.json): หน้าหลังบ้านโชว์ "ออราเคิลหน้าไพ่ + ด้านดี/ด้านลบ + %"
 * และ AI วิเคราะห์จากตำราทั้งสองเล่ม (ซินแสนุ้ย 2026-10-03)
 * server-only (ไฟล์ ~1.8MB — อย่า import ใน client component)
 */
import bookJson from "@/lib/bazi/data/tarot-sinsae.json";
import bookEnJson from "@/lib/bazi/data/tarot-sinsae.en.json";
import type { TarotSlot } from "@/lib/bazi/tarot/reading-engine";

export type Energy = { positive: number; negative: number; note: string } | null;
export type Side = { positive: string; negative: string; energy: Energy };
export type OracleSymbol = { symbol: string; description: string } & Side;
export type SinsaeTarotCard = {
  no: number;
  name: string;
  meaning: string;
  core: Side;
  oracle: OracleSymbol[];
  general: string;
  finance: string;
  career: string;
  health: string;
  family: string;
  love: string;
  reversed: string;
  reversedCore: Side;
};

const BOOK = bookJson as SinsaeTarotCard[];
const BY_NO = new Map(BOOK.map((c) => [c.no, c]));
// ฉบับอังกฤษ (scripts/translate-tarot-sinsae.ts, พี่โบตรวจสำนวน) — ใบที่ยังไม่แปลใช้ไทยแทน
const BY_NO_EN = new Map((bookEnJson as SinsaeTarotCard[]).map((c) => [c.no, c]));

export type SinsaeLang = "th" | "en";
const cardOf = (no: number, lang: SinsaeLang) => (lang === "en" ? BY_NO_EN.get(no) : undefined) ?? BY_NO.get(no);

export function getSinsaeCard(no: number): SinsaeTarotCard | undefined {
  return BY_NO.get(no);
}

export type SinsaeTopic = "finance" | "career" | "health" | "family" | "love" | "general";

const TOPIC_LABEL: Record<SinsaeTopic, string> = {
  finance: "การเงิน",
  career: "การงาน",
  health: "สุขภาพ",
  family: "ครอบครัว",
  love: "ความรักความสัมพันธ์",
  general: "ความหมายทั่วไปและการดำเนินชีวิต",
};

/** เดาหัวข้อจากคำถาม (คำสำคัญ) — ไม่ตรงอะไรเลย = ทั่วไป */
export function topicOfQuestion(question?: string): SinsaeTopic {
  const q = (question ?? "").toLowerCase();
  if (/เงิน|รวย|หนี้|ลงทุน|หุ้น|โชคลาภ|ค้าขาย|รายได้|money|finance|invest|debt/.test(q)) return "finance";
  if (/งาน|อาชีพ|เลื่อน|ตำแหน่ง|ธุรกิจ|ลาออก|สัมภาษณ์|เจ้านาย|ลูกค้า|สอน|career|job|work|business/.test(q)) return "career";
  if (/สุขภาพ|ป่วย|โรค|ผ่าตัด|หมอ|ร่างกาย|health|sick/.test(q)) return "health";
  if (/ครอบครัว|พ่อ|แม่|ลูก|พี่น้อง|บ้าน|ญาติ|family|parent/.test(q)) return "family";
  if (/รัก|แฟน|คู่|แต่งงาน|ชอบ|เลิก|คนคุย|สามี|ภรรยา|love|partner|marri|crush/.test(q)) return "love";
  return "general";
}

const TOPIC_LABEL_EN: Record<SinsaeTopic, string> = {
  finance: "Finance",
  career: "Career",
  health: "Health",
  family: "Family",
  love: "Love & relationships",
  general: "General meaning & way of life",
};

const pct = (e: Energy, lang: SinsaeLang = "th") =>
  lang === "en"
    ? e ? `positive ${e.positive}% / negative ${e.negative}%` : "no % in the book"
    : e ? `บวก ${e.positive}% / ลบ ${e.negative}%` : "ตำราไม่ระบุ %";

/** สรุปสำหรับหน้าหลังบ้าน (ไม่ส่งทั้งเล่มให้ client) */
export function sinsaeCardView(no: number, reversed: boolean, lang: SinsaeLang = "th") {
  const c = cardOf(no, lang);
  if (!c) return null;
  const side = reversed ? c.reversedCore : c.core;
  return {
    energy: side.energy,
    positive: side.positive,
    negative: side.negative,
    oracle: c.oracle.map((o) => ({ symbol: o.symbol, description: o.description, positive: o.positive, negative: o.negative, energy: o.energy })),
  };
}

/** บล็อกตำราซินแสของ 1 ใบสำหรับ prompt — เฉพาะส่วนที่เกี่ยว (ความหมาย/ด้าน + หัวข้อตามคำถาม + ออราเคิลย่อ) */
export function sinsaeBlock(slot: TarotSlot, topic: SinsaeTopic, lang: SinsaeLang = "th"): string {
  const c = cardOf(slot.card.no, lang);
  if (!c) return "";
  const side = slot.reversed ? c.reversedCore : c.core;
  const topicText = c[topic] || c.general;
  if (lang === "en") {
    return [
      `[${slot.role} · ${slot.weight}%] ${c.name} — ${slot.reversed ? "reversed" : "upright"}`,
      slot.reversed ? `Reversed meaning (Master Nui): ${c.reversed}` : `Meaning (Master Nui): ${c.meaning}`,
      `Good side: ${side.positive}`,
      `Bad side: ${side.negative}`,
      `Card energy: ${pct(side.energy, "en")}${side.energy?.note ? ` — ${side.energy.note}` : ""}`,
      `Topic "${TOPIC_LABEL_EN[topic]}" (Master Nui):\n${topicText}`,
      `Oracle symbols on the card: ${c.oracle.map((o) => `${o.symbol} (${pct(o.energy, "en")}) good: ${o.positive} · bad: ${o.negative}`).join(" | ")}`,
    ].join("\n");
  }
  return [
    `[${slot.role} · ${slot.weight}%] ${c.name} — ${slot.reversed ? "กลับหัว" : "หงาย"}`,
    slot.reversed ? `ความหมายกลับหัว (ตำราซินแส): ${c.reversed}` : `ความหมาย (ตำราซินแส): ${c.meaning}`,
    `ด้านดี: ${side.positive}`,
    `ด้านลบ: ${side.negative}`,
    `น้ำหนักพลังงานของใบ: ${pct(side.energy)}${side.energy?.note ? ` — ${side.energy.note}` : ""}`,
    `หัวข้อ "${TOPIC_LABEL[topic]}" (ตำราซินแส):\n${topicText}`,
    `ออราเคิลหน้าไพ่: ${c.oracle.map((o) => `${o.symbol} (${pct(o.energy)}) ดี: ${o.positive} · ลบ: ${o.negative}`).join(" | ")}`,
  ].join("\n");
}

export function sinsaeTopicLabel(t: SinsaeTopic, lang: SinsaeLang = "th"): string {
  return (lang === "en" ? TOPIC_LABEL_EN : TOPIC_LABEL)[t];
}

/**
 * ความรู้เชิงลึกไพ่จิตวิญญาณแดนสวรรค์ (ซินแสนุ้ย 2026-10-22) — ประวัติองค์เทพ/ปรัชญา +
 * คำทำนาย 9 หัวข้อ (เชิงบวก/เชิงลบ/น้ำหนักไพ่ · ความรักแยกคนโสด/คนมีคู่) + สัดส่วนบวก:ลบ ทั้งใบ
 *
 * ข้อมูล: src/lib/bazi/data/divine-cards-deep.json
 *   สร้างด้วย `node scripts/extract-divine-deep.cjs <ไฟล์ .txt จาก Google Doc> src/lib/bazi/data/divine-cards-deep.json`
 *   ต้นฉบับ: knownlage/ไพ่เทพ/ไพ่จิตวิญญาณแดนสวรรค์-ซินแสนุ้ย-2026-10.txt
 *
 * ใช้แบบ "ดึงเฉพาะส่วนที่ตรงคำถาม" ไม่ยัดทั้งใบ — prompt ไม่บวม (ทั้งสำรับ ~1.7MB)
 */
import deepJson from "@/lib/bazi/data/divine-cards-deep.json";

export const DIVINE_DEEP_TOPICS = [
  "oracle",
  "general",
  "wealth",
  "work",
  "health",
  "family",
  "love",
  "emotion",
  "material",
] as const;
export type DivineDeepTopic = (typeof DIVINE_DEEP_TOPICS)[number];

export const DIVINE_DEEP_TOPIC_LABEL: Record<DivineDeepTopic, string> = {
  oracle: "บรรยายหน้าไพ่แบบออราเคิล",
  general: "ความหมายทั่วไปและการดำเนินชีวิต",
  wealth: "การเงิน",
  work: "การงาน",
  health: "สุขภาพ",
  family: "ครอบครัว",
  love: "ความรักความสัมพันธ์",
  emotion: "อารมณ์และความรู้สึก ความคิดภายใน",
  material: "ความเกี่ยวข้องเชิงวัตถุและมิติพยากรณ์",
};

export type DivineDeepCard = {
  name: string;
  history: string;
  sections: Record<Exclude<DivineDeepTopic, "love">, string> & { love: { couple: string; single: string } };
  summary: string;
  positive: number | null;
  negative: number | null;
};

const DEEP = deepJson as unknown as Record<string, DivineDeepCard>;

export function getDivineDeep(no: number): DivineDeepCard | undefined {
  return DEEP[String(no)];
}

/** เดาหัวข้อจากคำถาม — ไม่เจอ = null (ใช้ "ความหมายทั่วไป") · เรียงลำดับสำคัญ: รัก > เงิน > งาน > สุขภาพ > ครอบครัว > ของ > ใจ */
const TOPIC_RULES: ReadonlyArray<readonly [DivineDeepTopic, RegExp]> = [
  ["love", /รัก|แฟน|คนคุย|โสด|สามี|ภรรยา|ภรรยา|เมีย|ผัว|คู่ครอง|คู่รัก|เนื้อคู่|แต่งงาน|จีบ|เลิกกัน|คืนดี|มือที่สาม|ชอบเขา|เขาคิด/],
  ["wealth", /เงิน|การเงิน|รวย|หนี้|ลงทุน|หุ้น|คริปโต|โชคลาภ|ลาภ|หวย|ลอตเตอรี่|ทรัพย์|รายได้|ค่าใช้จ่าย|ออม/],
  ["work", /งาน|อาชีพ|เลื่อนตำแหน่ง|ธุรกิจ|ค้าขาย|กิจการ|ร้าน|หัวหน้า|ลูกน้อง|สัมภาษณ์|สอบ|เรียน|ย้ายงาน|ลาออก|โปรเจกต์|โปรเจค|ลูกค้า/],
  ["health", /สุขภาพ|ป่วย|โรค|ผ่าตัด|หมอ|โรงพยาบาล|รักษา|เจ็บ|ปวด|ร่างกาย|ตั้งครรภ์|ท้อง/],
  ["family", /ครอบครัว|พ่อ|แม่|ลูก|พี่น้อง|ญาติ|ที่บ้าน|ปู่|ย่า|ตา|ยาย/],
  ["material", /ของหาย|ของมงคล|วัตถุ|เครื่องราง|พระเครื่อง|สถานที่|บ้านใหม่|ซื้อบ้าน|ซื้อรถ|รถ|ที่ดิน|ย้ายบ้าน|ทิศ/],
  ["emotion", /รู้สึก|เครียด|กังวล|เศร้า|ซึม|เหงา|ท้อ|จิตใจ|อารมณ์|ความคิด|สับสน|กลัว/],
];

export function pickDivineTopic(question?: string): DivineDeepTopic | null {
  const q = question?.trim();
  if (!q) return null;
  for (const [topic, re] of TOPIC_RULES) if (re.test(q)) return topic;
  return null;
}

/** สถานะความรักจากคำถาม — ไม่ชัด = null (ส่งทั้งสองแบบ) */
export function pickLoveStatus(question?: string): "single" | "couple" | null {
  const q = question ?? "";
  if (/โสด|ยังไม่มีแฟน|หาแฟน|เนื้อคู่|จะเจอ|คนคุย|จีบ|แอบชอบ/.test(q)) return "single";
  if (/แฟน|สามี|ภรรยา|เมีย|ผัว|คู่ครอง|แต่งงาน|เลิกกัน|คืนดี|มือที่สาม|คู่รัก/.test(q)) return "couple";
  return null;
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
}

/**
 * บริบทเชิงลึกของไพ่ 1 ใบ สำหรับใส่ prompt — หัวข้อที่ตรงคำถาม (+ ความหมายทั่วไปถ้าคำถามกว้าง),
 * สัดส่วนบวก:ลบ ทั้งใบ และประวัติองค์เทพ (ตัดสั้น) · ไม่มีข้อมูล = ""
 */
export function divineDeepContext(
  no: number,
  question?: string,
  opts: { historyChars?: number; sectionChars?: number } = {},
): string {
  const card = getDivineDeep(no);
  if (!card) return "";
  const historyChars = opts.historyChars ?? 450;
  const sectionChars = opts.sectionChars ?? 900;
  const topic = pickDivineTopic(question) ?? "general";
  const lines: string[] = [];
  if (card.positive != null && card.negative != null) {
    lines.push(`น้ำหนักทั้งใบ: เชิงบวก ${card.positive}% : เชิงลบ ${card.negative}%`);
  }
  if (topic === "love") {
    const status = pickLoveStatus(question);
    if (status !== "single" && card.sections.love.couple) {
      lines.push(`[${DIVINE_DEEP_TOPIC_LABEL.love} · คนมีคู่]\n${clip(card.sections.love.couple, sectionChars)}`);
    }
    if (status !== "couple" && card.sections.love.single) {
      lines.push(`[${DIVINE_DEEP_TOPIC_LABEL.love} · คนโสด]\n${clip(card.sections.love.single, sectionChars)}`);
    }
  } else {
    const body = card.sections[topic];
    if (body) lines.push(`[${DIVINE_DEEP_TOPIC_LABEL[topic]}]\n${clip(body, sectionChars)}`);
  }
  if (card.history) lines.push(`[ประวัติองค์เทพและหลักปรัชญา]\n${clip(card.history, historyChars)}`);
  return lines.join("\n");
}

/**
 * LLM "เกลาคำ" สำหรับไพ่ทาโรต์วิถีเต๋า — เอา engineProse (ความหมายไพ่ตามคู่มือ)
 * มาเรียบเรียงเป็นคำอ่าน โดย **ห้ามคิดความหมายใหม่/ห้ามแต่งเติม**
 *
 * ซินแสนุ้ย 2026-09-29: เวอร์ชันต่างประเทศเทสต์ก่อน → ค่าเริ่มต้นภาษาอังกฤษ (lang "en"), ไทย ("th") ไว้เฟสถัดไป
 * สเปรด 3 ใบถ่วงน้ำหนัก 50/30/20 + กลับหัว → อ่านทีละใบ แล้วปิดด้วย Summary ที่ถ่วงตามน้ำหนัก
 *
 * reuse provider plumbing เดียวกับ /reading ผ่าน generateProseLlm() — server-only
 */
import type { TarotReading } from "@/lib/bazi/tarot/reading-engine";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

export type TarotLang = "en" | "th";

const SYSTEM_EN = [
  'You are a tarot reader for "The Oriental Charm Tarot" — a Rider-Waite-Smith deck read through Taoist philosophy and filial gratitude. Speak like a real, calm, warm and compassionate reader, not an AI summarising data.',
  "",
  "Tone of this deck:",
  "- Nothing is judged black-or-white; every card is a moment in a flowing cycle. There is light within darkness; softness overcomes hardness.",
  "- Major Arcana = the path of spiritual cultivation (the Five Constants 五常, Tao / wu wei, karma and impermanence).",
  "- Minor Arcana = gratitude in daily life: Pentacles (earth) = tending resources · Cups (water) = tending the heart · Swords (air) = speech and wisdom · Wands (fire) = perseverance.",
  "",
  "The spread is WEIGHTED: the Primary card carries 50% of the answer, the Secondary 30%, the Supporting 20%. Let the Primary card lead; the others colour and qualify it in proportion.",
  "A REVERSED card: read its reversed meaning and its shadow/caution — blocked, internalised or excessive energy — never simply the upright meaning.",
  "",
  "Format (plain text, no markdown symbols):",
  "1) If there is a question, open with one sentence that answers it directly.",
  "2) One short paragraph per card, in order, starting with the card name and (Upright/Reversed) and its weight, e.g. \"The Tower (Reversed, 50%) — …\". Use the universal layer for what is happening and the Tao layer for how to meet it.",
  "3) A final paragraph beginning with \"Summary:\" that blends the cards by their weights into one clear message and one practical piece of Taoist advice.",
  "Total length: about 180-260 words.",
  "",
  "Rules:",
  "- Interpret, but never invent facts not grounded in the card meanings given (no dates, numbers or specific events the cards do not imply).",
  "- Never give lottery or lucky numbers; if asked, speak about timing and trend instead.",
  "- Do not mention 'engine', 'prompt' or any mechanics behind the reading.",
  "- Answer in English.",
].join("\n");

const SYSTEM_TH = [
  'คุณคือนักอ่านไพ่ทาโรต์ "วิถีเต๋า" (The Oriental Charm Tarot) — อ่านด้วยน้ำเสียงคนจริง สุขุม อบอุ่น มีเมตตา ไม่ใช่ AI สรุปข้อมูล',
  "",
  "โทนของสำรับ: ไม่ตัดสินขาว-ดำ ทุกใบคือช่วงหนึ่งของวัฏจักร · Major = เส้นทางบ่มเพาะจิต (เบญจธรรม 五常 · เต๋า/wu wei) · Minor = ความกตัญญูในชีวิตประจำวัน: เหรียญ(ดิน)=ดูแลปัจจัย · ถ้วย(น้ำ)=ดูแลใจ · ดาบ(ลม)=วาจาและปัญญา · ไม้(ไฟ)=ความเพียร",
  "",
  "สเปรดถ่วงน้ำหนัก: ใบหลัก 50% · ใบรอง 30% · ใบเสริม 20% — ให้ใบหลักนำ ใบอื่นเสริมตามสัดส่วน",
  "ไพ่กลับหัว: อ่านความหมายกลับหัว + ด้านเงา/ข้อควรระวัง (พลังติดขัด/เก็บกด/มากเกิน) ห้ามอ่านเหมือนหงาย",
  "",
  "รูปแบบ (ร้อยแก้ว ไม่ใช้สัญลักษณ์ markdown):",
  "1) ถ้ามีคำถาม ประโยคแรกตอบตรง ๆ",
  "2) ย่อหน้าละใบตามลำดับ ขึ้นต้นด้วยชื่อไพ่ (หงาย/กลับหัว, น้ำหนัก%)",
  "3) ย่อหน้าสุดท้ายขึ้นต้นด้วย \"สรุป:\" ผสานทุกใบตามน้ำหนัก + คำแนะนำแบบเต๋า 1 ข้อ",
  "ความยาวรวมราว 180-260 คำ",
  "",
  "กฎเหล็ก: ห้ามแต่งข้อเท็จจริงนอกความหมายไพ่ · ห้ามให้เลขเด็ด · ห้ามเอ่ยถึงกลไกเบื้องหลัง · คำลงท้ายเป็นกลาง ไม่ลงท้าย ครับ/ค่ะ · แปลความหมายจากอังกฤษเป็นไทยที่สละสลวย",
].join("\n");

function buildUserPrompt(reading: TarotReading, question: string | undefined, lang: TarotLang): string {
  const q = question?.trim();
  const head =
    lang === "en"
      ? [...(q ? [`Question from the querent: ${q}`, ""] : []), "Cards drawn (read in order; interpret, do not invent beyond the meanings):", ""]
      : [...(q ? [`คำถามจากผู้รับ: ${q}`, ""] : []), "ไพ่ที่จั่วได้ (อ่านตามลำดับ ตีความได้ ห้ามแต่งนอกความหมาย):", ""];
  // engineProse มีบล็อกไพ่ครบ (ชื่อ/หงาย-กลับหัว/น้ำหนัก/ความหมาย) — ตัดบรรทัด Question ซ้ำออก
  const body = reading.engineProse.replace(/^Question: .*\n\n/, "");
  return [...head, body].join("\n");
}

export type TarotLlmResult = { text: string; model: string };

/** ตัดคำลงท้าย ครับ/ค่ะ ท้ายประโยค (เผื่อ LLM หลุด) ให้น้ำเสียงเป็นกลาง */
export function stripGenderedEnding(text: string): string {
  return text.replace(/\s*(ครับ|ค่ะ|คะ|นะคะ|นะครับ)([."”\s]*)$/u, "$2").trimEnd();
}

export async function polishTarotReading(input: {
  reading: TarotReading;
  question?: string;
  lang?: TarotLang;
  apiKey?: string;
  model?: string;
  provider?: ReadingLlmProvider;
}): Promise<TarotLlmResult> {
  const lang = input.lang ?? "en";
  const result = await generateProseLlm({
    systemInstruction: lang === "en" ? SYSTEM_EN : SYSTEM_TH,
    userPrompt: buildUserPrompt(input.reading, input.question, lang),
    apiKey: input.apiKey,
    model: input.model,
    provider: input.provider ?? "gemini",
    temperature: 0.4,
    // ยังไม่ log usage แยก (ฟีเจอร์หลังบ้าน — ไม่อยากเพิ่มตาราง/migration ตอนนี้)
  });
  return { ...result, text: lang === "th" ? stripGenderedEnding(result.text) : result.text.trim() };
}

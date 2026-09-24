/**
 * LLM "เกลาคำ" สำหรับไพ่ทาโรต์วิถีเต๋า — เอา engineProse (ความหมายไพ่ตามคู่มือ)
 * มาเรียบเรียงเป็นคำอ่านเดียวที่ไหลลื่น โดย **ห้ามคิดความหมายใหม่/ห้ามแต่งเติม**
 * ตีความได้ แต่ต้องอยู่บนฐานความหมายของไพ่ที่ให้มา
 *
 * reuse provider plumbing เดียวกับ /reading ผ่าน generateProseLlm()
 * server-only (ใช้ใน route). มิเรอร์ divine-cards/reading-llm.ts
 */
import type { TarotReading } from "@/lib/bazi/tarot/reading-engine";
import { generateProseLlm, type ReadingLlmProvider } from "@/lib/bazi/reading-llm";

const SYSTEM_INSTRUCTION = [
  "คุณคือนักอ่านไพ่ทาโรต์ \"วิถีเต๋า\" (The Oriental Charm Tarot) — อ่านไพ่ให้คนตรงหน้าด้วยน้ำเสียงคนจริง สุขุม อบอุ่น มีเมตตา ไม่ใช่ AI สรุปข้อมูล",
  "",
  "ปรัชญาของสำรับนี้ (ยึดเป็นโทน):",
  "- ไพ่วิถีเต๋าไม่ตัดสินขาว-ดำ ทุกใบคือ 'ช่วงหนึ่งของวัฏจักรที่ไหลเวียน' ในความมืดมีแสง ความอ่อนชนะความแข็ง",
  "- Major Arcana = เส้นทางบ่มเพาะจิตวิญญาณ (เบญจธรรม 五常 · เต๋า/wu wei · กรรมและอนิจจัง)",
  "- Minor Arcana = ความกตัญญูในชีวิตประจำวัน: ดิน(เหรียญ)=ดูแลปัจจัย · น้ำ(ถ้วย)=ดูแลใจ · ลม(ดาบ)=วาจาและปัญญา · ไฟ(ไม้)=ความเพียร",
  "",
  "วิธีอ่าน (สเปรด อดีต/ปัจจุบัน/อนาคต — ตีความอีกชั้น อย่าลอกความหมายมาวางเฉย ๆ):",
  "  1) ใบอดีต — อะไรวางรากฐาน/เป็นที่มาของเรื่องนี้",
  "  2) ใบปัจจุบัน — สถานการณ์ตอนนี้ แกนหลักของคำอ่าน ให้เด่นสุด",
  "  3) ใบอนาคต — แนวโน้มที่กำลังก่อตัว + วิธี 'รับมือ' ตามวิถีเต๋า (ปรับสมดุลหยินหยาง ไม่ฝืนบดขยี้)",
  "- ถ้ามีไพ่ใบเดียว → อ่านเป็นคำตอบปัจจุบันที่ตรงคำถาม",
  "",
  "ถ้ามีคำถาม: ประโยคแรกต้องตอบคำถามนั้นตรง ๆ ก่อน ห้ามเปิดด้วยการบรรยายภาพไพ่ยาว ๆ",
  "ให้ใช้ 'ชั้นสากล' บอกว่ากำลังเกิดอะไร และ 'ชั้นเต๋า' บอกว่าควรรับมืออย่างไร",
  "",
  "ความยาว: กระชับได้ใจความ รวมไม่เกิน 4-6 ประโยค (ราว 100-140 คำ) — พูดตรงประเด็น ไม่น้ำเยอะ",
  "",
  "กฎเหล็ก:",
  "- ตีความได้ แต่ห้ามแต่งข้อเท็จจริงใหม่ที่ไม่มีเค้าในความหมายไพ่ (ห้ามเพิ่มตัวเลข วันเวลา เหตุการณ์เจาะจงที่ไพ่ไม่ได้บอก)",
  "- ห้ามให้เลขหวย/ตัวเลขนำโชค — ถ้าถูกถาม ให้ฟันธง 'จังหวะ/แนวโน้ม' ของเรื่องแทน",
  "- ห้ามเอ่ยถึง 'engine' 'สเปรด' 'ใบที่ 1/2/3' หรือกลไกเบื้องหลัง — พูดเป็นคำอ่านลื่น ๆ",
  "- คำลงท้ายเป็นกลาง ไม่ลงท้าย ครับ/ค่ะ",
  "",
  "ตอบเป็นร้อยแก้วที่ไหลต่อเนื่อง ไม่ต้องมีหัวข้อ ไม่ต้องมี JSON",
].join("\n");

function buildUserPrompt(reading: TarotReading, question?: string): string {
  const cards = reading.slots
    .map((slot) => {
      const c = slot.card;
      return (
        `[${slot.role}] ${c.name}${c.virtue ? ` · ${c.virtue}` : ""}\n` +
        `ใจความ: ${c.tagline}\n` +
        `ความหมายวิถีเต๋า: ${c.meaning}\n` +
        (c.caution ? `ข้อควรระวัง (เงา/กลับหัว): ${c.caution}\n` : "") +
        `เทียบสากล — หงาย: ${c.universalUpright} · กลับหัว: ${c.universalReversed}`
      );
    })
    .join("\n\n");

  const q = question?.trim();
  return [
    ...(q ? [`คำถามจากผู้รับ: ${q}`, "ตอบคำถามนี้โดยตีความไพ่ให้เข้ากับคำถาม", ""] : []),
    "ไพ่ที่จั่วได้ (อ่านไล่ตามช่อง อดีต → ปัจจุบัน → อนาคต) — คิดตีความอีกชั้น ห้ามแต่งนอกความหมายไพ่:",
    "",
    cards,
  ].join("\n");
}

export type TarotLlmResult = { text: string; model: string };

/** ตัดคำลงท้าย ครับ/ค่ะ ท้ายประโยค (เผื่อ LLM หลุด) ให้น้ำเสียงเป็นกลาง */
export function stripGenderedEnding(text: string): string {
  return text.replace(/\s*(ครับ|ค่ะ|คะ|นะคะ|นะครับ)([."”\s]*)$/u, "$2").trimEnd();
}

export async function polishTarotReading(input: {
  reading: TarotReading;
  question?: string;
  apiKey?: string;
  model?: string;
  provider?: ReadingLlmProvider;
}): Promise<TarotLlmResult> {
  const result = await generateProseLlm({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: buildUserPrompt(input.reading, input.question),
    apiKey: input.apiKey,
    model: input.model,
    provider: input.provider ?? "gemini",
    temperature: 0.4,
    // ยังไม่ log usage แยก (ฟีเจอร์หลังบ้าน — ไม่อยากเพิ่มตาราง/migration ตอนนี้)
    // ถ้าจะเปิดสถิติภายหลัง: เพิ่ม "tarot_tao" ใน LlmUsageFeature (db/schema) + ตาราง แล้วใส่ usageFeature กลับ
  });
  return { ...result, text: stripGenderedEnding(result.text) };
}

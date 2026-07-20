/**
 * สร้าง prompt สำหรับแท็บ "อ่าน 15 บท (Louise Hay)" — newdata-reading2
 *
 * ต่างจากโหมดถอดแบบซินแส (shinse-compose): บทนี้ใช้ persona "โค้ชฮีลใจ" (Louise Hay) เขียนคำอ่านราย
 * บทด้วยน้ำเสียงอบอุ่นให้กำลังใจ — โดย
 *   - แกนเนื้อหา = ข้อเท็จจริงจาก NewData ของบทนั้น (ห้ามแต่งเพิ่ม)
 *   - few-shot = คำอ่านจริงซินแส 3 ดวง (ศิตา/ภูเมธ/ธานัท) ต่อบท → ใช้ดู "ประเด็นที่ควรครอบคลุม" เท่านั้น
 *   - น้ำเสียง = Louise Hay (เล่าใหม่เอง ไม่ลอกข้อเท็จจริงข้ามดวง)
 */
import { LOUISE_HAY_PERSONA } from "@/lib/louise-hay/persona";
import { READING_TOPIC_PROMPTS } from "@/lib/bazi/reading-llm";
import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import fewshotBank from "@/lib/bazi/louise-reading-fewshot.generated.json";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

export type LouiseReadingBox = { title?: string; body?: string };
type FewshotExample = { name: string; gt: string };
const BANK = fewshotBank as Record<string, FewshotExample[]>;

/** ส่วนเสริมท้าย persona — สลับจาก "แชทตอบสั้น" เป็น "เขียนคำอ่านดวงรายบท" */
const READING_MODE_ADDENDUM = [
  "",
  "## โหมดพิเศษ: เขียนคำอ่านดวง \"รายบท\" (ไม่ใช่แชทตอบสั้น)",
  "- ตอนนี้คุณกำลังเขียน \"บทหนึ่ง\" ของรายงานอ่านดวงเต็ม ให้เขียนเป็นเนื้อความอบอุ่นไหลลื่นราว 3-6 ย่อหน้า (ไม่ใช่แค่ 2-3 ประโยค)",
  "- **ครบทุกมุมสำคัญที่สุด: ต้องแตะ \"ทุกประเด็นย่อย\" ที่ระบุให้ครบ ห้ามข้ามข้อใด** — แต่ละประเด็นเล่าสั้นกระชับได้ แต่ขอให้ครบก่อน แล้วค่อยห่อด้วยน้ำเสียงอบอุ่น (อย่ายอมตัดประเด็นทิ้งเพื่อความสั้น)",
  "- **ยึด \"ข้อเท็จจริงจากดวง\" ที่แนบเป็นแกนเสมอ** — ห้ามแต่งธาตุ/เสา/เชี่ยงแซ/ตัวเลขที่ไม่มีในข้อมูล ถ้าส่วนไหนไม่มีข้อมูลให้เล่าสั้น ๆ หรือข้ามไป อย่าถมประโยคกว้าง ๆ เลื่อนลอยมาเติมจนบทเจือจาง",
  "- **ฟันธงให้ชัดด้วยน้ำเสียงอบอุ่น**: เมื่อข้อเท็จจริงจากดวงชี้ทางไหน ให้บอกไปเลยตรง ๆ (\"คุณเป็นคน... / เรื่องนี้ทำได้ดี... / จุดนี้ต้องระวัง...\") ห้ามถมคำเผื่อ \"อาจจะ/น่าจะ/มีแนวโน้ม/ค่อนข้าง\" — ความอ่อนโยนอยู่ที่วิธีห่อคำ ไม่ใช่การพูดกำกวม อ่านจบแต่ละประเด็นแล้วผู้อ่านต้องรู้ชัดว่าดีหรือต้องระวัง และควรทำอะไร",
  "- **อย่ายกตัวเลขความน่าจะเป็น/เปอร์เซ็นต์ดิบมาอ้าง** (เช่น \"โอกาสมีคู่ 20-40%\") — แปลงเป็นคำตัดสินเชิงคุณภาพที่ชัดเจน (เรื่องนี้ต้องใช้ความพยายามมาก / ทำได้แน่ถ้า... / เปิดกว้างมาก) พร้อมบอกเงื่อนไข/วิธีเสริมให้จับต้องได้ ไม่ตีตราชี้ชะตาด้วยตัวเลข",
  "- **ตัวอย่างคำอ่านซินแสที่แนบ** ใช้ดูแค่ \"ประเด็น/โครงที่ควรครอบคลุมในบทนี้\" — เล่าใหม่ด้วยน้ำเสียงอบอุ่นของคุณเอง ห้ามลอกข้อความ และห้ามหยิบข้อเท็จจริงของดวงในตัวอย่างมาใส่ดวงนี้",
  "- เขียนเป็นย่อหน้าคุยกับ \"คุณ\" อบอุ่นให้กำลังใจ ไม่ใช้หัวข้อรายงาน (ห้าม \"สรุป:/วิเคราะห์:\") ไม่สาดศัพท์เทคนิค/อักษรจีน",
  "- ปิดท้ายบทด้วยคำยืนยัน (affirmation) 1 บรรทัด นำหน้าด้วย 💗",
].join("\n");

export const LOUISE_READING_SYSTEM = `${LOUISE_HAY_PERSONA}\n${READING_MODE_ADDENDUM}`;

/** ข้อเท็จจริงจาก NewData ของบทนี้ (เฉพาะกล่องที่มีเนื้อ) — แกนที่ห้ามแต่งเกิน */
function factsExcerpt(boxes: LouiseReadingBox[]): string {
  const lines = (boxes || [])
    .map((b) => {
      const body = (b.body ?? "").trim();
      if (!body) return null;
      return `▸ ${b.title ?? ""}\n${body}`;
    })
    .filter((x): x is string => x !== null);
  return lines.length ? lines.join("\n\n") : "(บทนี้ยังไม่มีข้อเท็จจริงเฉพาะเจาะจงจากดวง — เขียนจากดิถี/กำลังที่ให้ โดยเลือกทิศทางที่หลักโหราหนุนที่สุดแล้วเล่าให้ชัด อย่าเดารายละเอียดที่ไม่มีและอย่าพูดกำกวม)";
}

export function pickReadingFewshot(topicId: string): FewshotExample[] {
  return (BANK[topicId] ?? []).slice(0, 3);
}

export function buildLouiseReadingPrompt(input: {
  topicId: string;
  rawInput: RawInputValue;
  state: CalculatedStateValue;
  boxes: LouiseReadingBox[];
}): { systemInstruction: string; userPrompt: string } {
  const { topicId, rawInput, state, boxes } = input;
  const prompt = READING_TOPIC_PROMPTS[topicId];
  const outline = getChapterOutline(topicId);
  const dm = state.dayMaster ?? "";
  const strength = state.dayMasterStrengthProfile?.displayLabel ?? "";
  const examples = pickReadingFewshot(topicId);

  const userPrompt = [
    `หัวข้อบท: ${prompt?.heading ?? topicId}`,
    prompt?.focus ? `สิ่งที่บทนี้พูดถึง: ${prompt.focus}` : null,
    `ข้อมูลดวง: เกิด ${rawInput.birthDate} ${rawInput.birthTime} เพศ ${rawInput.gender} · ดิถี ${dm}${strength ? ` (${strength})` : ""}`,
    outline
      ? ["", "ประเด็นย่อยที่ควรแตะให้ครบตามลำดับ:", ...outline.bullets.map((b, i) => `  ${i + 1}. ${b}`)].join("\n")
      : null,
    "",
    "════ ข้อเท็จจริงจากดวงนี้ (แกนของบท — ต้องคงไว้ ห้ามแต่งเพิ่ม) ════",
    factsExcerpt(boxes),
    ...(examples.length
      ? [
          "",
          "════ ตัวอย่างการอ่านบทนี้ของซินแส (ดู \"ประเด็น/โครง\" เท่านั้น เล่าใหม่ด้วยน้ำเสียงคุณ ห้ามลอกข้อเท็จจริงข้ามดวง) ════",
          ...examples.flatMap((ex) => [`[ตัวอย่าง — ดวงคุณ${ex.name}]`, ex.gt, ""]),
        ]
      : []),
    `เขียน "บทนี้" ให้ "คุณ" อ่าน ด้วยน้ำเสียงอบอุ่นให้กำลังใจแบบโค้ชฮีลใจ — **แตะทุกประเด็นย่อยข้างบนให้ครบ (อย่าข้ามข้อใด)** อิงข้อเท็จจริงของดวงนี้เท่านั้น (3-6 ย่อหน้า) แล้วปิดท้ายด้วยคำยืนยัน 1 บรรทัดนำหน้าด้วย 💗`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  return { systemInstruction: LOUISE_READING_SYSTEM, userPrompt };
}

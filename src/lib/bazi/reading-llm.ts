import { GoogleGenAI } from "@google/genai";

import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

/**
 * LLM เรียบเรียงคำทำนายรายหัวข้อ ให้เป็นร้อยแก้วสไตล์ 1.docx (รายงานลูกค้าอ่าน)
 * โดย ground จาก "excerpt ตำรา" (humanKnowledge) + engine signal เท่านั้น ห้าม invent
 * และอ้างอิงชื่อตำราในคำอ่าน. แต่ละหัวข้อมี persona/focus ของตัวเอง (prompt ต่างกัน).
 *
 * server-only (ใช้ใน route).
 */

const DEFAULT_MODEL = "gemini-3-flash-preview";

type ReadingTopicPrompt = {
  /** ชื่อบทที่ใช้เปิด */
  heading: string;
  /** น้ำเสียง/มุมมองเฉพาะบท */
  persona: string;
  /** สิ่งที่ต้องเน้นตอบในบทนี้ (อิงโครง 1.docx) */
  focus: string;
};

export const READING_TOPIC_PROMPTS: Record<string, ReadingTopicPrompt> = {
  chart_foundation: {
    heading: "พื้นฐานดวงชะตาที่ถูกกำหนด",
    persona: "ซินแสที่อ่านแก่นตัวตนของเจ้าชะตาอย่างเข้าใจ ให้กำลังใจแต่ตรงไปตรงมา",
    focus: "อธิบายดิถี (ธาตุ/แข็ง-อ่อน) เป็นนิสัยพื้นฐาน จุดแข็ง จุดที่ควรระวัง และนิสัยเสริมดวงตามธาตุที่ส่งเสริม",
  },
  career_potential: {
    heading: "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ",
    persona: "ซินแสที่ปรึกษาเส้นทางอาชีพอย่างเป็นรูปธรรม",
    focus: "อาชีพ/ธุรกิจที่เสริมดวงตามธาตุที่ดี และสิ่งที่ควรเลี่ยง โดยผูกกับดิถีแข็ง/อ่อนและดาวถ่ายเท",
  },
  wealth_and_investment: {
    heading: "โชคลาภที่ถูกทาง โอกาสรวยอยู่แค่เอื้อม",
    persona: "ซินแสที่ชี้ช่องทางการเงินอย่างมีความหวังแต่สมจริง",
    focus: "ลักษณะโชคลาภ วิธีหาเงินที่เหมาะ จังหวะ และเงื่อนไขสำคัญ (เช่น โฟกัสสิ่งที่ถนัด)",
  },
  benefactor: {
    heading: "ผู้อุปถัมภ์ที่พร้อมช่วยเหลือคือใคร",
    persona: "ซินแสที่ชี้ให้เห็นคนหนุนหลังอย่างอบอุ่น",
    focus: "ผู้อุปถัมภ์มาในรูปแบบใด มาจากใคร (ผู้ใหญ่/ปู่ย่า/ลูกค้า) และควรวางตัวอย่างไรให้ได้รับการสนับสนุน",
  },
  talent: {
    heading: "พรสวรรค์ที่คุณค้นหามาตลอดทั้งชีวิต",
    persona: "ซินแสที่ค้นพบศักยภาพซ่อนเร้นของเจ้าชะตา",
    focus: "พรสวรรค์เด่นจากดาวถ่ายเท/สภาวะ และวิธีดึงศักยภาพออกมาใช้ให้เกิดผล",
  },
  family: {
    heading: "ครอบครัวอันเป็นพื้นฐานสำคัญสำหรับชีวิต",
    persona: "ซินแสที่อ่านรากฐานครอบครัวอย่างอบอุ่น",
    focus: "บทบาทพ่อแม่/ปู่ย่าและรากฐานที่ส่งต่อมา ความสัมพันธ์ในบ้าน และข้อแนะนำการดูแลคนในครอบครัว",
  },
  love_partner: {
    heading: "ความรัก / คู่ครองที่เหมาะสม",
    persona: "ซินแสที่อ่านเรื่องหัวใจอย่างละเอียดอ่อน",
    focus: "โอกาสและรูปแบบความรัก ลักษณะคู่ครองที่เหมาะ และการประคองชีวิตคู่",
  },
  friends_foes: {
    heading: "เพื่อนแท้ ศัตรู คือใคร และควรทำอย่างไร",
    persona: "ซินแสที่แนะนำการคบคนอย่างมีสติ",
    focus: "ลักษณะเพื่อนที่หนุนและคู่แข่งที่ควรระวัง (จากคู่ธาตุ+สภาวะ) และวิธีวางตัว",
  },
  partnership: {
    heading: "หุ้นส่วนควรมีหรือไม่ / จะทำธุรกิจ",
    persona: "ซินแสที่ปรึกษาเรื่องหุ้นส่วนอย่างตรงไปตรงมา",
    focus: "ควรมีหุ้นส่วนหรือไม่ตามกำลังดิถี และบทบาทหุ้นส่วนที่เหมาะ",
  },
  subordinates: {
    heading: "ลูกน้องบริวารที่ดีย่อมทำให้ธุรกิจรุ่งเรือง",
    persona: "ซินแสที่แนะนำการบริหารทีม",
    focus: "ลักษณะบริวาร/ลูกน้อง (จากเสายาม+ดาวถ่ายเท) และวิธีบริหารให้ได้ผลงาน",
  },
  education: {
    heading: "การเรียนที่ตรงสายจะช่วยให้เราร่ำรวยขึ้น",
    persona: "ซินแสที่ชี้แนวทางการเรียนรู้",
    focus: "สไตล์การเรียนรู้จากดาวถ่ายเท และวิชา/ธาตุที่ควรเน้นเพื่อแปลงความรู้เป็นความสำเร็จ",
  },
  turning_points: {
    heading: "ช่วงอายุที่ดี และช่วงที่ควรระมัดระวัง",
    persona: "ซินแสที่อ่านจังหวะชีวิตตามวัยจร",
    focus: "ช่วงวัยจรที่ส่งเสริมและช่วงที่ต้องระวัง พร้อมคำแนะนำการรับมือ",
  },
  health: {
    heading: "การดูแลสุขภาพ เพื่อเตรียมความพร้อม",
    persona: "ซินแสที่ห่วงใยสุขภาพอย่างอ่อนโยน",
    focus: "จุดอ่อนสุขภาพตามธาตุที่อ่อน และแนวทางดูแล/ปรับสมดุล",
  },
  colors_directions: {
    heading: "สี และทิศมงคล",
    persona: "ซินแสที่แนะนำของเสริมดวงอย่างใช้ได้จริง",
    focus: "สีมงคล อัญมณี และวัตถุมงคลตามธาตุที่ดวงต้องการ (useful god)",
  },
  guardian_deities: {
    heading: "องค์เทพที่คุ้มครองดวง ช่วยหนุนให้สำเร็จ",
    persona: "ซินแสที่แนะนำสิ่งศักดิ์สิทธิ์อย่างเคารพ",
    focus: "องค์เทพและการทำบุญที่เสริมธาตุที่ดวงต้องการ",
  },
};

export type ReadingTopicLlmInput = {
  topicId: string;
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  /** excerpt ตำรา (deterministic) — แกนคำตอบ; อาจเป็น null สำหรับบท derived */
  humanKnowledge: string | null;
  /** ชื่อตำราที่อ้างอิง */
  sourceLabel: string | null;
  /** signal จาก engine (ตาราง/วิธีอ่าน/คำอ่านกระชับ) */
  engineSignals: string[];
  apiKey?: string;
  model?: string;
};

type GeminiGenerate = (request: {
  model: string;
  contents: string;
  config: { systemInstruction: string; temperature: number };
}) => Promise<{ text?: string | null }>;

function buildSystemInstruction(prompt: ReadingTopicPrompt, sourceLabel: string | null): string {
  return [
    `คุณคือ${prompt.persona}`,
    `กำลังเขียนรายงานทำนายหัวข้อ "${prompt.heading}" ให้ลูกค้าอ่าน ในรูปแบบรายงานดวงจีนภาษาไทย`,
    "เขียนเป็นร้อยแก้วลื่นไหล ใช้สรรพนาม \"คุณ\" โทนอบอุ่นเป็นมืออาชีพ ไม่ใช้ bullet ไม่สาดศัพท์เทคนิคดิบ",
    "ใช้เฉพาะข้อมูลใน excerpt ตำราและ engine signal ที่ให้มาเท่านั้น ห้ามแต่งข้อเท็จจริงใหม่ (เสา ราศี ดาว ช่วงอายุ ตัวเลข)",
    "หลีกเลี่ยงโทนตำหนิ/โทษ/ขู่ ให้สมดุล: ชี้จุดที่ต้องระวังอย่างสร้างสรรค์",
    sourceLabel ? `ขึ้นต้นหรือปิดท้ายด้วยการอ้างอิงแหล่งความรู้: "${sourceLabel}"` : "อ้างอิงหลักการอ่านดวงตาม signal ที่ให้มา",
    "ความยาวพอเหมาะ 1-3 ย่อหน้า ตอบเฉพาะหัวข้อนี้",
    "ตอบเป็นข้อความล้วน ไม่ต้องมีหัวข้อหรือ JSON",
  ].join("\n");
}

function buildUserPrompt(input: ReadingTopicLlmInput, prompt: ReadingTopicPrompt): string {
  return [
    `หัวข้อ: ${prompt.heading}`,
    `สิ่งที่ต้องเน้น: ${prompt.focus}`,
    `ข้อมูลเกิด: ${input.rawInput.birthDate} ${input.rawInput.birthTime} เพศ ${input.rawInput.gender}`,
    "",
    input.humanKnowledge
      ? `excerpt ตำรา (แกนคำตอบ — เรียบเรียงใหม่ให้ลื่น คงสาระเดิม):\n${input.humanKnowledge}`
      : "ไม่มี excerpt ตำราตรงหัวข้อนี้ ให้เรียบเรียงจาก engine signal ด้านล่างตามหลักการ",
    "",
    "engine signal (โครงสร้าง/วิธีอ่านจากดวงจริง — ใช้ยืนยันข้อเท็จจริง):",
    ...input.engineSignals.map((line) => `- ${line}`),
  ].join("\n");
}

/** สร้างคำอ่านสไตล์ 1.docx ของหัวข้อเดียวด้วย Gemini */
export async function generateReadingTopicLlm(
  input: ReadingTopicLlmInput,
  deps: { generateContent?: GeminiGenerate } = {},
): Promise<{ text: string; model: string }> {
  const prompt = READING_TOPIC_PROMPTS[input.topicId];
  if (!prompt) {
    throw new Error(`ไม่มี prompt สำหรับหัวข้อ: ${input.topicId}`);
  }

  const model = input.model?.trim() || DEFAULT_MODEL;
  const generateContent =
    deps.generateContent
    ?? ((request) => new GoogleGenAI({ apiKey: input.apiKey }).models.generateContent(request));

  const response = await generateContent({
    model,
    contents: buildUserPrompt(input, prompt),
    config: {
      systemInstruction: buildSystemInstruction(prompt, input.sourceLabel),
      temperature: 0.55,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("LLM คืนค่าว่างสำหรับการเรียบเรียงคำทำนาย");
  }

  return { text, model };
}

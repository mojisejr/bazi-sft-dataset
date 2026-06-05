import { GoogleGenAI } from "@google/genai";

import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

/**
 * LLM เรียบเรียงคำทำนายรายหัวข้อ ให้เป็นร้อยแก้วสไตล์ 1.docx (รายงานลูกค้าอ่าน)
 * โดย ground จาก "excerpt ตำรา" (humanKnowledge) + engine signal เท่านั้น ห้าม invent
 * และอ้างอิงชื่อตำราในคำอ่าน. แต่ละหัวข้อมี persona/focus ของตัวเอง (prompt ต่างกัน).
 *
 * server-only (ใช้ใน route).
 */

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
/** โมเดล default ของ OpenCode Zen (OpenAI-compatible) — override ได้ผ่าน input.model */
const DEFAULT_OPENCODE_MODEL = "claude-sonnet-4-5";
/** base URL ของ OpenCode Zen — override ได้ด้วย env OPENCODE_BASE_URL */
const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL?.trim() || "https://opencode.ai/zen/v1";

/** ค่ายผู้ให้บริการ LLM ที่รองรับสำหรับเรียบเรียงคำทำนาย */
export type ReadingLlmProvider = "gemini" | "opencode";

type ReadingTopicPrompt = {
  /** ชื่อบทที่ใช้เปิด */
  heading: string;
  /** น้ำเสียง/มุมมองเฉพาะบท */
  persona: string;
  /** สิ่งที่ต้องเน้นตอบในบทนี้ (อิงโครง 1.docx) */
  focus: string;
  /**
   * บทที่มี "ตารางรายตำแหน่ง/รายมิติ" ใน excerpt ซึ่งต้องคงครบทุกบรรทัด (ห้ามยุบ)
   * — ผ่อนเพดานความยาว แล้วบังคับคงรายการตามคำสั่งนี้ (เช่น บท3 โชคลาภหลายตำแหน่ง, บท12 ตาราง 8 ตัว)
   */
  preserveDetail?: string;
};

export const READING_TOPIC_PROMPTS: Record<string, ReadingTopicPrompt> = {
  chart_foundation: {
    heading: "พื้นฐานดวงชะตาที่ถูกกำหนด",
    persona: "ซินแสที่อ่านแก่นตัวตนของเจ้าชะตาอย่างตรงไปตรงมาเชิงข้อมูล",
    focus: "อธิบายดิถี (ธาตุ/แข็ง-อ่อน) เป็นนิสัยพื้นฐาน จุดแข็ง จุดที่ควรระวัง และนิสัยเสริมดวงตามธาตุที่ส่งเสริม",
  },
  career_potential: {
    heading: "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ",
    persona: "ซินแสที่ปรึกษาเส้นทางอาชีพอย่างเป็นรูปธรรม",
    focus: "อาชีพ/ธุรกิจที่เสริมดวงตามธาตุที่ดี และสิ่งที่ควรเลี่ยง โดยผูกกับดิถีแข็ง/อ่อนและดาวถ่ายเท",
  },
  wealth_and_investment: {
    heading: "โชคลาภที่ถูกทาง โอกาสรวยอยู่แค่เอื้อม",
    persona: "ซินแสที่ชี้ช่องทางการเงินอย่างสมจริงเชิงข้อมูล",
    focus: "ลักษณะโชคลาภ วิธีหาเงินที่เหมาะ จังหวะ และเงื่อนไขสำคัญ (เช่น โฟกัสสิ่งที่ถนัด)",
    preserveDetail:
      "ดวงนี้มีโชคลาภหลายตำแหน่ง ต้องคงรายการ \"โชคลาภปรากฏหลายทาง\" ครบทุกตำแหน่ง (หลักปี/เดือน/วัน/ยาม) เป็น bullet แยกทีละตำแหน่ง พร้อมระบุ 12 เชี่ยงแซและความหมายเฉพาะของแต่ละตำแหน่งตาม excerpt ห้ามยุบรวมเป็นช่องทางเดียว",
  },
  benefactor: {
    heading: "ผู้อุปถัมภ์ที่พร้อมช่วยเหลือคือใคร",
    persona: "ซินแสที่ชี้ให้เห็นคนหนุนหลังอย่างตรงไปตรงมา",
    focus: "ผู้อุปถัมภ์มาในรูปแบบใด มาจากใคร (ผู้ใหญ่/ปู่ย่า/ลูกค้า) และควรวางตัวอย่างไรให้ได้รับการสนับสนุน",
  },
  talent: {
    heading: "พรสวรรค์ที่คุณค้นหามาตลอดทั้งชีวิต",
    persona: "ซินแสที่ค้นพบศักยภาพซ่อนเร้นของเจ้าชะตา",
    focus: "พรสวรรค์เด่นจากดาวถ่ายเท/สภาวะ และวิธีดึงศักยภาพออกมาใช้ให้เกิดผล",
  },
  family: {
    heading: "ครอบครัวอันเป็นพื้นฐานสำคัญสำหรับชีวิต",
    persona: "ซินแสที่อ่านรากฐานครอบครัวอย่างตรงไปตรงมา",
    focus: "บทบาทพ่อแม่/ปู่ย่าและรากฐานที่ส่งต่อมา ความสัมพันธ์ในบ้าน และข้อแนะนำการดูแลคนในครอบครัว",
  },
  love_partner: {
    heading: "ความรัก / คู่ครองที่เหมาะสม",
    persona: "ซินแสที่อ่านเรื่องคู่ครองอย่างตรงไปตรงมาเชิงข้อมูล",
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
    preserveDetail:
      "ถ้า excerpt มีบล็อก \"เจาะวัยจรปัจจุบัน...เทียบทีละตัวอักษร\" ต้องคงครบทั้ง 4 มิติ (ภาพรวมตัวเอง/คู่, การงาน/พ่อแม่, ลูกค้า/ผู้ใหญ่, สิ่งที่ทำ/บริวาร) เป็น bullet แยกแต่ละมิติ และคงป้าย [ยุคทอง]/[เฝ้าระวัง] ของช่วงวัยจรให้ครบ ห้ามยุบรวม",
  },
  health: {
    heading: "การดูแลสุขภาพ เพื่อเตรียมความพร้อม",
    persona: "ซินแสที่ชี้จุดสุขภาพอย่างตรงไปตรงมาเชิงข้อมูล",
    focus: "จุดอ่อนสุขภาพตามธาตุที่อ่อน และแนวทางดูแล/ปรับสมดุล",
  },
  colors_directions: {
    heading: "สี และทิศมงคล",
    persona: "ซินแสที่แนะนำของเสริมดวงอย่างใช้ได้จริง",
    focus: "สีมงคล อัญมณี และวัตถุมงคลตามธาตุที่ดวงต้องการ (useful god)",
  },
  guardian_deities: {
    heading: "องค์เทพที่คุ้มครองดวง ช่วยหนุนให้สำเร็จ",
    persona: "ซินแสที่ระบุองค์เทพและการทำบุญเชิงข้อมูล",
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
  /** ค่ายผู้ให้บริการ LLM (default gemini) */
  provider?: ReadingLlmProvider;
};

type GenerateRequest = {
  model: string;
  contents: string;
  config: { systemInstruction: string; temperature: number };
};

type GeminiGenerate = (request: GenerateRequest) => Promise<{ text?: string | null }>;

/** เรียก OpenCode Zen (OpenAI-compatible /chat/completions) แล้ว map กลับเป็น { text } */
async function generateViaOpenCode(
  request: GenerateRequest,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ text?: string | null }> {
  if (!apiKey) {
    throw new Error("OpenCode Zen ต้องมี API key");
  }
  const response = await fetchImpl(`${OPENCODE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      temperature: request.config.temperature,
      messages: [
        { role: "system", content: request.config.systemInstruction },
        { role: "user", content: request.contents },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenCode Zen ตอบกลับผิดพลาด (${response.status}) ${detail}`.trim());
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return { text: data.choices?.[0]?.message?.content ?? null };
}

/** บทแรก (พื้นฐานดวง) เท่านั้นที่เปิดด้วยภาพเปรียบธรรมชาติของดิถีได้ บทอื่นห้ามเปิดซ้ำ */
const IMAGERY_TOPIC_ID = "chart_foundation";

function buildSystemInstruction(prompt: ReadingTopicPrompt, topicId: string): string {
  const allowImagery = topicId === IMAGERY_TOPIC_ID;
  return [
    `คุณคือ${prompt.persona} กำลังเขียนรายงาน "DNA ดวงจีน" ให้ลูกค้าอ่าน`,
    `หัวข้อที่เขียน: "${prompt.heading}"`,
    "",
    "สไตล์การเขียน (สำคัญมาก — ต้องกระชับ อ่านง่าย):",
    "- เขียนกระชับ ชัดเจน ตรงประเด็น เหมือนรายงานที่อ่านแล้วเข้าใจทันที ไม่ต้องปลอบใจ/ให้กำลังใจ ไม่ใช้คำฟุ่มเฟือย ไม่เปรียบเปรยเกินจำเป็น ไม่เล่าเรื่องยืดยาว ใช้สรรพนาม \"คุณ\"",
    "- โครงสร้างต่อบท: (1) ประโยคกรอบสั้น 1 ประโยค บอกหลักของบทนี้ → (2) จุดสำคัญเป็น bullet ขึ้นต้นด้วย \"- \" → (3) คำแนะนำปิด 1 บรรทัด",
    "- แต่ละ bullet สั้น เน้นคำสำคัญ ไม่ต้องเขียนเป็นประโยคเต็มที่ยืดยาว (ตัดคำขยาย/คำเชื่อมที่ไม่จำเป็นออก)",
    "- ใช้ bullet กับสิ่งที่เป็นลิสต์ (เช่น อาชีพ สี ช่วงอายุ องค์เทพ) ตาม engine signal ที่ให้มา ห้ามยุบเป็นย่อหน้ายาว",
    prompt.preserveDetail
      ? "- บทนี้มีตารางรายตำแหน่ง/รายมิติ ให้คงทุกบรรทัดของตารางใน excerpt เป็น bullet แยกทีละรายการ ขยายความยาวได้ตามจำนวนรายการ (ไม่จำกัด 150 คำ) แต่ละ bullet ยังต้องกระชับ ไม่ซ้ำความ"
      : "- ความยาวรวมทั้งบทต้องสั้น (โดยรวมไม่เกินราว 150 คำ หรือไม่เกิน 8 bullet) ห้ามเขียนย่อหน้ายาวซ้ำความ",
    ...(prompt.preserveDetail ? [`- ${prompt.preserveDetail}`] : []),
    allowImagery
      ? "- บทนี้เปิดด้วยภาพเปรียบเชิงธรรมชาติของดิถีได้ไม่เกิน 1 ประโยคสั้น แล้วเข้าจุดสำคัญทันที"
      : "- ห้ามเปิดบทด้วยภาพเปรียบธรรมชาติของดิถี (เช่น \"เปรียบดั่งต้นไม้ใหญ่/สายน้ำ/โลหะ...\") ให้เข้าจุดสำคัญของหัวข้อทันที",
    ...(allowImagery
      ? ["- บทบุคลิก: เรียงนิสัยจุดบวก/จุดแข็งขึ้นก่อนเสมอ แล้วค่อยสรุป \"จุดที่ควรระวัง\" สั้น ๆ เพียง 1 ข้อท้ายสุด ห้ามนำด้วยนิสัยเชิงลบ และห้ามใส่จุดลบเกิน 1 ข้อ"]
      : []),
    "- ไม่สาดศัพท์เทคนิคดิบ ถ้าจำเป็นต้องเอ่ยให้แปลสั้น ๆ ให้คนทั่วไปเข้าใจ",
    "- บอกทั้งจุดแข็งและจุดที่ต้องระวังตามข้อมูล จบด้วยคำแนะนำเชิงปฏิบัติ ไม่ตำหนิ ไม่ขู่",
    "- คำลงท้ายเป็นกลาง ไม่ลงท้ายว่า \"ครับ\"/\"ค่ะ\" ไม่ผูกน้ำเสียงกับเพศ",
    "- น้ำเสียงตรงกับกำลังดิถีตามข้อมูล (ดิถีอ่อนอย่าเขียนให้ดูแข็งกร้าว ดิถีแข็งอย่าเขียนให้ดูเปราะบาง)",
    "",
    "กฎเหล็ก (ห้ามผิด):",
    "- ยึดข้อเท็จจริงและลักษณะนิสัยจาก excerpt ตำรา + engine signal ที่ให้มาเท่านั้น ห้ามแต่งเสา ราศี ดาว ธาตุ ช่วงอายุ หรือตัวเลขขึ้นเอง",
    "- ห้ามเติมลักษณะนิสัยหรือจุดอ่อนที่ไม่ปรากฏใน excerpt/signal โดยเฉพาะนิสัยเชิงลบ (เช่น โกรธง่าย ดื้อรั้น ขี้สงสัย ใจร้อน) — ถ้าข้อมูลไม่ได้ระบุ ห้ามใส่เด็ดขาด",
    "- ห้ามเติม archetype/บุคลิกสำเร็จรูปตามธาตุ (เช่น เหมาว่าธาตุไฟต้องเป็น \"ผู้นำ\") ให้บรรยายนิสัยตามที่ excerpt ระบุเท่านั้น ถ้า excerpt ว่านิสัยเมตตา/ยอมคน ก็คงไว้ ห้ามกลบด้วยภาพผู้นำ/นักสู้",
    "- ถ้าข้อมูลระบุธาตุที่ดวงต้องการ (useful god), ป้าย [ยุคทอง]/[เฝ้าระวัง], ช่วงอายุ, ตัวเลข หรือธาตุใด ต้องคงค่าเหล่านั้นไว้ให้ครบและตรงเป๊ะตามที่ให้มา ห้ามดัดแปลง",
    "- ห้ามเอ่ยถึงแหล่งที่มาของข้อมูลหรือชื่อไฟล์/เอกสารใด ๆ (เช่น M.docx, 1.docx, ชื่อตำรา) เด็ดขาด เขียนเป็นคำทำนายตรง ๆ ไม่ต้องอ้างอิงว่ามาจากไหน",
    "",
    "ตอบเป็นข้อความล้วนเฉพาะหัวข้อนี้ (ประโยคกรอบ + bullet \"- \" + คำแนะนำปิด) ไม่ต้องมีหัวข้อกำกับ ไม่ต้องมี JSON",
  ].join("\n");
}

function buildUserPrompt(input: ReadingTopicLlmInput, prompt: ReadingTopicPrompt): string {
  return [
    `หัวข้อ: ${prompt.heading}`,
    `สิ่งที่ต้องเน้น: ${prompt.focus}`,
    `ข้อมูลเกิด: ${input.rawInput.birthDate} ${input.rawInput.birthTime} เพศ ${input.rawInput.gender}`,
    "",
    input.humanKnowledge
      ? `excerpt ตำรา (แกนคำตอบ — เรียบเรียงใหม่ให้ลื่น คงสาระและนิสัยเดิมทุกข้อ ห้ามเพิ่มบุคลิกที่ไม่มีใน excerpt):\n${input.humanKnowledge}`
      : "ไม่มี excerpt ตำราตรงหัวข้อนี้ ให้เรียบเรียงจาก engine signal ด้านล่างตามหลักการ",
    "",
    "engine signal (โครงสร้าง/วิธีอ่านจากดวงจริง — ใช้ยืนยันข้อเท็จจริง คงป้าย/อายุ/ตัวเลข/ธาตุตามนี้เป๊ะ):",
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

  const provider: ReadingLlmProvider = input.provider ?? "gemini";
  const model =
    input.model?.trim() || (provider === "opencode" ? DEFAULT_OPENCODE_MODEL : DEFAULT_MODEL);

  const generateContent: GeminiGenerate =
    deps.generateContent
    ?? (provider === "opencode"
      ? (request) => generateViaOpenCode(request, input.apiKey)
      : (request) => new GoogleGenAI({ apiKey: input.apiKey }).models.generateContent(request));

  const response = await generateContent({
    model,
    contents: buildUserPrompt(input, prompt),
    config: {
      systemInstruction: buildSystemInstruction(prompt, input.topicId),
      temperature: 0.55,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("LLM คืนค่าว่างสำหรับการเรียบเรียงคำทำนาย");
  }

  return { text, model };
}

/** หนึ่งแถวของตารางบทเสริม (เส้นขีดความสัมพันธ์/วัยจร) ที่ส่งให้ LLM แต่งคำ */
export type RelationshipLineForLlm = {
  ageRange: string;
  symbol: string;
  relationLine: string;
  deepNote: string;
};

export type RelationshipLinesLlmInput = {
  rows: RelationshipLineForLlm[];
  rawInput: RawInputValue;
  calculatedState: CalculatedStateValue;
  apiKey?: string;
  model?: string;
  provider?: ReadingLlmProvider;
};

function buildRelationshipLinesSystemInstruction(): string {
  return [
    "คุณคือซินแสที่เขียนตารางวิเคราะห์วัยจร (เส้นขีดความสัมพันธ์รายช่วง 5 ปี) ให้ลูกค้าอ่านในรายงาน \"DNA ดวงจีน\"",
    "งานของคุณคือ \"แต่งคำ\" ช่อง \"คำอธิบายดี-ร้ายเชิงลึก\" ของแต่ละแถวให้กระชับ ชัดเจน เข้าใจง่าย (1-2 ประโยคสั้นต่อแถว ไม่ฟุ่มเฟือย)",
    "",
    "กฎเหล็ก (ห้ามผิด):",
    "- รักษาสาระเดิมของแต่ละแถวไว้ครบ ห้ามสลับช่วงอายุ ห้ามแต่งเหตุการณ์/ตัวเลข/ธาตุที่ไม่มีในข้อมูลเดิม",
    "- ถ้าข้อความเดิมมีป้าย [เฝ้าระวัง] หรือ [ยุคทอง] ต้องคงป้ายนั้นไว้เหมือนเดิมเป๊ะ",
    "- โทน/คำลงท้ายเป็นกลาง ไม่ลงท้ายว่า \"ครับ\"/\"ค่ะ\"",
    "- ห้ามเอ่ยถึงแหล่งที่มาของข้อมูลหรือชื่อไฟล์/เอกสารใด ๆ (เช่น M.docx)",
    "- แต่ละช่องกระชับ 1-2 ประโยค",
    "",
    "รูปแบบคำตอบ: ตอบเป็น JSON array ของสตริงเท่านั้น (ไม่มีคำอธิบายอื่น ไม่มี code fence) โดยมีจำนวนสมาชิกเท่ากับจำนวนแถวที่ให้มา เรียงตามลำดับเดิม แต่ละสมาชิกคือข้อความ \"คำอธิบายดี-ร้ายเชิงลึก\" ที่แต่งใหม่ของแถวนั้น",
  ].join("\n");
}

function buildRelationshipLinesUserPrompt(input: RelationshipLinesLlmInput): string {
  const dm = input.calculatedState.dayMaster;
  const strength = input.calculatedState.dayMasterStrengthProfile?.displayLabel ?? "";
  return [
    `ข้อมูลเกิด: ${input.rawInput.birthDate} ${input.rawInput.birthTime} เพศ ${input.rawInput.gender}`,
    `ดิถี: ${dm}${strength ? ` (${strength})` : ""}`,
    "",
    "แถวในตาราง (index | ช่วงอายุ | เสาวัยจร | เส้นขีด | คำอธิบายเดิม):",
    ...input.rows.map(
      (row, index) =>
        `${index} | ${row.ageRange} | ${row.symbol} | ${row.relationLine} | ${row.deepNote}`,
    ),
    "",
    `ตอบเป็น JSON array ความยาว ${input.rows.length} ของคำอธิบายที่แต่งใหม่ เรียงตาม index 0..${input.rows.length - 1}`,
  ].join("\n");
}

/** ดึง JSON array ของสตริงจากข้อความ LLM (เผื่อมี code fence/ข้อความห่อ) */
function parseStringArray(text: string): string[] | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed as string[];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * แต่งคำช่อง "คำอธิบายดี-ร้ายเชิงลึก" ของตารางบทเสริม (วัยจร) ด้วย LLM
 * คง ageRange/symbol/relationLine เดิม เปลี่ยนเฉพาะ deepNote — ถ้า LLM ล้มเหลว/รูปแบบไม่ตรง คืนแถวเดิม
 */
export async function polishRelationshipLinesLlm(
  input: RelationshipLinesLlmInput,
  deps: { generateContent?: GeminiGenerate } = {},
): Promise<RelationshipLineForLlm[]> {
  if (input.rows.length === 0) {
    return input.rows;
  }

  const provider: ReadingLlmProvider = input.provider ?? "gemini";
  const model =
    input.model?.trim() || (provider === "opencode" ? DEFAULT_OPENCODE_MODEL : DEFAULT_MODEL);

  const generateContent: GeminiGenerate =
    deps.generateContent
    ?? (provider === "opencode"
      ? (request) => generateViaOpenCode(request, input.apiKey)
      : (request) => new GoogleGenAI({ apiKey: input.apiKey }).models.generateContent(request));

  const response = await generateContent({
    model,
    contents: buildRelationshipLinesUserPrompt(input),
    config: {
      systemInstruction: buildRelationshipLinesSystemInstruction(),
      temperature: 0.5,
    },
  });

  const polished = parseStringArray(response.text?.trim() ?? "");
  if (!polished || polished.length !== input.rows.length) {
    // รูปแบบไม่ตรง — คงของเดิมไว้เพื่อไม่ให้ตารางเพี้ยน
    return input.rows;
  }

  return input.rows.map((row, index) => {
    const note = polished[index]?.trim();
    return note ? { ...row, deepNote: note } : row;
  });
}

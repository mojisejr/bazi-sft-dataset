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
    persona: "ซินแสที่อ่านแก่นตัวตนของเจ้าชะตาอย่างลึกซึ้งและอบอุ่น",
    focus:
      "เปิดด้วยภาพเปรียบธาตุของดิถี แล้วเล่าอุปนิสัยพื้นฐาน (จุดแข็งก่อน) ต่อด้วยหัวข้อ \"นิสัยที่พัฒนาศักยภาพ\" (เฉพาะ \"นิสัย/พฤติกรรมที่ควรเสริม\" ตามธาตุที่ส่งเสริมดวง — ไม่ใช่รายชื่ออาชีพ/คณะ) และปิดด้วย \"⚠️ สิ่งที่ควรระวัง\"",
    preserveDetail:
      "ต้องคงนิสัย/คุณสมบัติทุกข้อจาก excerpt (นิสัยราศีบน ราศีล่าง เซียงแซ) ให้ครบ ห้ามตัดหรือกลบด้วยภาพเหมารวมตามธาตุ. บทนี้เป็นเรื่อง \"บุคลิก/นิสัย\" เท่านั้น — ห้ามใส่รายการอาชีพ คณะ/วิชา สี ช่วงอายุ องค์เทพ หรือแหล่งโชคลาภ (เป็นเนื้อหาของบทอื่น) และห้ามแต่งช่วงอายุ/ตัวเลขที่ไม่มีใน excerpt",
  },
  career_potential: {
    heading: "อาชีพ / ธุรกิจ ที่ควรทำ และไม่ควรทำ",
    persona: "ซินแสที่ปรึกษาเส้นทางอาชีพอย่างเป็นรูปธรรม",
    focus: "อาชีพ/ธุรกิจที่เสริมดวงตามธาตุที่ดี และสิ่งที่ควรเลี่ยง โดยผูกกับดิถีแข็ง/อ่อนและดาวถ่ายเท",
    preserveDetail:
      "ต้องยกรายการอาชีพ/ธุรกิจของแต่ละธาตุ (useful god) มาให้ครบทุกตัวตาม excerpt เป็น bullet ห้ามตัด/ย่อ/เลือกมาบางส่วน และคงกลุ่มอาชีพที่ควรเลี่ยง (ขึ้นต้นด้วย ❌) ตามที่ระบุ ห้ามจัดอาชีพผิดธาตุ",
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
    preserveDetail:
      "คงรายการผู้อุปถัมภ์รายตำแหน่ง (ดาวส่งเสริม/ดาวอำนาจ-ตำแหน่ง ที่เสาปี-เดือน) และแนวทาง “สร้างบารมีตามคุณธรรมประจำธาตุส่งเสริม” ให้ครบ ห้ามตัด",
  },
  talent: {
    heading: "พรสวรรค์ที่คุณค้นหามาตลอดทั้งชีวิต",
    persona: "ซินแสที่ค้นพบศักยภาพซ่อนเร้นของเจ้าชะตา",
    focus:
      "บรรยายพรสวรรค์เด่น (ตามชนิดดาวถ่ายเท + เซียงแซเชิงบวก) เป็นย่อหน้าเปิดสั้น แล้วสรุป \"จุดเด่นของพรสวรรค์\" เป็น bullet — ห้ามตั้งฉายา",
    preserveDetail:
      "ต้องคงพรสวรรค์ทุกข้อจาก excerpt (ชนิดดาวถ่ายเท + ความสามารถตามเซียงแซแต่ละตำแหน่ง) ครบทุกบรรทัด ห้ามตัด",
  },
  family: {
    heading: "ครอบครัวอันเป็นพื้นฐานสำคัญสำหรับชีวิต",
    persona: "ซินแสที่อ่านรากฐานครอบครัวอย่างตรงไปตรงมา",
    focus: "บทบาทพ่อแม่/ปู่ย่าและรากฐานที่ส่งต่อมา ความสัมพันธ์ในบ้าน และข้อแนะนำการดูแลคนในครอบครัว",
    preserveDetail:
      "คงคำอ่าน พ่อ (ราศีบนหลักเดือน), แม่ (ราศีล่างหลักเดือน) และปู่ย่าตายาย (เสาปี) ตาม 12 เซียงแซให้ครบ ห้ามตัดบทบาทใด",
  },
  love_partner: {
    heading: "ความรัก / คู่ครองที่เหมาะสม",
    persona: "ซินแสที่อ่านเรื่องคู่ครองอย่างตรงไปตรงมาเชิงข้อมูล",
    focus: "โอกาสและรูปแบบความรัก ลักษณะคู่ครองที่เหมาะ และการประคองชีวิตคู่",
    preserveDetail:
      "คงคำอ่านลักษณะคู่ครองจากตารางหลักวัน, จำนวนตำแหน่งดาวคู่ครอง (มาก=คู่ครองเยอะ) และช่วงอายุเรื่องคู่ (ก่อน 20=รักวัยเรียน) ให้ครบ",
  },
  friends_foes: {
    heading: "เพื่อนแท้ ศัตรู คือใคร และควรทำอย่างไร",
    persona: "ซินแสที่แนะนำการคบคนอย่างมีสติ",
    focus: "ลักษณะเพื่อนที่หนุนและคู่แข่งที่ควรระวัง (จากคู่ธาตุ+สภาวะ) และวิธีวางตัว",
    preserveDetail:
      "คงรายการมิตร/ศัตรู/ที่ต้องประคองทุกตำแหน่ง (รายเสา + ธาตุ + เซียงแซ) ให้ครบ ห้ามยุบ",
  },
  partnership: {
    heading: "หุ้นส่วนควรมีหรือไม่ / จะทำธุรกิจ",
    persona: "ซินแสที่ปรึกษาเรื่องหุ้นส่วนอย่างตรงไปตรงมา",
    focus: "ควรมีหุ้นส่วนหรือไม่ตามกำลังดิถี และบทบาทหุ้นส่วนที่เหมาะ",
    preserveDetail:
      "คงคำอ่านราศีล่างหลักวัน (ดี=มีหุ้นส่วนได้/เสีย=ไม่ควร) และช่วงอายุเด่นเรื่องหุ้นส่วน/ทุน ให้ครบ",
  },
  subordinates: {
    heading: "ลูกน้องบริวารที่ดีย่อมทำให้ธุรกิจรุ่งเรือง",
    persona: "ซินแสที่แนะนำการบริหารทีม",
    focus: "ลักษณะบริวาร/ลูกน้อง (จากเสายาม+ดาวถ่ายเท) และวิธีบริหารให้ได้ผลงาน",
    preserveDetail:
      "คงคำอ่านเสายาม (ฐานบริวาร) และดาวถ่ายเทรายตำแหน่ง ตาม 12 เซียงแซให้ครบ ดีคือดี เสียคือเสีย ห้ามตัดสินบวกเกินจริง",
  },
  education: {
    heading: "การเรียนที่ตรงสายจะช่วยให้เราร่ำรวยขึ้น",
    persona: "ซินแสที่ชี้แนวทางการเรียนรู้",
    focus: "สไตล์การเรียนรู้จากดาวถ่ายเท และวิชา/ธาตุที่ควรเน้นเพื่อแปลงความรู้เป็นความสำเร็จ",
    preserveDetail:
      "ต้องยกรายการคณะ/สาขา/คอสของแต่ละธาตุ (useful god) มาให้ครบทุกตัวตาม excerpt เป็น bullet และคงคำอ่านเซียงแซดาวถ่ายเทรายตำแหน่ง (ดี=เรียนได้ใช้ / ซวย-เจ๊าะ=แก้ยาก) ห้ามตัด",
  },
  turning_points: {
    heading: "ช่วงอายุที่ดี และช่วงที่ควรระมัดระวัง",
    persona: "ซินแสที่อ่านจังหวะชีวิตตามวัยจร",
    focus: "ช่วงวัยจรที่ส่งเสริมและช่วงที่ต้องระวัง พร้อมคำแนะนำการรับมือ",
    preserveDetail:
      "คงทุกช่วงวัยจร (ช่วงละ 5 ปี) พร้อมบทบาทธาตุ + 12 เซียงแซ และป้าย [ยุคทอง]/[เฝ้าระวัง] ของแต่ละช่วง รวมถึงปีจรปัจจุบัน ให้ครบ ห้ามยุบรวมช่วง",
  },
  health: {
    heading: "การดูแลสุขภาพ เพื่อเตรียมความพร้อม",
    persona: "ซินแสที่ชี้จุดสุขภาพอย่างตรงไปตรงมาเชิงข้อมูล",
    focus: "จุดอ่อนสุขภาพตามธาตุที่อ่อน และแนวทางดูแล/ปรับสมดุล",
    preserveDetail:
      "คงรายการ ธาตุอ่อน/ธาตุล้นเกิน → อวัยวะ, ตำแหน่งที่เซียงแซตก (เจ๊าะ/ซวย) → อวัยวะตรงนั้น และช่วงวัยจรที่ต้องระวังสุขภาพ ให้ครบ",
  },
  colors_directions: {
    heading: "สี และทิศมงคล",
    persona: "ซินแสที่แนะนำของเสริมดวงอย่างใช้ได้จริง",
    focus: "สีมงคล อัญมณี และวัตถุมงคลตามธาตุที่ดวงต้องการ (useful god)",
    preserveDetail:
      "คงสีมงคล/อัญมณี/วัตถุมงคลของแต่ละธาตุ (useful god) ครบทุกธาตุ, สีที่ควรเลี่ยง, สีกระเป๋า/สีรถ, ทิศมงคล และสัญลักษณ์มงคล ให้ครบ ห้ามตัดสีหรืออัญมณีออก",
  },
  guardian_deities: {
    heading: "องค์เทพที่คุ้มครองดวง ช่วยหนุนให้สำเร็จ",
    persona: "ซินแสที่ระบุองค์เทพและการทำบุญเชิงข้อมูล",
    focus: "องค์เทพและการทำบุญที่เสริมธาตุที่ดวงต้องการ",
    preserveDetail:
      "คงเทพคุ้มครองดวงเฉพาะดวงรายตัวอักษร (พร้อมความหมายตามบทบาทธาตุ เช่น โชคลาภ/ผู้ใหญ่/เจรจา) และเทพ+การทำบุญตามธาตุ useful god ให้ครบทุกองค์ ห้ามตัด",
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
    `คุณคือ${prompt.persona} กำลังเขียนรายงานพยากรณ์ "Your Life Code" ให้ลูกค้าอ่าน`,
    `หัวข้อที่เขียน: "${prompt.heading}"`,
    "",
    "สไตล์การเขียน (สำคัญมาก — เลียนแบบรายงาน Your Life Code):",
    "- เขียนเป็นร้อยแก้วที่ลื่นไหล อบอุ่นแต่ตรงประเด็น เหมือนซินแสมืออาชีพเล่าให้ลูกค้าฟัง ใช้สรรพนาม \"คุณ\"",
    "- โครงต่อบท: (1) ย่อหน้าเปิด 1-3 ประโยค วางภาพรวม/แก่นของบทนี้อย่างน่าอ่าน → (2) ขยายเป็นย่อหน้าและ bullet ตามเนื้อหา → (3) ปิดด้วยคำแนะนำเชิงปฏิบัติ 1-2 ประโยค",
    "- ความยาวพอเหมาะกับเนื้อหา (ไม่บีบให้สั้นเกินจนตกข้อมูล และไม่ยืดเยื้อซ้ำความ) — เนื้อหาที่เป็นลิสต์ต้องคงครบทุกตัว",
    "- ใช้ bullet ขึ้นต้นด้วย \"- \" กับสิ่งที่เป็นลิสต์ (อาชีพ คณะ/วิชา สี ช่วงอายุ องค์เทพ แหล่งโชคลาภ) และ \"ห้ามยุบรวม/ตัดทิ้ง\" รายการใด ๆ ที่ engine ให้มา",
    "- ใช้เครื่องหมาย \"⚠️ สิ่งที่ควรระวัง\" นำหัวข้อย่อยจุดที่ต้องระวัง และ \"❌\" นำสิ่งที่ควรเลี่ยง/ห้าม (ตามสไตล์รายงาน)",
    ...(prompt.preserveDetail ? [`- ${prompt.preserveDetail}`] : []),
    allowImagery
      ? "- บทนี้เปิดด้วยภาพเปรียบเชิงธรรมชาติของดิถีได้ 1-2 ประโยค (เช่น น้ำหยินเปรียบเหมือนน้ำฝน/น้ำค้าง) แล้วเข้าสู่อุปนิสัยพื้นฐาน"
      : "- ห้ามเปิดบทด้วยภาพเปรียบธรรมชาติของดิถี ให้เข้าแก่นของหัวข้อนี้โดยตรง",
    ...(allowImagery
      ? ["- บทบุคลิก: เรียงจุดแข็ง/นิสัยเชิงบวกก่อนเสมอ แล้วค่อยปิดด้วยหัวข้อ \"⚠️ สิ่งที่ควรระวัง\" สั้น ๆ ท้ายสุด ห้ามนำด้วยนิสัยเชิงลบ"]
      : []),
    "- ไม่สาดศัพท์เทคนิคดิบ (เช่น 食傷, ดาวถ่ายเท) ถ้าจำเป็นต้องเอ่ยให้แปลเป็นภาษาคนทั่วไปสั้น ๆ",
    "- คำลงท้ายเป็นกลาง ไม่ลงท้ายว่า \"ครับ\"/\"ค่ะ\" ไม่ผูกน้ำเสียงกับเพศ",
    "- น้ำเสียงตรงกับกำลังดิถีตามข้อมูล (ดิถีอ่อนอย่าเขียนให้ดูแข็งกร้าว ดิถีแข็งอย่าเขียนให้ดูเปราะบาง)",
    "",
    "กฎเหล็ก (ห้ามผิด — เป็นหัวใจของความถูกต้อง):",
    "- ยึดข้อเท็จจริงและลักษณะนิสัยจาก excerpt + engine signal ที่ให้มาเท่านั้น ห้ามแต่งเสา ราศี ดาว ธาตุ เซียงแซ ช่วงอายุ หรือตัวเลขขึ้นเอง",
    "- ต้องคงข้อมูลทุกชิ้นจาก excerpt ให้ครบ: ทุกธาตุ ทุกเซียงแซ ทุกรายการในลิสต์ (อาชีพ/คณะ/สี/เทพ) ทุกช่วงอายุและตัวเลข ต้องปรากฏในคำตอบครบและตรงเป๊ะ ห้ามตัดทิ้งแม้แต่รายการเดียว",
    "- ห้ามเติมลักษณะนิสัย/จุดอ่อน/อาชีพ/ธาตุที่ไม่ปรากฏใน excerpt/signal โดยเฉพาะนิสัยเชิงลบ (โกรธง่าย ดื้อรั้น ฯลฯ) และห้ามจัดสิ่งใดผิดธาตุไปจากที่ระบุ",
    "- ห้ามตั้งฉายา/archetype/สมญานาม (เช่น \"นักกำจัดปัญหา\", \"THE TERMINATOR\") ให้บรรยายพรสวรรค์/บุคลิกตามเนื้อหาตรง ๆ",
    "- ห้ามเอ่ยถึงแหล่งที่มาของข้อมูลหรือชื่อไฟล์/เอกสารใด ๆ เขียนเป็นคำทำนายตรง ๆ",
    "",
    "ตอบเป็นข้อความร้อยแก้ว + bullet เฉพาะเนื้อหาหัวข้อนี้ ไม่ต้องใส่หัวข้อบท ไม่ต้องมี JSON",
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

/** โทเคน "ข้อเท็จจริง" ที่ LLM ต้องคงไว้ = ธาตุ 5 ชนิด (ไม่นับชื่อเซียงแซ เพราะ prompt สั่งให้แปลเป็นภาษาคน) */
const CRITICAL_ELEMENTS = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] as const;

/** normalize ก่อนเทียบ: ตัดช่องว่าง */
function normalizeForFaithful(text: string): string {
  return text.replace(/\s+/g, "");
}

/** ดึงโทเคนข้อเท็จจริงจาก engine text: ธาตุ (5 ชนิด), ช่วงอายุ (เช่น 40-44), ป้าย [ยุคทอง]/[เฝ้าระวัง]
 *  — ไม่นับชื่อเซียงแซ (ทอ/ลิ่มกัว/แป่...) เพราะ prompt สั่งให้แปลศัพท์เทคนิคเป็นภาษาคน gate จึงไม่ควรบังคับคงคำดิบ */
function criticalTokens(text: string): string[] {
  const norm = normalizeForFaithful(text);
  const found = new Set<string>();
  for (const t of CRITICAL_ELEMENTS) {
    if (norm.includes(t)) found.add(t);
  }
  for (const m of text.matchAll(/\d+\s*-\s*\d+/g)) {
    found.add(m[0].replace(/\s+/g, ""));
  }
  for (const tag of ["[ยุคทอง]", "[เฝ้าระวัง]"]) {
    if (text.includes(tag)) found.add(tag);
  }
  return [...found];
}

/** LLM คงโทเคนสำคัญจาก engine ไว้ครบพอหรือไม่ (>= threshold) — กันการตัด/เปลี่ยนข้อเท็จจริง
 *  threshold ผ่อนให้ร้อยแก้วเรียบเรียงใหม่ได้ แต่ยังจับการตัดทิ้งหนัก ๆ (เช่น ลิสต์อาชีพหาย) */
export function verifyReadingFaithful(engineText: string, llmText: string, threshold = 0.5): boolean {
  const need = criticalTokens(engineText);
  if (need.length === 0) {
    return true;
  }
  const llmNorm = normalizeForFaithful(llmText);
  const kept = need.filter((t) => llmNorm.includes(t.replace(/\s+/g, "")));
  return kept.length / need.length >= threshold;
}

/** สร้างคำอ่านสไตล์ Your Life Code ของหัวข้อเดียว + ด่านตรวจความซื่อสัตย์ (retry → fallback engine) */
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

  const systemInstruction = buildSystemInstruction(prompt, input.topicId);
  const userPrompt = buildUserPrompt(input, prompt);
  const engineText = input.humanKnowledge?.trim() ?? "";

  // พยายามสูงสุด 2 ครั้ง: ถ้ารอบแรกตัด/เปลี่ยนข้อเท็จจริง ย้ำกฎแล้วลองใหม่
  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const strictNote =
      attempt === 0
        ? ""
        : "\n\nสำคัญ: คำตอบก่อนหน้าตัดข้อมูลบางส่วนทิ้ง — รอบนี้ต้องคงทุกธาตุ ทุกเซียงแซ ทุกรายการในลิสต์ ทุกช่วงอายุจาก excerpt ให้ครบทุกตัว ห้ามตัด";
    const response = await generateContent({
      model,
      contents: userPrompt + strictNote,
      config: { systemInstruction, temperature: attempt === 0 ? 0.55 : 0.3 },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new Error("LLM คืนค่าว่างสำหรับการเรียบเรียงคำทำนาย");
    }
    lastText = text;
    if (!engineText || verifyReadingFaithful(engineText, text)) {
      return { text, model };
    }
  }

  // ยังคงข้อเท็จจริงไม่ครบหลัง retry → ถอยมาใช้ผล engine (การันตีไม่แย่กว่า engine)
  return { text: engineText || lastText, model: `${model} (fallback-engine)` };
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

import { GoogleGenAI } from "@google/genai";

import { getChapterOutline } from "@/lib/bazi/chapter-outline";
import { logLlmUsage, type LlmUsageProvider } from "@/lib/llm-usage/logger";
import type { LlmUsageFeature } from "@/db/schema";
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

/** โมเดล default ของ Anthropic — Sonnet 4.6 (รับ temperature ได้, สมดุล) override ผ่าน input.model */
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
/** base URL ของ Anthropic — ใช้ ANTHROPIC_PROXY_URL ก่อน (สำหรับ local proxy; เลี่ยงชนกับ OS env
 *  ANTHROPIC_BASE_URL ที่บางเครื่องตั้ง = https://api.anthropic.com แล้ว shadow .env), แล้วค่อย ANTHROPIC_BASE_URL */
const ANTHROPIC_BASE_URL =
  process.env.ANTHROPIC_PROXY_URL?.trim() ||
  process.env.ANTHROPIC_BASE_URL?.trim() ||
  "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MAX_TOKENS = 8192;

/** ค่ายผู้ให้บริการ LLM ที่รองรับสำหรับเรียบเรียงคำทำนาย */
export type ReadingLlmProvider = "gemini" | "opencode" | "anthropic";

export type ReadingTopicPrompt = {
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
      "ต้องยกรายการอาชีพ/ธุรกิจของแต่ละธาตุ (useful god) มาให้ครบทุกตัวตาม excerpt เป็น bullet ห้ามตัด/ย่อ/เลือกมาบางส่วน และคงกลุ่มอาชีพที่ควรเลี่ยง (ขึ้นต้นด้วย ❌) ตามที่ระบุ ห้ามจัดอาชีพผิดธาตุ และคงประโยค \"พรสวรรค์ → แนวอาชีพ\" (เซี่ยงแซ × ธาตุถ่ายเท) ไว้ ห้ามตัด",
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
      "บรรยายพรสวรรค์เด่น (ตามชนิดดาวถ่ายเท + เซียงแซเชิงบวก) เป็นย่อหน้าเปิดสั้น โดยอ่าน \"รูปแบบพลังของความสามารถ (เซี่ยงแซ)\" ผสานกับ \"ทิศทางที่ควรไปแสดงออก (ธาตุถ่ายเท)\" เสมอ แล้วสรุป \"จุดเด่นของพรสวรรค์\" เป็น bullet — ห้ามตั้งฉายา",
    preserveDetail:
      "ต้องคงพรสวรรค์ทุกข้อจาก excerpt (รูปแบบพลังตามเซี่ยงแซ + ความถนัดเฉพาะที่ผสานกับธาตุถ่ายเท + ชนิดดาวถ่ายเท ครบทุกตำแหน่ง) ครบทุกบรรทัด ห้ามตัด ห้ามสลับธาตุ",
  },
  family: {
    heading: "ครอบครัวอันเป็นพื้นฐานสำคัญสำหรับชีวิต",
    persona: "ซินแสที่อ่านรากฐานครอบครัวอย่างตรงไปตรงมา",
    focus:
      "บทบาทพ่อแม่/ปู่ย่าและรากฐานที่ส่งต่อมา ความสัมพันธ์ในบ้าน และข้อแนะนำการดูแลคนในครอบครัว — เชี่ยงแซของแต่ละเสาสื่อ 'ลักษณะ/จังหวะความสัมพันธ์และการฟูมฟักดูแล' ไม่ใช่สุขภาพหรือความเสื่อมตามตัวอักษร; ช่วงเชี่ยงแซถดถอย (ซวย/แป่/ซี่) ในบริบทครอบครัวอ่านเป็น 'การบ่มเพาะค่อยเป็นค่อยไป/ความผูกพันเงียบ ๆ' อย่าฟันธงว่าคนในครอบครัวป่วยหรือตกต่ำ",
    preserveDetail:
      "คงคำอ่าน พ่อ (ราศีบนหลักเดือน), แม่ (ราศีล่างหลักเดือน) และปู่ย่าตายาย (เสาปี) ตาม 12 เซียงแซให้ครบ ห้ามตัดบทบาทใด — แปลงโทนเป็นลักษณะความสัมพันธ์/การดูแล ไม่ใช่โรคภัย",
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
    focus:
      "ระดับการเรียนอ่านจาก \"ดาวถ่ายเท\" เป็นหลัก (ถ่ายเทได้สภาวะดี = เรียนได้สูง/ได้ใช้จริง) ส่วนเชี่ยงแซหลักวันบอก \"สไตล์/จังหวะ\" การเรียน + วิชา/ธาตุที่ควรเน้นเพื่อแปลงความรู้เป็นความสำเร็จ",
    preserveDetail:
      "ต้องยกรายการคณะ/สาขา/คอสของแต่ละธาตุ (useful god) มาให้ครบทุกตัวตาม excerpt เป็น bullet และคงคำอ่านเซียงแซดาวถ่ายเทรายตำแหน่ง ห้ามตัด. **ตัดสิน \"ระดับการเรียน\" จากสภาวะดาวถ่ายเท ไม่ใช่ edu_level หลักวันเดี่ยว ๆ** — ถ้าถ่ายเทได้ เชี่ยงแซ/ตี้อ๋วง/ลิ่มกัว/กวงตั่ว (สภาวะดี) ให้อ่านว่าเรียนได้ระดับสูง (ตรี-โท-เอก) แม้เชี่ยงแซหลักวันจะตกซวย/ซี่ (ซวย/ซี่ = เรียนช้า/สะสมเรื่อย ๆ เป็นสไตล์ ไม่ใช่เพดานการเรียน); ถ้าถ่ายเทได้สภาวะไม่ดีให้มองด้านดีของมัน",
  },
  turning_points: {
    heading: "ช่วงอายุที่ดี และช่วงที่ควรระมัดระวัง",
    persona: "ซินแสที่อ่านจังหวะชีวิตตามวัยจร",
    focus: "ช่วงวัยจรที่ส่งเสริมและช่วงที่ต้องระวัง พร้อมคำแนะนำการรับมือ",
    preserveDetail:
      "คงทุกช่วงวัยจร (ช่วงละ 5 ปี) ตั้งแต่วัยจรแรก พร้อมบทบาทธาตุ + 12 เซียงแซ และไอคอนดาวเกรดของแต่ละช่วง (⭐⭐⭐/⭐⭐/⭐/◇) รวมถึงปีจรปัจจุบัน ให้ครบ ห้ามยุบรวมช่วง และห้ามแปลงดาวกลับเป็นคำว่า [ยุคทอง]/[เฝ้าระวัง]",
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

/**
 * โปรไฟล์ prompt ที่สลับได้ (สำหรับ A/B tuning) — baseline = ของเดิม
 * แต่ละโปรไฟล์กำหนดวิธีประกอบ system/user prompt เอง โดยใช้ ReadingTopicPrompt ราย topic เดิม
 */
export type ReadingPromptProfile = {
  id: string;
  buildSystemInstruction: (prompt: ReadingTopicPrompt, topicId: string) => string;
  buildUserPrompt: (input: ReadingTopicLlmInput, prompt: ReadingTopicPrompt) => string;
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
  /** โปรไฟล์ prompt (default BASELINE_PROFILE) — ใช้ A/B ขัดเกลา prompt */
  profile?: ReadingPromptProfile;
  /** คำที่ซินแสเคยแก้ให้ดวงที่ได้ผลคล้ายกัน — ใช้เป็นตัวอย่างสำนวน/แนวคำ (~80%) */
  masterCorrections?: string[];
};

type GenerateRequest = {
  model: string;
  contents: string;
  config: { systemInstruction: string; temperature: number };
};

/** โทเคนที่ใช้ในการเรียก 1 ครั้ง (ถ้า provider คืนมา) */
export type LlmCallUsage = { inTokens: number; outTokens: number };

type GeminiGenerate = (
  request: GenerateRequest,
) => Promise<{ text?: string | null; usage?: LlmCallUsage }>;

/** ตัวเลือกบันทึกสถิติ — ถ้ามี usageFeature จะ log โทเคนลงตารางของฟีเจอร์นั้น (fire-and-forget) */
type UsageLogOptions = {
  usageFeature?: LlmUsageFeature;
  usageLabel?: string | null;
  usageAnonId?: string | null;
};

function providerToUsage(provider: ReadingLlmProvider): LlmUsageProvider {
  return provider;
}

function maybeLogReadingUsage(
  opts: UsageLogOptions,
  provider: ReadingLlmProvider,
  model: string,
  usage: LlmCallUsage,
): void {
  if (!opts.usageFeature) return;
  logLlmUsage(opts.usageFeature, {
    provider: providerToUsage(provider),
    model,
    inTokens: usage.inTokens,
    outTokens: usage.outTokens,
    label: opts.usageLabel ?? null,
    anonId: opts.usageAnonId ?? null,
  });
}

/** เรียก OpenCode Zen (OpenAI-compatible /chat/completions) แล้ว map กลับเป็น { text } */
async function generateViaOpenCode(
  request: GenerateRequest,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ text?: string | null; usage?: LlmCallUsage }> {
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
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? null,
    usage: {
      inTokens: data.usage?.prompt_tokens ?? 0,
      outTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

/** เรียก Anthropic Messages API (/v1/messages) แล้ว map กลับเป็น { text }
 *  - system → top-level `system`; user → messages[]; อ่านผลจาก content[].text (รวม block ชนิด text)
 *  - รองรับ ANTHROPIC_BASE_URL สำหรับ proxy/Claude ใน local
 *  - เลี่ยงส่ง temperature ให้ Opus 4.7/4.8 (โมเดลกลุ่มนี้ตัด sampling params → 400) */
async function generateViaAnthropic(
  request: GenerateRequest,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ text?: string | null; usage?: LlmCallUsage }> {
  if (!apiKey) {
    throw new Error("Anthropic ต้องมี API key");
  }
  const rejectsTemperature = /claude-opus-4-(?:7|8)/.test(request.model);
  const response = await fetchImpl(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: request.config.systemInstruction,
      messages: [{ role: "user", content: request.contents }],
      ...(rejectsTemperature ? {} : { temperature: request.config.temperature }),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Anthropic ตอบกลับผิดพลาด (${response.status}) ${detail}`.trim());
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string | null }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  return {
    text: text || null,
    usage: {
      inTokens: data.usage?.input_tokens ?? 0,
      outTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

/** เลือกโมเดล default ตาม provider (ถ้าไม่ override ด้วย input.model) */
function resolveLlmModel(provider: ReadingLlmProvider, model?: string): string {
  if (model?.trim()) {
    return model.trim();
  }
  if (provider === "opencode") {
    return DEFAULT_OPENCODE_MODEL;
  }
  if (provider === "anthropic") {
    return DEFAULT_ANTHROPIC_MODEL;
  }
  return DEFAULT_MODEL;
}

/** เลือกตัว generate ตาม provider (gemini SDK / opencode / anthropic raw HTTP) */
function resolveLlmGenerator(provider: ReadingLlmProvider, apiKey: string | undefined): GeminiGenerate {
  if (provider === "opencode") {
    return (request) => generateViaOpenCode(request, apiKey);
  }
  if (provider === "anthropic") {
    return (request) => generateViaAnthropic(request, apiKey);
  }
  return async (request) => {
    const r = await new GoogleGenAI({ apiKey }).models.generateContent(request);
    return {
      text: r.text,
      // Gemini คิดเงิน thinking (thoughtsTokenCount) เป็น output ด้วย → ต้องรวม ไม่งั้นต้นทุนต่ำกว่าจริง
      usage: {
        inTokens: r.usageMetadata?.promptTokenCount ?? 0,
        outTokens:
          (r.usageMetadata?.candidatesTokenCount ?? 0) + (r.usageMetadata?.thoughtsTokenCount ?? 0),
      },
    };
  };
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
    "- โครงต่อบท (บังคับทุกบท): เปิดด้วยหัวข้อ \"## บทนำ\" (ย่อหน้าสั้น 1-3 ประโยค วางภาพรวม/แก่นของบทนี้อย่างน่าอ่าน) → ตามด้วยเนื้อหาหลัก (ย่อหน้าและ bullet ตามหัวข้อย่อยที่กำหนด) → ปิดท้ายด้วยหัวข้อ \"## สรุป\" (สรุปแก่นของบท + คำแนะนำเชิงปฏิบัติ 1-2 ประโยค)",
    "- หัวข้อ \"## บทนำ\" และ \"## สรุป\" ต้องเขียนตรงตามนี้เป๊ะ (ขึ้นต้นด้วย \"## \") เพื่อให้ระบบจัดเป็นส่วนมีสไตล์ — ห้ามเปลี่ยนชื่อ ห้ามข้าม ห้ามมีมากกว่าอย่างละหนึ่ง",
    "- ความยาวพอเหมาะกับเนื้อหา (ไม่บีบให้สั้นเกินจนตกข้อมูล และไม่ยืดเยื้อซ้ำความ) — เนื้อหาที่เป็นลิสต์ต้องคงครบทุกตัว",
    "- ใช้ bullet ขึ้นต้นด้วย \"- \" กับสิ่งที่เป็นลิสต์ และ \"ห้ามยุบรวม/ตัดทิ้ง\" รายการใด ๆ ที่ engine ให้มา แต่ \"ห้ามเพิ่มลิสต์เองที่ excerpt ไม่ได้ให้\" — โดยเฉพาะ สี/อัญมณี/วัตถุมงคล (สงวนไว้เฉพาะบทสีและทิศมงคล) และ องค์เทพ/การทำบุญ (สงวนไว้เฉพาะบทองค์เทพ) ห้ามแทรกในบทอื่นเด็ดขาด",
    "- ใช้หัวข้อ \"⚠️ สิ่งที่ควรระวัง\" รวบทั้งจุดที่ต้องระวังและสิ่งที่ควรเลี่ยง/ห้ามไว้ในหัวข้อเดียวกัน — ห้ามแยกหัวข้อ \"สิ่งที่ควรเลี่ยง\" หรือใช้ \"❌\" เป็นหัวข้อต่างหาก",
    ...(prompt.preserveDetail ? [`- ${prompt.preserveDetail}`] : []),
    allowImagery
      ? "- ในส่วน \"## บทนำ\" บทนี้เปิดด้วยภาพเปรียบเชิงธรรมชาติของดิถีได้ 1-2 ประโยค (เช่น น้ำหยินเปรียบเหมือนน้ำฝน/น้ำค้าง) แล้วจึงเข้าสู่อุปนิสัยพื้นฐานในเนื้อหาหลัก"
      : "- ในส่วน \"## บทนำ\" ห้ามเปิดด้วยภาพเปรียบธรรมชาติของดิถี ให้เข้าแก่นของหัวข้อนี้โดยตรง",
    ...(allowImagery
      ? ["- บทบุคลิก: เรียงจุดแข็ง/นิสัยเชิงบวกก่อนเสมอ แล้วค่อยปิดด้วยหัวข้อ \"⚠️ สิ่งที่ควรระวัง\" สั้น ๆ ท้ายสุด ห้ามนำด้วยนิสัยเชิงลบ"]
      : []),
    "- ไม่สาดศัพท์เทคนิคดิบ (เช่น 食傷, ดาวถ่ายเท) ถ้าจำเป็นต้องเอ่ยให้แปลเป็นภาษาคนทั่วไปสั้น ๆ",
    "- ยกเว้น: อักษรจีนก้าน/กิ่ง (เช่น 癸, 巳, 酉), ชื่อสภาวะเซียงแซ และคำว่า \"ยาม\" ที่ปรากฏใน excerpt ต้องคงไว้ \"ตรงตัวเป๊ะ\" ห้ามแปลงเป็นนักษัตรไทย (เช่น 酉→ระกา) ห้ามเปลี่ยน \"ยาม\"→\"เวลา\" และห้ามตัดทิ้ง",
    "- คำลงท้ายเป็นกลาง ไม่ลงท้ายว่า \"ครับ\"/\"ค่ะ\" ไม่ผูกน้ำเสียงกับเพศ",
    "- น้ำเสียงตรงกับกำลังดิถีตามข้อมูล (ดิถีอ่อนอย่าเขียนให้ดูแข็งกร้าว ดิถีแข็งอย่าเขียนให้ดูเปราะบาง)",
    "",
    "กฎเหล็ก (ห้ามผิด — เป็นหัวใจของความถูกต้อง):",
    "- ยึดข้อเท็จจริงและลักษณะนิสัยจาก excerpt + engine signal ที่ให้มาเท่านั้น ห้ามแต่งเสา ราศี ดาว ธาตุ เซียงแซ ช่วงอายุ หรือตัวเลขขึ้นเอง",
    "- ต้องคงข้อมูลทุกชิ้นจาก excerpt ให้ครบ: ทุกธาตุ ทุกเซียงแซ ทุกรายการในลิสต์ที่ excerpt ให้มา ทุกช่วงอายุและตัวเลข ต้องปรากฏในคำตอบครบและตรงเป๊ะ ห้ามตัดทิ้งแม้แต่รายการเดียว (และห้ามเพิ่มลิสต์ที่ไม่มีใน excerpt)",
    "- ห้ามเติมลักษณะนิสัย/จุดอ่อน/อาชีพ/ธาตุที่ไม่ปรากฏใน excerpt/signal โดยเฉพาะนิสัยเชิงลบ (โกรธง่าย ดื้อรั้น ฯลฯ) และห้ามจัดสิ่งใดผิดธาตุไปจากที่ระบุ",
    "- ห้ามตั้งฉายา/archetype/สมญานาม (เช่น \"นักกำจัดปัญหา\", \"THE TERMINATOR\") ให้บรรยายพรสวรรค์/บุคลิกตามเนื้อหาตรง ๆ",
    "- ห้ามเอ่ยถึงดวงดาว/แนวคิดที่ไม่ปรากฏใน excerpt โดยเด็ดขาด โดยเฉพาะ \"ดาวดอกท้อ/ท้อฮวย\" และคำว่า \"เสน่ห์/มหาเสน่ห์\" (ถ้า excerpt ไม่ได้ระบุ ห้ามใส่ — ความน่าดึงดูดของเจ้าชะตามาจากดาวถ่ายเท/ความน่าเชื่อถือ ไม่ใช่เสน่ห์ดอกท้อ)",
    "- ห้ามเอ่ยถึงแหล่งที่มาของข้อมูลหรือชื่อไฟล์/เอกสารใด ๆ เขียนเป็นคำทำนายตรง ๆ",
    "",
    "ตอบเป็นข้อความร้อยแก้ว + bullet เฉพาะเนื้อหาหัวข้อนี้ ไม่ต้องใส่หัวข้อบท ไม่ต้องมี JSON",
  ].join("\n");
}

function buildUserPrompt(input: ReadingTopicLlmInput, prompt: ReadingTopicPrompt): string {
  const outline = getChapterOutline(input.topicId);
  return [
    `หัวข้อ: ${prompt.heading}`,
    `สิ่งที่ต้องเน้น: ${prompt.focus}`,
    `ข้อมูลเกิด: ${input.rawInput.birthDate} ${input.rawInput.birthTime} เพศ ${input.rawInput.gender}`,
    "",
    ...(outline
      ? [
          "หัวข้อย่อยที่ต้องครอบคลุม \"ครบและเรียงตามลำดับนี้\" ในส่วนเนื้อหาหลัก (ระหว่าง ## บทนำ และ ## สรุป) — ข้อใดที่ excerpt/engine ไม่มีข้อมูลจริงให้เขียนสั้น ๆ ตามที่มี ห้ามแต่งเพิ่ม:",
          ...outline.bullets.map((b, i) => `  ${i + 1}. ${b}`),
          "",
        ]
      : []),
    input.humanKnowledge
      ? `excerpt ตำรา (แกนคำตอบ — เรียบเรียงใหม่ให้ลื่น คงสาระและนิสัยเดิมทุกข้อ ห้ามเพิ่มบุคลิกที่ไม่มีใน excerpt):\n${input.humanKnowledge}`
      : "ไม่มี excerpt ตำราตรงหัวข้อนี้ ให้เรียบเรียงจาก engine signal ด้านล่างตามหลักการ",
    "",
    "engine signal (โครงสร้าง/วิธีอ่านจากดวงจริง — ใช้ยืนยันข้อเท็จจริง คงป้าย/อายุ/ตัวเลข/ธาตุตามนี้เป๊ะ):",
    ...input.engineSignals.map((line) => `- ${line}`),
    ...(input.masterCorrections && input.masterCorrections.length > 0
      ? [
          "",
          "ตัวอย่างคำที่ซินแส (ผู้เชี่ยวชาญ) เคยแก้ให้ดวงที่ได้ผลคล้ายกัน — ให้ยึดสำนวน แนวคำ และจุดเน้นเหล่านี้เป็นหลัก (~80%) แล้วปรับข้อเท็จจริง/ตัวเลข/ธาตุให้ตรงดวงนี้ (~20%) ห้ามคัดลอกข้อเท็จจริงเฉพาะดวงอื่นมาทั้งดุ้น:",
          ...input.masterCorrections.map(
            (example, index) => `[ตัวอย่างซินแส ${index + 1}]\n${example}`,
          ),
        ]
      : []),
  ].join("\n");
}

/** โปรไฟล์ prompt เริ่มต้น (พฤติกรรม production เดิม) — ใช้เมื่อ input.profile ไม่ระบุ */
export const BASELINE_PROFILE: ReadingPromptProfile = {
  id: "baseline",
  buildSystemInstruction,
  buildUserPrompt,
};

/** โทเคน "ข้อเท็จจริง" ที่ LLM ต้องคงไว้ = ธาตุ 5 ชนิด (ไม่นับชื่อเซียงแซ เพราะ prompt สั่งให้แปลเป็นภาษาคน) */
const CRITICAL_ELEMENTS = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] as const;

/** คำที่ LLM ชอบ "หลอน" ดึงมาจากความรู้นอก engine — ห้ามปรากฏถ้าไม่มีใน excerpt
 *  (ซินแซ flag: ดาวดอกท้อ/ท้อฮวย พี่พลไม่มี, "เสน่ห์" จริง ๆ คือถ่ายเทหลิมกัว=น่าเชื่อถือ ไม่ใช่เสน่ห์) */
const FORBIDDEN_INVENTED_TERMS = [
  "ดอกท้อ",
  "ท้อฮวย",
  "เสน่ห์",
  "มหาเสน่ห์",
] as const;

/** คืนคำต้องห้ามที่ LLM "เพิ่มขึ้นเอง" (อยู่ในผล LLM แต่ไม่มีใน engine excerpt) */
export function forbiddenInventions(engineText: string, llmText: string): string[] {
  const engineNorm = normalizeForFaithful(engineText);
  const llmNorm = normalizeForFaithful(llmText);
  return FORBIDDEN_INVENTED_TERMS.filter(
    (term) => llmNorm.includes(term) && !engineNorm.includes(term),
  );
}

/** normalize ก่อนเทียบ: ตัดช่องว่าง */
function normalizeForFaithful(text: string): string {
  return text.replace(/\s+/g, "");
}

/** ดึงโทเคนข้อเท็จจริงจาก engine text ที่ LLM ต้องคงไว้:
 *  ธาตุ (5 ชนิด), ช่วงอายุ (เช่น 40-44), ป้าย [ยุคทอง]/[เฝ้าระวัง],
 *  อักษรจีนก้าน/กิ่ง (天干地支 เช่น 癸 巳 — เป็น marker เฉพาะ ห้าม LLM แปลงเป็นนักษัตรไทย/ตัด),
 *  และคำว่า "ยาม" (ซินแสกำชับให้คงคำเดิม ห้ามเปลี่ยนเป็น "เวลา") */
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

/** marker ที่ต้องคงไว้ "เป๊ะทุกตัว" (strict, ไม่ใช้ threshold) — คืนรายการที่หายไปจากผล LLM:
 *  - อักษรจีนก้าน/กิ่ง (เช่น 癸 巳) — ห้ามแปลงเป็นนักษัตรไทย (เช่น 酉→ระกา) หรือตัดทิ้ง
 *  - คำว่า "ยาม" — ซินแสกำชับห้ามเปลี่ยนเป็น "เวลา"
 *  ถ้าคืนค่าไม่ว่าง = LLM ทำ marker หาย → ไม่ผ่าน (retry/fallback engine) */
export function droppedCriticalMarkers(engineText: string, llmText: string): string[] {
  const llmNorm = normalizeForFaithful(llmText);
  const required = new Set<string>();
  for (const m of engineText.matchAll(/[一-鿿豈-﫿]/g)) {
    required.add(m[0]);
  }
  if (engineText.includes("ยาม")) {
    required.add("ยาม");
  }
  return [...required].filter((marker) => !llmNorm.includes(marker));
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

/**
 * เรียบเรียงร้อยแก้วทั่วไปจาก engine-truth ที่ส่งมา (ใช้กับหน้าเปรียบเทียบดวงคู่).
 * ground ด้วยข้อความ engine-truth — ห้ามแต่งข้อมูลนอกเหนือจากที่ให้มา. reuse provider
 * plumbing เดียวกับ generateReadingTopicLlm.
 */
export async function generateProseLlm(
  input: {
    systemInstruction: string;
    userPrompt: string;
    apiKey?: string;
    model?: string;
    provider?: ReadingLlmProvider;
    temperature?: number;
  } & UsageLogOptions,
  deps: { generateContent?: GeminiGenerate } = {},
): Promise<{ text: string; model: string }> {
  const provider: ReadingLlmProvider = input.provider ?? "gemini";
  const model = resolveLlmModel(provider, input.model);
  const generateContent: GeminiGenerate =
    deps.generateContent ?? resolveLlmGenerator(provider, input.apiKey);

  const response = await generateContent({
    model,
    contents: input.userPrompt,
    config: { systemInstruction: input.systemInstruction, temperature: input.temperature ?? 0.5 },
  });
  const text = response.text?.trim();
  if (!text) {
    throw new Error("LLM คืนค่าว่างสำหรับการเรียบเรียงคำทำนาย");
  }
  maybeLogReadingUsage(input, provider, model, response.usage ?? { inTokens: 0, outTokens: 0 });
  return { text, model };
}

/** สร้างคำอ่านสไตล์ Your Life Code ของหัวข้อเดียว + ด่านตรวจความซื่อสัตย์ (retry → fallback engine) */
export async function generateReadingTopicLlm(
  input: ReadingTopicLlmInput & UsageLogOptions,
  deps: { generateContent?: GeminiGenerate } = {},
): Promise<{ text: string; model: string }> {
  const prompt = READING_TOPIC_PROMPTS[input.topicId];
  if (!prompt) {
    throw new Error(`ไม่มี prompt สำหรับหัวข้อ: ${input.topicId}`);
  }

  const provider: ReadingLlmProvider = input.provider ?? "gemini";
  const model = resolveLlmModel(provider, input.model);
  const generateContent: GeminiGenerate =
    deps.generateContent ?? resolveLlmGenerator(provider, input.apiKey);

  const profile = input.profile ?? BASELINE_PROFILE;
  const systemInstruction = profile.buildSystemInstruction(prompt, input.topicId);
  const userPrompt = profile.buildUserPrompt(input, prompt);
  const engineText = input.humanKnowledge?.trim() ?? "";

  // รวมโทเคนทุก attempt (แต่ละครั้งมีค่าใช้จ่ายจริง) แล้ว log ครั้งเดียวตอน return
  const totalUsage: LlmCallUsage = { inTokens: 0, outTokens: 0 };
  const logUsage = () =>
    maybeLogReadingUsage(
      { ...input, usageLabel: input.usageLabel ?? input.topicId },
      provider,
      model,
      totalUsage,
    );

  // พยายามสูงสุด 2 ครั้ง: ถ้ารอบแรกตัด/เปลี่ยนข้อเท็จจริง ย้ำกฎแล้วลองใหม่
  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const strictNote =
      attempt === 0
        ? ""
        : "\n\nสำคัญ: คำตอบก่อนหน้าตัดข้อมูลบางส่วนทิ้งหรือเพิ่มข้อมูลนอก excerpt (เช่น ดาวดอกท้อ/เสน่ห์) — รอบนี้ต้องคงทุกธาตุ ทุกเซียงแซ ทุกรายการในลิสต์ ทุกช่วงอายุจาก excerpt ให้ครบทุกตัว ห้ามตัด และห้ามเพิ่มดวงดาว/แนวคิดที่ไม่มีใน excerpt";
    const response = await generateContent({
      model,
      contents: userPrompt + strictNote,
      config: { systemInstruction, temperature: attempt === 0 ? 0.55 : 0.3 },
    });
    if (response.usage) {
      totalUsage.inTokens += response.usage.inTokens;
      totalUsage.outTokens += response.usage.outTokens;
    }
    const text = response.text?.trim();
    if (!text) {
      throw new Error("LLM คืนค่าว่างสำหรับการเรียบเรียงคำทำนาย");
    }
    lastText = text;
    // ผ่านเมื่อ: คงข้อเท็จจริงครบ (threshold) + ไม่เพิ่มคำต้องห้าม (ดอกท้อ/เสน่ห์)
    //   + ไม่ทำ marker เด็ดขาดหาย (อักษรจีนก้าน/กิ่ง, "ยาม") — strict ทุกตัว
    const invented = engineText ? forbiddenInventions(engineText, text) : [];
    const dropped = engineText ? droppedCriticalMarkers(engineText, text) : [];
    if (
      (!engineText || verifyReadingFaithful(engineText, text)) &&
      invented.length === 0 &&
      dropped.length === 0
    ) {
      logUsage();
      return { text, model };
    }
  }

  // ยังไม่ผ่านหลัง retry (ตัดข้อมูล หรือหลอนเพิ่มคำนอก excerpt) → ถอยมาใช้ผล engine (การันตีไม่แย่กว่า engine)
  logUsage();
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
    "- ห้ามเอ่ยถึงแหล่งที่มาของข้อมูลหรือชื่อไฟล์/เอกสารใด ๆ เขียนเป็นคำทำนายตรง ๆ",
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
  const model = resolveLlmModel(provider, input.model);
  const generateContent: GeminiGenerate =
    deps.generateContent ?? resolveLlmGenerator(provider, input.apiKey);

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

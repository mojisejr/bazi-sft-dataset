import { GoogleGenAI } from "@google/genai";

import { type ChatRunnerSuccess, type NormalizedChatMessage } from "@/features/open-webui/chat-runner";
import {
  type BaziExtractionFieldKey,
  type OpenWebUiIntentClassification,
  type TriageRoute,
  type TriageTimeframe,
} from "@/features/open-webui/triage";
import { type RawInputValue } from "@/lib/bazi/schema-types";
import { getGeminiApiKey } from "@/lib/env";

export const DEFAULT_OPEN_WEBUI_GEMINI_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION = [
  "You are the Bazi assistant inside an Open WebUI-compatible chat route.",
  "Reply helpfully and directly to the user's latest message.",
].join(" ");

// Token discipline (Phase 3): a ซินแส verdict is a few sentences, not a report. Cap the answer,
// cap how much chat history we replay into the compose call, and truncate the grounded reading we
// inject so the model answers from it instead of re-summarizing the whole chapter (double-injection).
export const OPEN_WEBUI_MAX_OUTPUT_TOKENS = 512;
export const OPEN_WEBUI_MAX_COMPOSE_MESSAGES = 8;
// Headroom for multi-topic (compound) grounding — สี/ทิศ + องค์เทพ + จังหวะวัน อาจต่อกันหลายก้อน.
// single-topic readings ยังต่ำกว่านี้อยู่แล้ว จึงไม่กระทบต้นทุนเคสทั่วไป.
const MAX_GROUNDED_READING_CHARS = 3200;
// Anchored Expert (v2): drift is fenced by prompt STRUCTURE (engine = the only source of chart
// facts), not by starving the sampler. v1's 0.2 killed the ซินแส warmth and read "แข็งกระด้าง";
// temperature is the mood knob, so restore it to a natural conversational 0.6 while the fact-lock
// lives in the persona + grounding rules. Answer length unchanged.
export const OPEN_WEBUI_TEMPERATURE = 0.6;
export const OPEN_WEBUI_TOP_P = 0.95;

// Timeframes finer than the engine's real resolution (year / da-yun). Same-day & monthly questions
// must be answered as an honest disposition-plus-period trend, never as literal daily precision.
const SUB_YEAR_TIMEFRAMES = new Set(["today", "tomorrow", "this_month"]);

// สัญญาณภาวะเปราะบาง/อยากทำร้ายตัวเอง — ตรวจแบบ deterministic เพื่อ "ปิดโหมดทำนาย" (วันมงคล/ฤกษ์/ตัวเลข)
// แล้วบังคับให้ตอบเชิงห่วงใย + ให้สายด่วน ไม่ให้ข้อมูลปฏิทิน/ยามไปกลบการช่วยเหลือ.
const CRISIS_RE =
  /อยากตาย|ฆ่าตัวตาย|ทำร้ายตัวเอง|ไม่อยากมีชีวิต|ไม่อยากอยู่แล้ว|จบชีวิต|จบๆ ?มัน|จบมันไป|อยู่ไปก็เท่านั้น|หมดหวัง|สิ้นหวัง|ไม่ไหวแล้ว|เป็นภาระ/;
export function isCrisisMessage(message?: string | null): boolean {
  return typeof message === "string" && CRISIS_RE.test(message);
}

// คำถามดูดวงคู่/สมพงศ์ ที่ผู้ใช้ให้ "วันเกิดของอีกฝ่าย" มาด้วย — แชตมีแค่ดวงผู้ใช้ จึงห้ามอ่าน/กุดวง
// ของคนที่สอง. ตรวจ: มีคำเชิงเข้ากัน/สมพงศ์ + มีปีเกิด (พ.ศ./ค.ศ.) โผล่ในข้อความ.
const COMPAT_RE = /เข้ากัน|สมพงศ|สมพงษ|ดวงคู่|แมทช์|ดูดวงคู่|คู่กันไหม|ถูกโฉลก/;
const BIRTH_YEAR_RE = /\b(?:25\d{2}|20\d{2}|19\d{2})\b/;
export function isOtherChartRequest(message?: string | null): boolean {
  return typeof message === "string" && COMPAT_RE.test(message) && BIRTH_YEAR_RE.test(message);
}

// คำถามความรักที่ "เจาะจงถึงคนใดคนหนึ่ง" (เขาชอบเราไหม/จะกลับมาไหม/คิดยังไงกับเรา) — พื้นดวงตอบได้แค่
// ภาพรวมชีวิตรักของผู้ถาม ตอบ "คนคนนั้น" เจาะจงไม่ได้ ต้องปิดท้ายด้วยการเสี่ยงทายไพ่ (ซินแสนุ้ยสั่ง).
// เงื่อนไข: ต้องมีทั้ง "การอ้างถึงคน" + "คำถามเชิงความรู้สึก/แนวโน้มความสัมพันธ์" พร้อมกัน. ต้องไม่ใช่คำถาม
// ดวงคู่ที่ให้วันเกิดอีกฝ่าย (นั่นเป็นเส้นทาง compatibility คนละแบบ).
const SPECIFIC_PERSON_RE =
  /คนนี้|คน ?ๆ ?นี้|ผู้ชายคนนี้|ผู้หญิงคนนี้|คนที่(ชอบ|คุย|แอบ|ปลื้ม|คบ|จีบ|เดต|รู้จัก|หมายตา)|คนคุย|แฟน(เก่า|ใหม่)?|กิ๊ก|สามี|ภรรยา|เขา|เค้า/;
const PERSON_FEELING_RE =
  /ชอบ(เรา|ฉัน|ผม|หนู|เค้า|ไหม|มั้ย|รึ|หรือ|ป่าว|ปะ)|รัก(เรา|ฉัน|ผม|หนู|ไหม|มั้ย|จริง|ป่าว)|คิด(ยังไง|ไง|อะไร|ถึงเรา|ดี)|สนใจ(เรา|ไหม|มั้ย)?|จริงใจ|หลอก|นอกใจ|มีคนอื่น|มือที่สาม|จะกลับมา|จะคืนดี|จะคบ|จะเลิก|จะแต่ง|จะไปต่อ|ได้ไปต่อ|เลิกกัน|ห่างเหิน|หายไป|จะเท|หึง|คิดถึงเรา/;
export function wantsSpecificPersonLove(message?: string | null): boolean {
  if (typeof message !== "string") return false;
  if (isOtherChartRequest(message)) return false; // ดวงคู่+วันเกิดอีกฝ่าย = compatibility ไม่ใช่เคสนี้
  return SPECIFIC_PERSON_RE.test(message) && PERSON_FEELING_RE.test(message);
}

// Single source of truth for the same-day honest-precision reframe. The compose prompt uses it to
// inject the reframe instruction; the Glass Box trace uses it to report whether the filter fired.
export function isHonestPrecisionReframe(
  requiresBaziConsult: boolean | undefined,
  timeframe: TriageTimeframe | string | null | undefined,
): boolean {
  return Boolean(requiresBaziConsult)
    && typeof timeframe === "string"
    && SUB_YEAR_TIMEFRAMES.has(timeframe);
}

function truncateGroundedReading(reading: string): string {
  if (reading.length <= MAX_GROUNDED_READING_CHARS) {
    return reading;
  }
  return `${reading.slice(0, MAX_GROUNDED_READING_CHARS).trimEnd()}\n…(ตัดเพื่อความกระชับ — ตอบจากแก่นที่เกี่ยวกับคำถามพอ)`;
}

// Keep only the last N conversational turns for the compose call instead of replaying the whole
// transcript (unbounded history was a real token sink on long chats).
function selectRecentConversation(messages: readonly NormalizedChatMessage[]): NormalizedChatMessage[] {
  const conversational = messages.filter((message) => message.role !== "system");
  return conversational.slice(-OPEN_WEBUI_MAX_COMPOSE_MESSAGES);
}

// เพอร์โซนา 2 แบบ — ลูกค้าเลือกคุยกับใคร (FE ส่ง persona มา, engine ปรับชื่อ+น้ำเสียง)
export type ChatPersona = "mu" | "mi";
export const CHAT_PERSONAS: Record<ChatPersona, { name: string; tone: string }> = {
  // เสี่ยวมู่ — ซินแสหนุ่ม (คำลงท้ายผู้ชาย)
  mu: { name: "เสี่ยวมู่", tone: "ใช้คำลงท้ายผู้ชาย (ครับ/นะครับ) วางตัวเป็นซินแสหนุ่มที่เป็นกันเอง อบอุ่นแต่มั่นใจ ฟันธงได้" },
  // เสี่ยวมี่ — ซินแสสาว (คำลงท้ายผู้หญิง)
  mi: { name: "เสี่ยวมี่", tone: "ใช้คำลงท้ายผู้หญิง (ค่ะ/นะคะ) วางตัวเป็นซินแสสาวที่เป็นกันเอง อบอุ่นแต่มั่นใจ ฟันธงได้" },
};

export function buildMumatePersonaInstruction(persona: ChatPersona = "mu"): string {
  const p = CHAT_PERSONAS[persona] ?? CHAT_PERSONAS.mu;
  return [
    `คุณคือ "${p.name}" — ซินแสปาจื่อที่อบอุ่น คม และเข้าใจคน คุยกับลูกดวงอย่างเป็นธรรมชาติเหมือนคนนั่งตรงหน้า ไม่ใช่หุ่นยนต์ส่งรายงาน`,
    "",
    "## ⛑️ ภาวะเปราะบาง — สำคัญสูงสุด (มาก่อนทุกกฎ)",
    "- ถ้าผู้ใช้ส่งสัญญาณสิ้นหวัง อยากทำร้ายตัวเอง ไม่อยากมีชีวิตอยู่ หรือพูดทำนอง \"จบๆ มันไป\" → **หยุดโหมดทำนายทันที** ห้ามตอบด้วยวันมงคล/ฤกษ์/ยาม/ตัวเลข หรือฟันธงว่าดวงจะดี-ร้าย",
    "- ตอบด้วยความห่วงใยแบบมนุษย์จริงๆ รับฟัง ไม่ตัดสิน ย้ำว่าเขาไม่ได้อยู่คนเดียวและเรื่องนี้ผ่านไปได้ ชวนให้คุยกับคนที่ไว้ใจหรือผู้เชี่ยวชาญ",
    "- ให้ช่องทางช่วยเหลือเสมอ: สายด่วนสุขภาพจิต 1323 (โทรฟรี 24 ชม.) หรือ สะมาริตันส์ 02-113-6789. ถ้าอยู่ในอันตรายเฉพาะหน้าให้โทร 1669",
    "- เป้าหมายคือความปลอดภัยและการหาคนช่วยตอนนี้ ไม่ใช่คำทำนาย",
    "",
    "## แหล่งความจริงของดวง (กฎเดียวที่ห้ามฝ่าฝืน)",
    "- \"ผลวินิจฉัยจาก engine\" ที่แนบมา คือแหล่งความจริงเดียวสำหรับ \"ข้อมูลเฉพาะดวงคนนี้\" — ธาตุ เสา สัญลักษณ์ ปี อายุ การปะทะ ทิศ สี อาชีพ คำทำนาย",
    "- ห้ามกุข้อมูลเฉพาะดวงใหม่ที่ขัดกับผลอ่าน (ธาตุ/เสา/สัญลักษณ์/ทิศ/สี/อาชีพที่ระบุไว้ ห้ามเปลี่ยน)",
    "- ข้อยกเว้น: หัวข้อที่วิชาปาจื่ออ่านได้ตามตำรา (คู่ครอง/แต่งงาน/บุตร/จังหวะเวลา) ถ้าผลอ่านที่แนบไม่ได้ลงรายละเอียด → ใช้หลักวิชามาตรฐานกับดวงที่คำนวณไว้ (วิมานคู่ 日支, วิมานบุตร 時柱, ดาวบุตร) ตอบเป็น \"แนวโน้ม\" ได้ อย่าปัดว่าข้อมูลไม่พอ ตราบใดที่ไม่ขัด fact ในผลอ่าน",
    "- แต่ \"วิธีพูด\" เป็นของคุณเต็มที่ — ความเข้าใจคน ภาษาอบอุ่น อุปมา การอธิบายให้เข้าใจง่าย ใช้ได้เต็มที่ ตราบใดที่มันรับใช้การสื่อผลอ่าน ไม่ใช่แทนที่ด้วย fact ใหม่",
    "",
    "## ตอบให้ได้ ฟันธงให้ชัด (ห้ามปัดเลี่ยง)",
    "- คำถามปลายเปิดเรื่องชีวิต — \"ช่วงนี้ควรทำอะไร\", \"วางแผนยังไงดี\", \"ตัดสินใจยังไง\", \"เอายังไงดี\", \"ควรไปต่อหรือพอ\" — คือหน้าที่หลักของซินแส ต้องตอบเสมอ ห้ามบอกว่าช่วยไม่ได้",
    "- ให้ \"ทางที่แนะนำ\" ชัดๆ ฟันธงจากดวง ไม่ใช่บรรยายดวงลอยๆ แล้วโยนให้ลูกดวงไปคิดเอง — ชี้ทางเลือกที่ดวงหนุน + สิ่งที่ควรเลี่ยง",
    "- ไม่ต้องจำกัดตัวเองอยู่แค่ศัพท์ปาจื่อ ให้คำแนะนำการใช้ชีวิตจริงที่ \"ตั้งอยู่บน\" ผลอ่านได้เต็มที่ ตราบใดที่ไม่กุ fact เฉพาะดวงใหม่",
    "",
    "## อ่านจังหวะเวลาให้ลึก (วัยจร → ปีจร → เดือนจร)",
    "- อย่าหยุดแค่ภาพรวมช่วงวัย ให้ไล่ลงมาให้เห็นจังหวะจริง: ช่วงวัย (วัยจร/大运) → ปีนี้-ปีหน้าเจาะจง (ปีจร/流年 จากผลอ่าน) → แนวโน้มระดับเดือน (เดือนจร) เป็น \"ทิศทาง\" ของช่วงนี้",
    "- ระดับเดือน/วัน ให้พูดเป็น \"แนวโน้ม\" ที่ต่อยอดจากปีจร + จังหวะฤดู ไม่รับปากความแม่นรายวัน และห้ามกุดวงรายวันขึ้นเอง",
    "",
    "## เครื่องมืออื่นของมู่เมท (ชวนเฉพาะตอนปาจื่อตอบไม่ได้จริง ๆ)",
    "- ⚠️ กฎเหล็ก: ถ้าปาจื่อตอบคำถามได้ (ดวงชะตา/ความรัก/การงาน/การเงิน/สุขภาพ/จังหวะเวลา/การตัดสินใจ/ปีจร-เดือนจร) → ตอบจากดวงให้จบ **ห้ามพ่วงชวนไปเปิดไพ่/เสี่ยงเซียมซี/เบอร์มงคลเด็ดขาด**. วิชาเราตอบได้อยู่แล้ว อย่าดึงวิชาอื่นมาปน",
    "- ชวนเครื่องมืออื่นเฉพาะเมื่อคำถาม \"อยู่นอกสิ่งที่ปาจื่อตอบได้\" จริง ๆ เท่านั้น:",
    "  • ผู้ใช้ขอเปิดไพ่/เสี่ยงทาย/ถาม-ตอบเฉพาะหน้าโดยตรง → ชวนไปเมนู \"เปิดไพ่\" หรือ \"เสี่ยงเซียมซี\"",
    "  • ขอดูเลขมงคล/เบอร์โทร → ชวนไปเมนู \"เบอร์มงคล\"",
    "  • เลขหวย/ผลพนัน/ผลแข่งขัน → บอกตรง ๆ ว่าปาจื่อไม่ได้ชี้เลขแบบนั้น (โยงจังหวะโชคลาภจากดวงได้) แล้วค่อยชวนเปิดไพ่/เซียมซีถ้าอยากเสี่ยงทาย",
    "  • ดูดวงคู่/สมพงศ์ที่ต้องใช้ \"วันเกิดของอีกฝ่าย\" (เข้ากันไหม/แมทช์ดวง) → แชตมีเฉพาะดวงของผู้ใช้ **อ่านดวงของอีกฝ่ายเองไม่ได้ ห้ามกุเสา/ดิถี/ดวงของคนที่สองขึ้นมาเด็ดขาด**. ให้บอกจากดวงผู้ใช้ว่าเข้ากับคู่แบบไหน/ควรระวังอะไร แล้วชวนไปเมนู \"ดูดวงคู่รัก\" เพื่อแมทช์ 2 ดวงจริง",
    "",
    "## เรื่องที่วิชาปาจื่ออ่านได้ — ต้องตอบ (ห้ามปัดว่าข้อมูลไม่พอ)",
    "- แต่งงาน/มีคู่ = ฟันธงช่วงวัย-ปีที่ดวงหนุนให้มีคู่/ลงหลักปักฐาน (วัยจร + วิมานคู่ 日支) และลักษณะเนื้อคู่ ตอบเป็นแนวโน้ม/เปอร์เซ็นต์โอกาสได้",
    "- บุตร = อ่านจากวิมานบุตร (時柱) + ดาวบุตร (食伤/官杀 ตามเพศ) ตอบแนวโน้ม \"จำนวน/เพศ/ช่วงมีบุตร\" ได้ เช่น \"มีเกณฑ์บุตรราว 1-2 คน คนแรกโน้มไปทาง...\" — กรอบว่าเป็นแนวโน้มตามหลักวิชา ไม่ใช่ตัวเลขตายตัว 100%",
    "- มีหลายคนให้เลือก (จีบหลายคน/เลือกใครดี) = อ่านจากดวงผู้ใช้ว่าเข้ากับคู่แบบไหน (ธาตุ/นิสัยที่หนุนดวง) + เกณฑ์เลือก + ธงแดงที่ควรเลี่ยง เพื่อช่วยตัดสินใจ; อย่าอ้างว่ารู้ใจคนแต่ละคน; ถ้าอยากเจาะรายคนค่อยชวนเปิดไพ่",
    "",
    "## ขอบเขต + ความรับผิดชอบ (อ่านดวงอย่างมีจริยธรรม)",
    "- เรื่องคนอื่น (แฟน/เจ้านาย/คู่กรณี) = ตอบได้จากมุมดวงของผู้ใช้ — จังหวะความสัมพันธ์ สิ่งที่ผู้ใช้ควรทำ/ระวัง — แต่ห้ามฟันธงพฤติกรรม/ความคิด/ความซื่อสัตย์ของอีกฝ่ายราวกับอ่านใจเขาจริง (ดวงที่มีคือของผู้ใช้เท่านั้น)",
    "- คดีความ/ขึ้นศาล/เจรจา = ตอบได้เต็มที่ในแบบซินแส: จังหวะวันนั้นดวงหนุนหรือไม่, สีเสริมดวง, ทิศมงคล, องค์ที่ควรไหว้/สิ่งยึดเหนี่ยว, ข้อควรระวัง/วางตัว. กรอบผลเป็น \"ดวงหนุน/ต้องระวัง\" ไม่ใช่รับประกันคำพิพากษา และไม่ใช่คำแนะนำทางกฎหมาย (เรื่องรูปคดีให้ปรึกษาทนาย)",
    "- เรื่องความตาย/อายุขัย = ไม่ทำนาย บอกตรงๆ ว่าปาจื่อไม่ได้ชี้วันตาย แล้วชวนโฟกัสการใช้ชีวิตปัจจุบัน",
    "- เรื่องสุขภาพ/โรค = ไม่วินิจฉัยโรคและไม่สั่งยา ชวนไปพบแพทย์; พูดได้แค่แนวโน้มการดูแลตัวเองตามธาตุ",
    "- เรื่องการเงิน/ลงทุน = ชี้ \"จังหวะ\" ได้ แต่ห้ามระบุหุ้น/เหรียญ/เลข หรือรับประกันผลตอบแทน. ย้ำว่าเป็นจังหวะเสริม ตัดสินใจสุดท้ายด้วยวิจารณญาณของตัวเอง",
    "- เรื่องใหญ่ที่ย้อนคืนยาก (ลาออก/แต่งงาน/ทุ่มเงินก้อน) = ฟันธงจังหวะที่ดวงหนุนได้ แต่กรอบว่าเป็น \"ตัวช่วยเสริมโอกาส\" ไม่ใช่คำรับประกันตายตัว",
    "",
    "## รูปแบบคำตอบ: สนทนาแบบคน ไม่ใช่โครงสร้างรายงาน",
    "- ห้ามใช้หัวข้อรายงาน (เช่น \"สรุป:\", \"วิเคราะห์:\", \"จากข้อมูลที่ให้มา\")",
    "- เขียนเป็นย่อหน้าพูดคุยธรรมชาติ ไม่บังคับใช้ bullet points",
    "- ห้ามลงท้ายแบบหุ่นยนต์ (เช่น \"หวังว่าจะเป็นประโยชน์\")",
    "- ความยาวคำตอบแปรผัน: ถามสั้นตอบสั้น ถามลึกค่อยขยายความ",
    "",
    "## ภาษาซินแซ: อธิบายง่าย อย่าถมคำจีน",
    "- พูดเป็นภาษาไทยที่คนทั่วไปเข้าใจเป็นหลัก. อักษรจีน/ศัพท์เทคนิค (เช่น 官杀, 子午冲) และชื่อยามแบบทับศัพท์ (เช่น ยามเหง็กอ๋วง/แชเล้ง) ให้ใช้ \"เท่าที่จำเป็นจริงๆ\" และแปลกำกับเสมอ — อย่าใส่รัว ๆ จนอ่านแล้วงง",
    "- เวลาบอกฤกษ์/ช่วงเวลา ให้บอกเป็นช่วง (เช้า/สาย/บ่าย/เย็น/ค่ำ/ดึก) + เวลาเป็นโมงก็พอ ไม่ต้องพ่วงชื่อยามภาษาจีน",
    "- ห้ามหยิบศัพท์/สัญลักษณ์ที่ไม่มีในผลอ่านมาเอง",
    "- ฟันธงตรงประเด็น ไม่อ้อมค้อม ไม่มีน้ำเยิ่ม",
    "",
    "## อุปมาอุปไมย: ใช้เฉพาะจุดสำคัญ 1-2 จุด",
    "- ใช้อุปมาเมื่อช่วยให้เข้าใจง่าย ไม่สาดทุกย่อหน้า",
    "- หลีกเลี่ยงการใช้อุปมาซ้ำซากหรือไม่จำเป็น",
    "",
    "## น้ำเสียง",
    `${p.tone} — และแนะนำตัว/เรียกแทนตัวเองว่า "${p.name}" เสมอ`,
  ].join("\n");
}

export const MUMATE_PERSONA_INSTRUCTION = buildMumatePersonaInstruction("mu");

type GeminiGenerateContentRequest = {
  model: string;
  contents: string;
  config: {
    systemInstruction: string;
    temperature: number;
    topP?: number;
    maxOutputTokens: number;
  };
};

type GeminiGenerateContentResponse = {
  text?: string | null;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
};

export type GeminiGenerateContent = (
  request: GeminiGenerateContentRequest,
) => Promise<GeminiGenerateContentResponse>;

export type OpenWebUiGeminiPromptPayload = {
  systemInstruction: string;
  userPrompt: string;
};

export type OpenWebUiGeminiExecutionContext = {
  intentClassification?: OpenWebUiIntentClassification;
  /** Precise reading topic the triage routed to (or off_topic/chit_chat). Phase 3 consumes this. */
  topicId?: TriageRoute;
  /** Asked timeframe (today..in_n_years..period..none). Phase 3 consumes this. */
  timeframe?: TriageTimeframe;
  baziConsult?: {
    rawInput: RawInputValue | null;
    truthPacket: string | null;
  } | null;
  /**
   * สรุปผังดวงจริงแบบสั้น (เสาสี่/ดิถี/วิมานคู่-บุตร) จาก calculatedState — ให้ LLM อ้างหลักวิชาตอบ
   * คู่ครอง/บุตร/จังหวะได้แม่นขึ้นโดยไม่กุเสาขึ้นเอง. แนบเฉพาะเมื่อมีการปรึกษาดวงจริง.
   */
  chartFacts?: string | null;
  baziMissingFields?: BaziExtractionFieldKey[];
  /**
   * ความรู้เสริมจากซินแส (fix ไม่ผูกดวง เช่น ฮวงจุ้ยกระเป๋าตังค์จาก NewData) — แนบเมื่อ
   * คำถามเข้าเงื่อนไข keyword; มีค่าแล้วให้ตอบจากก้อนนี้ได้เลย (ไม่ถูกปัดเป็น off-topic)
   */
  staticKnowledge?: string | null;
  /**
   * true = แนบข้อมูล "วันดีเดือนนี้" จริง (man-vs-day/流日 เฉพาะบุคคล) มาแล้ว → อย่าเปิด honest-precision
   * reframe ที่ห้ามพูดวันรายวัน ไม่งั้นจะกดคำตอบวันจริงทิ้ง (คำถาม "เดือนนี้วันไหนดีสุด")
   */
  hasDailyGoodDayData?: boolean;
  /**
   * true = แนบผลวิเคราะห์ "ดวงคู่/สมพงศ์" จริง (คำนวณ 2 ดวงผ่าน pair engine) มาแล้ว → ปิด guard ที่ห้าม
   * อ่านดวงคนที่สอง และให้ตอบสมพงศ์จากก้อนที่แนบได้เลย.
   */
  hasCompatibilityData?: boolean;
  /**
   * true = คำถามความรักเจาะจง "คนนี้" และได้จั่วไพ่เสี่ยงทายแนบไว้ในผลอ่านแล้ว (ต่อท้าย truthPacket) →
   * สั่งให้ปิดท้ายคำตอบด้วยไพ่ที่จั่วให้ ไม่ต้องชวนไปเมนูเปิดไพ่ (จั่วให้แล้ว). ซินแสนุ้ยสั่ง.
   */
  hasDrawnCardData?: boolean;
};

export type OpenWebUiGeminiConfig = {
  apiKey: string;
  model: string;
};

export type OpenWebUiGeminiReply = {
  model: string;
  text: string;
  /** โทเคนของการเรียกตอบหลัก — ไว้ log ต้นทุน (thinking รวมใน outTokens แล้ว) */
  usage?: { inTokens: number; outTokens: number };
};

export class OpenWebUiGeminiError extends Error {
  constructor(
    readonly code: "gemini_config_error" | "gemini_upstream_error" | "gemini_empty_response",
    message: string,
  ) {
    super(message);
    this.name = "OpenWebUiGeminiError";
  }
}

function formatConversationLine(message: NormalizedChatMessage) {
  const label = message.role === "assistant"
    ? "Assistant"
    : message.role === "system"
      ? "System"
      : "User";

  return `${label}: ${message.content}`;
}

export function getOpenWebUiGeminiConfig(
  raw: Partial<NodeJS.ProcessEnv> = process.env,
): OpenWebUiGeminiConfig {
  let apiKey: string;

  try {
    apiKey = getGeminiApiKey(raw);
  } catch (error) {
    throw new OpenWebUiGeminiError(
      "gemini_config_error",
      error instanceof Error ? error.message : "GEMINI_API_KEY is required for Open WebUI Gemini access.",
    );
  }

  const model = raw.OPEN_WEBUI_GEMINI_MODEL?.trim() || DEFAULT_OPEN_WEBUI_GEMINI_MODEL;

  if (!model) {
    throw new OpenWebUiGeminiError(
      "gemini_config_error",
      "OPEN_WEBUI_GEMINI_MODEL must be a non-empty string when provided.",
    );
  }

  return { apiKey, model };
}

function formatConsultBirthContext(rawInput: RawInputValue) {
  return [
    `- Birth date: ${rawInput.birthDate}`,
    `- Birth time: ${rawInput.birthTime}`,
    `- Gender: ${rawInput.gender}`,
    `- Province: ${rawInput.province}`,
    `- Calendar system: ${rawInput.calendarSystem ?? "solar"}`,
    `- Timezone: ${rawInput.timezone ?? "Asia/Bangkok"}`,
  ].join("\n");
}

function formatSystemClockLine(now: Date) {
  const formatted = now.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
  });
  const isoDate = now.toISOString().slice(0, 10);

  return `[เวลาปัจจุบันของระบบ]: ${formatted} (ISO: ${isoDate})`;
}

export function buildOpenWebUiGeminiPromptPayload(
  input: Pick<ChatRunnerSuccess, "normalizedMessages" | "triageMessages" | "latestUserMessage"> & {
    executionContext?: OpenWebUiGeminiExecutionContext;
    persona?: ChatPersona;
    now?: Date;
  },
): OpenWebUiGeminiPromptPayload {
  const now = input.now ?? new Date();
  const systemMessages = input.normalizedMessages
    .filter((message) => message.role === "system")
    .map((message) => message.content);
  const conversationTranscript = selectRecentConversation(input.normalizedMessages)
    .map(formatConversationLine)
    .join("\n\n");
  const intentClassification = input.executionContext?.intentClassification;
  const topicId = input.executionContext?.topicId;
  const timeframe = input.executionContext?.timeframe;
  const baziConsult = input.executionContext?.baziConsult;
  const chartFacts = input.executionContext?.chartFacts ?? null;
  const baziMissingFields = input.executionContext?.baziMissingFields ?? [];
  const staticKnowledge = input.executionContext?.staticKnowledge ?? null;
  const rawHasDailyGoodDayData = input.executionContext?.hasDailyGoodDayData ?? false;
  // ภาวะเปราะบาง: ปิดโหมดทำนายวัน/ยาม ไม่ให้ข้อมูลปฏิทินไปกลบการช่วยเหลือ
  const crisis = isCrisisMessage(input.latestUserMessage?.content);
  const hasCompatibilityData = input.executionContext?.hasCompatibilityData ?? false;
  const hasDrawnCardData = input.executionContext?.hasDrawnCardData ?? false;
  // เจอคำถามดวงคู่ + วันเกิดอีกฝ่าย แต่ "ยังไม่มี" ผลวิเคราะห์คู่จริงแนบมา → กัน LLM มั่วดวงคนที่สอง
  const otherChart = isOtherChartRequest(input.latestUserMessage?.content) && !hasCompatibilityData;
  const hasDailyGoodDayData = rawHasDailyGoodDayData && !crisis;
  // มีความรู้เสริมจากซินแสแนบมา = คำถามนี้อยู่ในขอบเขตที่ซินแสให้ตอบ ห้ามปัดเป็น off-topic
  const isOffTopic = topicId === "off_topic" && !staticKnowledge;
  const consultMode = intentClassification?.requiresBaziConsult
    ? baziConsult?.truthPacket
      ? "bazi_consult"
      : "bazi_consult_pending_context"
    : intentClassification
      ? isOffTopic
        ? "off_topic_refusal"
        : "non_bazi_bypass"
      : null;
  // Same-day / monthly questions: the engine has no 流日/流月; answer as an honest trend.
  // ยกเว้น: แนบข้อมูลวันดีจริง (man-vs-day) มาแล้ว → ปิด reframe ไม่งั้นมันห้ามพูดวันรายวันแล้วกดคำตอบทิ้ง.
  const honestPrecisionReframe =
    !hasDailyGoodDayData &&
    !crisis &&
    isHonestPrecisionReframe(intentClassification?.requiresBaziConsult, timeframe);

  return {
    systemInstruction: [
      buildMumatePersonaInstruction(input.persona ?? "mu"),
      systemMessages.join("\n\n") || DEFAULT_OPEN_WEBUI_SYSTEM_INSTRUCTION,
      baziMissingFields.length > 0
        ? `ผู้ใช้ยังไม่ได้บอก: ${baziMissingFields.join(", ")}. ขอข้อมูลนั้นเพิ่มอย่างสุภาพ และห้ามเดาคำพยากรณ์.`
        : baziConsult?.rawInput
          ? "หมายเหตุ: ระบบมีวันเดือนปี-เวลาเกิดของผู้ใช้อยู่แล้ว (ผูกกับบัญชี) — ห้ามขอวันเกิดซ้ำ ถ้าจะดูดวงให้ดูได้เลย."
          : null,
    ].filter((section): section is string => section !== null).join("\n\n"),
    userPrompt: [
      hasCompatibilityData
        ? "มีผลวิเคราะห์ดวงคู่/สมพงศ์ (คำนวณ 2 ดวงจริงผ่าน engine) แนบมาในผลอ่านแล้ว — ให้ฟันธงความเข้ากันจากก้อนนั้นได้เลย (เข้ากันแค่ไหน จุดหนุน-จุดปะทะ วิธีปรับเข้าหากัน). ห้ามแต่งเสา/ดวงเพิ่มเอง."
        : null,
      hasDrawnCardData
        ? "คำถามนี้ถามเจาะจงถึง 'คนใดคนหนึ่ง' (เช่น เขาชอบเราไหม/จะกลับมาไหม) — พื้นดวงบอกได้แค่ 'ภาพรวมชีวิตรักของผู้ถาม' ตอบเรื่องคนคนนั้นเจาะจงไม่ได้. ระบบจั่ว 'ไพ่เสี่ยงทาย' มาแนบไว้ท้ายผลอ่านแล้ว. ให้ตอบเป็น 2 ส่วนต่อเนื่อง: (1) เล่าภาพรวมความรักจากดวงสั้น ๆ ก่อน แล้ว (2) 'ปิดท้าย' ด้วยการเปิดไพ่เสี่ยงทายที่จั่วให้ — บอกชื่อไพ่ที่ได้ แล้วฟันธงแนวโน้มของคนคนนี้ให้ชัด. **ห้ามชวนผู้ใช้ไปเมนู 'เปิดไพ่'/'เสี่ยงเซียมซี' เพราะจั่วไพ่ให้แล้วในผลอ่าน** — ใช้ไพ่ก้อนนั้นตอบเลย."
        : null,
      otherChart
        ? "⚠️ ผู้ใช้ให้วันเกิดของอีกฝ่ายมาเพื่อดูดวงคู่/สมพงศ์. แชตนี้มีเฉพาะดวงของผู้ใช้ — **ห้ามอ่าน วิเคราะห์ บรรยาย หรือกุดวง/เสา/ดิถี/นิสัย/ชะตาของอีกฝ่ายเด็ดขาด** (จะเป็นการเดามั่ว). ให้ตอบจากดวงของผู้ใช้ว่าตัวเขาเข้ากับคู่แบบไหน/ควรวางตัวอย่างไร แล้วชวนไปเมนู \"ดูดวงคู่รัก\" เพื่อแมทช์ 2 ดวงจริง (ที่นั่นคำนวณดวงอีกฝ่ายได้จริง)."
        : null,
      crisis
        ? "⛑️ สัญญาณภาวะเปราะบาง/อยากทำร้ายตัวเอง: ห้ามตอบด้วยวันมงคล/ฤกษ์/ยาม/ตัวเลข หรือทำนายดวงดี-ร้าย. ให้ตอบแบบห่วงใย รับฟัง ไม่ตัดสิน + ให้สายด่วนสุขภาพจิต 1323 (24 ชม.) หรือสะมาริตันส์ 02-113-6789 (ฉุกเฉิน 1669) และชวนให้คุยกับคนที่ไว้ใจ/ผู้เชี่ยวชาญ."
        : null,
      formatSystemClockLine(now),
      "Continue the conversation from this transcript.",
      conversationTranscript,
      intentClassification
        ? `Routing: topic=${topicId ?? intentClassification.intent}; timeframe=${timeframe ?? "none"}; requiresBaziConsult=${String(intentClassification.requiresBaziConsult)}; confidence=${intentClassification.confidence.toFixed(2)}.`
        : null,
      consultMode ? `Consult mode: ${consultMode}.` : null,
      intentClassification?.requiresBaziConsult && baziConsult?.truthPacket && baziConsult.rawInput
        ? [
          "ข้อมูลวันเกิดที่ยืนยันแล้ว:",
          formatConsultBirthContext(baziConsult.rawInput),
          chartFacts ?? null,
          "ผลวินิจฉัยจาก engine (นี่คือแหล่งความจริงเดียวเรื่องดวงของคุณ — เรียบเรียงเป็นภาษาคนแบบฟันธงได้ แต่ห้ามเพิ่ม/เปลี่ยน/ตัด fact):",
          truncateGroundedReading(baziConsult.truthPacket),
          [
            "วิธีตอบแบบซินแส:",
            "- ข้อเท็จจริงเฉพาะดวง (ธาตุ/ปี/อายุ/สัญลักษณ์/อักษรจีน/ทิศ/สี/อาชีพ/คำทำนาย) ต้องมาจากผลวินิจฉัยด้านบน ห้ามแต่งใหม่. ส่วนวิธีอธิบาย ความอบอุ่น อุปมา พูดได้เต็มที่.",
            "- ฟันธงตอบคำถามตรงๆ เป็นข้อสรุปจากดวง ไม่ใช่ \"สรุปผลอ่าน\" และไม่เล่าผลอ่านทั้งบท",
            "- สั้น กระชับ ไม่กี่ประโยค ตรงประเด็นที่ถาม — ห้ามใส่หัวข้อรายงาน ห้ามดั้มผลอ่านลงมาหมด",
            "- อิงหลักสำนักตรงไปตรงมา ไม่อ้อมค้อม ไม่ปลอบใจลอยๆ ไม่ใช่คำตอบเชิงจิตวิทยา",
            "- ห้ามเพิ่มคำทำนายที่ไม่มีในผลอ่าน และห้ามเปลี่ยน/ตัดสัญลักษณ์ ธาตุ ยาม หรืออักษรจีน",
            "- ถ้าผลอ่านไม่ครอบคลุมสิ่งที่ถาม ให้บอกตรงๆ ว่าข้อมูลไม่พอ ห้ามแต่งเพิ่ม",
          ].join("\n"),
        ].join("\n")
        : null,
      staticKnowledge
        ? [
          "ความรู้เสริมจากซินแส (ใช้ตอบคำถามนี้ได้โดยตรง — สรุป/เรียบเรียงเป็นภาษาพูดได้ แต่ห้ามแต่ง fact ใหม่นอกก้อนนี้):",
          staticKnowledge,
          "ถ้าคำถามพาดพิงสีกระเป๋า/ธาตุเฉพาะดวง และไม่มีผลวินิจฉัย engine แนบมา ให้แนะนำภาพรวมจากก้อนความรู้นี้ แล้วชวนให้ดูดวงเพื่อเลือกสีที่ถูกโฉลกเฉพาะตัว",
        ].join("\n")
        : null,
      hasDailyGoodDayData
        ? "มีปฏิทินดวงเฉพาะบุคคล (วันจริง 流日 + ยามมงคล 時辰) แนบมาในผลอ่านแล้ว. ให้ฟันธงเจาะจงถึง \"วันที่จริง\" และ \"ช่วงเวลาในวัน\" (เช้า/สาย/บ่าย/เย็น/ค่ำ/ดึก พร้อมเวลาเป็นโมง) ตามข้อมูลนั้นตรงๆ. ห้ามตอบกว้างเป็นแค่ 'ช่วงอายุ/วัยจร' หรือเลี่ยงว่าเจาะจงวันไม่ได้ ทั้งที่มีข้อมูลวันจริงอยู่."
        : null,
      honestPrecisionReframe
        ? "ความแม่นเรื่องเวลา: ผู้ใช้ถามเจาะจงระดับวัน/เดือน. ให้อ่านจังหวะแบบไล่ชั้น วัยจร → ปีจร (จากผลอ่าน) → แล้วต่อยอดเป็น \"แนวโน้มระดับเดือน (เดือนจร)\" ของช่วงนี้อย่างซื่อสัตย์ว่าโน้มไปทางไหน. ระดับเดือน/วันตอบเป็นแนวโน้ม+คำแนะนำได้ แต่ห้ามรับปากความแม่นรายวันเป๊ะ และห้ามแต่งดวงรายวันขึ้นมาเอง."
        : null,
      intentClassification?.requiresBaziConsult && !baziConsult?.truthPacket
        ? "No verified Bazi chart context is attached. Do not invent chart details; ask for the missing birth data or chart payload first."
        : null,
      isOffTopic
        ? [
          "คำถามนี้ไม่เข้าหัวข้อดูดวงปาจื่อโดยตรง. ห้ามปฏิเสธแบบตัดจบว่า \"ช่วยไม่ได้\" — ให้จัดการตามชนิดคำถาม:",
          "- ถ้าเป็นเรื่องเสี่ยงทาย/เปิดไพ่/ถาม-ตอบเฉพาะหน้า → ชวนไปเมนู \"เปิดไพ่\" หรือ \"เสี่ยงเซียมซี\" อย่างเป็นกันเอง (โยงจังหวะดวงของเขาสั้นๆ ก่อนได้ถ้าพอมี).",
          "- ถ้าเป็นเลขมงคล/เบอร์โทร/ดูเบอร์ → ชวนไปเมนู \"เบอร์มงคล\".",
          "- ถ้าเป็นเลขหวย/ผลพนัน/ผลแข่งขัน → บอกตรงๆ ว่าดวงปาจื่อไม่ได้ชี้เลข/ผลแบบนั้น แล้วชวนไป \"เปิดไพ่/เสี่ยงเซียมซี\" ถ้าอยากเสี่ยงทาย (ห้ามมั่วเลข/ผลให้).",
          "- ถ้าไม่เกี่ยวกับดวงเลยจริงๆ (โค้ด/ข่าว/คณิต/แปลภาษา) → บอกสั้นๆ อย่างอบอุ่นว่าไม่ถนัดเรื่องนี้ แล้วชวนกลับมาคุยเรื่องจังหวะชีวิต/การตัดสินใจที่ซินแสช่วยได้.",
          "คงคาแรกเตอร์ซินแสไว้เสมอ ห้ามตอบห้วนหรือเหมือนหุ่นยนต์ปฏิเสธ.",
        ].join("\n")
        : intentClassification && !intentClassification.requiresBaziConsult
          ? "This request does not require Bazi chart analysis. Reply normally without claiming chart-specific insights."
          : null,
      `Latest user message: ${input.latestUserMessage.content}`,
      "Respond as the assistant.",
    ].filter((section): section is string => section !== null).join("\n\n"),
  };
}

function createGeminiGenerateContent(config: OpenWebUiGeminiConfig): GeminiGenerateContent {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return async (request) => ai.models.generateContent(request);
}

export async function generateGeminiAssistantReply(
  input: Pick<ChatRunnerSuccess, "normalizedMessages" | "triageMessages" | "latestUserMessage"> & { persona?: ChatPersona },
  options: {
    env?: Partial<NodeJS.ProcessEnv>;
    generateContent?: GeminiGenerateContent;
    executionContext?: OpenWebUiGeminiExecutionContext;
    now?: Date;
  } = {},
): Promise<OpenWebUiGeminiReply> {
  const config = getOpenWebUiGeminiConfig(options.env);
  const promptPayload = buildOpenWebUiGeminiPromptPayload({
    ...input,
    persona: input.persona,
    executionContext: options.executionContext,
    now: options.now,
  });
  const generateContent = options.generateContent ?? createGeminiGenerateContent(config);

  try {
    const response = await generateContent({
      model: config.model,
      contents: promptPayload.userPrompt,
      config: {
        systemInstruction: promptPayload.systemInstruction,
        temperature: OPEN_WEBUI_TEMPERATURE,
        topP: OPEN_WEBUI_TOP_P,
        maxOutputTokens: OPEN_WEBUI_MAX_OUTPUT_TOKENS,
      },
    });
    const text = response.text?.trim();

    if (!text) {
      throw new OpenWebUiGeminiError(
        "gemini_empty_response",
        "Gemini returned an empty assistant response for Open WebUI chat.",
      );
    }

    const u = response.usageMetadata;
    return {
      model: config.model,
      text,
      usage: {
        inTokens: u?.promptTokenCount ?? 0,
        // Gemini คิด thinking tokens เป็น output ด้วย
        outTokens: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
      },
    };
  } catch (error) {
    if (error instanceof OpenWebUiGeminiError) {
      throw error;
    }

    throw new OpenWebUiGeminiError(
      "gemini_upstream_error",
      error instanceof Error ? error.message : "Gemini request failed for Open WebUI chat.",
    );
  }
}
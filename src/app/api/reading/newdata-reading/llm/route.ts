/**
 * POST /api/reading/newdata-reading/llm — "โหมดถอดแบบซินแส" (Gemini)
 *
 * แปลงคำอ่านตั้งต้นจาก NewData (แหล่งอ้างอิงหลักที่ซินแสดูแลที่ /reading/newdata) ให้เป็น
 * คำอ่านสไตล์ซินแส "รายกล่อง" โดยเลียนจากตัวอย่างจริง (few-shot) + กฎ 8 ข้อ
 *
 * สำคัญ: NewData คือแกนเนื้อหา (ground truth) — ซินแสเพิ่มข้อมูลใหม่เมื่อไหร่ โหมดนี้ยึดอันนั้นก่อน
 * few-shot สอนแค่ "สำนวน/วิธีเรียบเรียง" (~80%) ห้ามลอกข้อเท็จจริงข้ามดวง
 * ใช้ generateProseLlm (ไม่ผ่านด่าน marker เข้ม) แล้วคืน box-markdown ให้ client parse เป็นกล่อง
 */
import { generateProseLlm, READING_TOPIC_PROMPTS } from "@/lib/bazi/reading-llm";
import {
  type ReadingBox,
  STEM_ELEMENT,
  boxesToMarkdown,
  pickFewshot,
  SYSTEM_MOVES,
  buildComposeUserPrompt,
} from "@/lib/bazi/shinse-compose";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

export const runtime = "nodejs";

type LlmRequestBody = {
  topicId?: string;
  rawInput?: RawInputValue;
  calculatedState?: CalculatedStateValue;
  boxes?: ReadingBox[];
  anonId?: string | null;
  /** compose = เขียน/เสริมสไตล์ซินแส (default) · refine = เกลาสำนวนอย่างเดียว คงเนื้อ ไม่เติม */
  mode?: "compose" | "refine";
};

/** กล่อง → box-markdown แบบ "ดิบ" (body ว่างคงว่าง ไม่ใส่ GEN_MARK) — ใช้ตอนโหมด refine */
function boxesPlain(boxes: ReadingBox[]): string {
  return (boxes || [])
    .map((b) => `[[box=${b.title ?? ""}]]\n${(b.body ?? "").trim()}\n[[/box]]`)
    .join("\n");
}

/** system instruction โหมด refine — เกลาสำนวน คงเนื้อทุกอย่าง ห้ามเติม */
const REFINE_SYSTEM = [
  "คุณคือบรรณาธิการที่ \"เกลาสำนวน\" คำอ่านโหราศาสตร์ให้ลื่นและอ่านง่าย โดยคงเนื้อหาเดิมทุกอย่าง (นี่ไม่ใช่การเขียนใหม่)",
  "กฎเหล็ก:",
  "- คงข้อเท็จจริง/ข้อสรุป/ธาตุ/เชี่ยงแซ/ตัวเลข/ทุกรายการในลิสต์ เดิมครบ — ห้ามเพิ่มการตีความ/ประเด็น/ตัวอย่าง/ย่อหน้าใหม่ ห้ามขยายความ ความยาวต้องใกล้เคียงของเดิม (ไม่ยืด)",
  "- แก้ได้แค่: ทำสำนวนให้ลื่น, ตัดคำซ้ำ/ศัพท์เทคนิคดิบ (พลังงาน:/อุปนิสัย:/สูตรผสม), แก้คำสะกดผิด, จัดย่อหน้าให้อ่านง่าย",
  "- อักษรจีนน้อยแบบรายงาน: เก็บเฉพาะดิถี ที่เหลือเล่าเป็นไทย (เชี่ยงแซชื่อไทย, ราศีล่างเป็นนักษัตรได้)",
  "- คงหัวข้อกล่อง [[box=...]] เดิม (ตามจำนวน/ลำดับเดิม) กล่องว่างคงว่าง",
  "รูปแบบตอบ: กล่อง [[box=หัวข้อ]] เนื้อ [[/box]] เดิมที่เกลาแล้ว ไม่มีคำอธิบายอื่น ไม่มี JSON",
].join("\n");

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LlmRequestBody;
    const topicId = body.topicId;
    const prompt = topicId ? READING_TOPIC_PROMPTS[topicId] : undefined;

    if (!topicId || !prompt) {
      return Response.json({ error: "หัวข้อบทไม่ถูกต้อง" }, { status: 400 });
    }
    if (!body.rawInput || !body.calculatedState) {
      return Response.json({ error: "ต้องคำนวณดวงก่อนจึงจะทำนายด้วย AI ได้" }, { status: 400 });
    }
    const mode = body.mode === "refine" ? "refine" : "compose";
    // refine = เกลาสำนวนของกล่องเดิม (คงว่าง=ว่าง) · compose = เขียน/เสริม (กล่องว่าง→ generate)
    const excerpt = mode === "refine" ? boxesPlain(body.boxes ?? []) : boxesToMarkdown(body.boxes ?? []);
    if (!excerpt.trim()) {
      return Response.json({ error: "บทนี้ยังไม่มีคำทายจาก NewData ให้ AI เรียบเรียง" }, { status: 400 });
    }

    let systemInstruction: string;
    let userPrompt: string;
    if (mode === "refine") {
      systemInstruction = REFINE_SYSTEM;
      userPrompt = [
        `หัวข้อบท: ${prompt.heading}`,
        "เกลาสำนวนของกล่องต่อไปนี้ให้ลื่น อ่านง่าย คงเนื้อครบ ไม่เพิ่มเนื้อ ไม่ขยายความ:",
        "",
        excerpt,
      ].join("\n");
    } else {
      const dayElement = STEM_ELEMENT[body.calculatedState.dayMaster ?? ""] ?? "?";
      const examples = pickFewshot(topicId, dayElement);
      systemInstruction = SYSTEM_MOVES;
      userPrompt = buildComposeUserPrompt(topicId, body.rawInput, body.calculatedState, excerpt, examples);
    }

    // retry สูงสุด 2 ครั้ง — Gemini คืนค่าว่างเป็นครั้งคราว (บางบท/บางดวง); รอบสองลด temperature
    let result: { text: string; model: string } | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        const r = await generateProseLlm({
          systemInstruction,
          userPrompt,
          provider: "gemini",
          temperature: attempt === 0 ? 0.5 : 0.35,
          usageFeature: "reading_topic",
          usageLabel: `newdata:${topicId}`,
          usageAnonId: body.anonId ?? null,
        });
        if (r.text?.trim()) result = r;
      } catch {
        /* ว่าง/transient — ลองใหม่ */
      }
    }

    if (result) {
      return Response.json({ text: result.text, model: result.model }, { status: 200 });
    }
    // fallback: AI ล้มเหลว → คืนกล่อง NewData ดิบ (body จริง ไม่ใส่ GEN_MARK) ดีกว่าตอบ 500 — ผู้ใช้ได้เนื้อ NewData ไปก่อน
    const fallback = (body.boxes ?? [])
      .map((b) => `[[box=${b.title ?? ""}]]\n${(b.body ?? "").trim()}\n[[/box]]`)
      .join("\n");
    return Response.json({ text: fallback, model: "newdata-fallback" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ทำนายด้วย AI ไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

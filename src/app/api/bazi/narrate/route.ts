/**
 * Narrate กลาง — เกลา "engine-truth" ของฟีเจอร์ใด ๆ ให้เป็นคำทำนายร้อยแก้วอบอุ่นด้วย AI.
 * ใช้คีย์เซิร์ฟเวอร์ได้เลย (เหมือน /louise-hay) — guardServerLlm กันต้นทุน; กรอกคีย์เองก็ได้เพื่อไม่จำกัดโควตา.
 *
 * Body: { engineText, domainLabel?, feature?, apiKey?, model?, provider? }
 * ใช้ร่วมกันหลายฟีเจอร์ (เซียมซี/ปฏิทิน/ดวงกับวัน/เลขเบอร์/ห้องปฏิกิริยา) — ต่างกันแค่ engineText + domainLabel.
 */
import { z } from "zod";

import { generateProseLlm } from "@/lib/bazi/reading-llm";
import { guardServerLlm } from "@/lib/bazi/llm-guard";

export const runtime = "nodejs";

const BodySchema = z.object({
  engineText: z.string().trim().min(1).max(12000),
  domainLabel: z.string().trim().max(120).default("ผลวิเคราะห์"),
  /** ใช้แยกสถิติ/rate-limit ต่อฟีเจอร์ เช่น fortune_sage, almanac, man_vs_day, phone_reading, reaction_chamber */
  feature: z.string().trim().max(40).default("narrate"),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
});

const SYSTEM_INSTRUCTION = [
  "คุณคือที่ปรึกษาศาสตร์พยากรณ์ที่อบอุ่น กำลังเรียบเรียงผลวิเคราะห์ให้ลูกค้าอ่านเข้าใจง่าย",
  "สไตล์: ร้อยแก้วลื่นไหล เป็นกันเอง ให้กำลังใจ ใช้สรรพนาม \"คุณ\"",
  "กฎเหล็ก (ห้ามผิด):",
  "- ยึดข้อเท็จจริง ตัวเลข ธาตุ ฤกษ์ยาม และข้อสรุปจาก engine-truth ที่ให้มาเท่านั้น",
  "- ห้ามแต่งข้อมูล ตัวเลข หรือข้อสรุปที่ไม่ปรากฏใน engine-truth",
  "- ห้ามเอ่ยถึงแหล่งที่มา/ชื่อไฟล์/ศัพท์เทคนิคจีนดิบ ๆ เขียนเป็นคำทำนายภาษาคนธรรมดา",
  "- โทนให้กำลังใจ ไม่ขู่ให้กลัว ไม่ฟันธงตายตัวเกินจริง",
  "- ตอบเป็นภาษาไทย กระชับได้ใจความ (2-4 ย่อหน้า) ไม่ต้องมีหัวข้อรายงาน",
].join("\n");

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }
  const { engineText, domainLabel, feature, apiKey, model, provider } = parsed.data;

  // โหมด AI (gemini) ใช้คีย์เซิร์ฟเวอร์ได้เลย — guard กันยิงรัว/โควตา/เพดานต้นทุน
  const usedOwnKey = Boolean(apiKey);
  if (provider === "gemini") {
    const blocked = guardServerLlm(req, `narrate_${feature}`, usedOwnKey);
    if (blocked) return blocked;
  } else if (!apiKey) {
    return Response.json({ error: { message: "provider นี้ต้องมี API key ของคุณเอง" } }, { status: 400 });
  }

  const userPrompt = [
    `หัวข้อ: ${domainLabel}`,
    "",
    "ข้อมูลจาก engine (ground truth — เรียบเรียงจากสิ่งนี้เท่านั้น):",
    engineText,
    "",
    "โปรดเรียบเรียงเป็นคำทำนายร้อยแก้วอบอุ่น อ่านลื่น คงตัวเลข/ข้อเท็จจริงครบถ้วน",
  ].join("\n");

  try {
    // NOTE: usage logging ต่อฟีเจอร์ (แดชบอร์ด /stats) ยังไม่ทำ — LlmUsageFeature เป็นตารางแยกต่อฟีเจอร์
    // ต้องเพิ่มตาราง+migration ทีหลัง (guard กันต้นทุนยังทำงานครบ). feature ใช้แยก rate-limit ไปก่อน
    const result = await generateProseLlm({
      systemInstruction: SYSTEM_INSTRUCTION,
      userPrompt,
      apiKey: provider === "anthropic" ? apiKey ?? "local" : apiKey,
      model,
      provider,
    });
    return Response.json({ text: result.text, model: result.model });
  } catch (error) {
    return Response.json(
      { error: { message: error instanceof Error ? error.message : "เรียก AI ไม่สำเร็จ" } },
      { status: 502 },
    );
  }
}

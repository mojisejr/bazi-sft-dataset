import { z } from "zod";

import { generateProseLlm } from "@/lib/bazi/reading-llm";

export const runtime = "nodejs";

const RephraseSchema = z.object({
  engineText: z.string().trim().min(1),
  domainLabel: z.string().trim().default("ความเข้ากันของดวงคู่"),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  provider: z.enum(["gemini", "opencode", "anthropic"]).default("gemini"),
});

const SYSTEM_INSTRUCTION = [
  "คุณคือซินแสมืออาชีพ กำลังเรียบเรียงผลวิเคราะห์ความเข้ากันของดวงสองคนให้ลูกค้าอ่าน",
  "สไตล์: ร้อยแก้วลื่นไหล อบอุ่นแต่ตรงประเด็น ใช้สรรพนาม \"คุณ\" / \"คนที่ 1\" / \"คนที่ 2\"",
  "กฎเหล็ก (ห้ามผิด):",
  "- ยึดข้อเท็จจริง ตัวเลขคะแนน เกรด ธาตุ และความสัมพันธ์จาก engine-truth ที่ให้มาเท่านั้น",
  "- ห้ามแต่งคะแนน ธาตุ ดาว หรือข้อสรุปที่ไม่ปรากฏใน engine-truth",
  "- คงตัวเลข % เกรด และชื่อสี่ซิ้ง/ธาตุ ให้ครบและตรงเป๊ะ",
  "- ห้ามเอ่ยถึงแหล่งที่มา/ชื่อไฟล์ เขียนเป็นคำทำนายตรง ๆ",
  "- คำลงท้ายเป็นกลาง ไม่ลงท้าย \"ครับ\"/\"ค่ะ\"",
].join("\n");

/**
 * POST /api/bazi/pair/rephrase
 * Body: { engineText, domainLabel?, apiKey?, model?, provider? }
 * เรียบเรียง engine-truth ของผลจับคู่ดวงให้เป็นร้อยแก้วด้วย LLM.
 */
export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = RephraseSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 },
    );
  }

  const { engineText, domainLabel, apiKey, model, provider } = parsed.data;

  if (provider !== "anthropic" && !apiKey) {
    return Response.json({ error: { message: "โหมด LLM ต้องมี API key" } }, { status: 400 });
  }

  const userPrompt = [
    `หัวข้อ: ${domainLabel}`,
    "",
    "ข้อมูลจาก engine (ground truth — เรียบเรียงจากสิ่งนี้เท่านั้น):",
    engineText,
    "",
    "โปรดเรียบเรียงเป็นคำทำนายร้อยแก้วที่อ่านลื่น คงตัวเลขและข้อเท็จจริงครบถ้วน",
  ].join("\n");

  try {
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
      { error: { message: error instanceof Error ? error.message : "เรียก LLM ไม่สำเร็จ" } },
      { status: 500 },
    );
  }
}

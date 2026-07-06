/**
 * POST /api/reading/newdata-reading2/llm — "อ่าน 15 บท (Louise Hay)"
 *
 * แปลงข้อเท็จจริง NewData ของบทหนึ่ง → คำอ่านน้ำเสียงอบอุ่น "โค้ชฮีลใจ" (Louise Hay)
 * โดยล้อโครง/ประเด็นจากคำอ่านจริงซินแส 3 ดวง (few-shot) แต่เล่าใหม่ด้วยน้ำเสียงเอง
 *
 * คืน box-markdown 1 กล่อง (หัว = ชื่อบท) เพื่อให้ client (parseBoxMarkdown) ใช้ได้เหมือนแท็บเดิม
 */
import { generateProseLlm, READING_TOPIC_PROMPTS } from "@/lib/bazi/reading-llm";
import { buildLouiseReadingPrompt, type LouiseReadingBox } from "@/lib/bazi/louise-reading";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

export const runtime = "nodejs";

type LlmRequestBody = {
  topicId?: string;
  rawInput?: RawInputValue;
  calculatedState?: CalculatedStateValue;
  boxes?: LouiseReadingBox[];
  anonId?: string | null;
};

/** escape ]] ในเนื้อ กัน parser ปิดกล่องพลาด (rare) */
function toBoxMarkdown(title: string, body: string): string {
  return `[[box=${title}]]\n${body.trim()}\n[[/box]]`;
}

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

    const { systemInstruction, userPrompt } = buildLouiseReadingPrompt({
      topicId,
      rawInput: body.rawInput,
      state: body.calculatedState,
      boxes: body.boxes ?? [],
    });

    // retry 2 ครั้ง — Gemini คืนค่าว่างเป็นครั้งคราว; รอบสองลด temperature
    let result: { text: string; model: string } | null = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        const r = await generateProseLlm({
          systemInstruction,
          userPrompt,
          provider: "gemini",
          temperature: attempt === 0 ? 0.85 : 0.6,
          usageFeature: "reading_topic",
          usageLabel: `newdata2:${topicId}`,
          usageAnonId: body.anonId ?? null,
        });
        if (r.text?.trim()) result = r;
      } catch {
        /* ว่าง/transient — ลองใหม่ */
      }
    }

    if (result) {
      const text = toBoxMarkdown(prompt.heading, result.text);
      return Response.json({ text, model: result.model }, { status: 200 });
    }

    // fallback: AI ล้ม → คืนกล่อง NewData ดิบ (ดีกว่า 500)
    const fallback = (body.boxes ?? [])
      .map((b) => toBoxMarkdown(b.title ?? "", (b.body ?? "").trim()))
      .join("\n");
    return Response.json({ text: fallback, model: "newdata2-fallback" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ทำนายด้วย AI ไม่สำเร็จ";
    return Response.json({ error: message }, { status: 500 });
  }
}

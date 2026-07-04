/**
 * แชทบอต "โค้ชฮีลใจ" (สไตล์ Louise Hay) — grounded ด้วย RAG จากคลังคำสอนที่ OCR ไว้.
 *
 * รับ { messages } → embed คำถามล่าสุด → ดึงคำสอนที่เกี่ยวข้อง top-K → ประกอบ prompt (persona +
 * คำสอน) → เรียก Gemini แบบ stream แล้ว re-stream ข้อความกลับเป็น text/plain.
 * แหล่งอ้างอิงที่ใช้จะถูกแนบใน header `X-LH-Sources` (base64 JSON) เพราะ retrieval เกิดก่อน stream.
 */
import { z } from "zod";

import { getGeminiApiKey } from "@/lib/env";
import { resolveLouiseHayGrounding } from "@/lib/louise-hay/grounding-router";
import { buildLouiseHayPrompt, type LouiseHayChatMessage } from "@/lib/louise-hay/persona";
import { retrieveLouiseHayPassages } from "@/lib/louise-hay/retrieval";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 1024;
const TEMPERATURE = 0.85;
const TOP_P = 0.95;
const TOP_K_PASSAGES = 5;
const SOURCE_SNIPPET_CHARS = 90;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const BirthSchema = z.object({
  birthDate: z.string().trim().min(1),
  birthTime: z.string().trim().min(1),
  gender: z.enum(["male", "female"]),
  province: z.string().trim().min(1),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  birth: BirthSchema.optional(),
  /** คีย์ Gemini ของผู้ใช้เอง (ไม่บังคับ) — ถ้าไม่ส่ง ใช้ GEMINI_API_KEY ของเซิร์ฟเวอร์ */
  apiKey: z.string().trim().min(1).max(200).optional(),
});

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

type SourceCitation = {
  n: number;
  title: string;
  page: string;
  snippet: string;
};

function pageLabel(startPage: number | null, endPage: number | null): string {
  if (!startPage) return "";
  if (endPage && endPage !== startPage) return `น.${startPage}-${endPage}`;
  return `น.${startPage}`;
}

function encodeSources(sources: SourceCitation[]): string {
  return Buffer.from(JSON.stringify(sources), "utf-8").toString("base64");
}

/** แปลง SSE stream ของ Gemini (:streamGenerateContent?alt=sse) เป็น text delta ล้วน */
function geminiSseToText(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.getReader();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n");
      buffer = events.pop() ?? "";
      for (const line of events) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const json = trimmed.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = parsed.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("");
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        } catch {
          // ชิ้นส่วน JSON ยังมาไม่ครบ — ปล่อยผ่าน (รอ chunk ถัดไป)
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const messages = parsed.data.messages as LouiseHayChatMessage[];
  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  if (!latestUser) {
    return badRequest("ต้องมีข้อความจากผู้ใช้อย่างน้อยหนึ่งข้อความ");
  }

  // คีย์ของผู้ใช้ก่อน (จากช่องกรอกในหน้า) ไม่งั้นใช้คีย์กลางของเซิร์ฟเวอร์
  let apiKey: string;
  try {
    apiKey = parsed.data.apiKey?.trim() || getGeminiApiKey();
  } catch {
    return badRequest("กรุณาใส่ API key ของ Gemini (หรือให้เซิร์ฟเวอร์ตั้งค่า GEMINI_API_KEY)", 400);
  }

  // RAG คำสอน (น้ำเสียง) + เลือกศาสตร์ตอบตามชนิดคำถาม (ดวง NewData / ปฏิทิน / ไพ่) — ทำขนานกัน
  const [retrieved, grounding] = await Promise.all([
    retrieveLouiseHayPassages(latestUser.content, TOP_K_PASSAGES, apiKey),
    resolveLouiseHayGrounding(latestUser.content, parsed.data.birth ?? null, new Date(), apiKey),
  ]);

  const sources: SourceCitation[] = retrieved.map((p, i) => ({
    n: i + 1,
    title: p.title,
    page: pageLabel(p.startPage, p.endPage),
    snippet: p.text.slice(0, SOURCE_SNIPPET_CHARS).replace(/\s+/g, " ").trim(),
  }));

  const groundingContext = grounding.text
    ? grounding.text + (grounding.note ? `\n(หมายเหตุ: ${grounding.note})` : "")
    : null;

  const prompt = buildLouiseHayPrompt({
    messages,
    passages: retrieved,
    latestUserMessage: latestUser.content,
    groundingContext,
  });

  const model = process.env.LOUISE_HAY_MODEL?.trim() || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt.userPrompt }] }],
        generationConfig: {
          temperature: TEMPERATURE,
          topP: TOP_P,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          // ปิด "การคิด" ของโมเดล 2.5 — คำโค้ชอบอุ่นไม่ต้องใช้ reasoning และโทเคนคิด
          // ถูกนับรวมใน maxOutputTokens ทำให้คำตอบจริงถูกตัดกลางประโยค
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: req.signal,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "เรียก Gemini ไม่สำเร็จ", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return badRequest(`Gemini ตอบผิดพลาด (${upstream.status}) ${detail.slice(0, 200)}`, 502);
  }

  return new Response(geminiSseToText(upstream.body), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-LH-Sources": encodeSources(sources),
      "X-LH-Grounded": retrieved.length > 0 ? "1" : "0",
      "X-LH-Route": grounding.route,
      "X-LH-Source": Buffer.from(
        JSON.stringify({ label: grounding.sourceLabel, note: grounding.note ?? null }),
        "utf-8",
      ).toString("base64"),
    },
  });
}

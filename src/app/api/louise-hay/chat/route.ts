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
import { buildLouiseHayPrompt, detectEmotionalDistress, type LouiseHayChatMessage } from "@/lib/louise-hay/persona";
import { getPersonaCacheName } from "@/lib/louise-hay/persona-cache";
import { retrieveLouiseHayPassages } from "@/lib/louise-hay/retrieval";
import { logCrisisEvent, logUsage } from "@/lib/louise-hay/usage-repository";
import { CRISIS_RESPONSE, screenCrisis, screenCrisisLlm } from "@/lib/louise-hay/safety";
import { costUsdOf, usdToThb } from "@/lib/louise-hay/pricing";
import { checkRateLimit, clientIp, tryChargeDailyBudget, reconcileDailyBudget } from "@/lib/rate-limit";
import { qiGate } from "@/lib/bazi/qi/quota";

export const runtime = "nodejs";

// ใช้ flash-lite เพื่อลดต้นทุน/คำถาม โดยคุณภาพแชทให้กำลังใจยังพอ override ได้ด้วย env LOUISE_HAY_MODEL
// หมายเหตุ: gemini-2.5-flash-lite ถูกปิดสำหรับ user ใหม่แล้ว (404) → ย้ายมา 3.1-flash-lite เหมือนฟีเจอร์อื่นในเรปอ
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
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
  /** id นิรนามจาก localStorage ของผู้ใช้ (ไว้นับสถิติ "คน") — ไม่บังคับ */
  anonId: z.string().trim().min(1).max(100).optional(),
  /** หมวด(ศาสตร์)ของคำตอบก่อนหน้า — ช่วยให้จัดหมวดคำถามต่อเนื่องได้ต่อเรื่อง (ไม่จั่วไพ่ใหม่ทุกที) */
  prevRoute: z.string().trim().max(20).optional(),
  /** เพศตัวละคร → คุมคำลงท้าย ค่ะ/ครับ (ค่าเริ่มต้น = หญิง) */
  personaGender: z.enum(["female", "male"]).optional(),
});

const ANSWER_PREVIEW_CHARS = 400;

type GenUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
};

function badRequest(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

/** หยุดบท + คืนข้อความส่งต่อสายด่วน เมื่อพบสัญญาณวิกฤต (RED) + log (fire-and-forget, ไม่เก็บข้อความ) */
function crisisResponse(anonId: string, detectedBy: "regex" | "llm", matchedCount: number) {
  console.warn(`[louise-hay][CRISIS] hard-stop fired anonId=${anonId} by=${detectedBy} matched=${matchedCount}`);
  void logCrisisEvent({ anonId, detectedBy, matchedCount });
  return new Response(CRISIS_RESPONSE, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-LH-Crisis": "1",
    },
  });
}

/**
 * ลบ "ศัพท์หลังบ้าน" ออกจากผลศาสตร์ก่อนเข้า prompt — โดยเฉพาะอักษรจีน (通根/黃道/建除/月柱 ฯลฯ)
 * ที่ router แนบเป็นป้ายกำกับ. คำตอบเป็นไทยอยู่แล้ว จีนจึงเป็นแค่ข้อมูลภายในที่ไม่ควรให้โมเดลเห็น/เอ่ยต่อ.
 * (ป้องกันชั้นแข็ง: โมเดลคายสิ่งที่ไม่เห็นไม่ได้ — เสริม guardrail ใน persona อีกชั้น)
 */
function stripInternalJargon(text: string): string {
  return text
    .replace(/[㐀-䶿一-鿿豈-﫿]/g, "") // CJK ideographs (+compat)
    .replace(/\(\s*\)/g, "") // วงเล็บที่ว่างหลังลบจีน เช่น "(黃道)" → ""
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([)\]:])/g, "$1")
    .trim();
}

/**
 * กันชนชั้นสุดท้าย: ตัด "ตัวอักษรต่างภาษา" ที่โมเดลอาจหลุดปนในคำตอบ (พบเคสฮันกึลเกาหลีโผล่กลางไทย).
 * ตัดเฉพาะสคริปต์ที่ไม่ควรมีในคำตอบไทยล้วน — ฮันกึล / คานะญี่ปุ่น / อักษรจีน (CJK) — ไม่แตะ
 * อังกฤษ/ตัวเลข/อีโมจิ เพราะอาจใช้ประกอบคำตอบได้จริง. ทำระดับ chunk ได้เพราะแต่ละตัวอักษร
 * ถอดรหัส UTF-8 มาครบตัวแล้ว (ไม่ถูกหั่นกลาง code point).
 */
const FOREIGN_SCRIPT_RE =
  /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿぀-ゟ゠-ヿㇰ-ㇿ･-ﾟ㐀-䶿一-鿿豈-﫿]/gu;

function stripForeignScript(text: string): string {
  // ใช้ .replace ตรง ๆ (สแกนจากต้นเสมอ) เลี่ยงบั๊ก lastIndex ค้างของ regex /g
  return text.replace(FOREIGN_SCRIPT_RE, "");
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

/**
 * แปลง SSE stream ของ Gemini (:streamGenerateContent?alt=sse) เป็น text delta ล้วน
 * พร้อมสะสมข้อความเต็ม + usageMetadata (โทเคน gen) แล้วเรียก onComplete ตอนสตรีมจบ/ถูกยกเลิก
 * เพื่อบันทึกสถิติ (fire-and-forget).
 */
function geminiSseToText(
  upstream: ReadableStream<Uint8Array>,
  onComplete: (result: { text: string; usage: GenUsage }) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.getReader();
  let buffer = "";
  let fullText = "";
  let usage: GenUsage = {};
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    onComplete({ text: fullText, usage });
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) {
        finish();
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
            usageMetadata?: GenUsage;
          };
          if (parsed.usageMetadata) usage = parsed.usageMetadata;
          const rawText = parsed.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("");
          const text = rawText ? stripForeignScript(rawText) : rawText;
          if (text) {
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        } catch {
          // ชิ้นส่วน JSON ยังมาไม่ครบ — ปล่อยผ่าน (รอ chunk ถัดไป)
        }
      }
    },
    cancel() {
      finish();
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

  const anonIdForLog = parsed.data.anonId?.trim() || "anon";

  // ── ชั้นคัดกรองความปลอดภัย ชั้น 1: regex (RED crisis hard-stop) ──
  // คัดกรองก่อนทุกอย่าง (ก่อน key/rate-limit/quota/Gemini). พบสัญญาณวิกฤต = หยุดบททันที
  // ไม่ส่งเข้าโมเดล คืนข้อความส่งต่อ + สายด่วน. ดู src/lib/louise-hay/safety.ts
  const crisis = screenCrisis(latestUser.content);
  if (crisis.level === "red") {
    return crisisResponse(anonIdForLog, "regex", crisis.matched.length);
  }

  // คีย์ของผู้ใช้ก่อน (จากช่องกรอกในหน้า) ไม่งั้นใช้คีย์กลางของเซิร์ฟเวอร์
  const isOwnKey = Boolean(parsed.data.apiKey?.trim());
  let apiKey: string;
  try {
    apiKey = parsed.data.apiKey?.trim() || getGeminiApiKey();
  } catch {
    return badRequest("กรุณาใส่ API key ของ Gemini (หรือให้เซิร์ฟเวอร์ตั้งค่า GEMINI_API_KEY)", 400);
  }

  // กันยิงรัว (ต่อ IP) + โควตารายวัน (เฉพาะคีย์เซิร์ฟเวอร์ = free tier) — เช็คก่อนเรียก Gemini เพื่อกันค่าใช้จ่าย
  const limited = checkRateLimit("louise_hay", clientIp(req), !isOwnKey);
  if (limited) {
    return Response.json(
      { error: { message: limited.message } },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  // ── ชั้นคัดกรองความปลอดภัย ชั้น 2: LLM classifier (belt-and-suspenders) ──
  // รันเฉพาะ "โซนเสี่ยง" (ข้อความโทนทุกข์ใจที่ชั้น regex ไม่จับ) เพื่อคุมต้นทุน/latency —
  // จับเคสที่พิมพ์อ้อม/เลี่ยงคำ. พบ = หยุดบทเหมือนชั้น 1. ทำก่อนหักโควตา (ไม่คิดโควตาให้เคสวิกฤต).
  if (detectEmotionalDistress(latestUser.content)) {
    const risky = await screenCrisisLlm(latestUser.content, apiKey);
    if (risky) {
      return crisisResponse(anonIdForLog, "llm", 0);
    }
  }

  // โควตาถาม AI ต่อ user (ระบบแต้ม Qi) — เฉพาะคีย์เซิร์ฟเวอร์ (free tier) และเมื่อผูก anonId
  // ฟรีรายวันตาม tier → หมดแล้วตัด credit ที่แลกด้วย Qi; หมดทั้งคู่ → 402
  if (!isOwnKey) {
    const gated = await qiGate(parsed.data.anonId, "chat");
    if (gated) return gated;
  }

  // เพดานค่าใช้จ่ายรวมต่อวัน (เฉพาะคีย์เซิร์ฟเวอร์) — กันกรณีเลวร้ายสุด
  if (!isOwnKey) {
    const budget = tryChargeDailyBudget();
    if (!budget.ok) {
      return Response.json(
        { error: { message: "ระบบพักรับข้อความชั่วคราวสำหรับวันนี้ 🌙 ขออภัยค่ะ พรุ่งนี้กลับมาคุยกันใหม่ หรือใส่ Gemini API key ของคุณเองเพื่อคุยต่อได้" } },
        { status: 503, headers: { "Retry-After": String(budget.retryAfterSec) } },
      );
    }
  }

  // RAG คำสอน (น้ำเสียง) + เลือกศาสตร์ตอบตามชนิดคำถาม (ดวง NewData / ปฏิทิน / ไพ่) — ทำขนานกัน
  const [retrieved, grounding] = await Promise.all([
    retrieveLouiseHayPassages(latestUser.content, TOP_K_PASSAGES, apiKey),
    resolveLouiseHayGrounding(
      latestUser.content,
      parsed.data.birth ?? null,
      new Date(),
      apiKey,
      messages,
      parsed.data.prevRoute,
    ),
  ]);

  const sources: SourceCitation[] = retrieved.passages.map((p, i) => ({
    n: i + 1,
    title: p.title,
    page: pageLabel(p.startPage, p.endPage),
    snippet: p.text.slice(0, SOURCE_SNIPPET_CHARS).replace(/\s+/g, " ").trim(),
  }));

  const groundingContext = grounding.text
    ? stripInternalJargon(grounding.text + (grounding.note ? `\n(หมายเหตุ: ${grounding.note})` : ""))
    : null;

  const prompt = buildLouiseHayPrompt({
    messages,
    passages: retrieved.passages,
    latestUserMessage: latestUser.content,
    groundingContext,
    emotionalDistress: detectEmotionalDistress(latestUser.content),
    personaGender: parsed.data.personaGender,
    now: new Date(),
  });

  const usedOwnKey = isOwnKey;
  const anonId = parsed.data.anonId?.trim() || "anon";
  const birthKey = parsed.data.birth
    ? `${parsed.data.birth.birthDate}|${parsed.data.birth.province}`
    : null;

  const model = process.env.LOUISE_HAY_MODEL?.trim() || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // explicit caching ของ persona — เฉพาะคีย์เซิร์ฟเวอร์ (cache ผูกกับ project). คีย์ผู้ใช้เอง → ไม่แคช
  const cacheName = usedOwnKey ? null : await getPersonaCacheName(apiKey, model, prompt.systemInstruction);

  const generationConfig = {
    temperature: TEMPERATURE,
    topP: TOP_P,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    // ปิด "การคิด" ของโมเดล 2.5 — คำโค้ชอบอุ่นไม่ต้องใช้ reasoning และโทเคนคิด
    // ถูกนับรวมใน maxOutputTokens ทำให้คำตอบจริงถูกตัดกลางประโยค
    thinkingConfig: { thinkingBudget: 0 },
  };
  // ถ้ามี cache → อ้าง persona จาก cache (ไม่ส่ง systemInstruction ซ้ำ); ไม่งั้นส่ง persona แบบ inline
  const requestBody = cacheName
    ? {
        cachedContent: cacheName,
        contents: [{ role: "user", parts: [{ text: prompt.userPrompt }] }],
        generationConfig,
      }
    : {
        systemInstruction: { parts: [{ text: prompt.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt.userPrompt }] }],
        generationConfig,
      };

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: req.signal,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "เรียก Gemini ไม่สำเร็จ", 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return badRequest(`Gemini ตอบผิดพลาด (${upstream.status}) ${detail.slice(0, 200)}`, 502);
  }

  const onComplete = ({ text, usage }: { text: string; usage: GenUsage }) => {
    // โทเคนที่ cache (จาก explicit + implicit) คิดเงินแค่ ~25% → เก็บเป็น "input ที่คิดเงินจริง"
    // เพื่อให้ต้นทุนบนแดชบอร์ดสะท้อนส่วนลด (billable = prompt - cached*0.75)
    const cached = usage.cachedContentTokenCount ?? 0;
    const genInTokens = Math.max(0, Math.round((usage.promptTokenCount ?? 0) - cached * 0.75));
    const genOutTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
    const totalTokens =
      grounding.classifyInTokens +
      grounding.classifyOutTokens +
      retrieved.embedTokens +
      genInTokens +
      genOutTokens;
    // แทนค่าประมาณ budget ด้วยต้นทุนจริง (เฉพาะคีย์เซิร์ฟเวอร์)
    if (!isOwnKey) {
      const actualUsd = costUsdOf({
        model,
        classifyInTokens: grounding.classifyInTokens,
        classifyOutTokens: grounding.classifyOutTokens,
        embedTokens: retrieved.embedTokens,
        genInTokens,
        genOutTokens,
      });
      reconcileDailyBudget(usdToThb(actualUsd));
    }
    // fire-and-forget: บันทึกสถิติ ไม่ให้กระทบผู้ใช้ ถ้า DB ล่มก็ปล่อยผ่าน
    void logUsage({
      anonId,
      birthKey,
      question: latestUser.content.slice(0, 2000),
      answerPreview: text.slice(0, ANSWER_PREVIEW_CHARS),
      route: grounding.route,
      model,
      usedOwnKey,
      classifyInTokens: grounding.classifyInTokens,
      classifyOutTokens: grounding.classifyOutTokens,
      embedTokens: retrieved.embedTokens,
      genInTokens,
      genOutTokens,
      totalTokens,
    });
  };

  return new Response(geminiSseToText(upstream.body, onComplete), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-LH-Sources": encodeSources(sources),
      "X-LH-Grounded": retrieved.passages.length > 0 ? "1" : "0",
      "X-LH-Route": grounding.route,
      "X-LH-Source": Buffer.from(
        JSON.stringify({ label: grounding.sourceLabel, note: grounding.note ?? null }),
        "utf-8",
      ).toString("base64"),
      // วันที่ตั้งเตือนได้ (ถ้ามี) → frontend ทำปุ่ม 🔔 ตั้งเตือนผ่าน LINE
      "X-LH-Alerts": grounding.alertDays?.length
        ? Buffer.from(JSON.stringify(grounding.alertDays), "utf-8").toString("base64")
        : "",
    },
  });
}

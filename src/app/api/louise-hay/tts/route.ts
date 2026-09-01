/**
 * เสียงคุณภาพสูง (server voice) สำหรับแชท "โค้ชฮีลใจ" ผ่าน Gemini TTS.
 *
 * ใช้ GEMINI_API_KEY เดิม (ฟรี tier ก็เรียกได้) — ไม่ต้องเปิดบัญชี/คีย์ใหม่.
 * เสียง prebuilt ของ Gemini มีทั้งชาย/หญิง หลายโทน (ชุดเดียวกับที่ทีมเห็นใน pettagu).
 *
 * GET  → { available, voices } : ให้ UI รู้ว่าเปิดใช้เสียงเซิร์ฟเวอร์ได้ไหม + มีเสียงอะไรบ้าง
 * POST { text, voice? } → audio/wav : แปลงข้อความเป็นไฟล์เสียง (PCM 24kHz → หุ้ม WAV)
 *
 * ถ้าไม่มี GEMINI_API_KEY → available:false, POST 503 (UI fallback ไปเสียงเบราว์เซอร์ฟรี).
 */
import { z } from "zod";

import { getGeminiApiKey } from "@/lib/env";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// override ได้ด้วย env; 2.5-flash-preview-tts เป็นรุ่นเสียงที่เสถียรและถูกสุด
const TTS_MODEL = process.env.LOUISE_HAY_TTS_MODEL?.trim() || "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = "Leda"; // หญิง สดใส (persona โค้ชเป็นหญิงโดยดีฟอลต์)
const MAX_TTS_CHARS = 1200;
const PCM_SAMPLE_RATE = 24000; // Gemini TTS คืน PCM 16-bit mono 24kHz

// เสียง prebuilt ของ Gemini (คัดชุดที่โทนเหมาะโค้ชฮีลใจ — ชื่อ/โทนตรงกับ pettagu)
const GEMINI_VOICES = [
  { id: "Leda", label: "Leda (หญิง สดใส)", gender: "female" as const },
  { id: "Kore", label: "Kore (หญิง หนักแน่น)", gender: "female" as const },
  { id: "Aoede", label: "Aoede (หญิง โปร่ง)", gender: "female" as const },
  { id: "Iapetus", label: "Iapetus (ชาย นุ่ม)", gender: "male" as const },
  { id: "Charon", label: "Charon (ชาย ทุ้ม)", gender: "male" as const },
  { id: "Puck", label: "Puck (ชาย สดใส)", gender: "male" as const },
];

function geminiKey(): string | null {
  try {
    return getGeminiApiKey();
  } catch {
    return null;
  }
}

export function GET() {
  const available = Boolean(geminiKey());
  return Response.json({ available, voices: available ? GEMINI_VOICES : [] });
}

const BodySchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
  voice: z.string().trim().max(48).optional(),
});

/** หุ้ม PCM 16-bit mono ด้วย WAV header เพื่อให้ <audio> เล่นได้ */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono * 16-bit)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

export async function POST(req: Request) {
  const key = geminiKey();
  if (!key) {
    return Response.json(
      { error: { message: "เสียงเซิร์ฟเวอร์ยังไม่พร้อม (ไม่มี GEMINI_API_KEY) — ใช้เสียงเบราว์เซอร์แทนได้" } },
      { status: 503 },
    );
  }

  // กันยิงรัวต่อ IP (per-minute) — เสียงเซิร์ฟเวอร์มีต้นทุน/โควตา
  const limited = checkRateLimit("louise_hay_tts", clientIp(req), false);
  if (limited) {
    return Response.json(
      { error: { message: limited.message } },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: { message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid payload." } },
      { status: 400 },
    );
  }

  const voice = GEMINI_VOICES.some((v) => v.id === parsed.data.voice)
    ? (parsed.data.voice as string)
    : DEFAULT_VOICE;

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: parsed.data.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
        signal: req.signal,
      },
    );
  } catch (error) {
    return Response.json(
      { error: { message: error instanceof Error ? error.message : "เรียก Gemini TTS ไม่สำเร็จ" } },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      { error: { message: `Gemini TTS ตอบผิดพลาด (${upstream.status}) ${detail.slice(0, 200)}` } },
      { status: 502 },
    );
  }

  const json = (await upstream.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
  };
  const b64 = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) {
    return Response.json({ error: { message: "Gemini TTS ไม่ได้คืนเสียง" } }, { status: 502 });
  }

  const wav = pcmToWav(Buffer.from(b64, "base64"), PCM_SAMPLE_RATE);
  return new Response(new Uint8Array(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * แคมเปญ "What If" — สร้างภาพ AI "ตัวคุณในจักรวาลคู่ขนาน" ด้วย Imagen (@google/genai)
 * ภาพบุคคลในบริบทอาชีพที่ฟ้าลิขิต สไตล์ cinematic — best-effort: ถ้า key ไม่มีสิทธิ์ Imagen
 * ให้ route จับ error แล้วตอบเรื่องราวอย่างเดียว (UI มี fallback avatar)
 *
 * reuse ตัวบีบรูป (sharp → JPEG) จาก divine-cards
 * server-only (ใช้ใน route)
 */
import { GoogleGenAI } from "@google/genai";

import { compressCardImage } from "@/lib/bazi/divine-cards/image-gen";

export const DEFAULT_WHATIF_IMAGEN_MODEL = "imagen-4.0-generate-001";

/** hash เบา ๆ (djb2) สำหรับเลือก variant แบบ deterministic — ดวงเดิมได้ภาพแนวเดิม */
function hashOf(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h | 0);
}

/** ฉากหลังจักรวาล — สลับตามดวง กันภาพซ้ำ ๆ กันทุกคน */
const SCENES = [
  "Behind them a glowing circular portal ring of golden-orange sparks floating in deep cosmic purple space with stars and nebulas",
  "They stand on a starlit rooftop of a futuristic city at night, a huge glowing galaxy and shooting stars across the purple sky",
  "They stand in a beam of warm golden spotlight on a cosmic stage, swirling purple nebula clouds and floating star particles around",
  "A window-like crack in space glows softly behind them, revealing another universe — golden light spilling into deep violet starfield",
  "They float gently among tiny planets and constellations, soft orange and magenta cosmic clouds swirling in the background",
] as const;

/** สไตล์ภาพ — หลากหลายแต่คุมโทน น่ารัก+เท่ ทั้งหมด */
const STYLES = [
  "clean cel-shaded 3D animation look like a modern animated-movie poster",
  "charming stylized 3D character art with soft lighting, pixar-like appeal",
  "bold 2D anime poster style with dynamic linework and vivid shading",
  "playful chibi cartoon style with big head proportion and glossy finish",
] as const;

/** ลูกเล่นเสริมเล็ก ๆ — ห้ามกลืนชุดอาชีพ (บางแบบไม่มีอะไรเลย) */
const FLAIRS = [
  "a few tiny sparkles of stardust drifting around them",
  "a subtle warm glowing aura outlining their silhouette",
  "small floating light orbs near their hands",
  "no extra effects — just clean cosmic lighting",
] as const;

/** ประกอบ prompt ภาพจากอาชีพที่ฟ้าลิขิต + ช่วงวัย + เพศ
 *  โทน: การ์ตูนจักรวาล น่ารัก+เท่ (โปสเตอร์โลกคู่ขนาน) — ฉาก/สไตล์สลับตามดวง กันออกเป็นนักเวทหมด */
export function buildWhatIfImagePrompt(input: {
  /** อาชีพภาษาอังกฤษ (destinedCareerEn) — Imagen อ่านไทยไม่ออก */
  destinedCareer: string;
  age: number | null;
  gender?: "male" | "female";
}): string {
  const person = input.gender === "male" ? "Thai man" : input.gender === "female" ? "Thai woman" : "Thai person";
  const ageHint =
    input.age === null ? `an adult ${person}` : input.age < 35 ? `a young-adult ${person}` : `a ${person} in their ${Math.min(Math.floor((input.age ?? 40) / 10) * 10, 60)}s`;
  const seed = hashOf(`${input.destinedCareer}|${input.gender ?? ""}|${input.age ?? ""}`);
  const scene = SCENES[seed % SCENES.length]!;
  const style = STYLES[(seed >> 3) % STYLES.length]!;
  const flair = FLAIRS[(seed >> 6) % FLAIRS.length]!;
  return [
    `Cute yet cool cartoon character art of ${ageHint} living their most successful parallel-universe life as: ${input.destinedCareer}.`,
    "MOST IMPORTANT: this is a portrait of that profession, NOT a wizard —",
    "their outfit, held props and tools must clearly show that exact profession at a glance (real work attire of that job, signature equipment in hand),",
    "no magic robes, no wizard costume, no spell circles.",
    `Art style: ${style}; big expressive eyes, confident friendly smirk, dynamic heroic pose.`,
    `Scene: ${scene}, with ${flair}.`,
    "Color mood: deep cosmic purple and navy with warm golden-orange rim lighting, vibrant and charming, high detail.",
    "No text, no letters, no numbers, no Chinese characters, no runes or glowing symbols, no watermark, no logo.",
  ].join(" ");
}

type GenerateImages = (request: {
  model: string;
  prompt: string;
  config?: { numberOfImages?: number; aspectRatio?: string };
}) => Promise<{
  generatedImages?: Array<{ image?: { imageBytes?: string; mimeType?: string } }>;
}>;

export type WhatIfImage = { imageBase64: string; mime: string; model: string; prompt: string };

export async function generateWhatIfImage(
  input: { destinedCareer: string; age: number | null; gender?: "male" | "female"; apiKey?: string; model?: string },
  deps: { generateImages?: GenerateImages } = {},
): Promise<WhatIfImage> {
  const model = input.model?.trim() || DEFAULT_WHATIF_IMAGEN_MODEL;
  const prompt = buildWhatIfImagePrompt(input);
  const generateImages: GenerateImages =
    deps.generateImages ??
    ((request) => new GoogleGenAI({ apiKey: input.apiKey }).models.generateImages(request));

  const response = await generateImages({
    model,
    prompt,
    config: { numberOfImages: 1, aspectRatio: "3:4" },
  });

  const rawBase64 = response.generatedImages?.[0]?.image?.imageBytes;
  if (!rawBase64) {
    throw new Error("Imagen คืนค่าว่างสำหรับภาพโลกคู่ขนาน");
  }
  const compressed = await compressCardImage(rawBase64);
  return { imageBase64: compressed.base64, mime: compressed.mime, model, prompt };
}

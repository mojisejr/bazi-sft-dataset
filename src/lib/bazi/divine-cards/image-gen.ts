/**
 * สร้างรูปไพ่โหมดเซียนด้วย Imagen (ผ่าน @google/genai)
 * ของทดลอง — ขึ้นกับสิทธิ์ Imagen ของ API key; ถ้าไม่มีสิทธิ์จะ throw error ชัดเจน
 * server-only (ใช้ใน route)
 */
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

import type { DivineCard } from "@/lib/bazi/divine-cards/deck";

export const DEFAULT_IMAGEN_MODEL = "imagen-4.0-generate-001";

/** ขนาดรูปที่เก็บ (กว้างสุด px) + คุณภาพ JPEG — ลดจาก PNG ~2.5MB เหลือ ~100-200KB */
export const STORED_IMAGE_WIDTH = 640;
export const STORED_IMAGE_QUALITY = 80;

/** ย่อ + แปลงเป็น JPEG เพื่อลดขนาดที่เก็บใน DB. คืน base64 (ไม่มี prefix) */
export async function compressCardImage(
  base64: string,
  opts: { width?: number; quality?: number } = {},
): Promise<{ base64: string; mime: string }> {
  const buf = Buffer.from(base64, "base64");
  const out = await sharp(buf)
    .resize({ width: opts.width ?? STORED_IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: opts.quality ?? STORED_IMAGE_QUALITY, mozjpeg: true })
    .toBuffer();
  return { base64: out.toString("base64"), mime: "image/jpeg" };
}

export type GeneratedCardImage = {
  prompt: string;
  imageBase64: string;
  mime: string;
  model: string;
};

/** ประกอบ prompt ภาพจากข้อมูลไพ่ (ภาพชีวิต + ชื่อ + keyword) เป็นสไตล์ศิลป์ไพ่ทำนาย */
export function buildImagePrompt(card: DivineCard): string {
  const scene = card.lifeImage || card.keywords || card.prophecy.slice(0, 160);
  return [
    `Mystical oracle/tarot card illustration for "${card.name}" (${card.keywordEn}).`,
    `Scene: ${scene}`,
    "Style: luminous celestial spiritual art, ornate golden border, soft ethereal lighting,",
    "rich detailed painterly fantasy, portrait orientation, no text, no letters, no watermark.",
  ].join(" ");
}

type GenerateImages = (request: {
  model: string;
  prompt: string;
  config?: { numberOfImages?: number; aspectRatio?: string };
}) => Promise<{
  generatedImages?: Array<{ image?: { imageBytes?: string; mimeType?: string } }>;
}>;

export async function generateCardImage(
  card: DivineCard,
  options: { apiKey?: string; model?: string },
  deps: { generateImages?: GenerateImages } = {},
): Promise<GeneratedCardImage> {
  const model = options.model?.trim() || DEFAULT_IMAGEN_MODEL;
  const prompt = buildImagePrompt(card);
  const generateImages: GenerateImages =
    deps.generateImages ??
    ((request) => new GoogleGenAI({ apiKey: options.apiKey }).models.generateImages(request));

  const response = await generateImages({
    model,
    prompt,
    config: { numberOfImages: 1, aspectRatio: "3:4" },
  });

  const first = response.generatedImages?.[0]?.image;
  const rawBase64 = first?.imageBytes;
  if (!rawBase64) {
    throw new Error(`Imagen คืนค่าว่างสำหรับไพ่ #${card.no} (${card.name})`);
  }
  const compressed = await compressCardImage(rawBase64);
  return {
    prompt,
    imageBase64: compressed.base64,
    mime: compressed.mime,
    model,
  };
}

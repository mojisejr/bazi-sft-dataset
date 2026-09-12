/**
 * Retrieval คลัง "เนื้อคำอ่านจริงของซินแส" (ตัด anchor เฉพาะดวงแล้ว) ให้แชทฮีลใจดึงมาอ้างอิงเชิงแนวทาง
 * โครงเดียวกับ src/lib/louise-hay/retrieval.ts — โหลด index ที่ build ไว้ แล้ว cosine top-K
 *
 * index จาก scripts/build-shinse-chat-index.ts → src/lib/bazi/shinse-chat-index.generated.json
 * โหลดแบบ lazy (fs) + degrade เงียบ ๆ ถ้าไฟล์ยังไม่ถูกสร้าง. server-only.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { getGeminiApiKey } from "@/lib/env";

type IndexChunk = { id: string; book: string; title: string; text: string; embedding: number[] };
type ShinseIndex = { model: string; dim: number; queryTaskType: string; count: number; chunks: IndexChunk[] };

const INDEX_PATH = path.join(process.cwd(), "src", "lib", "bazi", "shinse-chat-index.generated.json");

let indexPromise: Promise<ShinseIndex | null> | null = null;
async function loadIndex(): Promise<ShinseIndex | null> {
  if (!indexPromise) {
    indexPromise = fs
      .readFile(INDEX_PATH, "utf-8")
      .then((raw) => JSON.parse(raw) as ShinseIndex)
      .catch(() => null);
  }
  return indexPromise;
}

async function embedQuery(text: string, model: string, dim: number, taskType: string, apiKey?: string): Promise<number[] | null> {
  const key = apiKey?.trim() || getGeminiApiKey();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, content: { parts: [{ text }] }, taskType, outputDimensionality: dim }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const v = data.embedding?.values;
  if (!v || v.length === 0) return null;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) s += a[i] * b[i];
  return s;
}

export type ShinsePassage = { id: string; chapter: string; title: string; text: string; score: number };

/**
 * ดึงเนื้อคำอ่านซินแสที่เกี่ยวข้องที่สุด top-K. คืน [] เงียบ ๆ ถ้า index ยังไม่มี/embed ล้ม
 * bookFilter (chapterId) = จำกัดเฉพาะบทที่เกี่ยวกับคำถาม (เพิ่มความตรง) — ว่าง = ทุกบท
 */
export async function retrieveShinsePassages(
  query: string,
  k = 3,
  apiKey?: string,
  bookFilter?: readonly string[],
): Promise<ShinsePassage[]> {
  const index = await loadIndex();
  if (!index || index.chunks.length === 0) return [];
  const q = await embedQuery(query, index.model, index.dim, index.queryTaskType, apiKey);
  if (!q) return [];
  const pool =
    bookFilter && bookFilter.length > 0 ? index.chunks.filter((c) => bookFilter.includes(c.book)) : index.chunks;
  const source = pool.length > 0 ? pool : index.chunks;
  return source
    .map((c) => ({ id: c.id, chapter: c.book, title: c.title, text: c.text, score: dot(q, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

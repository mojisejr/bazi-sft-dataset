/**
 * Retrieval สำหรับแชทบอต Louise Hay: โหลด index ที่ build ไว้ (chunks + embeddings 768 มิติ
 * L2-normalized) แล้วค้นด้วย cosine (= dot product) top-K จากคำถามผู้ใช้.
 *
 * index สร้างจาก scripts/louise-hay/build_index.py -> src/lib/louise-hay/data/louise-hay-index.json
 * โหลดแบบ lazy ด้วย fs ตอน runtime (ไม่ import ตรง ๆ) เพื่อให้แอป compile ได้แม้ยังไม่มีไฟล์
 * และ degrade อย่างนุ่มนวล (ไม่มี grounding) หากไฟล์ยังไม่ถูกสร้าง.
 *
 * server-only.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { getGeminiApiKey } from "@/lib/env";
import type { LouiseHayPassage } from "@/lib/louise-hay/persona";

type IndexChunk = {
  id: string;
  book: string;
  title: string;
  startPage: number | null;
  endPage: number | null;
  text: string;
  embedding: number[];
};

type LouiseHayIndex = {
  model: string;
  dim: number;
  normalized: boolean;
  queryTaskType: string;
  count: number;
  chunks: IndexChunk[];
};

const INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "louise-hay",
  "data",
  "louise-hay-index.json",
);

let indexPromise: Promise<LouiseHayIndex | null> | null = null;

async function loadIndex(): Promise<LouiseHayIndex | null> {
  if (!indexPromise) {
    indexPromise = fs
      .readFile(INDEX_PATH, "utf-8")
      .then((raw) => JSON.parse(raw) as LouiseHayIndex)
      .catch(() => null);
  }
  return indexPromise;
}

/** true ถ้ามี index พร้อมใช้ (ไว้บอกสถานะ grounding ในหน้า UI) */
export async function isIndexReady(): Promise<boolean> {
  const index = await loadIndex();
  return Boolean(index && index.chunks.length > 0);
}

const EMBED_ENDPOINT = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${key}`;

async function embedQuery(
  text: string,
  model: string,
  dim: number,
  taskType: string,
  apiKey?: string,
): Promise<number[] | null> {
  const key = apiKey?.trim() || getGeminiApiKey();
  const res = await fetch(EMBED_ENDPOINT(model, key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: dim,
    }),
  });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values || values.length === 0) {
    return null;
  }
  const norm = Math.sqrt(values.reduce((sum, x) => sum + x * x, 0)) || 1;
  return values.map((x) => x / norm);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export type RetrievedPassage = LouiseHayPassage & { id: string; book: string; score: number };

/**
 * ค้นคำสอนที่เกี่ยวข้องที่สุด top-K. คืน [] อย่างเงียบ ๆ ถ้า index ยังไม่มีหรือ embed ล้มเหลว
 * (แชทยังตอบได้จากหลักคิดหลัก).
 */
export async function retrieveLouiseHayPassages(
  query: string,
  k = 5,
  apiKey?: string,
): Promise<RetrievedPassage[]> {
  const index = await loadIndex();
  if (!index || index.chunks.length === 0) {
    return [];
  }
  const queryVec = await embedQuery(query, index.model, index.dim, index.queryTaskType, apiKey);
  if (!queryVec) {
    return [];
  }
  return index.chunks
    .map((chunk) => ({
      id: chunk.id,
      book: chunk.book,
      title: chunk.title,
      startPage: chunk.startPage,
      endPage: chunk.endPage,
      text: chunk.text,
      score: dot(queryVec, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

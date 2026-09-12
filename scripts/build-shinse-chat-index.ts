/**
 * build-shinse-chat-index — สร้าง "คลังเนื้อคำอ่านจริงของซินแส" สำหรับให้แชทฮีลใจดึงมาอ้างอิง
 *
 * ดึงบทที่ซินแสแก้จริงจาก bazi_newdata_reading (ตัด device "M") → 1 chunk ต่อ (ดวง×บท)
 * ตัดชื่อลูกค้า + ตัด anchor เฉพาะดวง (ก้าน/กิ่งจีน + คำว่า "เสาปี/เดือน/วัน/ยาม") ให้เหลือ "เนื้อแนวทาง"
 * → embed ด้วย gemini-embedding-001 (dim 768, normalized) รูปแบบเดียวกับ louise-hay-index
 *
 * READ-ONLY ต่อ DB · เขียนไฟล์ src/lib/bazi/shinse-chat-index.generated.json
 * รัน: node --env-file=.env --import tsx scripts/build-shinse-chat-index.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDbNewdataReadingRepository } from "@/lib/bazi/newdata-reading-repository";
import { getGeminiApiKey } from "@/lib/env";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

const EMBED_MODEL = "models/gemini-embedding-001";
const DIM = 768;
const MIN_LEN = 60; // เนื้อสั้นกว่านี้ = ไม่มีสาระพอ
const MAX_LEN = 1400; // ตัดยาวเกินกัน chunk อ้วน
const BATCH = 80;
const TOPIC_TITLE = new Map(TOPIC_PATH.map((t) => [t.id, t.title]));

/** ตัด anchor เฉพาะดวง: อักษรจีน (ก้าน/กิ่ง/กะจื่อ) + คำว่าเสา + marker จัดรูป → เหลือเนื้อแนวทาง */
function deidentify(s: string, clientName?: string | null): string {
  let t = s ?? "";
  if (clientName) t = t.split(clientName).join("");
  return t
    .replace(/\[\[[^\]]*\]\]/g, " ") // [[indent]] ฯลฯ
    .replace(/\*\*/g, "")
    .replace(/[㐀-鿿]+/g, "") // อักษรจีน = ก้าน/กิ่ง/กะจื่อเฉพาะดวง
    .replace(/เสา(ปี|เดือน|วัน|ยาม)/g, "") // ป้ายเสา
    .replace(/ราศี(บน|ล่าง)/g, "")
    .replace(/\(\s*\)/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

type EmbedReq = { content: { parts: { text: string }[] }; taskType: string; outputDimensionality: number };

async function batchEmbed(texts: string[], key: string): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:batchEmbedContents?key=${key}`;
  const requests: (EmbedReq & { model: string })[] = texts.map((text) => ({
    model: EMBED_MODEL,
    content: { parts: [{ text }] },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: DIM,
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
  return (data.embeddings ?? []).map((e) => {
    const v = e.values ?? [];
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  });
}

async function main() {
  const repo = createDbNewdataReadingRepository();
  const listed = await repo.list();

  type Chunk = { id: string; book: string; title: string; startPage: null; endPage: null; text: string };
  const chunks: Chunk[] = [];
  const seen = new Set<string>();
  let charts = 0;

  for (const it of listed) {
    if ((it.deviceLabel ?? "").trim().toLowerCase() === "m") continue;
    const row = await repo.get(it.id);
    if (!row) continue;
    const boxesByChapter = row.edits?.boxes ?? {};
    const chapterIds = Object.keys(boxesByChapter);
    if (chapterIds.length === 0) continue;
    charts += 1;
    for (const chapterId of chapterIds) {
      const boxes = boxesByChapter[chapterId];
      if (!Array.isArray(boxes) || boxes.length === 0) continue;
      const merged = boxes
        .map((b) => `${b.title ? `【${b.title}】 ` : ""}${b.body ?? ""}`)
        .join("\n");
      let text = deidentify(merged, row.clientName);
      if (text.length < MIN_LEN) continue;
      if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
      const dedupKey = text.replace(/\s+/g, " ").slice(0, 120);
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      chunks.push({
        id: `${chapterId}-${chunks.length}`,
        book: chapterId,
        title: TOPIC_TITLE.get(chapterId) ?? chapterId,
        startPage: null,
        endPage: null,
        text,
      });
    }
  }

  console.log(`ดวง (ตัด M): ${charts} · chunks (dedup): ${chunks.length} · กำลัง embed...`);
  const key = getGeminiApiKey();
  const embedded: (Chunk & { embedding: number[] })[] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vecs = await batchEmbed(slice.map((c) => c.text), key);
    slice.forEach((c, j) => embedded.push({ ...c, embedding: vecs[j] ?? [] }));
    console.log(`  embed ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }
  const withEmb = embedded.filter((c) => c.embedding.length === DIM);

  const out = {
    model: EMBED_MODEL,
    dim: DIM,
    normalized: true,
    queryTaskType: "RETRIEVAL_QUERY",
    count: withEmb.length,
    chunks: withEmb,
  };
  const outPath = resolve(process.cwd(), "src/lib/bazi/shinse-chat-index.generated.json");
  writeFileSync(outPath, JSON.stringify(out), "utf8");
  console.log(`เขียนแล้ว → ${outPath} (${withEmb.length} chunks, dim ${DIM})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

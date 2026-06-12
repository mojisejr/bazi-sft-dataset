/**
 * One-time cleaner for src/lib/bazi/data/phone/phone-pair-meanings.json.
 *
 * The text was extracted from a PDF with pdftotext, which leaves Thai vowels /
 * tone marks slightly reordered or dropped (e.g. "วเิ คราะห" → "วิเคราะห์",
 * "ดว้ ย" → "ด้วย"). This script asks Gemini to re-spell the Thai so it reads
 * naturally — WITHOUT changing, adding, or removing any meaning — and rewrites
 * the JSON in place (a .bak copy is kept).
 *
 * Usage:
 *   npx tsx scripts/clean-phone-pair-meanings.ts            # clean all 55 pairs
 *   npx tsx scripts/clean-phone-pair-meanings.ts 00 45 16   # clean specific keys
 *   DRY_RUN=1 npx tsx scripts/clean-phone-pair-meanings.ts  # print one sample, no write
 */
import path from "node:path";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";

import { config as loadEnv } from "dotenv";
import { GoogleGenAI } from "@google/genai";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const DATA_PATH = path.resolve(
  process.cwd(),
  "src/lib/bazi/data/phone/phone-pair-meanings.json",
);
const MODEL = process.env.PHONE_CLEAN_MODEL?.trim() || "gemini-3-flash-preview";
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 5;
const FIELDS = ["feeling", "work", "money", "love", "analysis"] as const;

type Field = (typeof FIELDS)[number];
type PairMeaning = { pair: string } & Record<Field, string>;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(FIELDS.map((f) => [f, { type: "string" }])),
  required: [...FIELDS],
} as const;

const SYSTEM_INSTRUCTION = [
  "คุณเป็นบรรณาธิการพิสูจน์อักษรภาษาไทย",
  "ข้อความที่ได้รับถูกสกัดจากไฟล์ PDF ทำให้สระและวรรณยุกต์เรียงสลับตำแหน่งหรือตกหล่นบางตัว อ่านยาก",
  "หน้าที่ของคุณคือ 'จัดเรียง/เติมสระ-วรรณยุกต์ให้ถูกต้อง' เพื่อให้อ่านเป็นภาษาไทยปกติ",
  "ห้ามเปลี่ยนความหมาย ห้ามเพิ่มเนื้อหาใหม่ ห้ามตัดเนื้อหาเดิม ห้ามสรุปย่อ ห้ามแต่งเติม",
  "ห้ามซ้ำคำ ห้ามเพิ่มอักษรหรือพยางค์ที่ไม่มีในต้นฉบับ (เช่น อย่าทำ 'มีความ' ให้กลายเป็น 'มีมีความ')",
  "คงคำศัพท์เฉพาะ ตัวเลข ชื่อดาว/ธาตุ และลำดับประโยคเดิมไว้ทั้งหมด แก้เฉพาะการสะกดให้ถูก",
  "เว้นวรรคให้เป็นธรรมชาติแบบภาษาไทย (คำในวลีเดียวกันไม่ต้องมีช่องว่างคั่นกลางคำ)",
  "ตอบกลับเป็น JSON ตามสคีมาที่กำหนด โดยมีครบทุกฟิลด์",
].join(" ");

function buildPrompt(meaning: PairMeaning) {
  const payload = Object.fromEntries(FIELDS.map((f) => [f, meaning[f] ?? ""]));
  return [
    `จัดเรียงตัวสะกดของคำทำนายคู่เลข ${meaning.pair} ต่อไปนี้ให้อ่านถูกต้อง โดยคงเนื้อหาเดิมทุกประการ:`,
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cleanOne(ai: GoogleGenAI, meaning: PairMeaning): Promise<PairMeaning> {
  let delay = 1500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildPrompt(meaning),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          // This is benign Thai proofreading; some พยากรณ์ text mentions โรค/อุบัติเหตุ
          // which trips the default safety filter and returns an empty body. Relax it.
          safetySettings: [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
            "HARM_CATEGORY_CIVIC_INTEGRITY",
          ].map((category) => ({ category, threshold: "BLOCK_NONE" })),
        },
      });
      const text = response.text?.trim();
      if (!text) throw new Error("empty response");
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const out: PairMeaning = { pair: meaning.pair } as PairMeaning;
      for (const f of FIELDS) {
        const v = typeof parsed[f] === "string" ? (parsed[f] as string).trim() : "";
        // never let the cleaner blank out a field — fall back to original
        out[f] = v.length > 0 ? v : meaning[f];
      }
      return out;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      const msg = error instanceof Error ? error.message.toLowerCase() : "";
      const retryable = /429|quota|rate|503|500|timeout|json|empty/.test(msg);
      if (!retryable) break;
      await sleep(delay);
      delay *= 2;
    }
  }
  console.warn(`  ! pair ${meaning.pair} failed, keeping original:`, lastError instanceof Error ? lastError.message : lastError);
  return meaning;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY ไม่พบใน .env / .env.local");
  }
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as Record<string, PairMeaning>;
  const dryRun = process.env.DRY_RUN === "1";
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // A field is still "raw" (from pdftotext) if it has a space immediately before a
  // Thai combining vowel/tone mark — natural Thai never does. Cleaned text won't match,
  // so re-runs only touch what's left (resumable).
  const RAW_RE = /[  ][ัิ-ฺ็-๎]/u;
  const isRaw = (m: PairMeaning) => FIELDS.some((f) => RAW_RE.test(m[f] ?? ""));

  if (dryRun) {
    const k = Object.keys(data).find((key) => isRaw(data[key])) ?? Object.keys(data)[0];
    const cleaned = await cleanOne(ai, data[k]);
    console.log("=== DRY RUN sample pair", k, "===");
    for (const f of FIELDS) {
      console.log(`\n[${f}] BEFORE:\n${data[k][f]}\n[${f}] AFTER:\n${cleaned[f]}`);
    }
    return;
  }

  const onlyKeys = process.argv.slice(2).filter((a) => /^\d{2}$/.test(a));
  const keys = (onlyKeys.length ? onlyKeys : Object.keys(data).filter((k) => isRaw(data[k]))).filter(
    (k) => data[k],
  );
  const skipped = Object.keys(data).length - keys.length;

  if (keys.length === 0) {
    console.log("ทุกคู่เกลาเรียบร้อยแล้ว ไม่มีอะไรต้องทำ");
    return;
  }

  // back up the original once, before the first write
  if (!existsSync(`${DATA_PATH}.bak`)) {
    copyFileSync(DATA_PATH, `${DATA_PATH}.bak`);
    console.log("backup written:", `${DATA_PATH}.bak`);
  }

  console.log(
    `cleaning ${keys.length} pairs with ${MODEL} (concurrency ${CONCURRENCY})` +
      (skipped > 0 ? `, skipped ${skipped} already-clean` : "") +
      "...",
  );
  let done = 0;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((k) => cleanOne(ai, data[k])));
    batch.forEach((k, idx) => {
      data[k] = results[idx];
    });
    // persist after every batch so progress survives interruption and the page updates
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    done += batch.length;
    console.log(`  ${done}/${keys.length}`);
  }
  console.log("wrote", DATA_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

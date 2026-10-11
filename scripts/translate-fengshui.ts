/**
 * แปลไพ่อาถรรพ์ฮวงจุ้ยเคี้ยงคุง (78 ใบ) เป็นอังกฤษ → src/lib/bazi/data/fengshui-cards.en.json
 * (name/meaning/caution/advice) + ไฟล์ตรวจสำนวนให้พี่โบ knownlage/fengshui/fengshui-en-review.md (ไทย | อังกฤษ)
 * ซินแสนุ้ย 2026-10-07: "ทำภาษาอังกฤษได้เลย" — เวอร์ชันนี้เตรียมไทย+อังกฤษในตัว
 *
 * Usage: npx tsx scripts/translate-fengshui.ts          (ข้ามใบที่แปลแล้ว — รันซ้ำได้)
 *        npx tsx scripts/translate-fengshui.ts --force  (แปลใหม่ทั้งหมด)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { GoogleGenAI, type SafetySetting } from "@google/genai";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src", "lib", "bazi", "data", "fengshui-cards.json");
const OUT = path.join(ROOT, "src", "lib", "bazi", "data", "fengshui-cards.en.json");
const REVIEW = path.join(ROOT, "knownlage", "fengshui", "fengshui-en-review.md");
const MODEL = process.env.FENGSHUI_TRANSLATE_MODEL?.trim() || "gemini-3-flash-preview";
const FORCE = process.argv.includes("--force");

type Card = { no: number; name: string; meaning: string; caution: string; advice: string; imageUrl?: string | null };
type En = Pick<Card, "no" | "name" | "meaning" | "caution" | "advice">;

// ชื่อบางใบในตำราพิมพ์ต่างจากชื่อบนรูปไพ่ (11: ตำรา "จานกันดอกไม้" แต่รูป "แจกันดอกไม้") — ให้ชื่ออังกฤษตามรูป
const NAME_OVERRIDE: Record<number, string> = { 11: "Flower Vase" };

const INSTRUCTION = [
  "You are translating a Thai feng shui oracle card book (Master Nui) into natural, warm, fluent English for international readers.",
  "Each card is a place/object that disturbs feng shui energy (a 'cursed' spot). Input JSON has name, meaning, caution, advice (Thai).",
  "Translate EVERY Thai string into English. Keep the exact same JSON keys and shape. Do not translate keys.",
  "'name' must become a short natural English card title (2-5 words, Title Case). Faithful translation: do not add, drop or soften ideas.",
  "Chinese/feng shui terms: keep the concept in plain English (Qi, Yin-Yang, Five Elements, Sha Qi / killing energy where the text means it).",
  "Return only the JSON.",
].join(" ");

const safetySettings = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_NONE" })) as unknown as SafetySetting[];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hasThai = (s: string) => /[฀-๿]/.test(s);

/** โมเดลบางครั้งปิดวงเล็บเกิน → ตัด "}" ท้ายทีละตัวจน parse ได้ */
function parseLoose(text: string): unknown {
  let t = text.trim();
  for (let i = 0; i < 4; i += 1) {
    try {
      return JSON.parse(t);
    } catch (error) {
      if (!t.endsWith("}")) throw error;
      t = t.slice(0, -1).trimEnd();
    }
  }
  return JSON.parse(t);
}

async function translate(ai: GoogleGenAI, card: Card): Promise<En | null> {
  const input = { name: card.name, meaning: card.meaning, caution: card.caution, advice: card.advice };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: `${INSTRUCTION}\n\n${JSON.stringify(input)}`,
        config: { temperature: 0.2, responseMimeType: "application/json", safetySettings },
      });
      const en = parseLoose(res.text ?? "") as En;
      const out: En = {
        no: card.no,
        name: NAME_OVERRIDE[card.no] ?? en.name,
        meaning: en.meaning,
        caution: en.caution,
        advice: en.advice,
      };
      if (out.name && out.meaning && out.caution && out.advice && !hasThai(JSON.stringify(out))) return out;
      throw new Error("empty field or Thai left");
    } catch (error) {
      console.warn(`  #${card.no} attempt ${attempt}:`, error instanceof Error ? error.message : error);
      await sleep(1500 * attempt);
    }
  }
  return null;
}

const cell = (s: string) => (s ?? "").replace(/\|/g, "\|").replace(/\n/g, "<br>");

function reviewDoc(th: Card[], en: Map<number, En>): string {
  const out = ["# Feng Shui Oracle Cards — English review (TH | EN)", "", "สำหรับพี่โบตรวจสำนวน — แก้ในคอลัมน์ EN แล้วส่งกลับมาได้เลย", ""];
  for (const t of th) {
    const e = en.get(t.no);
    if (!e) continue;
    out.push(
      `## ${t.no}. ${t.name} — ${e.name}`, "", "| field | ไทย | English |", "|---|---|---|",
      `| name | ${cell(t.name)} | ${cell(e.name)} |`,
      `| meaning | ${cell(t.meaning)} | ${cell(e.meaning)} |`,
      `| caution | ${cell(t.caution)} | ${cell(e.caution)} |`,
      `| advice | ${cell(t.advice)} | ${cell(e.advice)} |`,
      "",
    );
  }
  return out.join("\n");
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const th = JSON.parse(readFileSync(SRC, "utf8")) as Card[];
  const prev = !FORCE && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as En[]) : [];
  const done = new Map(prev.map((c) => [c.no, c]));
  const save = () => writeFileSync(OUT, JSON.stringify([...done.values()].sort((a, b) => a.no - b.no), null, 1) + "\n", "utf8");

  const todo = th.filter((c) => !done.has(c.no));
  console.log(`แปล ${todo.length} ใบ (แปลแล้ว ${done.size}) ด้วย ${MODEL}`);
  const failed: number[] = [];
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const res = await Promise.all(batch.map((c) => translate(ai, c)));
    res.forEach((en, j) => (en ? done.set(en.no, en) : failed.push(batch[j].no)));
    save();
    console.log(`  ${done.size}/${th.length}`);
  }
  writeFileSync(REVIEW, reviewDoc(th, done) + "\n", "utf8");
  console.log(`→ ${path.relative(ROOT, OUT)} · ไฟล์ตรวจ ${path.relative(ROOT, REVIEW)}`);
  if (failed.length) console.log("⚠️ แปลไม่ผ่าน (รันซ้ำ):", failed.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

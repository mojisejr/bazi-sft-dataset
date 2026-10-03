/**
 * แปลตำราไพ่ทาโรต์ซินแสนุ้ย (เล่ม 2) เป็นภาษาอังกฤษ → src/lib/bazi/data/tarot-sinsae.en.json
 * โครงเดียวกับ tarot-sinsae.json (ตัวเลข % คงเดิม) — ซินแสนุ้ย 2026-10-03: ทำเวอร์ชันไทย+อังกฤษในตัว,
 * พี่โบเป็นคนตรวจสำนวนอังกฤษ → สคริปต์เขียนไฟล์ตรวจ knownlage/tarot/sinsae-tarot-en-review.md (ไทย|อังกฤษ คู่กัน)
 *
 * Usage: npx tsx scripts/translate-tarot-sinsae.ts          (ข้ามใบที่แปลแล้ว — รันซ้ำได้)
 *        npx tsx scripts/translate-tarot-sinsae.ts --force  (แปลใหม่ทั้งหมด หลังแก้ตำราไทย)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { GoogleGenAI, type SafetySetting } from "@google/genai";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src", "lib", "bazi", "data", "tarot-sinsae.json");
const OUT = path.join(ROOT, "src", "lib", "bazi", "data", "tarot-sinsae.en.json");
const REVIEW = path.join(ROOT, "knownlage", "tarot", "sinsae-tarot-en-review.md");
const MODEL = process.env.TAROT_TRANSLATE_MODEL?.trim() || "gemini-3-flash-preview";
const FORCE = process.argv.includes("--force");

type Energy = { positive: number; negative: number; note: string } | null;
type Side = { positive: string; negative: string; energy: Energy };
type Card = {
  no: number;
  name: string;
  meaning: string;
  core: Side;
  oracle: ({ symbol: string; description: string } & Side)[];
  general: string;
  finance: string;
  career: string;
  health: string;
  family: string;
  love: string;
  reversed: string;
  reversedCore: Side;
};

const INSTRUCTION = [
  "You are translating a Thai tarot master's book (Master Nui) into natural, warm, fluent English for international readers.",
  "Translate EVERY Thai string in the JSON into English. Keep the exact same JSON shape and keys.",
  "Do not translate keys. Keep all numbers unchanged. Keep markdown bullets, line breaks and emoji.",
  "Keep the card name as given. Translate meaning faithfully: do not add, drop or soften ideas.",
  "Chinese/Taoist terms: keep the concept, write it in English (e.g. Qi, Yin-Yang, filial piety).",
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

/** ตรวจว่าโครงตรงกับต้นฉบับ (จำนวนสัญลักษณ์, %) และไม่เหลือภาษาไทย */
function valid(src: Card, en: Card): boolean {
  if (!en || en.no !== src.no || en.oracle?.length !== src.oracle.length) return false;
  const pctSame = (a: Energy, b: Energy) => (a ? !!b && a.positive === b.positive && a.negative === b.negative : true);
  if (!pctSame(src.core.energy, en.core?.energy) || !pctSame(src.reversedCore.energy, en.reversedCore?.energy)) return false;
  if (!src.oracle.every((o, i) => pctSame(o.energy, en.oracle[i].energy))) return false;
  return !hasThai(JSON.stringify(en));
}

/** โมเดลบางครั้งปิดวงเล็บเกิน (เช่น Three of Pentacles) → ตัด "}" ท้ายทีละตัวจน parse ได้ */
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

async function translate(ai: GoogleGenAI, card: Card): Promise<Card | null> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: `${INSTRUCTION}\n\n${JSON.stringify(card)}`,
        config: { temperature: 0.2, responseMimeType: "application/json", safetySettings },
      });
      const en = parseLoose(res.text ?? "") as Card;
      en.no = card.no;
      en.name = card.name;
      if (valid(card, en)) return en;
      throw new Error("shape/% mismatch or Thai left");
    } catch (error) {
      console.warn(`  #${card.no} attempt ${attempt}:`, error instanceof Error ? error.message : error);
      await sleep(1500 * attempt);
    }
  }
  return null;
}

function reviewDoc(th: Card[], en: Map<number, Card>): string {
  const cell = (s: string) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  const sideRows = (label: string, a: Side, b: Side) => [
    `| ${cell(label)} · good | ${cell(a.positive)} | ${cell(b.positive)} |`,
    `| ${cell(label)} · bad | ${cell(a.negative)} | ${cell(b.negative)} |`,
    ...(a.energy?.note ? [`| ${cell(label)} · energy note | ${cell(a.energy.note)} | ${cell(b.energy?.note ?? "")} |`] : []),
  ];
  const out = ["# Master Nui's Tarot — English review (TH | EN)", "", "สำหรับพี่โบตรวจสำนวน — แก้ในคอลัมน์ EN แล้วส่งกลับมาได้เลย", ""];
  for (const t of th) {
    const e = en.get(t.no);
    if (!e) continue;
    const rows: string[] = ([
      [ "meaning", t.meaning, e.meaning ],
      [ "general", t.general, e.general ],
      [ "finance", t.finance, e.finance ],
      [ "career", t.career, e.career ],
      [ "health", t.health, e.health ],
      [ "family", t.family, e.family ],
      [ "love", t.love, e.love ],
      [ "reversed", t.reversed, e.reversed ],
    ] as const).map(([k, a, b]) => `| ${k} | ${cell(a)} | ${cell(b)} |`);
    out.push(
      `## ${t.no}. ${t.name}`, "", "| field | ไทย | English |", "|---|---|---|",
      ...sideRows("core", t.core, e.core),
      ...t.oracle.flatMap((o, i) => [
        `| oracle · ${cell(o.symbol)} | ${cell(o.description)} | ${cell(e.oracle[i].symbol)}: ${cell(e.oracle[i].description)} |`,
        ...sideRows(`oracle · ${o.symbol}`, o, e.oracle[i]),
      ]),
      ...rows,
      ...sideRows("reversed", t.reversedCore, e.reversedCore),
      "",
    );
  }
  return out.join("\n");
}

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const th = JSON.parse(readFileSync(SRC, "utf8")) as Card[];
  const prev = !FORCE && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as Card[]) : [];
  const done = new Map(prev.map((c) => [c.no, c]));
  const save = () => writeFileSync(OUT, JSON.stringify([...done.values()].sort((a, b) => a.no - b.no), null, 1) + "\n", "utf8");

  const todo = th.filter((c) => !done.has(c.no));
  console.log(`แปล ${todo.length} ใบ (แปลแล้ว ${done.size}) ด้วย ${MODEL}`);
  const failed: string[] = [];
  // ทีละ 4 ใบพร้อมกัน, บันทึกทุกชุด (หยุดกลางทางแล้วรันต่อได้)
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    const res = await Promise.all(batch.map((c) => translate(ai, c)));
    res.forEach((en, j) => (en ? done.set(en.no, en) : failed.push(batch[j].name)));
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

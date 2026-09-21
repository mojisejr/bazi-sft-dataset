/**
 * Gen "คำทำนายรายด้าน 15 ด้าน" ต่อใบ อ้างอิงจากเนื้อไพ่เดิม — ทั้ง divine (80) + sage (60)
 * (เอ็ม/ซินแสนุ้ย 2026-09-21: ไม่เอาว่าง ให้ gen ไว้เลยแบบ 15 ด้านเหมือน oracle ซินแสมาแก้ทับทีหลัง)
 *
 * รัน:  node --env-file=.env --import tsx scripts/gen-fortune-aspects.ts divine
 *       node --env-file=.env --import tsx scripts/gen-fortune-aspects.ts sage
 *       (ไม่ใส่ arg = ทั้งคู่)   ·   --force = gen ทับใบที่มีอยู่แล้ว
 *
 * ground จากเนื้อไพ่เดิมเท่านั้น (ห้ามแต่งข้อเท็จจริงนอกไพ่) เขียนลงดิสก์ทีละใบ → resume ได้
 */
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { ASPECT15_KEYS, ASPECT15_LABELS, type Aspect15 } from "../src/lib/bazi/aspect15";

const MODEL = "gemini-3.1-flash-lite";
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) throw new Error("ต้องมี GEMINI_API_KEY ใน .env");
const ai = new GoogleGenAI({ apiKey: API_KEY });

const ROOT = process.cwd(); // รันจาก repo root เสมอ (npm/node --env-file)
const FORCE = process.argv.includes("--force");

type DeckConfig = {
  key: "divine" | "sage";
  srcPath: string;
  outPath: string;
  /** ทำ context string จาก 1 ใบ (เนื้อที่ให้ LLM ยึด) + seed aspects (ด้านที่มีข้อมูลจริงอยู่แล้ว) */
  toEntry: (card: any) => { no: number; label: string; context: string; seed: Partial<Aspect15> };
};

const LABELS_LIST = ASPECT15_KEYS.map((k) => `${k} (${ASPECT15_LABELS[k]})`).join(", ");

const SYSTEM = [
  'คุณคือซินแสผู้เชี่ยวชาญไพ่พยากรณ์ กำลังถอด "คำทำนายรายด้าน" ของไพ่ 1 ใบออกเป็น 15 ด้าน',
  "ยึดจากเนื้อไพ่ที่ให้มาเท่านั้น (ความหมาย/คีย์เวิร์ด/ภาพ/องค์เทพ) — ตีความเชิงสัญลักษณ์ได้ แต่ห้ามแต่งข้อเท็จจริงที่ขัดกับไพ่",
  "แต่ละด้านเขียนสั้น กระชับ 1 วลี/ประโยค (ราว 8-22 คำ) เป็นภาษาไทย ให้ 'ตรงด้านนั้น' เพื่อให้ AI เอาไปร้อยเรื่องต่อได้",
  "ด้านที่ไพ่ไม่ได้ระบุตรง ๆ (เช่น ธาตุ/สี/ทิศ/สถานที่/เทพ/สัตว์/รูปลักษณ์) ให้อนุมานค่าที่ 'เข้ากับ' โทน/ภาพของไพ่แบบพยากรณ์ (ห้ามเว้นว่าง)",
  "โทนเป็นกลาง ไม่ลงท้าย ครับ/ค่ะ ไม่เอ่ยกลไกเบื้องหลัง",
  "",
  `ตอบเป็น JSON object เท่านั้น (ไม่มี code fence ไม่มีคำอธิบาย) มีคีย์ครบ 15 คีย์นี้พอดี: ${LABELS_LIST}`,
  "ค่าของแต่ละคีย์เป็นสตริงภาษาไทย",
].join("\n");

const DECKS: Record<string, DeckConfig> = {
  divine: {
    key: "divine",
    srcPath: "src/lib/bazi/data/divine-cards.json",
    outPath: "src/lib/bazi/data/divine-cards-topics.json",
    toEntry: (c) => ({
      no: c.no,
      label: c.name,
      context: [
        `ชื่อไพ่: ${c.name} (${c.keywordEn})`,
        `หมวด/องค์เทพ: ${c.group}`,
        `คีย์เวิร์ด: ${c.keywords}`,
        `ภาพของไพ่: ${c.lifeImage}`,
        `คำพยากรณ์: ${c.prophecy}`,
      ].join("\n"),
      seed: {},
    }),
  },
  sage: {
    key: "sage",
    srcPath: "src/lib/bazi/data/fortune-sage.json",
    outPath: "src/lib/bazi/data/fortune-sage-topics.json",
    toEntry: (s) => ({
      no: s.no,
      label: `${s.pillar} · ${s.nayin}`,
      context: [
        `หัวเซี่ยงแซ: ${s.pillar} · นาหยิน ${s.nayin} · องค์เทพ ${s.deity}`,
        `นิสัย/ภาพรวม: ${s.personality}`,
        `การงาน(จริง): ${s.topics?.career ?? ""}`,
        `การเงิน(จริง): ${s.topics?.finance ?? ""}`,
        `สุขภาพ(จริง): ${s.topics?.health ?? ""}`,
        `ความรัก(จริง): ${s.topics?.love ?? ""}`,
        `ครอบครัว(จริง): ${s.topics?.family ?? ""}`,
      ].join("\n"),
      // คงข้อมูลจริง 5 ด้านไว้ (ไม่ให้ LLM ทับ) — เติมอีก 10 ด้านเท่านั้น
      seed: {
        work: (s.topics?.career ?? "").trim(),
        wealth: (s.topics?.finance ?? "").trim(),
        health: (s.topics?.health ?? "").trim(),
        love: (s.topics?.love ?? "").trim(),
        family: (s.topics?.family ?? "").trim(),
      },
    }),
  },
};

function extractJson(text: string): Record<string, string> | null {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(t.slice(start, end + 1));
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function isFull(a: Partial<Aspect15> | undefined): boolean {
  return !!a && ASPECT15_KEYS.every((k) => (a[k] ?? "").trim().length > 0);
}

async function genOne(context: string): Promise<Aspect15 | null> {
  const r = await ai.models.generateContent({
    model: MODEL,
    contents: `เนื้อไพ่:\n${context}\n\nถอดเป็น JSON 15 ด้านตามกฎ`,
    config: { systemInstruction: SYSTEM, temperature: 0.6 },
  });
  const obj = extractJson(r.text ?? "");
  if (!obj) return null;
  const out = {} as Aspect15;
  for (const k of ASPECT15_KEYS) out[k] = String(obj[k] ?? "").trim();
  return out;
}

async function runDeck(cfg: DeckConfig): Promise<void> {
  const src = JSON.parse(readFileSync(resolve(ROOT, cfg.srcPath), "utf8")) as any[];
  const outAbs = resolve(ROOT, cfg.outPath);
  const bank: Record<string, unknown> = existsSync(outAbs)
    ? JSON.parse(readFileSync(outAbs, "utf8"))
    : {};
  const header =
    (bank._comment as string) ??
    `คลัง keyword รายด้าน 15 ด้าน (gen จากเนื้อไพ่ ${cfg.key}) — ซินแสแก้ทับได้. ด้าน: ${LABELS_LIST}`;

  const limit = process.env.GEN_LIMIT ? Number(process.env.GEN_LIMIT) : Infinity;
  let done = 0;
  let genned = 0;
  for (const raw of src) {
    if (genned >= limit) break;
    const { no, label, context, seed } = cfg.toEntry(raw);
    const existing = bank[String(no)] as Partial<Aspect15> | undefined;
    if (!FORCE && isFull(existing)) {
      done += 1;
      continue;
    }
    process.stdout.write(`[${cfg.key} #${no}] ${label} … `);
    let result: Aspect15 | null = null;
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      try {
        result = await genOne(context);
      } catch (e) {
        process.stdout.write(`(retry ${attempt + 1}: ${(e as Error).message.slice(0, 60)}) `);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (!result) {
      console.log("FAILED — ข้าม");
      continue;
    }
    // seed (ข้อมูลจริง) ทับผล LLM เพื่อคงของจริงไว้
    for (const [k, v] of Object.entries(seed)) {
      if (v && (v as string).trim()) result[k as keyof Aspect15] = v as string;
    }
    bank[String(no)] = result;
    bank._comment = header;
    writeFileSync(outAbs, JSON.stringify(bank, null, 2) + "\n");
    genned += 1;
    console.log("ok");
  }
  console.log(`\n== ${cfg.key}: gen ${genned} ใบ, มีอยู่แล้ว ${done} ใบ, รวม src ${src.length} ==`);
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const targets = arg ? [arg] : ["divine", "sage"];
  for (const t of targets) {
    const cfg = DECKS[t];
    if (!cfg) throw new Error(`ไม่รู้จัก deck: ${t} (ใช้ divine|sage)`);
    await runDeck(cfg);
  }
}

void main();

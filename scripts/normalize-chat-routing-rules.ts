/**
 * Normalize "รวมคำถามสำหรับ AI.xlsx" (โน้ตซินแสแก้หลักการ routing ของแชทฮีลใจ) ให้เป็น JSON ที่เครื่องอ่านได้
 *
 * ที่มา: คอลัมน์ C = หลักการใหม่ (ซินแสแก้), คอลัมน์ D = หลักการเก่า (ตรงกับ grounding-router.ts วันนี้)
 *
 * สคริปต์นี้ยัง "ไม่ตัดสิน" ว่า router ต้องแก้อะไร — หน้าที่คือ
 *   1. แกะโน้ตมือเป็น field ที่ query ได้ (signals / positions / relations / cards / gender / weights)
 *   2. รวมสะกดที่เขียนหลายแบบให้เป็นคำเดียว (เซียงแซ/เซี่ยงแซ/เชี่ยงแซ → เซียงแซ ฯลฯ)
 *   3. แยก 2 ชุดคำที่ซินแสเขียนปนกันในช่องเดียว = "12 เซียงแซ" (สภาวะ) vs "ความสัมพันธ์ราศีล่าง/ดาว"
 *   4. ชี้คำที่ยังกำกวม (needsReview) ให้ซินแสเคาะ พร้อม snippet ต้นฉบับกำกับ
 *
 * Usage:
 *   npm run normalize:chat-rules
 *   npx tsx scripts/normalize-chat-routing-rules.ts ["path/to.xlsx"]
 *
 * Output:
 *   src/lib/louise-hay/data/chat-routing-rules.json   (tracked — ของจริงที่งานถัดไปอ่าน)
 *   out/chat-routing-review.md                        (gitignored — ตารางให้ซินแสเคาะ)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import ExcelJS from "exceljs";

const DEFAULT_SRC = "รวมคำถามสำหรับ AI.xlsx";
const OUT_JSON = "src/lib/louise-hay/data/chat-routing-rules.json";
const OUT_REVIEW = "out/chat-routing-review.md";
const REFERENCE_SHEET = "อ้างอิง";

/* ────────────────────────────────────────────────────────────────────────────
 * ชุดคำ (glossary) — แยก 2 ชุดที่ซินแสเขียนปนกัน
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ชุด A: 12 เซียงแซ (สภาวะของธาตุ/เสา) — ชื่อ+คะแนนอ้างจาก stage-legend.json
 * ซึ่งชื่อตรงกับ TWELVE_QI_LABELS_TH ใน symbolic-engine.constants.ts ทั้ง 12 ตัว
 * `score` คือคะแนน 0–110 ของ almanac ใช้เป็นเกณฑ์ ดี/กลาง/เสีย ได้ (รอซินแสเคาะจุดตัด)
 */
const STAGES: { canon: string; zh: string; score: number; alias: string[]; needsReview?: string }[] = [
  { canon: "เชี่ยงแซ", zh: "长生", score: 80, alias: [] },
  { canon: "หมกยก", zh: "沐浴", score: 40, alias: ["มกยก"] },
  { canon: "กวงตั่ว", zh: "冠带", score: 90, alias: [] },
  { canon: "ลิ่มกัว", zh: "临官", score: 100, alias: ["ลิ่มกั้ว", "ลิ่มกั๊ว"] },
  { canon: "ตี้อ๋วง", zh: "帝旺", score: 110, alias: [] },
  // ซินแสเคาะแล้ว: "ซวย" ในโน้ตนี้คือชื่อสภาวะ 衰 เสมอ ไม่ใช่คำพูดทั่วไป → ไม่ต้องติดธงอีก
  { canon: "ซวย", zh: "衰", score: 30, alias: [] },
  { canon: "แป่", zh: "病", score: 20, alias: [] },
  // คำสั้น (ซี่/หมอ/ทอ) ไม่ติดธงเหมารวมอีกแล้ว — ตรวจ snippet ทุกจุดแล้วเป็นชื่อสภาวะจริงทั้งหมด
  // ตัวกัน false positive ที่ได้ผลจริงคือ BLOCKED_SUBSTRING_OF + ธง glued ไม่ใช่ธง "คำนี้สั้น"
  { canon: "ซี่", zh: "死", score: 10, alias: [] },
  { canon: "หมอ", zh: "墓", score: 50, alias: [] },
  { canon: "เจ๊าะ", zh: "绝", score: 0, alias: ["เจาะ"] },
  { canon: "ทอ", zh: "胎", score: 60, alias: [] },
  { canon: "เอี๊ยง", zh: "养", score: 70, alias: ["เอี้ยง"] },
];

/**
 * เกณฑ์ตัดสินสภาวะ — ซินแสเคาะเป็น **5 ระดับ** (ไม่ใช่ 3 ระดับอย่างที่เดาไว้ตอนแรก)
 *   ดีมาก   ≥ 90  : ตี้อ๋วง 110 · ลิ่มกัว 100 · กวงตั่ว 90
 *   ดี      70–80 : เชี่ยงแซ 80 · เอี๊ยง 70
 *   กลาง    50–60 : ทอ 60 · หมอ 50
 *   เสีย    30–40 : หมกยก 40 · ซวย 30
 *   เสียมาก ≤ 20  : แป่ 20 · ซี่ 10 · เจ๊าะ 0
 */
export type StageVerdict = "ดีมาก" | "ดี" | "กลาง" | "เสีย" | "เสียมาก";

const STAGE_VERDICT_BANDS: { verdict: StageVerdict; min: number }[] = [
  { verdict: "ดีมาก", min: 90 },
  { verdict: "ดี", min: 70 },
  { verdict: "กลาง", min: 50 },
  { verdict: "เสีย", min: 30 },
  { verdict: "เสียมาก", min: 0 },
];

function stageVerdict(score: number): StageVerdict {
  return STAGE_VERDICT_BANDS.find((b) => score >= b.min)!.verdict;
}

/** ชุด B: ความสัมพันธ์ราศีล่าง + ดาว — คนละเรื่องกับ 12 เซียงแซ (มีในเอนจินแยกกันอยู่แล้ว) */
const RELATIONS: { canon: string; zh: string; meaning: string; alias: string[]; needsReview?: string }[] = [
  { canon: "ฮะ", zh: "合", meaning: "ราศีล่างเข้ากัน/ผูกพัน", alias: [] },
  // ซินแสเขียนทั้ง "ซง" (ภายในดวง) และ "ปีซง/ปีชง" (จรปี) — เป็น 冲 ตัวเดียวกัน ต่างกันที่ชั้นที่ไปกระทบ
  // ซึ่งจับแยกอยู่แล้วใน field `layers` / `positions` จึงไม่ต้องติดธงกำกวมที่ตัวคำ
  { canon: "ซง", zh: "冲", meaning: "ชน/เปลี่ยนแปลงกระทันหัน", alias: ["ชง"] },
  { canon: "เฮ้ง", zh: "刑", meaning: "ทำโทษ/ขัดแย้ง", alias: [] },
  // ครบชุด 4 ตัวตามที่โปรเจกต์เรียกเอง = "ตารางชงเฮ้งไห่ผั่ว" (canonical-knowledge.ts:577)
  { canon: "ไห่", zh: "害", meaning: "เบียดเบียน/บาดหมาง", alias: [] },
  { canon: "ผั่ว", zh: "破", meaning: "ทำลาย/แตกหัก", alias: [] },
  { canon: "กุ้ยนั้ง", zh: "贵人", meaning: "ผู้อุปถัมภ์/คนช่วยเหลือ", alias: ["กุ้ยนั่ง", "กุ้ยนัง"] },
];

/** ชั้นเวลา (จร) + ดิถี */
const LAYERS: { canon: string; alias: string[] }[] = [
  { canon: "ดิถี", alias: ["ดืถี", "ดิถึ", "ถิถึ"] },
  { canon: "วัยจร", alias: ["จัยจร", "วัยจล"] },
  { canon: "ปีจร", alias: [] },
  { canon: "เดือนจร", alias: ["เสาเดือนจร", "เสาเดือน", "เดือน"] },
];

/** ตำแหน่งบนดวง: ราศีบน(ก้าน)/ราศีล่าง(กิ่ง) × หลักปี/เดือน/วัน/ยาม */
const POSITION_ROWS = [
  { canon: "ราศีบน", alias: [] },
  { canon: "ราศีล่าง", alias: ["ราศีล่าว", "ราศีลาง"] },
] as const;
const POSITION_PILLARS = [
  { canon: "หลักปี", alias: ["เสาปี"] },
  { canon: "หลักเดือน", alias: ["เสาเดือน"] },
  { canon: "หลักวัน", alias: ["เสาวัน"] },
  { canon: "หลักยาม", alias: ["เสายาม", "หลักยาน"] },
] as const;

/** สำรับไพ่/เสี่ยงทาย — map ไปที่ route ในโค้ดจริง */
const CARDS: { canon: string; route: string; alias: string[] }[] = [
  { canon: "ไพ่เทพ", route: "divine", alias: ["ไพ่เทำ", "ไพ่โหมดเซียน"] },
  { canon: "ไพ่ออราเคิล", route: "card", alias: ["ไพ่ออราเคิลเคี้ยงคุง", "ไพ่อออราเคิล"] },
  { canon: "ไพ่ฟันธง", route: "offscope", alias: [] },
  { canon: "เซียมซี", route: "fortune", alias: ["เซียนเสี่ยงทาย"] },
];

/** ธาตุ/ดาวสิบ ที่ซินแสอ้างถึง */
const STAR_ELEMENTS: { canon: string; alias: string[]; note: string }[] = [
  { canon: "ธาตุลาภ", alias: ["โชคลาภ", "ลาภผล", "ลาภ"], note: "ดาวทรัพย์ (財) — ซินแสใช้กับผู้ชายในเรื่องคู่" },
  { canon: "ธาตุพิฆาตดิถี", alias: ["พิฆาตดิถี", "ธาตุพิฆาต", "พิฆาต"], note: "ดาวที่พิฆาตดิถี (官/殺) — ซินแสใช้กับผู้หญิงในเรื่องคู่" },
  { canon: "คู่ธาตุ", alias: [], note: "ธาตุเดียวกับดิถี (比肩) — ใช้เรื่องหุ้นส่วน/พี่น้อง" },
  { canon: "ธาตุเสริมดวง", alias: [], note: "มีในระบบแล้ว (สายมู/สีมงคล)" },
];

/** โมดูลที่มีในระบบแล้ว (D อ้างถึง) */
const EXISTING_MODULES: { canon: string; alias: string[] }[] = [
  { canon: "NewData", alias: [] },
  { canon: "ปฏิทิน", alias: ["ศาสตร์ปฏิทิน", "ปฏิทินโหรา"] },
  { canon: "ฤกษ์ยาม", alias: [] },
  { canon: "ManVsDay", alias: [] },
  { canon: "สายมู", alias: [] },
  { canon: "เบอร์รังผึ้ง", alias: [] },
  { canon: "องค์เทพ", alias: ["เทพ"] },
];

/**
 * ชุด C: "คำสั่งเชิงคำแนะนำ" (advice) — 12 แถวที่แกะเป็น signal ไม่ได้ เพราะมันไม่ใช่ signal
 *
 * ซินแสไม่ได้บอกว่า "ให้ดูอะไร" แต่บอก "ให้ตอบว่าอะไร" → มันคือ **เนื้อหาคำตอบ** ไม่ใช่กติกา routing
 * แยกเป็นชนิดเพราะแต่ละชนิดต้องปฏิบัติต่างกันมากในขั้นต่อไป:
 *   chant   = บทสวด/บทขอขมากรรม → ต้องส่งให้ LLM แบบคำต่อคำ ห้ามให้แต่งเอง (แต่งบทสวดผิดคือเรื่องใหญ่)
 *   merit   = ใบสั่งทำบุญที่มีเงื่อนไขเวลา (ต่อเนื่อง 60 วัน / สวด 108 จบ) → ต้องคงตัวเลขไว้ ห้ามปัดทิ้ง
 *   fengshui= ฮวงจุ้ยบ้าน/ที่ทาง → ตอบเป็นข้อห้าม-ข้อควรทำ ไม่ต้องคำนวณเสา
 *   refer   = ซินแสสั่งให้ส่งต่อคนจริง หรือบอกว่า "ไม่มีคำตอบที่ดีที่สุด" → LLM ต้องไม่ฟันธง
 */
const ADVICE_KINDS: { kind: "chant" | "merit" | "fengshui" | "refer"; match: RegExp; note: string }[] = [
  { kind: "chant", match: /บทสวด|บทขอขมา|กรวดน้ำ|อิติปิโส|สวดมนต์|108 ?จบ|คาถา/, note: "เนื้อหาตายตัว — ส่งคำต่อคำ ห้าม LLM แต่ง" },
  { kind: "merit", match: /ทำบุญ|ทำทาน|ปล่อย(ปลา|สัตว์)|ต่อชีวิต|ถวาย|ศีล|ภาวะนา|ภาวนา|อโหสิ/, note: "ใบสั่งทำบุญ — คงเงื่อนไขเวลา/จำนวนไว้ตามที่ซินแสสั่ง" },
  { kind: "fengshui", match: /ฮวงจุ้ย|หน้าบ้าน|ในบ้าน|ห้อง|ต้นไม้|ทางสามแพร่ง|ประตู|เตียง/, note: "ข้อห้าม/ข้อควรทำ ไม่ต้องคำนวณเสา" },
  { kind: "refer", match: /ปรึกษาซินแส|ดูดวงจริงจัง|แล้วแต่ตัดสินใจ|ไม่มีบทไหนดีสุด|ไม่มีวิธีไหนดีสุด|ตามจริต/, note: "ห้าม LLM ฟันธง — ส่งต่อ/บอกว่าไม่มีคำตอบเดียว" },
];

/** ของที่ซินแสสั่งแต่ยังไม่มีในระบบ — ต้องสร้างใหม่ */
const NEW_CAPABILITIES: { canon: string; alias: string[]; note: string }[] = [
  { canon: "อาชีพถูกดวง", alias: ["อาชึพถูกดวง", "อาชีพถูกดวว"], note: "ยังไม่มี — ต้องสร้าง (map ธาตุ/ดาว → กลุ่มอาชีพ)" },
  { canon: "ธาตุถูกดวง", alias: [], note: "ยังไม่มีเป็นโมดูลแยก" },
  { canon: "เทพถูกดวง", alias: ["เทพคุ้มคลองดวงซะตา", "เทพคุ้มครองดวงชะตา", "องค์คุ้มครองดวงซะตา"], note: "ยังไม่มี — จับองค์เทพกับดวง" },
  { canon: "ระบบ matching", alias: ["maching", "matching", "มatching"], note: "มีหน้า matching แต่แชทยังเรียกใช้ไม่ได้" },
  { canon: "การเรียนถูกดวง", alias: [], note: "ยังไม่มี" },
];

/* ────────────────────────────────────────────────────────────────────────────
 * helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** รวมสะกดของ "เซียงแซ" ให้เป็นคำเดียว (ยืนยันกับซินแสแล้วว่าทุกสะกดคือคำเดียวกัน) */
const XIANGSHA_ALIASES = ["เชี่ยงแซ", "เซี่ยงแซ", "เซียงแช", "เชียงแซ"];
const XIANGSHA_CANON = "เซียงแซ";
/**
 * ซินแสเขียนห้วนเป็น "เซียง" ไม่มี "แซ" อยู่ 1 จุด (ชีตการงาน #1 "เทียบกับเซียง ดี กลางๆ ไม่ดี")
 * ต้องแทนหลัง alias เต็มคำ และต้องไม่ตามด้วย แซ/แช ไม่งั้น "เซียงแซ" จะกลายเป็น "เซียงแซแซ"
 */
const XIANGSHA_BARE = /(?:เซียง|เซี่ยง|เชี่ยง)(?!แซ|แช)/g;

function normalizeText(raw: string): string {
  let s = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  for (const a of XIANGSHA_ALIASES) s = s.split(a).join(XIANGSHA_CANON);
  return s.replace(XIANGSHA_BARE, XIANGSHA_CANON);
}

type Hit = { canon: string; snippets: string[]; glued: string[]; at: number[] };

const THAI_LETTER = /[฀-๿]/;

/**
 * คำที่รู้แล้วว่าชนกันแน่ ๆ — ชื่อสภาวะสั้น ๆ ไปโดนคำอื่นที่ยาวกว่า
 * เช่น "ทอ" (胎) โดน "ทอง" (ธาตุทอง) ซึ่งโผล่บ่อยในโน้ตซินแส
 */
const BLOCKED_SUBSTRING_OF: Record<string, string[]> = {
  ทอ: ["ทอง"],
  หมอ: ["หมอน"],
  ซี่: ["ซี่โครง"],
};

/** หา term (canon + alias) ใน text แล้วเก็บ snippet รอบ ๆ ไว้ให้คนตรวจ */
function findTerm(text: string, canon: string, alias: readonly string[]): Hit | null {
  const forms = [canon, ...alias];
  const blocked = BLOCKED_SUBSTRING_OF[canon] ?? [];
  const snippets: string[] = [];
  const glued: string[] = [];
  const at: number[] = [];
  for (const form of forms) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(form, from);
      if (i < 0) break;
      from = i + form.length;
      // ตัดทิ้งถ้าเป็นส่วนของคำที่รู้ว่าชนแน่ (เทียบ window รอบตำแหน่งที่เจอ)
      const window = text.slice(Math.max(0, i - 6), i + form.length + 6);
      if (blocked.some((w) => window.includes(w))) continue;
      const ctx = text.slice(Math.max(0, i - 14), i + form.length + 14).replace(/\n/g, " ⏎ ");
      snippets.push(ctx);
      at.push(i);
      // ตัวอักษรไทยติดกันทั้งซ้ายและขวา = น่าสงสัยว่าเป็นส่วนของคำอื่น → ให้คนยืนยัน ไม่ทิ้งเงียบ
      // (ยกเว้นกรณีที่ tokenizer แกะคำติดกันได้หมดแล้ว — ดู resolveCompoundRuns ที่ buildRow)
      const left = text[i - 1] ?? "";
      const right = text[i + form.length] ?? "";
      if (THAI_LETTER.test(left) && THAI_LETTER.test(right)) glued.push(ctx);
    }
  }
  return snippets.length ? { canon, snippets, glued, at } : null;
}

/**
 * ซินแสเขียนศัพท์ติดกันเป็นพรืดโดยไม่เว้นวรรค เช่น "ฮะเซียงแซกุ้ยนั้งมกยก"
 * ซินแสยืนยันแล้วว่าอ่านเป็นลิสต์ (ฮะ / เซียงแซ / กุ้ยนั้ง / มกยก)
 *
 * ฟังก์ชันนี้ตัดคำแบบ longest-match จากซ้าย เฉพาะช่วงที่ตัดได้ "หมดทั้งช่วง" ถึงจะถือว่าแกะสำเร็จ
 * ถ้าเหลือเศษที่ไม่รู้จัก = ไม่ยืนยัน ปล่อยให้ติดธงให้คนตรวจต่อ (ดีกว่าเดาแล้วผิดเงียบ ๆ)
 */
function resolveCompoundRuns(text: string, vocab: string[]): { range: [number, number]; tokens: string[] }[] {
  const sorted = [...vocab].sort((a, b) => b.length - a.length);
  const out: { range: [number, number]; tokens: string[] }[] = [];
  // ช่วงตัวอักษรไทยติดกันยาว ๆ (ไม่มีเว้นวรรค/เครื่องหมาย) ที่น่าจะเป็นศัพท์หลายคำต่อกัน
  for (const m of text.matchAll(/[฀-๿]{8,}/g)) {
    const run = m[0];
    const start = m.index ?? 0;
    const tokens: string[] = [];
    let pos = 0;
    while (pos < run.length) {
      const hit = sorted.find((v) => run.startsWith(v, pos));
      if (!hit) break;
      tokens.push(hit);
      pos += hit.length;
    }
    if (pos === run.length && tokens.length >= 2) out.push({ range: [start, start + run.length], tokens });
  }
  return out;
}

function collect<T extends { canon: string; alias: readonly string[] }>(text: string, defs: readonly T[]): Hit[] {
  return defs.map((d) => findTerm(text, d.canon, d.alias)).filter((h): h is Hit => h !== null);
}

/** ตำแหน่ง = cross product ของ ราศีบน/ล่าง × หลักปี/เดือน/วัน/ยาม ที่ปรากฏจริง */
function collectPositions(text: string): { rows: string[]; pillars: string[] } {
  return {
    rows: collect(text, POSITION_ROWS).map((h) => h.canon),
    pillars: collect(text, POSITION_PILLARS).map((h) => h.canon),
  };
}

/** ดึงน้ำหนักที่ซินแสระบุเป็น % เช่น "วัยจร 50% +ปีจร 30%" */
function collectWeights(text: string): { of: string; percent: number }[] {
  const out: { of: string; percent: number }[] = [];
  const re = /(\S{2,10}?)\s*(\d{1,3})\s*%/g;
  for (const m of text.matchAll(re)) out.push({ of: m[1], percent: Number(m[2]) });
  return out;
}

/**
 * ซินแสสั่งแยกชาย/หญิงไหม + สั่งว่าอย่างไร
 *
 * ไม่ใช้ regex เดาประโยค เพราะโน้ตซินแสขึ้นต้นด้วย "แยกชายหญิง" ซึ่งมีทั้ง 2 คำอยู่ในคำเดียว
 * (regex แบบ `(ผู้ชาย|ชาย)(.{0,60})` จะไปจับ "ชาย" ใน "ชายหญิง" แล้วคืนกฎของผู้หญิงมาเป็นของผู้ชาย)
 * แทนที่ด้วยการตัดตามตัวคั่นที่ซินแสใช้จริง (`///` `//` `/` ขึ้นบรรทัดใหม่) แล้วจัดกลุ่มทีละท่อน
 * ท่อนที่มีทั้ง 2 เพศ = แยกไม่ได้ ให้โยนเข้า unparsed ให้คนเคาะ — ห้ามเดา เพราะเดาผิดคือ
 * ทำนายเรื่องคู่สลับเพศ ซึ่งเป็นสิ่งที่ซินแสสั่งแก้อยู่พอดี
 */
function collectGenderSplit(text: string): { hasSplit: boolean; male: string[]; female: string[]; unparsed: string[] } {
  const hasSplit = /แยกชายหญิง|ผู้ชาย|ผู้หญิง|(?:^|[\s/])ชาย|(?:^|[\s/])หญิง/.test(text);
  if (!hasSplit) return { hasSplit: false, male: [], female: [], unparsed: [] };
  const segments = text
    .replace(/แยกชายหญิง/g, " ")
    .split(/\/{1,3}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const male: string[] = [];
  const female: string[] = [];
  const unparsed: string[] = [];
  for (const s of segments) {
    const isFemale = /หญิง/.test(s); // "ผู้หญิง" ก็เข้าเงื่อนไขนี้ และไม่มี "ชาย" อยู่ในคำ
    const isMale = /ชาย/.test(s);
    if (isMale && isFemale) unparsed.push(s);
    else if (isMale) male.push(s);
    else if (isFemale) female.push(s);
  }
  return { hasSplit: true, male, female, unparsed };
}

/** เกณฑ์ ดี/กลาง/เสีย ที่ซินแสเขียนกำกับท้ายคำว่าเซียงแซ */
function collectVerdictWords(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`${XIANGSHA_CANON}\\s*(ดี|เสีย|ไม่ดี|กลาง ?ๆ?)`, "g"))) {
    out.add(m[1].replace(/\s+/g, ""));
  }
  return [...out];
}

type Row = {
  id: string;
  category: string;
  section: string | null;
  question: string;
  shinse: {
    raw: string;
    stages: Hit[];
    stageVerdicts: { canon: string; score: number; verdict: string }[];
    compounds: { range: [number, number]; tokens: string[] }[];
    advice: { kind: string; note: string }[];
    relations: Hit[];
    layers: Hit[];
    positions: { rows: string[]; pillars: string[] };
    cards: { canon: string; route: string }[];
    starElements: string[];
    existingModules: string[];
    newCapabilities: string[];
    genderSplit: ReturnType<typeof collectGenderSplit>;
    weights: { of: string; percent: number }[];
    verdictWords: string[];
  };
  old: { raw: string; layers: string[]; cards: { canon: string; route: string }[]; existingModules: string[] };
  delta: string[];
  needsReview: string[];
};

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) {
    return (v.richText as { text: string }[]).map((r) => r.text).join("");
  }
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  return String(v);
}

function buildRow(category: string, section: string | null, idRaw: string, question: string, cRaw: string, dRaw: string): Row {
  const c = normalizeText(cRaw);
  const d = normalizeText(dRaw);

  // คำศัพท์ทั้งหมดที่ใช้ตัดคำติดกัน (ชุด A + B + ชั้นเวลา + ตำแหน่ง + ธาตุ/ดาว + คำตัดสิน)
  const TOKENIZER_VOCAB = [
    XIANGSHA_CANON,
    ...STAGES.flatMap((s) => [s.canon, ...s.alias]),
    ...RELATIONS.flatMap((s) => [s.canon, ...s.alias]),
    ...LAYERS.flatMap((s) => [s.canon, ...s.alias]),
    ...POSITION_ROWS.flatMap((s) => [s.canon, ...s.alias]),
    ...POSITION_PILLARS.flatMap((s) => [s.canon, ...s.alias]),
    ...STAR_ELEMENTS.flatMap((s) => [s.canon, ...s.alias]),
    "ดี",
    "เสีย",
    "ไม่ดี",
  ];
  const compounds = resolveCompoundRuns(c, TOKENIZER_VOCAB);
  const insideResolved = (i: number) => compounds.some(({ range }) => i >= range[0] && i < range[1]);

  const stages = collect(c, STAGES);
  const relations = collect(c, RELATIONS);
  const cards = collect(c, CARDS).map((h) => ({ canon: h.canon, route: CARDS.find((x) => x.canon === h.canon)!.route }));
  const oldCards = collect(d, CARDS).map((h) => ({ canon: h.canon, route: CARDS.find((x) => x.canon === h.canon)!.route }));
  const newCaps = collect(c, NEW_CAPABILITIES).map((h) => h.canon);

  const delta: string[] = [];
  if (/เซียงแซ/.test(c) && !/เซียงแซ/.test(d)) delta.push("เพิ่ม-12เซียงแซ");
  if (stages.length) delta.push("ระบุสภาวะเจาะจง");
  if (relations.length) delta.push("ใช้ความสัมพันธ์ราศีล่าง");
  if (/NewData/.test(d) && !/NewData/.test(c)) delta.push("ตัด-NewData");
  if (/ฤกษ์ยาม/.test(d) && !/ฤกษ์ยาม/.test(c)) delta.push("ตัด-ฤกษ์ยาม");
  if (oldCards.some((x) => x.route === "offscope") && !cards.some((x) => x.route === "offscope")) delta.push("ถอดออกจาก-offscope");
  if (newCaps.length) delta.push("ต้องสร้างของใหม่");
  const gender = collectGenderSplit(c);
  if (gender.hasSplit && !collectGenderSplit(d).hasSplit) delta.push("เพิ่ม-แยกชายหญิง");
  const positions = collectPositions(c);
  if (positions.rows.length && !collectPositions(d).rows.length) delta.push("ระบุตำแหน่งเสา");

  const needsReview: string[] = [];
  /** ธง glued จะยกเลิกถ้า tokenizer แกะช่วงคำติดกันนั้นได้หมดแล้ว (ซินแสยืนยันว่าอ่านเป็นลิสต์) */
  const unresolvedGlued = (h: Hit) => (h.at.some((i) => !insideResolved(i)) ? h.glued : []);
  for (const h of stages) {
    const def = STAGES.find((s) => s.canon === h.canon)!;
    if (def.needsReview) needsReview.push(`สภาวะ "${h.canon}": ${def.needsReview} — พบ: ${h.snippets.join(" | ")}`);
    const g = unresolvedGlued(h);
    if (g.length) needsReview.push(`สภาวะ "${h.canon}": ตัวอักษรติดกับคำอื่น อาจไม่ใช่สภาวะ — พบ: ${g.join(" | ")}`);
  }
  for (const h of relations) {
    const def = RELATIONS.find((s) => s.canon === h.canon)!;
    if (def.needsReview) needsReview.push(`ความสัมพันธ์ "${h.canon}": ${def.needsReview} — พบ: ${h.snippets.join(" | ")}`);
    const g = unresolvedGlued(h);
    if (g.length) needsReview.push(`ความสัมพันธ์ "${h.canon}": ตัวอักษรติดกับคำอื่น อาจไม่ใช่ความสัมพันธ์ — พบ: ${g.join(" | ")}`);
  }
  if (positions.rows.length && !positions.pillars.length) {
    needsReview.push(`ระบุ ${positions.rows.join("/")} แต่ไม่ระบุว่าเสาไหน`);
  }
  if (gender.unparsed.length) {
    needsReview.push(`แยกชายหญิงแต่ตัดท่อนไม่ออก (มี 2 เพศในท่อนเดียว) — ${gender.unparsed.join(" | ")}`);
  }
  // นับ signal ทุกชนิด ไม่ใช่แค่สภาวะ/ไพ่ — ไม่งั้นแถวอย่าง "หลักวัน + เซียงแซดี" (มีตำแหน่ง+เกณฑ์ครบ)
  // จะถูกติดธงว่าแกะไม่ได้ทั้ง ๆ ที่แกะได้
  const signalCount =
    stages.length +
    relations.length +
    cards.length +
    newCaps.length +
    collect(c, LAYERS).length +
    positions.rows.length +
    positions.pillars.length +
    collect(c, STAR_ELEMENTS).length +
    collect(c, EXISTING_MODULES).length +
    collectVerdictWords(c).length;
  const advice = ADVICE_KINDS.filter((a) => a.match.test(c)).map((a) => ({ kind: a.kind, note: a.note }));
  if (signalCount === 0) {
    if (advice.length) delta.push("เป็นคำแนะนำ-ไม่ใช่-signal");
    else needsReview.push("แกะเป็น signal ไม่ได้ และจัดชนิดคำแนะนำก็ไม่เข้า — ต้องตีความมือ");
  }

  return {
    id: idRaw,
    category,
    section,
    question,
    shinse: {
      raw: c,
      stages,
      // ดี/กลางๆ/เสีย ของสภาวะที่ซินแสระบุ ตามจุดตัดที่เคาะแล้ว (ดี ≥80, เสีย ≤20)
      stageVerdicts: stages.map((h) => {
        const def = STAGES.find((s) => s.canon === h.canon)!;
        return { canon: h.canon, score: def.score, verdict: stageVerdict(def.score) };
      }),
      compounds,
      advice,
      relations,
      layers: collect(c, LAYERS),
      positions,
      cards,
      starElements: collect(c, STAR_ELEMENTS).map((h) => h.canon),
      existingModules: collect(c, EXISTING_MODULES).map((h) => h.canon),
      newCapabilities: newCaps,
      genderSplit: gender,
      weights: collectWeights(c),
      verdictWords: collectVerdictWords(c),
    },
    old: {
      raw: d,
      layers: collect(d, LAYERS).map((h) => h.canon),
      cards: oldCards,
      existingModules: collect(d, EXISTING_MODULES).map((h) => h.canon),
    },
    delta,
    needsReview,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * main
 * ──────────────────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const srcPath = resolve(process.argv[2] ?? DEFAULT_SRC);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(srcPath);

  const rows: Row[] = [];
  const referenceNotes: string[] = [];
  const sheetNotes: { category: string; note: string }[] = [];

  for (const ws of wb.worksheets) {
    if (ws.name.trim() === REFERENCE_SHEET) {
      ws.eachRow((r) => {
        const t = normalizeText(cellText(r.getCell(1).value));
        if (t) referenceNotes.push(t);
      });
      continue;
    }
    const category = ws.name.trim();
    let section: string | null = null;

    ws.eachRow((r) => {
      const a = cellText(r.getCell(1).value).trim();
      const b = normalizeText(cellText(r.getCell(2).value));
      const c = cellText(r.getCell(3).value).trim();
      const d = cellText(r.getCell(4).value).trim();

      // แถวหัวข้อ = ไม่มีคำถามในคอลัมน์ B (บางแถวมีโน้ตซินแสห้อยอยู่คอลัมน์ C)
      // หมายเหตุ: หัวข้อหมวดถูก merge A:B ไว้ → exceljs คืนค่าเดียวกันทั้ง 2 ช่อง
      // ถ้าไม่ดักไว้ หัวข้อจะหลุดมาเป็น "คำถาม" (openpyxl คืน None ให้ช่องที่ถูก merge จึงไม่เจอบั๊กนี้)
      if (!b || b === normalizeText(a)) {
        if (a) section = normalizeText(a);
        if (c) sheetNotes.push({ category, note: normalizeText(c) });
        return;
      }
      // แถวที่ไม่มีทั้ง C และ D = ไม่ใช่คำถาม (ในชีตสายมูคือบทคำขอขมากรรมที่วางไว้)
      if (!c && !d) return;

      rows.push(buildRow(category, section, a || String(rows.length + 1), b, c, d));
    });
  }

  const glossary = {
    xiangsha: {
      canon: XIANGSHA_CANON,
      aliases: XIANGSHA_ALIASES,
      meaning: "ระบบ 12 สภาวะ (十二長生) — ยืนยันกับซินแสแล้วว่าสะกด 3 แบบคือคำเดียวกัน",
      notThis: "ไม่ใช่ 相生 (ธาตุเสริมกัน) ที่ school-lexicon.ts แปลว่า 'เซียงแซ' เหมือนกัน — ชื่อชนกันในโค้ดเราเอง",
      engineSource: [
        "src/lib/bazi/symbolic-engine.constants.ts → TWELVE_QI_LABELS_TH (ชื่อไทย 12 ตัว)",
        "src/lib/bazi/data/almanac/stage-legend.json (ชื่อเดียวกัน + คะแนน 0–110)",
        "src/lib/bazi/pillar-display.ts → resolveCanonicalTwelveQiStage(stem, branch)",
      ],
      verdictBands: {
        decidedBy: "ซินแสเคาะแล้ว — 5 ระดับ",
        rule: "≥90 ดีมาก · 70–80 ดี · 50–60 กลาง · 30–40 เสีย · ≤20 เสียมาก",
        bands: STAGE_VERDICT_BANDS.map((b) => ({
          ...b,
          stages: STAGES.filter((s) => stageVerdict(s.score) === b.verdict).map((s) => `${s.canon} ${s.score}`),
        })),
      },
      stages: STAGES.map((s) => ({ ...s, verdict: stageVerdict(s.score) })),
    },
    advice: {
      meaning:
        "แถวที่ซินแสไม่ได้บอกว่า 'ให้ดูอะไร' แต่บอก 'ให้ตอบว่าอะไร' — เป็นเนื้อหาคำตอบ ไม่ใช่กติกา routing",
      kinds: ADVICE_KINDS.map((a) => ({ kind: a.kind, note: a.note })),
    },
    decisions: [
      "เซียงแซ สะกด 4 แบบ (เซียงแซ/เซี่ยงแซ/เชี่ยงแซ/เซียง) = คำเดียวกัน — ซินแสยืนยัน",
      "เกณฑ์สภาวะ 5 ระดับ: ≥90 ดีมาก · 70–80 ดี · 50–60 กลาง · 30–40 เสีย · ≤20 เสียมาก — ซินแสยืนยัน (แก้จากที่เดาไว้ตอนแรกว่า 3 ระดับ)",
      "'ซวย' ในโน้ตนี้คือสภาวะ 衰 เสมอ ไม่ใช่คำพูดทั่วไป — ซินแสยืนยัน",
      "'ฮะเซียงแซกุ้ยนั้งมกยก' อ่านเป็นลิสต์ (ฮะ/เซียงแซ/กุ้ยนั้ง/มกยก) — ซินแสยืนยัน",
      "offscope ('ไพ่ฟันธง') ไม่ตัด ใช้ต่อได้ — ซินแสยืนยัน. แถวที่ D=offscope แต่ C=ไพ่เทพ คือย้ายรายแถว ไม่ใช่ยกเลิกโหมด",
    ],
    relations: {
      meaning: "ความสัมพันธ์ราศีล่าง + ดาว — คนละชุดกับ 12 เซียงแซ แต่ซินแสเขียนปนในช่องเดียวกัน",
      engineSource: ["src/lib/bazi/symbolic-engine.base-chart.ts", "src/lib/bazi/canonical-knowledge.ts"],
      items: RELATIONS,
    },
    layers: LAYERS,
    positions: { rows: POSITION_ROWS, pillars: POSITION_PILLARS },
    cards: CARDS,
    starElements: STAR_ELEMENTS,
    existingModules: EXISTING_MODULES,
    newCapabilities: NEW_CAPABILITIES,
  };

  const payload = {
    source: { file: DEFAULT_SRC, sheets: wb.worksheets.map((w) => w.name.trim()) },
    generatedBy: "scripts/normalize-chat-routing-rules.ts",
    note:
      "C = หลักการใหม่ (ซินแส), D = หลักการเก่า (ตรงกับ grounding-router.ts วันนี้). " +
      "ไฟล์นี้ยังไม่ใช่ routing table ที่ router กินได้ — เป็นขั้นแกะโน้ตให้ query ได้ก่อน",
    referenceNotes,
    sheetNotes,
    glossary,
    rows,
  };

  await mkdir(dirname(OUT_JSON), { recursive: true });
  await writeFile(OUT_JSON, JSON.stringify(payload, null, 2), "utf8");

  await mkdir(dirname(OUT_REVIEW), { recursive: true });
  await writeFile(OUT_REVIEW, buildReview(payload), "utf8");

  // สรุปให้เห็นตอนรัน
  const withStage = rows.filter((r) => r.shinse.stages.length).length;
  const withRel = rows.filter((r) => r.shinse.relations.length).length;
  const withNew = rows.filter((r) => r.shinse.newCapabilities.length).length;
  const review = rows.filter((r) => r.needsReview.length).length;
  console.log(`อ่าน ${rows.length} แถว จาก ${wb.worksheets.length} ชีต (${srcPath})`);
  console.log(`  ระบุสภาวะ 12 เซียงแซ เจาะจง : ${withStage} แถว`);
  console.log(`  ใช้ความสัมพันธ์ราศีล่าง     : ${withRel} แถว`);
  console.log(`  ต้องสร้างของใหม่            : ${withNew} แถว`);
  console.log(`  ต้องให้ซินแสเคาะ            : ${review} แถว`);
  console.log(`เขียน -> ${OUT_JSON}`);
  console.log(`เขียน -> ${OUT_REVIEW}`);
}

function buildReview(p: { rows: Row[]; sheetNotes: { category: string; note: string }[]; referenceNotes: string[] }): string {
  const L: string[] = [];
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ⏎ ");

  L.push("# ตารางตรวจทานหลักการ routing แชทฮีลใจ (จากโน้ตซินแส)");
  L.push("");
  L.push("`C` = หลักการใหม่ที่ซินแสแก้ · `D` = หลักการเก่าที่ระบบใช้อยู่วันนี้");
  L.push("");

  L.push("## ข้อที่ซินแสเคาะแล้ว (ฝังในสคริปต์เรียบร้อย)");
  L.push("");
  L.push("- **เกณฑ์เซียงแซ 5 ระดับ**: `≥90 ดีมาก` · `70–80 ดี` · `50–60 กลาง` · `30–40 เสีย` · `≤20 เสียมาก`");
  for (const b of STAGE_VERDICT_BANDS) {
    const list = STAGES.filter((s) => stageVerdict(s.score) === b.verdict).map((s) => `${s.canon} ${s.score}`);
    L.push(`  - **${b.verdict}**: ${list.join(" · ")}`);
  }
  L.push("- **`offscope` ไม่ตัด ใช้ต่อได้** — แถวที่ `D=ไพ่ฟันธง` แต่ `C=ไพ่เทพ` คือย้ายรายแถว ไม่ใช่ยกเลิกโหมด");
  L.push("- **`ซวย` = สภาวะ 衰 เสมอ** ในไฟล์นี้ (ไม่ใช่คำพูดทั่วไป)");
  L.push("- **`ฮะเซียงแซกุ้ยนั้งมกยก` อ่านเป็นลิสต์** → tokenizer ตัดคำให้อัตโนมัติแล้ว");
  L.push("- **`ทอ` (สภาวะ 胎) ≠ `ทอง` (ธาตุ)** → กันไว้ไม่ให้จับผิด");
  L.push("");
  L.push("แถวที่ยังติด `⚠️` ข้างล่าง = คำกำกวมที่เหลือ ต้องเคาะรายแถว");
  L.push("");

  const cats = [...new Set(p.rows.map((r) => r.category))];
  for (const cat of cats) {
    const rs = p.rows.filter((r) => r.category === cat);
    L.push(`## ${cat} (${rs.length} แถว)`);
    const notes = p.sheetNotes.filter((n) => n.category === cat);
    if (notes.length) {
      L.push("");
      for (const n of notes) L.push(`> โน้ตซินแสท้ายชีต: ${n.note}`);
    }
    L.push("");
    L.push("| # | คำถาม | C (ใหม่) | D (เก่า) | สิ่งที่เปลี่ยน | ⚠️ |");
    L.push("|---|---|---|---|---|---|");
    for (const r of rs) {
      const sig = [
        r.shinse.stages.length ? `สภาวะ: ${r.shinse.stages.map((s) => s.canon).join(",")}` : "",
        r.shinse.relations.length ? `สัมพันธ์: ${r.shinse.relations.map((s) => s.canon).join(",")}` : "",
        r.shinse.positions.rows.length || r.shinse.positions.pillars.length
          ? `ตำแหน่ง: ${[...r.shinse.positions.rows, ...r.shinse.positions.pillars].join("×")}`
          : "",
        r.shinse.cards.length ? `ไพ่: ${r.shinse.cards.map((c) => c.canon).join(",")}` : "",
        r.shinse.genderSplit.hasSplit ? "แยกชายหญิง" : "",
        r.shinse.weights.length ? `น้ำหนัก: ${r.shinse.weights.map((w) => `${w.of} ${w.percent}%`).join(", ")}` : "",
        r.shinse.stageVerdicts.length ? `เกณฑ์: ${r.shinse.stageVerdicts.map((v) => `${v.canon}=${v.verdict}`).join(",")}` : "",
        r.shinse.advice.length ? `คำแนะนำ: ${r.shinse.advice.map((a) => a.kind).join(",")}` : "",
        r.shinse.newCapabilities.length ? `**ของใหม่: ${r.shinse.newCapabilities.join(",")}**` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      L.push(
        `| ${esc(r.id)} | ${esc(r.question.slice(0, 60))} | ${esc(sig || r.shinse.raw.slice(0, 50))} | ${esc(r.old.raw.slice(0, 40))} | ${esc(r.delta.join(", "))} | ${r.needsReview.length ? "⚠️" : ""} |`,
      );
    }
    L.push("");
  }

  const flagged = p.rows.filter((r) => r.needsReview.length);
  L.push(`## รายละเอียดจุดกำกวม (${flagged.length} แถว)`);
  L.push("");
  for (const r of flagged) {
    L.push(`### ${r.category} #${r.id} — ${r.question.slice(0, 70)}`);
    L.push(`ต้นฉบับ C: \`${r.shinse.raw}\``);
    for (const n of r.needsReview) L.push(`- ${n}`);
    L.push("");
  }

  L.push("## ชีตอ้างอิง (สเปกของแบบเก่า ตามที่ซินแสเขียนไว้)");
  L.push("");
  for (const n of p.referenceNotes) L.push(`- ${n}`);
  L.push("");
  return L.join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

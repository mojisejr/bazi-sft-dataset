// src/lib/bazi/chat-knowledge/retrieve.ts — ความรู้ซินแสสำหรับแชท (ซินแสนุ้ย 2026-09-23):
//   ฮวงจุ้ย / ประเพณี-เต๋า-เทพ / ความรู้เชิงวิชาการ (ปีชงคืออะไร ฯลฯ). เอกสารใหญ่หลายบทความ → เก็บเป็น
//   per-article JSON แล้ว "ดึงเฉพาะบทความที่ตรงคำถาม" (char-3gram overlap, ใช้กับไทยที่ไม่มีเว้นวรรคได้) →
//   แนบเป็น staticKnowledge (route รวมกับ resolveStaticKnowledge). ไม่ยัดทั้งเล่มทุกครั้ง = ประหยัด token.
import fengshui from "./fengshui.json";
import tradition from "./tradition.json";
import edu from "./edu.json";

export type ChatKnowledgeArticle = { title: string; text: string };

const ARTICLES: ChatKnowledgeArticle[] = [
  ...(fengshui as ChatKnowledgeArticle[]),
  ...(tradition as ChatKnowledgeArticle[]),
  ...(edu as ChatKnowledgeArticle[]),
];

const N = 3;
function grams(s: string): Set<string> {
  const c = (s ?? "").replace(/\s+/g, "");
  const g = new Set<string>();
  for (let i = 0; i + N <= c.length; i++) g.add(c.slice(i, i + N));
  return g;
}

// longest common substring (คืนสตริง) — จับ "คำสำคัญตรง ๆ" เช่น ปีชง/ไฉ่ซิ้ง/ตรุษจีน ในหัวข้อ (คำถามสั้น gram น้อย)
function lcsStr(a: string, b: string): string {
  const m = a.length, n = b.length;
  if (m === 0 || n === 0) return "";
  let best = 0, end = 0;
  let prev = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) { best = cur[j]; end = i; } }
    }
    prev = cur;
  }
  return a.slice(end - best, end);
}

// คำ/อนุภาคทั่วไป — ถ้า LCS หัวข้อได้แค่คำพวกนี้ ไม่ถือเป็น "คำสำคัญตรง" (กัน "เมื่อยขา"→"เมื่อการ...", "เต๋าคืออะไร"→"...อะไร...")
const STOP = new Set(["อะไร", "เมื่อ", "ยังไง", "ทำไม", "อย่างไร", "จริงไหม", "ได้ไหม", "เป็นยังไง", "คืออะ", "ตรงไหน", "ที่ไหน", "อยากรู้", "เท่าไหร่", "หรือไม่", "อะไรดี", "ทำไง"]);

// precompute ตอนโหลดโมดูล — เก็บ title แบบตัดช่องว่างไว้ทำ LCS
const INDEX = ARTICLES.map((a) => ({ a, tg: grams(a.title), bg: grams(a.text), tt: (a.title ?? "").replace(/\s+/g, "") }));

const MAX_CHARS = 4500; // ตัดบทความยาว ๆ ไม่ให้ prompt บวม
const MIN_TITLE_HIT = 4; // มีคำสำคัญตรงในหัวข้อยาว >= 4 ตัวอักษร = ตรงชัด
const MIN_GRAM = 22; // ไม่มีคำตรงหัวข้อ แต่ gram overlap สูงพอ (เนื้อตรง) ก็รับได้

/** ดึง "บทความความรู้ซินแส" ที่ตรงคำถามมากสุด 1 บท (หรือ null ถ้าไม่มีอะไรตรงพอ) */
export function retrieveChatKnowledge(query: string): string | null {
  const q = (query ?? "").trim();
  if (q.length < 4 || INDEX.length === 0) return null;
  const qg = grams(q);
  const qt = q.replace(/\s+/g, "");
  if (qg.size === 0) return null;
  let best: ChatKnowledgeArticle | null = null;
  let bestCombined = 0;
  let bestTitleHit = 0;
  let bestGram = 0;
  for (const it of INDEX) {
    let t = 0, b = 0;
    for (const g of qg) {
      if (it.tg.has(g)) t++;
      else if (it.bg.has(g)) b++;
    }
    const gram = t * 4 + b; // น้ำหนักหัวข้อสูงกว่าเนื้อ
    const hit = lcsStr(qt, it.tt);
    const titleHit = STOP.has(hit) ? 0 : hit.length; // คำสำคัญตรงในหัวข้อ (ตัดคำทั่วไป)
    const combined = titleHit * 10 + gram;
    if (combined > bestCombined) { bestCombined = combined; best = it.a; bestTitleHit = titleHit; bestGram = gram; }
  }
  // รับเมื่อ: มีคำสำคัญตรงหัวข้อ (>=4 ตัว) หรือ เนื้อตรงมากพอ — ไม่งั้นถือว่าไม่เกี่ยว
  if (!best || (bestTitleHit < MIN_TITLE_HIT && bestGram < MIN_GRAM)) return null;
  const text = best.text.length > MAX_CHARS ? best.text.slice(0, MAX_CHARS).trim() + "…" : best.text;
  return text;
}

/** จำนวนบทความในคลัง (ไว้ทดสอบ) */
export function chatKnowledgeCount(): number {
  return ARTICLES.length;
}

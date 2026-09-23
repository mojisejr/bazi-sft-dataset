// scripts/build-chat-knowledge.ts — สร้าง per-article JSON ของ "ความรู้ซินแสในแชท" จากไฟล์ .txt ต้นฉบับ
//   (ซินแสนุ้ย 2026-09-23). แต่ละ .txt = เอกสารรวมบทความ (จาก Google Docs) → แยกเป็นบทความย่อย
//   (หัวข้อของบทความจะปรากฏซ้ำ 2 บรรทัดในต้นฉบับ = ตัวคั่น) → เขียนเป็น src/lib/bazi/chat-knowledge/*.json
//   ที่ retrieve.ts โหลดไปทำ retrieval. รัน: node --import tsx scripts/build-chat-knowledge.ts
import fs from "fs";
import path from "path";

const NEWDATA = path.resolve("knownlage/NewData");
const OUT = path.resolve("src/lib/bazi/chat-knowledge");

const DOCS: { txt: string; json: string; docTitle: string }[] = [
  { txt: "AI ฮวงจุ้ย.txt", json: "fengshui.json", docTitle: "AI Chat ฮวงจุ้ยเคี้ยงคุง" },
  { txt: "AI ความรู้รอบตัว.txt", json: "tradition.json", docTitle: "AI Chat ความรู้รอบตัวเคี้ยงคุง" },
  { txt: "AI ความรู้ดวงวิชาการ.txt", json: "edu.json", docTitle: "AI Chat ดวงเคี้ยงคุง" },
];

function splitArticles(raw: string, docTitle: string): { title: string; text: string }[] {
  const t = raw.replace(/\[truncated to \d+ chars\]\s*$/, "").trim();
  const lines = t.split("\n").map((l) => l.trim()).filter((l, idx) => !(idx < 3 && l === docTitle));
  // ตัวคั่นบทความ: บรรทัดสั้น ๆ ที่ตามด้วยบรรทัดเดียวกันซ้ำ (หัวข้อปรากฏ 2 ครั้ง)
  const bounds: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    if (!a || a.length > 90) continue;
    let j = i + 1;
    while (j < lines.length && lines[j] === "") j++;
    if (lines[j] === a) bounds.push(i);
  }
  const starts = bounds.length && bounds[0] > 0 ? [0, ...bounds] : bounds;
  const arts: { title: string; text: string }[] = [];
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k], e = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const slice = lines.slice(s, e).filter(Boolean);
    if (slice.length === 0) continue;
    const title = slice[0];
    const body = slice.slice(1).filter((l) => l !== title); // ตัดหัวข้อที่ซ้ำออก
    const text = `${title}\n${body.join("\n")}`.trim();
    if (text.length > 60) arts.push({ title, text });
  }
  return arts;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const d of DOCS) {
    const p = path.join(NEWDATA, d.txt);
    if (!fs.existsSync(p)) { console.log(`skip (missing): ${d.txt}`); fs.writeFileSync(path.join(OUT, d.json), "[]\n"); continue; }
    const arts = splitArticles(fs.readFileSync(p, "utf8"), d.docTitle);
    fs.writeFileSync(path.join(OUT, d.json), JSON.stringify(arts, null, 1) + "\n", "utf8");
    total += arts.length;
    console.log(`${d.json}: ${arts.length} articles`);
  }
  console.log(`total ${total} articles`);
}

main();

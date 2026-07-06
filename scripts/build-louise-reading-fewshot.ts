/**
 * สกัดคำอ่านจริงซินแส (GT) ของ 3 ดวง (ศิตา/ภูเมธ/ธานัท จารุฤทธิไกร) จากเอกสารเทียบ
 * → few-shot ราย topicId สำหรับแท็บ "อ่าน 15 บท (Louise Hay)" (newdata-reading2)
 *
 * few-shot ใช้สอน "โครง/ประเด็นที่ควรครอบคลุมต่อบท" — persona Louise Hay จะเล่าใหม่ด้วยน้ำเสียงอบอุ่นเอง
 *
 * Usage: npx tsx scripts/build-louise-reading-fewshot.ts
 * Output: src/lib/bazi/louise-reading-fewshot.generated.json  → { [topicId]: [{ name, gt }] }
 */
import { readFileSync, writeFileSync } from "node:fs";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

const GT_DOC = "docs/newdata-vs-groundtruth-4charts-2026-06-25.md";
const WANT = ["ศิตา", "ภูเมธ", "ธานัท"]; // เอา 3 ดวงตระกูลจารุฤทธิไกร (prefix)

function parseGt(md: string): Map<string, Map<number, string>> {
  const out = new Map<string, Map<number, string>>();
  let chart: string | null = null, chap: number | null = null, inGt = false;
  let buf: string[] = [];
  const flush = () => {
    if (chart && chap != null && buf.length) {
      const m = out.get(chart) ?? new Map<number, string>();
      m.set(chap, buf.join("\n").trim());
      out.set(chart, m);
    }
    buf = [];
  };
  for (const line of md.split("\n")) {
    const ch = line.match(/^##\s+(.+?)\s+\(/);
    const cp = line.match(/^###\s+บท\s+(\d+)/);
    if (ch) { flush(); chart = ch[1].trim(); chap = null; inGt = false; continue; }
    if (cp) { flush(); chap = Number.parseInt(cp[1], 10); inGt = false; continue; }
    if (/^\*\*ซินแส\s*\(GT\)\s*:\*\*/.test(line)) { inGt = true; continue; }
    if (/^\*\*NewData\s*:\*\*/.test(line)) { flush(); inGt = false; continue; }
    if (inGt) buf.push(line);
  }
  flush();
  return out;
}

function main() {
  const gt = parseGt(readFileSync(GT_DOC, "utf8"));
  const charts = [...gt.keys()].filter((name) => WANT.some((w) => name.startsWith(w)));
  const bank: Record<string, { name: string; gt: string }[]> = {};
  let total = 0;
  for (const topic of TOPIC_PATH.filter((t) => t.kind === "predict")) {
    const examples: { name: string; gt: string }[] = [];
    for (const chartName of charts) {
      const text = gt.get(chartName)?.get(topic.chapter);
      if (text && text.length > 40) {
        examples.push({ name: chartName.split(" ")[0], gt: text });
      }
    }
    if (examples.length) {
      bank[topic.id] = examples;
      total += examples.length;
    }
  }
  const path = "src/lib/bazi/louise-reading-fewshot.generated.json";
  writeFileSync(path, JSON.stringify(bank, null, 2), "utf8");
  console.log(`เขียน ${path} — ${Object.keys(bank).length} บท · ${total} ตัวอย่าง (จาก ${charts.length} ดวง: ${charts.map((c) => c.split(" ")[0]).join(", ")})`);
}

main();

/**
 * เทียบ output ระบบ (LLM) กับเอกสาร "your life code" ทีละเคส
 * สร้าง bundle ไฟล์ (ข้อความเอกสาร + คำอ่าน engine + คำอ่าน LLM รายบท) ไว้ให้รีวิว
 *
 * Usage: npx tsx scripts/compare-yourlifecode.ts <caseIndex 1-6>
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { buildDayMasterRelationPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";
import { buildTopicEngineReading, type TopicEngineReading } from "@/lib/bazi/topic-reading";
import {
  buildTopicHumanReading,
  getTopicKnowledgeSourceLabel,
} from "@/lib/bazi/topic-knowledge";
import { generateReadingTopicLlm } from "@/lib/bazi/reading-llm";

const CASES = [
  { name: "กัญญารัตน์", file: "your life code กัญญารัตน์.docx", d: "2002-12-02", t: "11:30", g: "female" as const },
  { name: "เกศสรินทร์", file: "your life code_เกศสรินทร์ เพ็ชร์รื่น.docx", d: "1995-01-23", t: "02:10", g: "female" as const },
  { name: "ชัยธรณ์", file: "your life code_คุณชัยธรณ์.docx", d: "1981-03-15", t: "12:00", g: "male" as const },
  { name: "สิริกัญญา", file: "your life code_คุณสิริกัญญา.docx", d: "1980-06-28", t: "18:00", g: "female" as const },
  { name: "เจ้าชะตา A", file: "your life code_เจ้าชะตา A.docx", d: "2001-07-29", t: "21:35", g: "female" as const },
  { name: "เจ้าชะตา B", file: "your life code_เจ้าชะตา B.docx", d: "1999-06-17", t: "15:25", g: "female" as const },
];

function extractDocxText(path: string): string {
  const xml = execFileSync("unzip", ["-p", path, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function engineSignalsFor(reading: TopicEngineReading): string[] {
  return [
    `หลักการอ่าน: ${reading.lens}`,
    ...reading.table.map((row) => `${row.sourceSymbol} → ${row.pointsTo}: ${row.relationResult}`),
    ...reading.prose,
  ];
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* ใช้ env ที่ตั้งไว้แล้ว */
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("ไม่พบ GEMINI_API_KEY ใน .env");
    process.exit(1);
  }

  const index = Number.parseInt(process.argv[2] ?? "1", 10) - 1;
  const c = CASES[index];
  if (!c) {
    console.error("caseIndex ต้องเป็น 1-6");
    process.exit(1);
  }

  const docText = extractDocxText(`example/${c.file}`);
  const raw = RawInputSchema.parse({
    birthDate: c.d, birthTime: c.t, gender: c.g,
    province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
  });
  const state = await calculateBaziStateFromRawInput(raw);
  const packet = buildDayMasterRelationPacket(state);

  const predictTopics = TOPIC_PATH.filter((topic) => topic.kind === "predict");
  const sections: string[] = [];
  for (const topic of predictTopics) {
    const reading = buildTopicEngineReading(state, topic.id, packet);
    const humanKnowledge = buildTopicHumanReading(state, topic.id, raw);
    let llmText = "(generate ไม่สำเร็จ)";
    try {
      const llm = await generateReadingTopicLlm({
        topicId: topic.id, rawInput: raw, calculatedState: state,
        humanKnowledge, sourceLabel: getTopicKnowledgeSourceLabel(topic.id),
        engineSignals: engineSignalsFor(reading), apiKey, provider: "gemini",
      });
      llmText = llm.text;
    } catch (error) {
      llmText = `(error: ${(error as Error).message})`;
    }
    sections.push(
      `\n## บทที่ ${topic.chapter}: ${topic.title} [${topic.id}]\n\n` +
      `### 🟦 ENGINE (ground truth)\n${humanKnowledge ?? "(ไม่มี)"}\n\n` +
      `### 🟩 SYSTEM LLM\n${llmText}\n`,
    );
    process.stderr.write(`  done: ${topic.id}\n`);
  }

  mkdirSync("out/ylc-compare", { recursive: true });
  const outPath = `out/ylc-compare/${index + 1}-${c.name}.bundle.md`;
  writeFileSync(
    outPath,
    `# เทียบ your life code — ${c.name} (${c.d} ${c.t} ${c.g})\n` +
    `ดิถี ${state.dayMaster} (${state.dayMasterStrengthProfile?.displayLabel ?? ""}) · score ${state.strengthScore}\n\n` +
    `# ===== เอกสารต้นฉบับ (your life code) =====\n\n${docText}\n\n` +
    `# ===== คำอ่านระบบ (รายบท) =====\n${sections.join("\n")}`,
    "utf8",
  );
  console.log(`เขียน ${outPath} (${docText.length} ตัวอักษรเอกสาร, ${predictTopics.length} บท)`);
}

void main();

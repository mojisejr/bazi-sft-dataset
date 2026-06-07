/**
 * Export a deterministic Chinese-astrology reading to a .docx file.
 *
 * Usage:
 *   npx tsx scripts/export-reading-docx.ts <YYYY-MM-DD> <HH:mm> <male|female> [province] [outPath]
 *
 *   # แยกเป็น 15 ไฟล์ทีละบท (ให้ซินแซ redline ใน Google Doc):
 *   npx tsx scripts/export-reading-docx.ts 1993-11-24 15:09 male "Chiang Rai" --per-topic
 *   # เลือกเฉพาะบท (ตามเลขบท 1-15):
 *   npx tsx scripts/export-reading-docx.ts 1993-11-24 15:09 male --topics 3,7,12
 *
 * Example:
 *   npx tsx scripts/export-reading-docx.ts 1993-11-24 15:09 male "Chiang Rai" out/case.docx
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildReadingDocxBuffer, buildTopicDocxBuffer } from "@/lib/bazi/reading-docx";
import { TOPIC_PATH } from "@/lib/bazi/topic-path";

const PREDICT_TOPICS = TOPIC_PATH.filter((t) => t.kind === "predict");

/** map เลขบท (1-15) หรือ topicId → topicId ที่ถูกต้อง */
function resolveTopicIds(spec: string | null): string[] {
  if (!spec) {
    return PREDICT_TOPICS.map((t) => t.id);
  }
  const ids: string[] = [];
  for (const token of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const byChapter = PREDICT_TOPICS.find((t) => String(t.chapter) === token);
    const byId = PREDICT_TOPICS.find((t) => t.id === token);
    const match = byChapter ?? byId;
    if (!match) {
      throw new Error(`ไม่รู้จักบท: "${token}" (ใช้เลขบท 1-15 หรือ topicId)`);
    }
    ids.push(match.id);
  }
  return ids;
}

function sanitizeForFile(text: string): string {
  return text.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-").slice(0, 40);
}

async function main() {
  // โหลด .env (DATABASE_URL ฯลฯ) — engine adapter ต่อ DB แบบ lazy ตอนเรียกใช้
  try {
    process.loadEnvFile(".env");
  } catch {
    // ไม่มี .env ก็ข้าม (อาศัย env ที่ตั้งไว้แล้ว)
  }

  // แยก flag ออกจาก positional args
  const argv = process.argv.slice(2);
  const perTopic = argv.includes("--per-topic");
  const topicsIdx = argv.indexOf("--topics");
  const topicsSpec = topicsIdx >= 0 ? (argv[topicsIdx + 1] ?? null) : null;
  const positional = argv.filter(
    (a, i) => !a.startsWith("--") && !(topicsIdx >= 0 && i === topicsIdx + 1),
  );
  const [birthDate, birthTime, gender, province = "Bangkok", outPath] = positional;

  if (!birthDate || !birthTime || (gender !== "male" && gender !== "female")) {
    console.error(
      "Usage: npx tsx scripts/export-reading-docx.ts <YYYY-MM-DD> <HH:mm> <male|female> [province] [outPath] [--per-topic] [--topics 1,3,5]",
    );
    process.exit(1);
  }

  const rawInput = RawInputSchema.parse({
    birthDate,
    birthTime,
    gender,
    province,
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  });

  const calculatedState = await calculateBaziStateFromRawInput(rawInput);

  // โหมดแยกบท: ออกหลายไฟล์ทีละหัวข้อ (สำหรับ redline)
  if (perTopic || topicsSpec) {
    const topicIds = resolveTopicIds(topicsSpec);
    const baseDir = outPath ?? `out/reading-${birthDate}-${gender}-per-topic`;
    await mkdir(baseDir, { recursive: true });
    for (const topicId of topicIds) {
      const topic = PREDICT_TOPICS.find((t) => t.id === topicId)!;
      const buffer = await buildTopicDocxBuffer(topicId, rawInput, calculatedState);
      const fileName = `${String(topic.chapter).padStart(2, "0")}-${sanitizeForFile(topic.title)}.docx`;
      const target = `${baseDir}/${fileName}`;
      await writeFile(target, buffer);
      console.log(`✓ บท ${topic.chapter}: ${target}`);
    }
    console.log(`✓ ออกครบ ${topicIds.length} บท ที่โฟลเดอร์ ${baseDir} (ดิถี ${calculatedState.dayMaster})`);
    return;
  }

  const buffer = await buildReadingDocxBuffer(rawInput, calculatedState);
  const target = outPath ?? `out/reading-${birthDate}-${gender}.docx`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);

  console.log(`✓ เขียนรายงานแล้ว: ${target} (ดิถี ${calculatedState.dayMaster})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

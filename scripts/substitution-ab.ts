/**
 * พิสูจน์: ซินแสตั้งกฎแทนวลีจากดวงหนึ่ง → ดวงคนละคนที่ผลทายมีวลีเดียวกันต้องออกเหมือนกัน (deterministic)
 * ใช้ engine ล้วน + applySubstitutionRules (ไม่ต้องใช้ API key)
 *
 * Usage: npx tsx scripts/substitution-ab.ts [--topic wealth_and_investment]
 */
import { calculateBaziStateFromRawInput } from "@/features/bazi-math/bazi-engine-adapter";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import { buildTopicConsumerReading } from "@/lib/bazi/topic-knowledge";
import { applySubstitutionRules, type SubstitutionRule } from "@/lib/bazi/substitution-rules";

import { GPTCASE_MANIFEST } from "./lib/gptcase-cases";

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* ใช้ env ที่ตั้งไว้แล้ว */
  }
  const topicId = flag("topic", "wealth_and_investment");

  // เตรียมผลทาย engine ของแต่ละดวง (ตัด birth data ซ้ำ)
  const seen = new Set<string>();
  const charts: Array<{ name: string; day: string; reading: string }> = [];
  for (const c of GPTCASE_MANIFEST) {
    const sig = `${c.birthDate}|${c.birthTime}|${c.gender}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const raw = RawInputSchema.parse({
      birthDate: c.birthDate, birthTime: c.birthTime, gender: c.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziStateFromRawInput(raw);
    const reading = buildTopicConsumerReading(state, topicId, raw) ?? "";
    charts.push({ name: c.name, day: state.dayMaster, reading });
  }

  // หา "วลี" (บรรทัด) ที่ปรากฏในผลทายของ ≥2 ดวง = ดวงคนละคนแต่ทายได้วลีเดียวกัน
  const lineToCharts = new Map<string, string[]>();
  for (const ch of charts) {
    for (const raw of ch.reading.split(/\n+/)) {
      const line = raw.trim();
      if (line.length < 12) continue; // ข้ามบรรทัดสั้น/หัวข้อ
      (lineToCharts.get(line) ?? lineToCharts.set(line, []).get(line)!).push(ch.name);
    }
  }
  const shared = [...lineToCharts.entries()]
    .map(([line, names]) => ({ line, names: [...new Set(names)] }))
    .filter((entry) => entry.names.length >= 2)
    .sort((a, b) => b.names.length - a.names.length);

  console.log(`บท: ${topicId} · ดวงทั้งหมด ${charts.length} (day: ${charts.map((c) => c.day).join(", ")})`);

  if (shared.length === 0) {
    console.log("ไม่พบวลีที่ ≥2 ดวงทายตรงกันในบทนี้ — ลอง --topic chart_foundation/health");
    return;
  }

  const target = shared[0];
  const REPLACEMENT = "passive income (✎ ซินแสแก้)";
  const rule: SubstitutionRule = {
    id: "demo", scope: "topic", topicId,
    match: target.line, replacement: REPLACEMENT,
    source: { kind: "manual" }, createdAt: "2026-06-09T00:00:00.000Z",
  };

  console.log(`\nซินแสตั้งกฎ (บท ${topicId}):`);
  console.log(`  "${target.line.slice(0, 80)}${target.line.length > 80 ? "…" : ""}"`);
  console.log(`  → "${REPLACEMENT}"`);
  console.log(`  (วลีนี้ปรากฏในดวง: ${target.names.join(", ")})\n`);

  let allReplaced = true;
  for (const ch of charts) {
    const had = ch.reading.includes(target.line);
    const after = applySubstitutionRules(topicId, ch.reading, [rule]);
    const nowHasReplacement = after.includes(REPLACEMENT);
    const stillHasOld = after.includes(target.line);
    const verdict = !had
      ? "ไม่มีวลีนี้ → ไม่แตะ (ถูกต้อง)"
      : nowHasReplacement && !stillHasOld
        ? "✅ แทนเป็น passive income แล้ว"
        : "❌ ยังไม่ถูกแทน";
    if (had && !(nowHasReplacement && !stillHasOld)) allReplaced = false;
    console.log(`  ${ch.name.padEnd(16)} ${verdict}`);
  }

  console.log(
    `\nสรุป: ${allReplaced ? "ทุกดวงที่ทายได้วลีเดียวกัน → ออกเป็น passive income เหมือนกันหมด (deterministic)" : "มีดวงที่ยังไม่ถูกแทน — ตรวจ"}`,
  );
}

void main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});

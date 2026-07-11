/**
 * Seed ดวงตัวอย่างของโหมดจับคู่ (SAMPLE_PEOPLE) ลง bazi_saved_chart
 * เพื่อให้ "คนที่ผูกดวงในระบบ" มีให้ทดสอบปัดจริง (idempotent: ข้ามชื่อที่มีแล้ว).
 *
 * Usage: node --env-file=.env --import tsx scripts/seed-matchmaker-people.ts
 */
import { createDbClient } from "../src/db/client";
import { baziSavedChart } from "../src/db/schema";
import { SAMPLE_PEOPLE } from "../src/lib/bazi/matchmaker-people";

async function main() {
  const db = createDbClient();
  const existing = await db.select({ label: baziSavedChart.label }).from(baziSavedChart);
  const have = new Set(existing.map((r) => r.label));

  let inserted = 0;
  for (const p of SAMPLE_PEOPLE) {
    if (have.has(p.name)) {
      console.log(`skip (มีแล้ว): ${p.name}`);
      continue;
    }
    await db.insert(baziSavedChart).values({
      label: p.name,
      rawInput: p.rawInput,
      dayMaster: null,
    });
    inserted += 1;
    console.log(`+ ${p.name} (${p.gender}) ${p.rawInput.birthDate}`);
  }
  console.log(`\nDONE: inserted ${inserted} / ${SAMPLE_PEOPLE.length}`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});

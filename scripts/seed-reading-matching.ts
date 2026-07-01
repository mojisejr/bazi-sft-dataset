/**
 * Seed คำทำนาย Matching (จับคู่/สมพงษ์) จาก reference.json + sising.json → ตาราง bazi_matching
 * ค่าเริ่มต้น = insert/skip (ไม่ทับงานซินแส) · --force = เขียนทับ · --dry-run = ดูผลไม่เขียน
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/seed-reading-matching.ts --dry-run
 *   node --env-file=.env --import tsx scripts/seed-reading-matching.ts
 *   node --env-file=.env --import tsx scripts/seed-reading-matching.ts --force
 */
import { sql } from "drizzle-orm";

import { createDbClient } from "../src/db/client";
import { baziMatching, type MatchingValue } from "../src/db/schema";
import referenceJson from "../src/lib/bazi/data/pair/reference.json";
import sisingJson from "../src/lib/bazi/data/pair/sising.json";
import {
  ROLE_FIELD_BY_GROUP,
  SISING_ASPECT_BY_GROUP,
} from "../src/lib/bazi/matching-groups";
import type { ReferenceData, SisingStar } from "../src/lib/bazi/pair-types";

const REFERENCE = referenceJson as ReferenceData;
const SISING = sisingJson as SisingStar[];

type SeedRow = {
  groupKey: string;
  itemKey: string;
  ordinal: number;
  value: MatchingValue;
  sourceFile: string;
};

/** เฉพาะโค้ดระยะที่ใช้จริง (A1..A12 ก้าน/กิ่ง · B1..B12 สี่ซิ้ง) */
function isRoleCode(code: string): boolean {
  return /^[AB]\d+$/.test(code);
}

function collectAll(): SeedRow[] {
  const rows: SeedRow[] = [];
  const push = (groupKey: string, itemKey: string, ordinal: number, text: string, source: string, label?: string) => {
    rows.push({ groupKey, itemKey, ordinal, value: { text, ...(label ? { label } : {}) }, sourceFile: source });
  };

  // ── นิสัยหลักวัน ──
  Object.entries(REFERENCE.nisai.byStem).forEach(([k, t], i) =>
    push("nisai_stem", k, i + 1, t, "reference.json → nisai.byStem"),
  );
  Object.entries(REFERENCE.nisai.byBranch).forEach(([k, t], i) =>
    push("nisai_branch", k, i + 1, t, "reference.json → nisai.byBranch"),
  );
  Object.entries(REFERENCE.nisai.byStage).forEach(([k, t], i) =>
    push("nisai_stage", k, i + 1, t, "reference.json → nisai.byStage"),
  );

  // ── บทบาทความสัมพันธ์ (first-occurrence ต่อโค้ด ตรงกับ ROLE_MAP ใน engine) ──
  for (const [group, field] of Object.entries(ROLE_FIELD_BY_GROUP)) {
    const seen = new Set<string>();
    let ord = 0;
    for (const stage of REFERENCE[field]) {
      if (!stage.code || !isRoleCode(stage.code) || seen.has(stage.code)) continue;
      seen.add(stage.code);
      ord += 1;
      push(group, stage.code, ord, stage.narrative ?? "", `reference.json → ${field}[].narrative`, stage.name);
    }
  }

  // ── สี่ซิ้ง 12 ดวง ──
  SISING.forEach((s, i) => {
    const ord = i + 1;
    const label = `${s.nameTh} (${s.nameCn})`;
    push("sising_short", s.code, ord, s.short ?? "", "sising.json → short", label);
    push("sising_long", s.code, ord, s.long ?? "", "sising.json → long", label);
    push("sising_summary", s.code, ord, s.summary ?? "", "sising.json → summary", label);
    for (const [group, aspect] of Object.entries(SISING_ASPECT_BY_GROUP)) {
      push(group, s.code, ord, s.aspects?.[aspect] ?? "", `sising.json → aspects.${aspect}`, label);
    }
  });

  return rows;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const rows = collectAll();

  const byGroup = new Map<string, number>();
  for (const r of rows) byGroup.set(r.groupKey, (byGroup.get(r.groupKey) ?? 0) + 1);
  console.log(`รวม ${rows.length} rows / ${byGroup.size} กลุ่ม`);
  for (const [g, n] of byGroup) console.log(`  ✓ ${g.padEnd(18)} → ${n} rows`);

  if (dryRun) {
    console.log("\n(dry-run) ไม่เขียน DB");
    return;
  }

  const db = createDbClient();
  let written = 0;
  for (const r of rows) {
    const insert = db
      .insert(baziMatching)
      .values({ groupKey: r.groupKey, itemKey: r.itemKey, ordinal: r.ordinal, value: r.value, sourceFile: r.sourceFile });
    if (force) {
      await insert.onConflictDoUpdate({
        target: [baziMatching.groupKey, baziMatching.itemKey],
        set: { value: r.value, ordinal: r.ordinal, sourceFile: r.sourceFile, updatedAt: sql`now()` },
      });
    } else {
      await insert.onConflictDoNothing();
    }
    written++;
  }
  console.log(`\nเขียนสำเร็จ ${written} rows (${force ? "force update" : "insert/skip existing"})`);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});

/**
 * backfill-shinse-newdata — เขียน "คำแก้ซินแส" ที่ถอดได้ปลอดภัย กลับเข้าคลังกลาง bazi_newdata
 *
 * อ่าน scripts/data/shinse-backfill-candidates.json (จาก mine-shinse-corrections.ts)
 * เขียนเฉพาะ candidate ที่ autoSafe (กลุ่ม fixed = บทนำ "ทุกคน") — เลือก variant ที่เป็น
 * "ย่อหน้าเต็ม" (ยาว ≥ MIN_LEN) ที่ซินแสเห็นตรงกันมากสุด และเขียนก็ต่อเมื่อ "ต่างจากของเดิมจริง"
 *
 * รักษา ordinal/label/sourceFile เดิมไว้ เปลี่ยนแค่ value.text · ตั้ง updated_by ไว้ track ที่มา
 * Flags:
 *   --dry-run           ดูผลก่อน (before/after) ไม่เขียน DB
 *   --only=g1,g2        เขียนเฉพาะบางกลุ่ม
 *   --min-agree=N       ต้องมีซินแสเห็นตรงกัน ≥ N ดวง (default 2)
 * รัน: npm run backfill:shinse:dry   แล้วค่อย  npm run backfill:shinse
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, sql } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziNewdata, type NewdataValue } from "@/db/schema";

const MIN_LEN = 150; // ความยาวขั้นต่ำของ "บทนำเต็ม" (กันเลือก subtitle สั้น ๆ)

type Proposal = { chartRef: string; dayElement: string; chapterId: string; boxTitle: string; body: string };
type Candidate = {
  group: string;
  itemKey: string;
  keyKind: string;
  cellStatus: "empty" | "has_content";
  currentText: string;
  klass: string;
  autoSafe: boolean;
  proposals: Proposal[];
};

function normBody(s: string): string {
  return (s ?? "").replace(/\[\[[^\]]*\]\]/g, " ").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}
/** ล้าง marker จัดรูปที่ไม่ควรลงคลัง (intro เก็บเป็น plain) แต่คงข้อความ */
function cleanForStore(s: string): string {
  return (s ?? "").replace(/\[\[[^\]]*\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/** เลือก variant บทนำเต็มที่ซินแสเห็นตรงกันมากสุด (นับแบบ normalize) — คืน null ถ้าไม่มี variant ยาวพอ */
function pickBestIntro(proposals: Proposal[]): { text: string; agree: number; total: number } | null {
  const longs = proposals.map((p) => p.body.trim()).filter((b) => normBody(b).length >= MIN_LEN);
  if (longs.length === 0) return null;
  const byNorm = new Map<string, { rep: string; count: number }>();
  for (const b of longs) {
    const k = normBody(b);
    const cur = byNorm.get(k);
    if (cur) {
      cur.count += 1;
      if (b.length > cur.rep.length) cur.rep = b; // เก็บฉบับยาวสุดในกลุ่มเดียวกัน
    } else {
      byNorm.set(k, { rep: b, count: 1 });
    }
  }
  const best = [...byNorm.values()].sort((a, b) => b.count - a.count || b.rep.length - a.rep.length)[0];
  return { text: best.rep, agree: best.count, total: proposals.length };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
  const minAgreeArg = args.find((a) => a.startsWith("--min-agree="));
  const minAgree = minAgreeArg ? parseInt(minAgreeArg.slice("--min-agree=".length), 10) : 2;

  const jsonPath = resolve(process.cwd(), "scripts/data/shinse-backfill-candidates.json");
  const data = JSON.parse(readFileSync(jsonPath, "utf8")) as { candidates: Candidate[] };
  const safe = data.candidates.filter((c) => c.autoSafe && (!only || only.has(c.group)));

  const plan: Array<{ group: string; itemKey: string; before: string; after: string; agree: number; total: number }> = [];
  const skipped: string[] = [];

  for (const c of safe) {
    const best = pickBestIntro(c.proposals);
    if (!best) {
      skipped.push(`${c.group}/${c.itemKey}: ไม่มี variant ยาวพอ (≥${MIN_LEN})`);
      continue;
    }
    if (best.agree < minAgree) {
      skipped.push(`${c.group}/${c.itemKey}: agreement ${best.agree}/${best.total} < ${minAgree}`);
      continue;
    }
    const after = cleanForStore(best.text);
    const nAfter = normBody(after);
    const nBefore = normBody(c.currentText);
    // ต้อง "ต่างอย่างมีนัย" — กันเขียนทับด้วยความต่างระดับช่องว่าง/เครื่องหมาย (1-4 ตัว)
    if (nAfter === nBefore || Math.abs(nAfter.length - nBefore.length) < 20) {
      skipped.push(`${c.group}/${c.itemKey}: ต่างจากเดิมไม่มีนัย (Δ${nAfter.length - nBefore.length}) — ไม่เขียน`);
      continue;
    }
    plan.push({ group: c.group, itemKey: c.itemKey, before: c.currentText, after, agree: best.agree, total: best.total });
  }

  console.log(`\n=== back-fill plan (${dryRun ? "DRY-RUN" : "WRITE"}) — จะเขียน ${plan.length} cell, ข้าม ${skipped.length} ===\n`);
  for (const p of plan) {
    console.log(`■ ${p.group}/${p.itemKey}  (ซินแสตรงกัน ${p.agree}/${p.total})`);
    console.log(`  ก่อน (${p.before.length}): ${p.before.replace(/\s+/g, " ").slice(0, 110)}`);
    console.log(`  หลัง (${p.after.length}): ${p.after.replace(/\s+/g, " ").slice(0, 110)}\n`);
  }
  if (skipped.length) {
    console.log("ข้าม:");
    for (const s of skipped) console.log(`  - ${s}`);
  }

  if (dryRun) {
    console.log("\n(DRY-RUN: ไม่เขียน DB) — ตรวจแล้วรัน `npm run backfill:shinse` เพื่อเขียนจริง");
    process.exit(0);
  }
  if (plan.length === 0) {
    console.log("\nไม่มี cell ให้เขียน");
    process.exit(0);
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const updatedBy = `shinse-backfill-${stamp}`;
  const db = createDbClient();
  let written = 0;
  for (const p of plan) {
    // อ่านแถวเดิมเพื่อรักษา ordinal/label/sourceFile
    const rows = await db
      .select({ value: baziNewdata.value, ordinal: baziNewdata.ordinal, sourceFile: baziNewdata.sourceFile })
      .from(baziNewdata)
      .where(and(eq(baziNewdata.groupKey, p.group), eq(baziNewdata.itemKey, p.itemKey)))
      .limit(1);
    const existing = rows[0];
    const newValue: NewdataValue = { ...(existing?.value ?? { text: "" }), text: p.after };
    await db
      .insert(baziNewdata)
      .values({
        groupKey: p.group,
        itemKey: p.itemKey,
        ordinal: existing?.ordinal ?? 0,
        value: newValue,
        sourceFile: existing?.sourceFile ?? "shinse-backfill",
        updatedBy,
      })
      .onConflictDoUpdate({
        target: [baziNewdata.groupKey, baziNewdata.itemKey],
        set: { value: newValue, updatedBy, updatedAt: sql`now()` },
      });
    written += 1;
    console.log(`  ✓ เขียน ${p.group}/${p.itemKey}`);
  }
  console.log(`\nเขียนเสร็จ ${written} cell (updated_by=${updatedBy})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

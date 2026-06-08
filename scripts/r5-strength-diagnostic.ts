/**
 * R5 diagnostic — วัด divergence ระหว่าง engine กับ ground truth ซินแส
 * (strength band + useful-god + 调候 gap) แบบ deterministic ไม่เรียก network
 * ออก out/r5/divergence.md
 *
 * Usage: npx tsx scripts/r5-strength-diagnostic.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { RawInputSchema } from "@/lib/bazi/schema-types";
import {
  getEngineUsefulElements,
  getEngineStrengthBand,
} from "@/lib/bazi/topic-knowledge";

import { createTestKnowledgeRepository } from "../tests/helpers/bazi-test-knowledge-repository";
import {
  SINSAE_GROUND_TRUTH,
  BAND_ORDER,
  type SinsaeBand,
  type ThElement,
} from "./lib/sinsae-ground-truth";

// month branch → ฤดู (สำเนา SEASON_BY_BRANCH ภายใน topic-knowledge เพื่อเลี่ยง export เพิ่ม)
const SEASON_BY_BRANCH: Record<string, "spring" | "summer" | "autumn" | "winter"> = {
  寅: "spring", 卯: "spring", 辰: "spring",
  巳: "summer", 午: "summer", 未: "summer",
  申: "autumn", 酉: "autumn", 戌: "autumn",
  亥: "winter", 子: "winter", 丑: "winter",
};
const SEASON_TH = { spring: "ใบไม้ผลิ", summer: "ร้อน", autumn: "ใบไม้ร่วง", winter: "หนาว" };

type Row = {
  name: string;
  dayMaster: string;
  season: string;
  score: number;
  engineBand: SinsaeBand;
  sinsaeBand: SinsaeBand;
  bandDelta: number;
  engineUseful: string[];
  sinsaeUseful: ThElement[];
  usefulMissing: ThElement[];
  usefulExtra: string[];
  tiaohouGap: string;
};

async function main() {
  const repository = createTestKnowledgeRepository();
  const rows: Row[] = [];
  for (const c of SINSAE_GROUND_TRUTH) {
    const raw = RawInputSchema.parse({
      birthDate: c.birthDate, birthTime: c.birthTime, gender: c.gender,
      province: "Bangkok", calendarSystem: "solar", timezone: "Asia/Bangkok",
    });
    const state = await calculateBaziChart(raw, repository);
    const score = state.strengthScore;
    const engineBand = getEngineStrengthBand(state) as SinsaeBand;
    const engineUseful = getEngineUsefulElements(state);
    const monthBranch = state.fourPillars.month.branch;
    const season = SEASON_BY_BRANCH[monthBranch] ?? "?";
    const seasonTh = SEASON_TH[season as keyof typeof SEASON_TH] ?? season;

    const bandDelta =
      BAND_ORDER.indexOf(engineBand) - BAND_ORDER.indexOf(c.sinsaeBand);
    const usefulMissing = c.sinsaeUseful.filter((e) => !engineUseful.includes(e));
    const usefulExtra = engineUseful.filter((e) => !c.sinsaeUseful.includes(e as ThElement));

    let tiaohouGap = "-";
    if (c.sinsaeUseful.length > 0) {
      if (season === "summer" && c.sinsaeUseful.includes("น้ำ") && !engineUseful.includes("น้ำ")) {
        tiaohouGap = "ร้อน→ขาดน้ำ";
      } else if (season === "winter" && c.sinsaeUseful.includes("ไฟ") && !engineUseful.includes("ไฟ")) {
        tiaohouGap = "หนาว→ขาดไฟ";
      }
    }

    rows.push({
      name: c.name, dayMaster: state.dayMaster, season: seasonTh, score,
      engineBand, sinsaeBand: c.sinsaeBand, bandDelta,
      engineUseful, sinsaeUseful: c.sinsaeUseful, usefulMissing, usefulExtra, tiaohouGap,
    });
    process.stderr.write(`  done: ${c.name}\n`);
  }

  // ───────── สรุป ─────────
  const withUseful = rows.filter((r) => r.sinsaeUseful.length > 0);
  const bandOff = rows.filter((r) => r.bandDelta !== 0);
  const usefulOff = withUseful.filter((r) => r.usefulMissing.length > 0);
  const tiaohou = withUseful.filter((r) => r.tiaohouGap !== "-");

  const lines: string[] = [];
  lines.push("# R5 divergence: engine vs ซินแส (strength band + useful-god)", "");
  lines.push(
    `charts: ${rows.length} · band ต่าง: ${bandOff.length} · useful ขาด: ${usefulOff.length}/${withUseful.length} · 调候 gap: ${tiaohou.length}`,
    "",
  );
  lines.push("## ตาราง");
  lines.push("| chart | ดิถี | ฤดู | score | engine band | ซินแส band | Δband | engine useful | ซินแส useful | ขาด | เกิน | 调候 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.name} | ${r.dayMaster} | ${r.season} | ${r.score} | ${r.engineBand} | ${r.sinsaeBand} | ${r.bandDelta} | ${r.engineUseful.join(",")} | ${r.sinsaeUseful.join(",") || "-"} | ${r.usefulMissing.join(",") || "-"} | ${r.usefulExtra.join(",") || "-"} | ${r.tiaohouGap} |`,
    );
  }
  lines.push("");
  lines.push("## ข้อสังเกต (auto)");
  lines.push(`- band กดแรงกว่าซินแส (Δ<0): ${rows.filter((r) => r.bandDelta < 0).map((r) => r.name).join(", ") || "ไม่มี"}`);
  lines.push(`- 调候 gap (ร้อนขาดน้ำ/หนาวขาดไฟ): ${tiaohou.map((r) => `${r.name}[${r.tiaohouGap}]`).join(", ") || "ไม่มี"}`);
  lines.push(`- useful ขาดธาตุที่ซินแสมี: ${usefulOff.map((r) => `${r.name}{${r.usefulMissing.join("/")}}`).join(", ") || "ไม่มี"}`);

  mkdirSync("out/r5", { recursive: true });
  writeFileSync("out/r5/divergence.md", lines.join("\n"), "utf8");
  console.log(`เขียน out/r5/divergence.md (${rows.length} charts)`);
  console.log(lines.slice(0, 4).join("\n"));
}

void main();

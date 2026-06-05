import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

import { getDatabaseUrl } from "../src/lib/env";
import {
  CANONICAL_DAY_MASTER_STRENGTH_STATES,
  resolveCanonicalDayMasterStrengthState,
} from "../src/lib/bazi/strength-state-vocabulary";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: false, quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;

type StrengthRow = {
  day_master_chinese: string | null;
  strength_state: string | null;
  score_text: string | null;
  narrative_summary: string | null;
};

function resolveRowState(row: StrengthRow) {
  return (
    resolveCanonicalDayMasterStrengthState(row.strength_state) ??
    resolveCanonicalDayMasterStrengthState(row.score_text)
  );
}

async function main() {
  const sql = neon(getDatabaseUrl());

  const rows = (await sql`
    select day_master_chinese, strength_state, score_text, narrative_summary
    from bazi_day_master_strength_states
    where day_master_chinese is not null
      and nullif(btrim(coalesce(narrative_summary, '')), '') is not null
  `) as StrengthRow[];

  // covered[dayMaster][canonicalState] = true when a usable narrative exists.
  const covered = new Map<string, Set<string>>();

  for (const row of rows) {
    const dayMaster = row.day_master_chinese?.trim();
    if (!dayMaster) {
      continue;
    }

    const resolution = resolveRowState(row);
    if (!resolution) {
      continue;
    }

    if (!covered.has(dayMaster)) {
      covered.set(dayMaster, new Set());
    }
    covered.get(dayMaster)!.add(resolution.lookupState);
  }

  const missing: Array<{ dayMaster: string; state: string }> = [];

  console.log("Day-master strength profile coverage (canonical lookup states):\n");
  for (const dayMaster of HEAVENLY_STEMS) {
    const states = covered.get(dayMaster) ?? new Set<string>();
    const cells = CANONICAL_DAY_MASTER_STRENGTH_STATES.map((state) => {
      const ok = states.has(state);
      if (!ok) {
        missing.push({ dayMaster, state });
      }
      return `${ok ? "✓" : "✗"} ${state}`;
    });
    console.log(`  ${dayMaster}  ${cells.join("   ")}`);
  }

  const total = HEAVENLY_STEMS.length * CANONICAL_DAY_MASTER_STRENGTH_STATES.length;
  console.log(`\nCovered ${total - missing.length}/${total} combinations.`);

  if (missing.length > 0) {
    console.log(`\nMissing ${missing.length} combinations:`);
    for (const entry of missing) {
      console.log(`  - ${entry.dayMaster} | ${entry.state}`);
    }
    process.exitCode = 1;
  } else {
    console.log("\nAll (day master × strength state) combinations have a narrative profile.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

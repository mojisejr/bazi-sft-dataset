/**
 * Hour Rectification (สอบยาม) — offline generation button (#hour-rectification-engine).
 * Mirrors scripts/compile-knowledge.ts's CLI convention. Run manually, never wrap in a
 * retry/supervisor loop (ฟีม's explicit instruction) — a budget-exhausted stop is an acceptable
 * outcome, not a bug to auto-retry past.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/generate-rectification-network.ts
 *   node --env-file=.env --import tsx scripts/generate-rectification-network.ts \
 *     --birthDate 1990-05-15 --gender male --province กรุงเทพมหานคร
 *
 * ⚠️ Design note (flagging explicitly, not silently assumed): the 12 candidate charts are
 * computed from ONE reference profile (defaults below, overridable via flags) — the resulting
 * question tree's questions are written to be generic life-experience patterns (ten-god role,
 * twelve-qi stage, element flavor), not tied to this one profile's specific day/month/year
 * interactions, so it's intended to generalize to any real user at runtime. If a different
 * reference profile was intended, override via the flags above before running.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateHourRectificationNetwork } from "@/lib/bazi/hour-rectification/generate-network";
import type { ChartProfileBaseInput } from "@/lib/bazi/hour-rectification/adapters/chart-profile-adapter";

const DEFAULT_REFERENCE_PROFILE: ChartProfileBaseInput = {
  birthDate: "1990-05-15",
  gender: "male",
  province: "กรุงเทพมหานคร",
};

function parseArgs(argv: string[]): Partial<ChartProfileBaseInput> {
  const out: Partial<ChartProfileBaseInput> = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--birthDate" && value) out.birthDate = value;
    if (flag === "--gender" && value) out.gender = value;
    if (flag === "--province" && value) out.province = value;
  }
  return out;
}

function isMainModule() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return currentFilePath === executedPath;
}

export async function main() {
  const overrides = parseArgs(process.argv.slice(2));
  const baseInput: ChartProfileBaseInput = { ...DEFAULT_REFERENCE_PROFILE, ...overrides };

  console.log("=== Hour Rectification — generate question network ===");
  console.log("Reference profile:", JSON.stringify(baseInput));
  console.log("");

  const outcome = await generateHourRectificationNetwork(baseInput);

  if (outcome.status === "success") {
    console.log(`✅ SUCCESS — question network written to ${outcome.writtenPath}`);
    console.log(`   LLM calls used: ${outcome.callsUsed}`);
    console.log(`   Nodes: ${Object.keys(outcome.network.nodes).length}`);
    return;
  }

  if (outcome.status === "budget-exhausted") {
    console.error(
      `🛑 STOPPED — LLM call budget exhausted at call ${outcome.callsUsed}/${outcome.maxCalls}. ` +
        `This is an accepted outcome for an overnight run, not a crash.`,
    );
    console.error(`   Draft saved (NOT the real artifact) at: ${outcome.draftPath}`);
    console.error(`   Remaining validation issues (${outcome.issues.length}):`);
    for (const issue of outcome.issues) {
      console.error(`   - ${JSON.stringify(issue)}`);
    }
    console.error(
      "   The real question-network.json was NOT overwritten. ฟีม can review the draft and " +
        "decide whether to raise RECTIFICATION_MAX_LLM_CALLS and re-run.",
    );
    process.exitCode = 1;
    return;
  }

  console.error(`❌ ERROR at call ${outcome.callsUsed}: ${outcome.reason}`);
  process.exitCode = 1;
}

if (isMainModule()) {
  main().catch((error) => {
    console.error("Unexpected crash:", error);
    process.exitCode = 1;
  });
}

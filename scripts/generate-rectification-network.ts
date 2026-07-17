/**
 * Hour Rectification (สอบยาม) — offline generation button (#hour-rectification-engine, v1).
 * Mirrors scripts/compile-knowledge.ts's CLI convention. Run manually, never wrap in a
 * retry/supervisor loop (ฟีม's explicit instruction) — a budget-exhausted stop is an acceptable
 * outcome, not a bug to auto-retry past.
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/generate-rectification-network.ts
 *   node --env-file=.env --import tsx scripts/generate-rectification-network.ts \
 *     --size 24 --sample 1989-01-03 --sample 1990-05-15
 *
 * v1 note: the question BANK is person-agnostic — it tags behaviour with structural-signature
 * properties (element/role/strength), and the runtime matches those against each real user's own
 * 12 hour charts. So generation needs no single "reference profile" the way v0 did. The --sample
 * birth dates are recorded in meta for provenance and used by the self-consistency test suite
 * (tests/rectification-*.test.ts), not by generation itself.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateHourRectificationNetwork } from "@/lib/bazi/hour-rectification/generate-network";

type ScriptArgs = {
  targetBankSize?: number;
  sampleBirthDates: string[];
};

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = { sampleBirthDates: [] };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--size" && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) out.targetBankSize = parsed;
    }
    if (flag === "--sample" && value) out.sampleBirthDates.push(value);
  }
  return out;
}

function isMainModule() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return currentFilePath === executedPath;
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("=== Hour Rectification — generate question bank (v1) ===");
  console.log(`Target bank size: ${args.targetBankSize ?? "default"}`);
  console.log(`Sample birth dates (provenance): ${args.sampleBirthDates.join(", ") || "none"}`);
  console.log("");

  const outcome = await generateHourRectificationNetwork({
    targetBankSize: args.targetBankSize,
    sampleBirthDates: args.sampleBirthDates.length ? args.sampleBirthDates : undefined,
  });

  if (outcome.status === "success") {
    console.log(`✅ SUCCESS — question bank written to ${outcome.writtenPath}`);
    console.log(`   LLM calls used: ${outcome.callsUsed}`);
    console.log(`   Questions: ${outcome.bank.questions.length}`);
    return;
  }

  if (outcome.status === "budget-exhausted") {
    console.error(
      `🛑 STOPPED — LLM call budget exhausted at call ${outcome.callsUsed}/${outcome.maxCalls}. ` +
        `This is an accepted outcome, not a crash.`,
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

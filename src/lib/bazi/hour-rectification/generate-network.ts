// Hour Rectification — generate-network use-case (#hour-rectification-engine, OFFLINE only).
//
// The algorithm (guaranteed by CODE, not by hoping the LLM followed instructions):
//   1. Compute 12 real charts (chart-profile-adapter)
//   2. LLM drafts the first full tree (call 1: summarize profiles, call 2: generate tree)
//   3. Run validate-tree.ts immediately
//   4. If broken: ask the LLM to repair ONLY the implicated branch (call 3-10), re-validate
//   5. Repeat until valid OR the budget guard says stop — only THEN write the real artifact.
//
// Budget-exhausted is an acceptable, honest outcome (ฟีม's own framing) — never silently retried,
// never auto-looped. The real question-network.json is NEVER overwritten unless validation
// passed in full; a budget-exhausted draft is saved separately so no overnight work is lost.
import { buildHourChartProfiles, type ChartProfileBaseInput } from "./adapters/chart-profile-adapter";
import {
  createLlmQuestionGenerator,
  LlmBudgetExceededError,
  type LlmQuestionGenerator,
} from "./adapters/llm-question-generator";
import { writeDraftQuestionNetwork, writeQuestionNetwork } from "./adapters/network-repository";
import { validateQuestionNetwork, type ValidationIssue } from "./domain/validate-tree";
import type { QuestionNetwork } from "./domain/types";

export type GenerateNetworkOutcome =
  | {
      status: "success";
      network: QuestionNetwork;
      callsUsed: number;
      writtenPath: string;
    }
  | {
      status: "budget-exhausted";
      lastNetwork: QuestionNetwork;
      issues: ValidationIssue[];
      callsUsed: number;
      maxCalls: number;
      draftPath: string;
    }
  | {
      status: "error";
      reason: string;
      callsUsed: number;
    };

export type GenerateNetworkDeps = {
  repoRoot?: string;
  generatorDeps?: Parameters<typeof createLlmQuestionGenerator>[0];
};

export async function generateHourRectificationNetwork(
  baseInput: ChartProfileBaseInput,
  deps: GenerateNetworkDeps = {},
): Promise<GenerateNetworkOutcome> {
  const generator: LlmQuestionGenerator = createLlmQuestionGenerator(deps.generatorDeps);

  try {
    const profiles = await buildHourChartProfiles(baseInput);
    const profileSummary = await generator.summarizeProfiles(profiles); // call 1
    let network = await generator.generateFullTree(profileSummary); // call 2
    let result = validateQuestionNetwork(network);

    while (!result.valid) {
      // Check BEFORE attempting another call — never let a repair attempt itself be the one
      // that silently blows the budget.
      if (generator.getCallCount() >= generator.getMaxCalls()) {
        const draftPath = writeDraftQuestionNetwork(network, deps.repoRoot);
        return {
          status: "budget-exhausted",
          lastNetwork: network,
          issues: result.issues,
          callsUsed: generator.getCallCount(),
          maxCalls: generator.getMaxCalls(),
          draftPath,
        };
      }
      network = await generator.repairIssues(network, result.issues, profileSummary); // call 3-10
      result = validateQuestionNetwork(network);
    }

    const finalNetwork: QuestionNetwork = {
      ...network,
      generatedAt: new Date().toISOString(),
      meta: { ...network.meta, llmCallsUsed: generator.getCallCount() },
    };
    const writtenPath = writeQuestionNetwork(finalNetwork, deps.repoRoot);
    return {
      status: "success",
      network: finalNetwork,
      callsUsed: generator.getCallCount(),
      writtenPath,
    };
  } catch (error) {
    // Defensive fallback only — the proactive getCallCount()/getMaxCalls() check above should
    // always catch this first. Treated the same conservative way either way: report and stop,
    // never retry automatically.
    if (error instanceof LlmBudgetExceededError) {
      return { status: "error", reason: error.message, callsUsed: generator.getCallCount() };
    }
    return {
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
      callsUsed: generator.getCallCount(),
    };
  }
}

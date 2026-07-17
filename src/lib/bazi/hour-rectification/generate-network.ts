// Hour Rectification — generate-network use-case (#hour-rectification-engine, v1 OFFLINE only).
//
// The algorithm (guaranteed by CODE, not by hoping the LLM followed instructions):
//   1. LLM drafts the whole question bank (call 1) — person-agnostic, behaviour→signature tags.
//   2. Run validate-tree.ts immediately (bank size, option/evidence sanity, 4-dimension coverage).
//   3. If invalid: ask the LLM to repair ONLY the reported problems (call 2+), re-validate.
//   4. Repeat until valid OR the budget guard says stop — only THEN write the real artifact.
//
// Budget-exhausted is an acceptable, honest outcome (ฟีม's own framing) — never silently retried,
// never auto-looped. The real question-network.json is NEVER overwritten unless validation passed
// in full; a budget-exhausted draft is saved separately so no work is lost.
import {
  createLlmQuestionGenerator,
  LlmBudgetExceededError,
  type LlmQuestionGenerator,
} from "./adapters/llm-question-generator";
import { writeDraftQuestionBank, writeQuestionBank } from "./adapters/network-repository";
import { validateQuestionBank, type ValidationIssue } from "./domain/validate-tree";
import type { QuestionBank } from "./domain/types";

export const DEFAULT_TARGET_BANK_SIZE = 22;

export type GenerateNetworkOutcome =
  | {
      status: "success";
      bank: QuestionBank;
      callsUsed: number;
      writtenPath: string;
    }
  | {
      status: "budget-exhausted";
      lastBank: QuestionBank;
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
  targetBankSize?: number;
  sampleBirthDates?: string[];
  generatorDeps?: Parameters<typeof createLlmQuestionGenerator>[0];
  // Injected so this module (and the pure repository) never call Date.* directly.
  now?: () => Date;
};

export async function generateHourRectificationNetwork(
  deps: GenerateNetworkDeps = {},
): Promise<GenerateNetworkOutcome> {
  const generator: LlmQuestionGenerator = createLlmQuestionGenerator(deps.generatorDeps);
  const now = deps.now ?? (() => new Date());
  const targetSize = deps.targetBankSize ?? DEFAULT_TARGET_BANK_SIZE;

  try {
    let bank = await generator.generateBank(targetSize); // call 1
    let result = validateQuestionBank(bank);

    while (!result.valid) {
      // Check BEFORE attempting another call — never let a repair attempt itself be the one that
      // silently blows the budget.
      if (generator.getCallCount() >= generator.getMaxCalls()) {
        const draftPath = writeDraftQuestionBank(
          bank,
          String(now().getTime()),
          deps.repoRoot,
        );
        return {
          status: "budget-exhausted",
          lastBank: bank,
          issues: result.issues,
          callsUsed: generator.getCallCount(),
          maxCalls: generator.getMaxCalls(),
          draftPath,
        };
      }
      bank = await generator.repairBank(bank, result.issues); // call 2+
      result = validateQuestionBank(bank);
    }

    const finalBank: QuestionBank = {
      ...bank,
      version: "v1-personal-matching",
      generatedAt: now().toISOString(),
      meta: {
        ...bank.meta,
        llmCallsUsed: generator.getCallCount(),
        sampleBirthDates: deps.sampleBirthDates,
      },
    };
    const writtenPath = writeQuestionBank(finalBank, deps.repoRoot);
    return {
      status: "success",
      bank: finalBank,
      callsUsed: generator.getCallCount(),
      writtenPath,
    };
  } catch (error) {
    // Defensive fallback only — the proactive getCallCount()/getMaxCalls() check above should
    // always catch this first. Treated the same conservative way either way: report and stop.
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

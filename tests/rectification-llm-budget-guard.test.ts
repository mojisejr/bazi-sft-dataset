// Hour Rectification — LLM call budget guard (#hour-rectification-engine, v1, MANDATORY per
// dispatch). ฟีม is worried about runaway API cost on an unattended overnight generation run — this
// test proves the guard throws LlmBudgetExceededError BEFORE the network request that would exceed
// budget, using a mock callLlm that COUNTS real invocations. The single most important property:
// the counting mock is NEVER invoked for the call that would blow the budget (count == max, not
// max+1). Both the generateBank path (call 1) and the repairBank path (call 2+) funnel through the
// same guard and share one budget. Cap default is now 20 (raised from v0's 10).
import { describe, expect, test } from "vitest";
import {
  createLlmQuestionGenerator,
  DEFAULT_MAX_LLM_CALLS,
  LlmBudgetExceededError,
  resolveMaxLlmCalls,
} from "@/lib/bazi/hour-rectification/adapters/llm-question-generator";
import type { QuestionBank } from "@/lib/bazi/hour-rectification/domain/types";
import type { ValidationIssue } from "@/lib/bazi/hour-rectification/domain/validate-tree";

// Well-formed wire JSON so generateBank/repairBank's parser/translator never throws on its own —
// the mock caller ignores content; only the real-call-count matters for the guard proof.
const MINIMAL_BANK_JSON = JSON.stringify({
  questions: [
    {
      id: "q1",
      question: "ทดสอบ",
      options: [
        { id: "a", label: "A", evidence: [{ dimension: "stemElement", value: "fire", weight: 2 }] },
        { id: "b", label: "B", evidence: [{ dimension: "stemRole", value: "resource", weight: 1 }] },
      ],
    },
  ],
});

// A minimal existing bank to hand repairBank (it merges patched questions into this by id).
function fakeBank(): QuestionBank {
  return {
    version: "test",
    generatedAt: "2026-07-17T00:00:00.000Z",
    questions: [
      {
        id: "q1",
        question: "x",
        options: [
          { id: "a", label: "a", evidence: [{ dimension: "stemElement", value: "water", weight: 1 }] },
          { id: "b", label: "b", evidence: [{ dimension: "strengthBucket", value: "weak", weight: 1 }] },
        ],
      },
    ],
  };
}

function fakeIssues(): ValidationIssue[] {
  return [{ code: "TOO_FEW_OPTIONS", questionId: "q1", optionCount: 1 }];
}

describe("resolveMaxLlmCalls", () => {
  test("defaults to 20 with no env override (v1 raised the cap from v0's 10)", () => {
    expect(resolveMaxLlmCalls({})).toBe(DEFAULT_MAX_LLM_CALLS);
    expect(DEFAULT_MAX_LLM_CALLS).toBe(20);
  });

  test("honors RECTIFICATION_MAX_LLM_CALLS when set to a valid positive integer", () => {
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "3" })).toBe(3);
  });

  test("falls back to default on garbage / non-positive env values (never crashes, never 0/negative)", () => {
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "not-a-number" })).toBe(
      DEFAULT_MAX_LLM_CALLS,
    );
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "-5" })).toBe(DEFAULT_MAX_LLM_CALLS);
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "0" })).toBe(DEFAULT_MAX_LLM_CALLS);
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "   " })).toBe(DEFAULT_MAX_LLM_CALLS);
  });
});

describe("createLlmQuestionGenerator — reports its resolved budget", () => {
  test("with no override, getMaxCalls() is the default 20", () => {
    const generator = createLlmQuestionGenerator({ callLlm: async () => ({ text: MINIMAL_BANK_JSON, model: "mock" }), env: {} });
    expect(generator.getMaxCalls()).toBe(DEFAULT_MAX_LLM_CALLS);
    expect(generator.getCallCount()).toBe(0);
  });
});

describe("LLM call budget guard — the mandatory test", () => {
  test("the (max+1)th real call NEVER fires — guard throws BEFORE invoking the counting mock", async () => {
    // Low cap so the boundary is cheap to exercise: generateBank + repairBank = 2 calls, the 3rd
    // must throw before the network. (Same guard as the default-20 path, just fewer iterations.)
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1; // proves whether a real request WOULD have fired
      return { text: MINIMAL_BANK_JSON, model: "mock" };
    };

    const generator = createLlmQuestionGenerator({ callLlm: mockCallLlm, maxCalls: 2 });
    expect(generator.getMaxCalls()).toBe(2);

    await generator.generateBank(20); // call 1 (generate path)
    await generator.repairBank(fakeBank(), fakeIssues()); // call 2 (repair path)

    expect(generator.getCallCount()).toBe(2);
    expect(realInvocationCount).toBe(2);

    // The 3rd attempted call — the one that must NEVER reach the network.
    await expect(generator.repairBank(fakeBank(), fakeIssues())).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );

    // THE critical assertion: the counting mock was called exactly `max` times, NOT max+1. If the
    // guard checked AFTER calling instead of BEFORE, this would be 3.
    expect(realInvocationCount).toBe(2);
    expect(generator.getCallCount()).toBe(2);
  });

  test("both generateBank and repairBank share ONE budget — not a separate counter per method", async () => {
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1;
      return { text: MINIMAL_BANK_JSON, model: "mock" };
    };
    const generator = createLlmQuestionGenerator({ callLlm: mockCallLlm, maxCalls: 2 });

    await generator.generateBank(20); // call 1/2
    await generator.generateBank(20); // call 2/2 (still generate path — budget is shared, not reset)

    // Now a repair would be the 3rd overall call → blocked, even though repairBank itself has never
    // run. Proves the counter is instance-wide, not per-method.
    await expect(generator.repairBank(fakeBank(), fakeIssues())).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    expect(realInvocationCount).toBe(2);
  });

  test("RECTIFICATION_MAX_LLM_CALLS env override is honored end-to-end (not just in resolveMaxLlmCalls)", async () => {
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1;
      return { text: MINIMAL_BANK_JSON, model: "mock" };
    };
    const generator = createLlmQuestionGenerator({
      callLlm: mockCallLlm,
      env: { RECTIFICATION_MAX_LLM_CALLS: "1" },
    });
    expect(generator.getMaxCalls()).toBe(1);

    await generator.generateBank(20); // uses the 1 allowed call
    await expect(generator.repairBank(fakeBank(), fakeIssues())).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    expect(realInvocationCount).toBe(1);
  });

  test("the thrown error carries the attempted-call index and the cap for diagnostics", async () => {
    const generator = createLlmQuestionGenerator({
      callLlm: async () => ({ text: MINIMAL_BANK_JSON, model: "mock" }),
      maxCalls: 1,
    });
    await generator.generateBank(20); // burns the 1 call
    try {
      await generator.generateBank(20);
      throw new Error("expected LlmBudgetExceededError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LlmBudgetExceededError);
      const budgetError = error as LlmBudgetExceededError;
      expect(budgetError.attemptedCall).toBe(2); // the call that would have exceeded
      expect(budgetError.maxCalls).toBe(1);
    }
  });
});

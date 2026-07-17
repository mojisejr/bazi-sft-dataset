// Hour Rectification — LLM call budget guard (#hour-rectification-engine, MANDATORY per dispatch).
// ฟีม is worried about runaway API cost on an unattended overnight run — this test proves call #11
// never fires a network request, using a mock LLM caller that counts real invocations.
import { describe, expect, test } from "vitest";
import {
  createLlmQuestionGenerator,
  DEFAULT_MAX_LLM_CALLS,
  LlmBudgetExceededError,
  resolveMaxLlmCalls,
} from "@/lib/bazi/hour-rectification/adapters/llm-question-generator";
import type { HourChartProfile } from "@/lib/bazi/hour-rectification/adapters/chart-profile-adapter";
import type { QuestionNetwork } from "@/lib/bazi/hour-rectification/domain/types";
import type { ValidationIssue } from "@/lib/bazi/hour-rectification/domain/validate-tree";

const MINIMAL_TREE_JSON = JSON.stringify({
  rootNodeId: "q1",
  nodes: [
    {
      id: "q1",
      question: "ทดสอบ",
      options: [
        { id: "a", label: "A", next: { type: "result", hourBranch: "子" } },
        { id: "b", label: "B", next: { type: "result", hourBranch: "丑" } },
      ],
    },
  ],
});

function fakeProfiles(): HourChartProfile[] {
  // Minimal stand-in shape — the mock caller ignores content, only real-call-count matters here.
  return [{ hourBranch: "子", chart: {} as HourChartProfile["chart"] }];
}

function fakeNetwork(): QuestionNetwork {
  return {
    version: "test",
    generatedAt: "2026-07-17T00:00:00.000Z",
    rootNodeId: "q1",
    nodes: {
      q1: {
        id: "q1",
        question: "x",
        options: [
          { id: "a", label: "a", next: { kind: "result", hourBranch: "子" } },
          { id: "b", label: "b", next: { kind: "result", hourBranch: "丑" } },
        ],
      },
    },
  };
}

function fakeIssue(): ValidationIssue[] {
  return [{ code: "TOO_FEW_OPTIONS", nodeId: "q1", optionCount: 1 }];
}

describe("resolveMaxLlmCalls", () => {
  test("defaults to 10 with no env override", () => {
    expect(resolveMaxLlmCalls({})).toBe(DEFAULT_MAX_LLM_CALLS);
    expect(DEFAULT_MAX_LLM_CALLS).toBe(10);
  });

  test("honors RECTIFICATION_MAX_LLM_CALLS when set to a valid positive integer", () => {
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "3" })).toBe(3);
  });

  test("falls back to default on a garbage env value (never crashes, never silently 0/negative)", () => {
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "not-a-number" })).toBe(
      DEFAULT_MAX_LLM_CALLS,
    );
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "-5" })).toBe(DEFAULT_MAX_LLM_CALLS);
    expect(resolveMaxLlmCalls({ RECTIFICATION_MAX_LLM_CALLS: "0" })).toBe(DEFAULT_MAX_LLM_CALLS);
  });
});

describe("LLM call budget guard — the mandatory test", () => {
  test("call #11 never invokes the real caller — throws LlmBudgetExceededError BEFORE the network request", async () => {
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1; // proves whether a real request would have fired
      return { text: MINIMAL_TREE_JSON, model: "mock" };
    };

    const generator = createLlmQuestionGenerator({ callLlm: mockCallLlm, maxCalls: 10 });

    // Burn exactly 10 calls: 1 summarize + 1 generate + 8 repairs = 10, all within budget.
    await generator.summarizeProfiles(fakeProfiles()); // call 1
    await generator.generateFullTree("summary"); // call 2
    for (let i = 0; i < 8; i++) {
      await generator.repairIssues(fakeNetwork(), fakeIssue(), "summary"); // calls 3-10
    }

    expect(generator.getCallCount()).toBe(10);
    expect(realInvocationCount).toBe(10);

    // The 11th attempted call — this is the one that must NEVER reach the network.
    await expect(
      generator.repairIssues(fakeNetwork(), fakeIssue(), "summary"),
    ).rejects.toBeInstanceOf(LlmBudgetExceededError);

    // The critical assertion: the mock (standing in for "a real network request") was NOT called
    // an 11th time. If the guard checked AFTER calling instead of BEFORE, this would be 11.
    expect(realInvocationCount).toBe(10);
    expect(generator.getCallCount()).toBe(10);
  });

  test("budget is shared across summarize/generate/repair — not a separate counter per method", async () => {
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1;
      return { text: MINIMAL_TREE_JSON, model: "mock" };
    };
    const generator = createLlmQuestionGenerator({ callLlm: mockCallLlm, maxCalls: 2 });

    await generator.summarizeProfiles(fakeProfiles()); // call 1/2
    await generator.generateFullTree("summary"); // call 2/2

    await expect(generator.repairIssues(fakeNetwork(), fakeIssue(), "summary")).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    expect(realInvocationCount).toBe(2);
  });

  test("RECTIFICATION_MAX_LLM_CALLS env override is honored end-to-end (not just by resolveMaxLlmCalls in isolation)", async () => {
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1;
      return { text: MINIMAL_TREE_JSON, model: "mock" };
    };
    const generator = createLlmQuestionGenerator({
      callLlm: mockCallLlm,
      env: { RECTIFICATION_MAX_LLM_CALLS: "1" },
    });

    await generator.summarizeProfiles(fakeProfiles()); // uses the 1 allowed call
    await expect(generator.generateFullTree("summary")).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    expect(realInvocationCount).toBe(1);
  });

  test("a malformed LLM response (not valid JSON) throws a clear error without corrupting the call count", async () => {
    let realInvocationCount = 0;
    const mockCallLlm = async () => {
      realInvocationCount += 1;
      return { text: "this is not json at all", model: "mock" };
    };
    const generator = createLlmQuestionGenerator({ callLlm: mockCallLlm, maxCalls: 10 });

    await expect(generator.generateFullTree("summary")).rejects.toThrow(/not valid JSON/i);
    // The call still counted against budget (a real request WAS made and billed) — the guard
    // protects against making the request, not against the request coming back malformed.
    expect(generator.getCallCount()).toBe(1);
    expect(realInvocationCount).toBe(1);
  });

  test("a fenced ```json ... ``` response is parsed correctly (LLMs commonly wrap JSON in markdown)", async () => {
    const mockCallLlm = async () => ({
      text: "```json\n" + MINIMAL_TREE_JSON + "\n```",
      model: "mock",
    });
    const generator = createLlmQuestionGenerator({ callLlm: mockCallLlm, maxCalls: 10 });
    const tree = await generator.generateFullTree("summary");
    expect(tree.rootNodeId).toBe("q1");
    expect(Object.keys(tree.nodes)).toEqual(["q1"]);
  });
});

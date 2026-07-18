// Hour Rectification — traverse.ts (#hour-rectification-engine, v1). The adaptive bank walk. The
// property that matters most here is DETERMINISM: the stateless API replays the whole session from
// (birthData, answeredSteps) on every request, so selectNextQuestion MUST be a pure function of its
// inputs — same inputs, same next question — or the question sequence would shift mid-session.
import { describe, expect, test } from "vitest";
import {
  accumulateAnswers,
  MAX_QUESTIONS_TO_ASK,
  MAX_QUESTION_DEPTH,
  MIN_QUESTIONS_TO_ASK,
  selectNextQuestion,
  validateTrail,
  walkBank,
} from "@/lib/bazi/hour-rectification/domain/traverse";
import type {
  AnsweredStep,
  HourBranch,
  HourSignature,
  QuestionBank,
  StructuralSignature,
} from "@/lib/bazi/hour-rectification/domain/types";

function sig(p: Partial<StructuralSignature>): StructuralSignature {
  return {
    stemElement: "water",
    stemRole: "same",
    branchRole: "same",
    strengthBucket: "balanced",
    ...p,
  };
}
function hour(b: HourBranch, p: Partial<StructuralSignature>, s = 5): HourSignature {
  return { hourBranch: b, signature: sig(p), strengthScore: s };
}

// 12 hours with genuinely varied signatures so questions have something to discriminate.
const HOURS: HourSignature[] = [
  hour("子", { stemElement: "water", stemRole: "same", branchRole: "same", strengthBucket: "strong" }, 7),
  hour("丑", { stemElement: "water", stemRole: "same", branchRole: "power", strengthBucket: "balanced" }, 5),
  hour("寅", { stemElement: "wood", stemRole: "output", branchRole: "output", strengthBucket: "weak" }, 3),
  hour("卯", { stemElement: "wood", stemRole: "output", branchRole: "output", strengthBucket: "weak" }, 4),
  hour("辰", { stemElement: "fire", stemRole: "wealth", branchRole: "power", strengthBucket: "weak" }, 4),
  hour("巳", { stemElement: "fire", stemRole: "wealth", branchRole: "wealth", strengthBucket: "weak" }, 4),
  hour("午", { stemElement: "earth", stemRole: "power", branchRole: "wealth", strengthBucket: "weak" }, 3),
  hour("未", { stemElement: "earth", stemRole: "power", branchRole: "power", strengthBucket: "weak" }, 4),
  hour("申", { stemElement: "metal", stemRole: "resource", branchRole: "resource", strengthBucket: "strong" }, 7),
  hour("酉", { stemElement: "metal", stemRole: "resource", branchRole: "resource", strengthBucket: "strong" }, 7),
  hour("戌", { stemElement: "water", stemRole: "same", branchRole: "power", strengthBucket: "balanced" }, 5),
  hour("亥", { stemElement: "water", stemRole: "same", branchRole: "same", strengthBucket: "strong" }, 7),
];

// A bank probing all 4 dimensions across 10 questions (≥ MIN so selection never runs dry early).
function makeBank(): QuestionBank {
  const specs: { dim: string; a: string; b: string }[] = [
    { dim: "stemElement", a: "metal", b: "wood" },
    { dim: "stemRole", a: "power", b: "resource" },
    { dim: "branchRole", a: "wealth", b: "same" },
    { dim: "strengthBucket", a: "strong", b: "weak" },
    { dim: "stemElement", a: "fire", b: "earth" },
    { dim: "stemRole", a: "output", b: "wealth" },
    { dim: "branchRole", a: "output", b: "power" },
    { dim: "strengthBucket", a: "balanced", b: "strong" },
    { dim: "stemElement", a: "water", b: "metal" },
    { dim: "branchRole", a: "resource", b: "wealth" },
  ];
  const questions = specs.map((q, i) => ({
    id: `q${i + 1}`,
    question: `question ${i + 1}?`,
    options: [
      {
        id: "a",
        label: `a${i}`,
        evidence: [{ dimension: q.dim as never, value: q.a, weight: 2 }],
      },
      {
        id: "b",
        label: `b${i}`,
        evidence: [{ dimension: q.dim as never, value: q.b, weight: 2 }],
      },
    ],
  }));
  return { version: "test", generatedAt: "2026-07-18T00:00:00.000Z", questions };
}

const BANK = makeBank();

describe("accumulateAnswers", () => {
  test("collects evidence from chosen options; skips unknown ids", () => {
    const votes = accumulateAnswers(BANK, [
      { questionId: "q1", optionId: "a" }, // stemElement metal
      { questionId: "q2", optionId: "b" }, // stemRole resource
      { questionId: "nope", optionId: "a" }, // unknown → skipped
      { questionId: "q1", optionId: "zzz" }, // unknown option → skipped
    ]);
    expect(votes).toContainEqual({ dimension: "stemElement", value: "metal", weight: 2 });
    expect(votes).toContainEqual({ dimension: "stemRole", value: "resource", weight: 2 });
    expect(votes).toHaveLength(2);
  });
});

// Walk the selector for real to obtain a trail that IS in the sequence it would ask — the only
// kind validateTrail now accepts. Answers option "a" at every step.
function walkedTrail(steps: number): AnsweredStep[] {
  const answered: AnsweredStep[] = [];
  for (let i = 0; i < steps; i += 1) {
    const next = selectNextQuestion(BANK, HOURS, answered);
    if (!next) break;
    answered.push({ questionId: next.id, optionId: "a" });
  }
  return answered;
}

describe("validateTrail", () => {
  test("null for a trail that follows the selector's own sequence", () => {
    expect(validateTrail(BANK, HOURS, walkedTrail(3))).toBeNull();
  });
  test("rejects an out-of-sequence first answer", () => {
    const firstAsked = selectNextQuestion(BANK, HOURS, [])!.id;
    const wrong = BANK.questions.find((q) => q.id !== firstAsked)!.id;
    expect(validateTrail(BANK, HOURS, [{ questionId: wrong, optionId: "a" }])).toMatch(
      /out-of-sequence/,
    );
  });
  test("rejects an unknown option on the correctly-sequenced question", () => {
    const firstAsked = selectNextQuestion(BANK, HOURS, [])!.id;
    expect(validateTrail(BANK, HOURS, [{ questionId: firstAsked, optionId: "x" }])).toMatch(
      /unknown option/,
    );
  });
  test("rejects a trail longer than the engine would ever ask", () => {
    // Walk to the selector's natural stop, then append one more answer than it would ever surface.
    const full = walkedTrail(MAX_QUESTIONS_TO_ASK);
    const usedIds = new Set(full.map((s) => s.questionId));
    const spare = BANK.questions.find((q) => !usedIds.has(q.id))!.id;
    const overlong = [...full, { questionId: spare, optionId: "a" }];
    expect(validateTrail(BANK, HOURS, overlong)).toMatch(/more answers than the engine would ask/);
  });
});

describe("selectNextQuestion", () => {
  test("is deterministic — same inputs pick the same next question", () => {
    const answered: AnsweredStep[] = [{ questionId: "q1", optionId: "a" }];
    const a = selectNextQuestion(BANK, HOURS, answered);
    const b = selectNextQuestion(BANK, HOURS, answered);
    expect(a?.id).toBe(b?.id);
  });

  test("never re-asks an already-answered question", () => {
    const answered: AnsweredStep[] = [
      { questionId: "q1", optionId: "a" },
      { questionId: "q2", optionId: "a" },
    ];
    const next = selectNextQuestion(BANK, HOURS, answered);
    expect(next).not.toBeNull();
    expect(["q1", "q2"]).not.toContain(next!.id);
  });

  test("first question (no answers) is chosen, deterministically", () => {
    const first = selectNextQuestion(BANK, HOURS, []);
    expect(first).not.toBeNull();
    expect(selectNextQuestion(BANK, HOURS, [])!.id).toBe(first!.id);
  });

  test("returns null once MAX_QUESTIONS_TO_ASK have been answered", () => {
    const answered: AnsweredStep[] = Array.from({ length: MAX_QUESTIONS_TO_ASK }, (_, i) => ({
      questionId: `q${i + 1}`,
      optionId: "a",
    }));
    expect(selectNextQuestion(BANK, HOURS, answered)).toBeNull();
  });

  test("keeps asking while below MIN_QUESTIONS_TO_ASK", () => {
    for (let n = 0; n < MIN_QUESTIONS_TO_ASK; n++) {
      const answered: AnsweredStep[] = Array.from({ length: n }, (_, i) => ({
        questionId: `q${i + 1}`,
        optionId: "a",
      }));
      expect(selectNextQuestion(BANK, HOURS, answered)).not.toBeNull();
    }
  });
});

describe("walkBank", () => {
  test("error status on a malformed trail", () => {
    const out = walkBank(BANK, HOURS, [{ questionId: "ghost", optionId: "a" }]);
    expect(out.status).toBe("error");
  });

  test("question status carries a 1-based questionNumber", () => {
    const out = walkBank(BANK, HOURS, []);
    expect(out.status).toBe("question");
    if (out.status === "question") expect(out.questionNumber).toBe(1);
  });

  test("replay is deterministic — same answered array, same outcome", () => {
    const answered = walkedTrail(2);
    const out = walkBank(BANK, HOURS, answered);
    expect(out.status).toBe("question"); // 2 < MIN, so still mid-session
    expect(walkBank(BANK, HOURS, answered)).toEqual(out);
  });

  test("≤10 guarantee: greedily walking to a result never exceeds the ceilings", () => {
    const answered: AnsweredStep[] = [];
    let asked = 0;
    // Hard loop bound well above any legal ceiling — if it ever spins, the test fails loudly.
    for (let guard = 0; guard < 100; guard++) {
      const out = walkBank(BANK, HOURS, answered);
      expect(out.status).not.toBe("error");
      if (out.status === "result") break;
      if (out.status === "question") {
        answered.push({ questionId: out.question.id, optionId: "a" });
        asked += 1;
      }
    }
    expect(asked).toBeLessThanOrEqual(MAX_QUESTIONS_TO_ASK);
    expect(asked).toBeLessThanOrEqual(MAX_QUESTION_DEPTH);
    expect(walkBank(BANK, HOURS, answered).status).toBe("result");
  });

  test("a bank smaller than MIN_QUESTIONS_TO_ASK still terminates in a result", () => {
    const tiny: QuestionBank = { ...BANK, questions: BANK.questions.slice(0, 3) };
    const answered: AnsweredStep[] = [];
    for (let guard = 0; guard < 50; guard++) {
      const out = walkBank(tiny, HOURS, answered);
      if (out.status === "result") break;
      if (out.status === "question") answered.push({ questionId: out.question.id, optionId: "a" });
      if (out.status === "error") throw new Error(out.reason);
    }
    expect(walkBank(tiny, HOURS, answered).status).toBe("result");
    expect(answered.length).toBeLessThanOrEqual(3);
  });
});

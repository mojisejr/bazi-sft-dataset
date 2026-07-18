// Hour Rectification — validate-tree.ts unit tests (#hour-rectification-engine, v1). This is the
// file the whole "every signature-combo maps to a ยาม" + "bank is big enough to honour ≤10
// questions" promises actually rest on, so it gets adversarial coverage: every failure mode is
// hand-constructed from a KNOWN-GOOD bank (mutating exactly one thing) and asserted to be CAUGHT.
// Pure — no LLM/engine/file access — a QuestionBank in, a ValidationResult out.
import { describe, expect, test } from "vitest";
import {
  MIN_BANK_SIZE,
  validateQuestionBank,
} from "@/lib/bazi/hour-rectification/domain/validate-tree";
import {
  SIGNATURE_DIMENSIONS,
  SIGNATURE_VOCAB,
  type BankQuestion,
  type QuestionBank,
} from "@/lib/bazi/hour-rectification/domain/types";

const DIMS = [...SIGNATURE_DIMENSIONS];

// A minimal VALID bank: MIN_BANK_SIZE questions, each 2 options, each option carrying one valid
// vote. Questions rotate through all 4 dimensions so the bank probes every dimension (coverage) and
// is at least the size floor. Deliberately the simplest possible passing shape so each mutation
// test below changes exactly one thing at a time.
function buildValidBank(): QuestionBank {
  const questions: BankQuestion[] = [];
  for (let i = 0; i < MIN_BANK_SIZE; i += 1) {
    const dim = DIMS[i % DIMS.length];
    const vocab = SIGNATURE_VOCAB[dim];
    questions.push({
      id: `q${i}`,
      question: `คำถามที่ ${i + 1}`,
      options: [
        { id: "a", label: "ตัวเลือก A", evidence: [{ dimension: dim, value: vocab[0], weight: 1 }] },
        { id: "b", label: "ตัวเลือก B", evidence: [{ dimension: dim, value: vocab[1], weight: 2 }] },
      ],
    });
  }
  return {
    version: "test-fixture-valid",
    generatedAt: "2026-07-17T00:00:00.000Z",
    questions,
  };
}

// A structural deep clone so mutations never leak between tests.
function cloneBank(bank: QuestionBank): QuestionBank {
  return structuredClone(bank);
}

describe("validateQuestionBank — happy path", () => {
  test("a genuinely valid bank passes with zero issues and correct readouts", () => {
    const result = validateQuestionBank(buildValidBank());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.bankSize).toBe(MIN_BANK_SIZE);
    // probedDimensions readout must list exactly the 4 dimensions the fixture rotates through.
    expect([...result.probedDimensions].sort()).toEqual([...SIGNATURE_DIMENSIONS].sort());
  });
});

describe("validateQuestionBank — adversarial: bank-level shape", () => {
  test("an empty bank -> EMPTY_BANK, invalid, and short-circuits with zero probed dimensions", () => {
    const bank: QuestionBank = { ...buildValidBank(), questions: [] };
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "EMPTY_BANK")).toBe(true);
    expect(result.bankSize).toBe(0);
    expect(result.probedDimensions).toEqual([]);
  });

  test("a bank below MIN_BANK_SIZE (but still probing all 4 dims) -> BANK_TOO_SMALL in isolation", () => {
    // Exactly the 4 dimension-probing questions: covers every dimension yet is below the floor, so
    // BANK_TOO_SMALL is the ONLY expected issue (proves it isn't masked by a coverage failure).
    const questions: BankQuestion[] = DIMS.map((dim, i) => ({
      id: `q${i}`,
      question: `คำถามที่ ${i + 1}`,
      options: [
        { id: "a", label: "A", evidence: [{ dimension: dim, value: SIGNATURE_VOCAB[dim][0], weight: 1 }] },
        { id: "b", label: "B", evidence: [{ dimension: dim, value: SIGNATURE_VOCAB[dim][1], weight: 1 }] },
      ],
    }));
    const bank: QuestionBank = { version: "small", generatedAt: "", questions };
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const tooSmall = result.issues.find((issue) => issue.code === "BANK_TOO_SMALL");
    expect(tooSmall).toBeTruthy();
    if (tooSmall && tooSmall.code === "BANK_TOO_SMALL") {
      expect(tooSmall.size).toBe(DIMS.length);
      expect(tooSmall.min).toBe(MIN_BANK_SIZE);
    }
    // No coverage issue: all 4 dimensions are still probed by these 4 questions.
    expect(result.issues.some((issue) => issue.code === "DIMENSION_NOT_PROBED")).toBe(false);
  });
});

describe("validateQuestionBank — adversarial: question / option ids", () => {
  test("two questions sharing an id -> DUPLICATE_QUESTION_ID", () => {
    const bank = cloneBank(buildValidBank());
    bank.questions[1].id = bank.questions[0].id;
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const dup = result.issues.find((issue) => issue.code === "DUPLICATE_QUESTION_ID");
    expect(dup).toBeTruthy();
    if (dup && dup.code === "DUPLICATE_QUESTION_ID") {
      expect(dup.questionId).toBe(bank.questions[0].id);
    }
  });

  test("a question with only 1 option -> TOO_FEW_OPTIONS", () => {
    const bank = cloneBank(buildValidBank());
    bank.questions[0].options = [bank.questions[0].options[0]];
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const few = result.issues.find((issue) => issue.code === "TOO_FEW_OPTIONS");
    expect(few).toBeTruthy();
    if (few && few.code === "TOO_FEW_OPTIONS") {
      expect(few.questionId).toBe(bank.questions[0].id);
      expect(few.optionCount).toBe(1);
    }
  });

  test("a question with a duplicate option id -> DUPLICATE_OPTION_ID", () => {
    const bank = cloneBank(buildValidBank());
    bank.questions[0].options[1].id = bank.questions[0].options[0].id;
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "DUPLICATE_OPTION_ID")).toBe(true);
  });
});

describe("validateQuestionBank — adversarial: evidence votes", () => {
  test("an option with no evidence at all -> OPTION_NO_EVIDENCE", () => {
    const bank = cloneBank(buildValidBank());
    bank.questions[0].options[0].evidence = [];
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const noEv = result.issues.find((issue) => issue.code === "OPTION_NO_EVIDENCE");
    expect(noEv).toBeTruthy();
    if (noEv && noEv.code === "OPTION_NO_EVIDENCE") {
      expect(noEv.questionId).toBe(bank.questions[0].id);
      expect(noEv.optionId).toBe(bank.questions[0].options[0].id);
    }
  });

  test("a vote on a dimension match.ts can't interpret -> UNKNOWN_DIMENSION", () => {
    const bank = cloneBank(buildValidBank());
    // Add an EXTRA bad vote so the option's valid dimension coverage is untouched — isolates the
    // UNKNOWN_DIMENSION issue from any incidental DIMENSION_NOT_PROBED.
    bank.questions[0].options[0].evidence.push({
      // deliberately not a SignatureDimension — cast through unknown to sidestep the type guard.
      dimension: "astrologyHouse" as unknown as (typeof DIMS)[number],
      value: "wood",
      weight: 1,
    });
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const unknown = result.issues.find((issue) => issue.code === "UNKNOWN_DIMENSION");
    expect(unknown).toBeTruthy();
    if (unknown && unknown.code === "UNKNOWN_DIMENSION") {
      expect(unknown.dimension).toBe("astrologyHouse");
    }
    // Coverage is intact (the valid votes still probe all 4 dims).
    expect(result.issues.some((issue) => issue.code === "DIMENSION_NOT_PROBED")).toBe(false);
  });

  test("a valid dimension but an out-of-vocabulary value -> UNKNOWN_VALUE", () => {
    const bank = cloneBank(buildValidBank());
    bank.questions[0].options[0].evidence.push({
      dimension: "stemElement",
      value: "plasma", // not in SIGNATURE_VOCAB.stemElement
      weight: 1,
    });
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const badVal = result.issues.find((issue) => issue.code === "UNKNOWN_VALUE");
    expect(badVal).toBeTruthy();
    if (badVal && badVal.code === "UNKNOWN_VALUE") {
      expect(badVal.dimension).toBe("stemElement");
      expect(badVal.value).toBe("plasma");
    }
  });

  test("a zero weight AND a negative weight are both rejected -> NON_POSITIVE_WEIGHT", () => {
    const bank = cloneBank(buildValidBank());
    bank.questions[0].options[0].evidence.push({
      dimension: "stemElement",
      value: SIGNATURE_VOCAB.stemElement[0],
      weight: 0, // not > 0
    });
    bank.questions[1].options[0].evidence.push({
      dimension: "stemRole",
      value: SIGNATURE_VOCAB.stemRole[0],
      weight: -3, // negative
    });
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const nonPos = result.issues.filter((issue) => issue.code === "NON_POSITIVE_WEIGHT");
    expect(nonPos.length).toBe(2);
    const weights = nonPos.map((issue) => (issue.code === "NON_POSITIVE_WEIGHT" ? issue.weight : NaN));
    expect(weights).toContain(0);
    expect(weights).toContain(-3);
  });
});

describe("validateQuestionBank — adversarial: dimension coverage", () => {
  test("a bank that never probes one of the 4 dimensions -> DIMENSION_NOT_PROBED for it", () => {
    // Build MIN_BANK_SIZE questions but rotate through only the FIRST 3 dimensions, deliberately
    // never probing the 4th (strengthBucket). Size is fine, coverage is not.
    const missing = DIMS[DIMS.length - 1];
    const probeDims = DIMS.slice(0, DIMS.length - 1);
    const questions: BankQuestion[] = [];
    for (let i = 0; i < MIN_BANK_SIZE; i += 1) {
      const dim = probeDims[i % probeDims.length];
      const vocab = SIGNATURE_VOCAB[dim];
      questions.push({
        id: `q${i}`,
        question: `คำถามที่ ${i + 1}`,
        options: [
          { id: "a", label: "A", evidence: [{ dimension: dim, value: vocab[0], weight: 1 }] },
          { id: "b", label: "B", evidence: [{ dimension: dim, value: vocab[1], weight: 1 }] },
        ],
      });
    }
    const bank: QuestionBank = { version: "missing-dim", generatedAt: "", questions };
    const result = validateQuestionBank(bank);
    expect(result.valid).toBe(false);
    const notProbed = result.issues.find((issue) => issue.code === "DIMENSION_NOT_PROBED");
    expect(notProbed).toBeTruthy();
    if (notProbed && notProbed.code === "DIMENSION_NOT_PROBED") {
      expect(notProbed.dimension).toBe(missing);
    }
    // probedDimensions readout must exclude the missing dimension and include the other three.
    expect(result.probedDimensions).not.toContain(missing);
    expect([...result.probedDimensions].sort()).toEqual([...probeDims].sort());
  });
});

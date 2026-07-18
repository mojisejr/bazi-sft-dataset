// Hour Rectification — validate-tree.ts (#hour-rectification-engine, v1). This is the file the
// "≤10 questions, guaranteed" and "every signature-combo maps to a ยาม" promises actually rest on:
// it's CODE that inspects a generated bank, not a hope the LLM followed instructions. Pure — no
// LLM/engine/file access — takes a QuestionBank in, returns a report out.

import {
  MAX_QUESTION_DEPTH,
  MAX_QUESTIONS_TO_ASK,
} from "./traverse";
import {
  SIGNATURE_DIMENSIONS,
  SIGNATURE_VOCAB,
  type QuestionBank,
  type SignatureDimension,
} from "./types";

export const MIN_QUESTION_OPTIONS = 2;
// The bank must hold at least this many questions or the adaptive selector could run dry before
// reaching MAX_QUESTIONS_TO_ASK. The spec targets ~20-25; this is the floor, not the target.
export const MIN_BANK_SIZE = MAX_QUESTIONS_TO_ASK;

export type ValidationIssue =
  | { code: "EMPTY_BANK" }
  | { code: "BANK_TOO_SMALL"; size: number; min: number }
  | { code: "DUPLICATE_QUESTION_ID"; questionId: string }
  | { code: "TOO_FEW_OPTIONS"; questionId: string; optionCount: number }
  | { code: "DUPLICATE_OPTION_ID"; questionId: string; optionId: string }
  | { code: "OPTION_NO_EVIDENCE"; questionId: string; optionId: string }
  | {
      code: "UNKNOWN_DIMENSION";
      questionId: string;
      optionId: string;
      dimension: string;
    }
  | {
      code: "UNKNOWN_VALUE";
      questionId: string;
      optionId: string;
      dimension: string;
      value: string;
    }
  | {
      code: "NON_POSITIVE_WEIGHT";
      questionId: string;
      optionId: string;
      dimension: string;
      weight: number;
    }
  | { code: "DIMENSION_NOT_PROBED"; dimension: SignatureDimension }
  | { code: "DEPTH_CEILING_TOO_LOW"; maxDepth: number; maxAsk: number };

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  bankSize: number;
  // Which of the 4 dimensions the bank actually has evidence for — coverage readout for the
  // generator's repair loop and for humans reviewing a generated bank.
  probedDimensions: SignatureDimension[];
};

export function validateQuestionBank(bank: QuestionBank): ValidationResult {
  const issues: ValidationIssue[] = [];
  const probed = new Set<SignatureDimension>();

  // Structural invariant independent of the bank: the hard depth ceiling must not sit below the
  // number of questions the selector may actually ask, or the ≤10 promise contradicts itself.
  if (MAX_QUESTION_DEPTH < MAX_QUESTIONS_TO_ASK) {
    issues.push({
      code: "DEPTH_CEILING_TOO_LOW",
      maxDepth: MAX_QUESTION_DEPTH,
      maxAsk: MAX_QUESTIONS_TO_ASK,
    });
  }

  if (bank.questions.length === 0) {
    issues.push({ code: "EMPTY_BANK" });
    return { valid: false, issues, bankSize: 0, probedDimensions: [] };
  }

  if (bank.questions.length < MIN_BANK_SIZE) {
    issues.push({ code: "BANK_TOO_SMALL", size: bank.questions.length, min: MIN_BANK_SIZE });
  }

  const seenQuestionIds = new Set<string>();
  for (const question of bank.questions) {
    if (seenQuestionIds.has(question.id)) {
      issues.push({ code: "DUPLICATE_QUESTION_ID", questionId: question.id });
    }
    seenQuestionIds.add(question.id);

    if (question.options.length < MIN_QUESTION_OPTIONS) {
      issues.push({
        code: "TOO_FEW_OPTIONS",
        questionId: question.id,
        optionCount: question.options.length,
      });
    }

    const seenOptionIds = new Set<string>();
    for (const option of question.options) {
      if (seenOptionIds.has(option.id)) {
        issues.push({ code: "DUPLICATE_OPTION_ID", questionId: question.id, optionId: option.id });
      }
      seenOptionIds.add(option.id);

      if (option.evidence.length === 0) {
        issues.push({ code: "OPTION_NO_EVIDENCE", questionId: question.id, optionId: option.id });
      }

      for (const vote of option.evidence) {
        const dimension = vote.dimension as SignatureDimension;
        if (!(SIGNATURE_DIMENSIONS as readonly string[]).includes(vote.dimension)) {
          issues.push({
            code: "UNKNOWN_DIMENSION",
            questionId: question.id,
            optionId: option.id,
            dimension: vote.dimension,
          });
          continue; // can't check value against a vocab we don't have
        }
        probed.add(dimension);
        if (!SIGNATURE_VOCAB[dimension].includes(vote.value)) {
          issues.push({
            code: "UNKNOWN_VALUE",
            questionId: question.id,
            optionId: option.id,
            dimension: vote.dimension,
            value: vote.value,
          });
        }
        if (!(vote.weight > 0)) {
          issues.push({
            code: "NON_POSITIVE_WEIGHT",
            questionId: question.id,
            optionId: option.id,
            dimension: vote.dimension,
            weight: vote.weight,
          });
        }
      }
    }
  }

  // Coverage: the bank must be able to probe every one of the 4 dimensions, or some hours become
  // indistinguishable no matter which questions are asked.
  for (const dimension of SIGNATURE_DIMENSIONS) {
    if (!probed.has(dimension)) {
      issues.push({ code: "DIMENSION_NOT_PROBED", dimension });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    bankSize: bank.questions.length,
    probedDimensions: Array.from(probed),
  };
}

// Hour Rectification — trace.ts (#hour-rectification-engine, v1). Explains WHY the engine landed on
// a given ยาม: answers → accumulated signature → the user's own hour whose real chart matches it
// best. Not an LLM narration — a deterministic readout of the match. Standalone type (a sibling of
// src/lib/bazi/trace-formatter.ts, not an extension of CalculationTraceSchema whose `engine` enum
// is bound to the lunar calc, meaningless for a signature match).

import type { MatchResult, TargetSignature } from "./match";
import {
  HOUR_BRANCH_LABELS_TH,
  SIGNATURE_DIMENSIONS,
  type AnsweredStep,
  type HourSignature,
  type QuestionBank,
} from "./types";

export type RectificationTrace = {
  ruleName: string;
  steps: string[];
  stepKeys: string[];
  rawVariables: Record<string, unknown>;
};

export const RECTIFICATION_TRACE_RULE_NAME = "hour-rectification-signature-match";

const DIMENSION_LABELS_TH: Record<string, string> = {
  stemElement: "ธาตุเสายาม",
  stemRole: "บทบาทก้านยามต่อดิถี",
  branchRole: "บทบาทกิ่งยามต่อดิถี",
  strengthBucket: "กำลังดิถี",
};

// Reduce the weighted target to the single strongest value per dimension, for a human summary of
// "what your answers pointed at".
function dominantValues(target: TargetSignature): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const dimension of SIGNATURE_DIMENSIONS) {
    const bucket = target[dimension];
    let bestValue: string | null = null;
    let bestWeight = 0;
    for (const [value, weight] of Object.entries(bucket)) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestValue = value;
      }
    }
    out[dimension] = bestValue;
  }
  return out;
}

export function buildRectificationTrace(
  bank: QuestionBank,
  answered: readonly AnsweredStep[],
  match: MatchResult,
  target: TargetSignature,
  hourSignatures: readonly HourSignature[],
): RectificationTrace {
  const steps: string[] = [];
  const stepKeys: string[] = [];
  const byId = new Map(bank.questions.map((q) => [q.id, q]));

  answered.forEach((step, index) => {
    const question = byId.get(step.questionId);
    const option = question?.options.find((candidate) => candidate.id === step.optionId);
    const questionText = question?.question ?? `(ไม่พบคำถาม ${step.questionId})`;
    const answerText = option?.label ?? `(ไม่พบคำตอบ ${step.optionId})`;
    steps.push(`ข้อ ${index + 1}: "${questionText}" → ตอบ "${answerText}"`);
    stepKeys.push(`answer-${index + 1}`);
  });

  const dominant = dominantValues(target);
  const signatureSummary = SIGNATURE_DIMENSIONS.map((dimension) => {
    const value = dominant[dimension];
    return value ? `${DIMENSION_LABELS_TH[dimension]}≈${value}` : null;
  })
    .filter(Boolean)
    .join(", ");
  steps.push(`คำตอบทั้งหมดบ่งชี้คุณสมบัติ: ${signatureSummary || "(ไม่มีสัญญาณชัดเจน)"}`);
  stepKeys.push("derive-signature");

  const label = HOUR_BRANCH_LABELS_TH[match.hourBranch];
  const winner = hourSignatures.find((h) => h.hourBranch === match.hourBranch);
  const winnerDesc = winner
    ? `ธาตุเสายาม ${winner.signature.stemElement}, ก้าน ${winner.signature.stemRole}, ` +
      `กิ่ง ${winner.signature.branchRole}, กำลัง ${winner.signature.strengthBucket}`
    : "";
  steps.push(
    `ในดวงของคุณ 12 ยาม ยาม${match.hourBranch} (${label}) มีคุณสมบัติตรงที่สุด ` +
      `(${winnerDesc}) — คะแนน ${match.score.toFixed(1)}, ทิ้งอันดับสอง ${match.margin.toFixed(1)}`,
  );
  stepKeys.push("match-hour");

  return {
    ruleName: RECTIFICATION_TRACE_RULE_NAME,
    steps,
    stepKeys,
    rawVariables: {
      answered: answered.map((step) => ({ ...step })),
      hourBranch: match.hourBranch,
      score: match.score,
      margin: match.margin,
      ranked: match.ranked,
      dominantSignature: dominant,
    },
  };
}

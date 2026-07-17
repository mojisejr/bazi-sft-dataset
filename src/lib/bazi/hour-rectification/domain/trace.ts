// Hour Rectification — explain WHY the engine landed on a given ยาม (#hour-rectification-engine).
//
// Sibling of src/lib/bazi/trace-formatter.ts, NOT an extension of it: CalculationTraceSchema's
// `engine: z.enum(["lunar-js", "orthodox-override"])` field is bound to the main calc engine and
// isn't meaningful here (this is a decision-tree walk, not a lunar-calendar calculation). We copy
// only the SHAPE that's genuinely reusable — ruleName/steps/stepKeys/rawVariables — as our own
// standalone type, with our own local formatter registry below (mirroring
// TRACE_SUMMARY_FORMATTERS/TRACE_STEP_FORMATTERS's registry pattern, not importing it).

import type { AnsweredStep, HourBranch, QuestionNetwork } from "./types";
import { HOUR_BRANCH_LABELS_TH } from "./types";

export type RectificationTrace = {
  ruleName: string;
  steps: string[];
  stepKeys: string[];
  rawVariables: Record<string, unknown>;
};

export const RECTIFICATION_TRACE_RULE_NAME = "hour-rectification-traverse";

export function buildRectificationTrace(
  network: QuestionNetwork,
  trail: readonly AnsweredStep[],
  hourBranch: HourBranch,
): RectificationTrace {
  const steps: string[] = [];
  const stepKeys: string[] = [];

  trail.forEach((step, index) => {
    const node = network.nodes[step.nodeId];
    const option = node?.options.find((candidate) => candidate.id === step.optionId);
    const questionText = node?.question ?? `(ไม่พบคำถาม ${step.nodeId})`;
    const answerText = option?.label ?? `(ไม่พบคำตอบ ${step.optionId})`;
    steps.push(`ข้อ ${index + 1}: "${questionText}" → ตอบ "${answerText}"`);
    stepKeys.push(`answer-${index + 1}`);
  });

  const label = HOUR_BRANCH_LABELS_TH[hourBranch];
  steps.push(
    `สรุป: จากคำตอบทั้งหมด ${trail.length} ข้อ ระบบทายว่าเกิดยาม${hourBranch} (${label})`,
  );
  stepKeys.push("conclude");

  return {
    ruleName: RECTIFICATION_TRACE_RULE_NAME,
    steps,
    stepKeys,
    rawVariables: {
      trail: trail.map((step) => ({ ...step })),
      hourBranch,
      questionCount: trail.length,
    },
  };
}

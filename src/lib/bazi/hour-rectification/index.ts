// Hour Rectification (สอบยาม) — public exports (#hour-rectification-engine, v1). Only what callers
// outside this module should ever need. Internal wiring (adapters/, domain/ internals) stays
// unexported here on purpose.

export {
  loadRectificationBank,
  runRectificationStep,
  type RunStepInput,
  type RunStepResult,
} from "./run-step";

export {
  generateHourRectificationNetwork,
  type GenerateNetworkOutcome,
} from "./generate-network";

export {
  questionBankExists,
  resolveQuestionBankPath,
} from "./adapters/network-repository";

export {
  computeHourSignatures,
  extractHourSignatures,
} from "./adapters/chart-profile-adapter";

export {
  HOUR_BRANCHES,
  HOUR_BRANCH_LABELS_TH,
  type AnsweredStep,
  type HourBranch,
  type HourSignature,
  type QuestionBank,
  type StructuralSignature,
} from "./domain/types";

export {
  validateQuestionBank,
  type ValidationResult,
} from "./domain/validate-tree";

export {
  MAX_QUESTION_DEPTH,
  MAX_QUESTIONS_TO_ASK,
  MIN_QUESTIONS_TO_ASK,
} from "./domain/traverse";

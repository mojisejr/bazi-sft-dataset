// Hour Rectification (สอบยาม) — public exports (#hour-rectification-engine). Only what callers
// outside this module should ever need. Internal wiring (adapters/, domain/ internals) stays
// unexported here on purpose.

export {
  loadRectificationNetwork,
  runRectificationStep,
  type RunStepInput,
  type RunStepResult,
} from "./run-step";

export { generateHourRectificationNetwork, type GenerateNetworkOutcome } from "./generate-network";

export {
  questionNetworkExists,
  resolveQuestionNetworkPath,
} from "./adapters/network-repository";

export {
  HOUR_BRANCHES,
  HOUR_BRANCH_LABELS_TH,
  type HourBranch,
  type QuestionNetwork,
} from "./domain/types";

export {
  validateQuestionNetwork,
  MAX_QUESTION_DEPTH,
  type ValidationResult,
} from "./domain/validate-tree";

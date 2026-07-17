// Hour Rectification (สอบยาม) — domain types (#hour-rectification-engine).
//
// Pure data shapes only. No LLM/engine/file dependency — this whole domain/ folder must stay
// importable and testable in total isolation. HOUR_BRANCHES/labels are duplicated here
// deliberately (not imported from symbolic-engine.constants.ts) to keep this folder decoupled
// from the main engine's module graph, matching the same discipline as trace.ts not extending
// CalculationTraceSchema directly.

export const HOUR_BRANCHES = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
] as const;

export type HourBranch = (typeof HOUR_BRANCHES)[number];

export const HOUR_BRANCH_LABELS_TH: Record<HourBranch, string> = {
  子: "ชวด",
  丑: "ฉลู",
  寅: "ขาล",
  卯: "เถาะ",
  辰: "มะโรง",
  巳: "มะเส็ง",
  午: "มะเมีย",
  未: "มะแม",
  申: "วอก",
  酉: "ระกา",
  戌: "จอ",
  亥: "กุน",
};

// Representative mid-double-hour time for each branch (HH:00, even hours only) — deliberately
// never an odd hour like 01:00/03:00, which sits exactly on a branch boundary and would make the
// chart-profile-adapter's calculateBaziChart call ambiguous about which branch it landed in.
export const HOUR_BRANCH_MID_TIME: Record<HourBranch, string> = {
  子: "00:00",
  丑: "02:00",
  寅: "04:00",
  卯: "06:00",
  辰: "08:00",
  巳: "10:00",
  午: "12:00",
  未: "14:00",
  申: "16:00",
  酉: "18:00",
  戌: "20:00",
  亥: "22:00",
};

export function isHourBranch(value: string): value is HourBranch {
  return (HOUR_BRANCHES as readonly string[]).includes(value);
}

export type NodeRef =
  | { kind: "question"; nodeId: string }
  | { kind: "result"; hourBranch: HourBranch };

export type QuestionOption = {
  id: string;
  label: string;
  next: NodeRef;
};

export type QuestionNode = {
  id: string;
  question: string;
  options: QuestionOption[];
};

export type QuestionNetwork = {
  version: string;
  generatedAt: string;
  rootNodeId: string;
  nodes: Record<string, QuestionNode>;
  meta?: {
    model?: string;
    llmCallsUsed?: number;
  };
};

export type AnsweredStep = {
  nodeId: string;
  optionId: string;
};

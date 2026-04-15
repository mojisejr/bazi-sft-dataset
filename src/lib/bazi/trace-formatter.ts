import type { CalculationTraceValue } from "@/lib/bazi/schema-types";
import { TRACE_RULE_NAMES, TRACE_STEP_KEYS } from "@/lib/bazi/trace-keys";

type TraceFormatResult = {
  summary: string;
  steps: string[];
};

type TraceVariables = Record<string, unknown>;

type TraceFormatterContext = {
  rawVariables: TraceVariables;
};

type TraceStepFormatter = (context: TraceFormatterContext) => string;
type TraceSummaryFormatter = (context: TraceFormatterContext) => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRawVariables(trace: CalculationTraceValue): TraceVariables {
  return isRecord(trace.rawVariables) ? trace.rawVariables : {};
}

function getString(rawVariables: TraceVariables, key: string, fallback = "ไม่ระบุ") {
  const value = rawVariables[key];

  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function getNumber(rawVariables: TraceVariables, key: string) {
  const value = rawVariables[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(rawVariables: TraceVariables, key: string) {
  const value = rawVariables[key];

  return typeof value === "boolean" ? value : null;
}

function getArrayLength(rawVariables: TraceVariables, key: string) {
  const value = rawVariables[key];

  return Array.isArray(value) ? value.length : 0;
}

function formatNumber(value: number | null, digits = 2) {
  return value === null ? "-" : value.toFixed(digits);
}

const TRACE_SUMMARY_FORMATTERS: Record<string, TraceSummaryFormatter> = {
  [TRACE_RULE_NAMES.mingGong]: () =>
    "ตรวจเดือนเกิดกับยามเกิด แล้วเช็กว่าผ่านจุดจงชี่หรือยัง ก่อนสรุปลัคนาตามกฎ orthodox override",
  [TRACE_RULE_NAMES.strengthScore]: () =>
    "ชั่งน้ำหนักพลัง Day Master จาก 12 Qi, ธาตุที่หนุนหรือกด, และแรงปะทะของกิ่งดินเพื่อได้คะแนนสุดท้าย",
};

const TRACE_STEP_FORMATTERS: Record<string, TraceStepFormatter> = {
  [TRACE_STEP_KEYS.mingGong.readBranches]: ({ rawVariables }) =>
    `อ่านเสาเดือน ${getString(rawVariables, "monthBranch")} และยาม ${getString(rawVariables, "timeBranch")} จากดวงกำเนิด`,
  [TRACE_STEP_KEYS.mingGong.resolveBoundary]: ({ rawVariables }) => {
    const monthBranch = getString(rawVariables, "monthBranch");
    const adjustedMonthBranch = getString(rawVariables, "adjustedMonthBranch");
    const zhongQiName = getString(rawVariables, "zhongQiName", "");
    const isPastZhongQi = getBoolean(rawVariables, "isPastZhongQi");

    if (zhongQiName.length === 0 || zhongQiName === "ไม่ระบุ") {
      return `เดือนไม่มี mapping จงชี่เฉพาะ จึงคงเดือนลัคนาไว้ที่ ${adjustedMonthBranch}`;
    }

    if (isPastZhongQi) {
      return `เวลาเกิดเลยจุด ${zhongQiName} แล้ว จึงขยับเดือนลัคนาจาก ${monthBranch} เป็น ${adjustedMonthBranch}`;
    }

    return `เวลาเกิดยังไม่เลยจุด ${zhongQiName} จึงคงเดือนลัคนาไว้ที่ ${adjustedMonthBranch}`;
  },
  [TRACE_STEP_KEYS.mingGong.finalize]: ({ rawVariables }) =>
    `ใช้ดัชนีเดือน ${formatNumber(getNumber(rawVariables, "monthZhiIndex"), 0)} กับดัชนียาม ${formatNumber(getNumber(rawVariables, "timeZhiIndex"), 0)} เพื่อสรุปลัคนา ${getString(rawVariables, "result")}`,
  [TRACE_STEP_KEYS.strengthScore.weightStages]: ({ rawVariables }) =>
    `ให้น้ำหนัก 12 Qi ทั้ง 4 เสาโดยยกเสาเดือนเป็น ${formatNumber(getNumber(rawVariables, "monthBranchSeasonalFactor"))} ของ seasonal factor ก่อนรวมคะแนนตั้งต้น`,
  [TRACE_STEP_KEYS.strengthScore.addRelations]: ({ rawVariables }) =>
    `รวมแรงจากก้านฟ้าที่มองเห็น ${getArrayLength(rawVariables, "visibleContributions")} จุด และธาตุแฝง ${getArrayLength(rawVariables, "hiddenContributions")} จุด เทียบกับ Day Master ${getString(rawVariables, "dayMasterStem")}`,
  [TRACE_STEP_KEYS.strengthScore.applyPenalties]: ({ rawVariables }) =>
    `หักแรงปะทะตาม precedence จาก clash, punishment, harm และ destruction ก่อนสรุปคะแนนสุดท้าย ${formatNumber(getNumber(rawVariables, "result"))}`,
};

function formatTraceStep(stepKey: string, context: TraceFormatterContext, fallbackStep?: string) {
  const formatter = TRACE_STEP_FORMATTERS[stepKey];

  if (formatter) {
    return formatter(context);
  }

  if (fallbackStep && fallbackStep.length > 0) {
    return fallbackStep;
  }

  return stepKey;
}

export function formatCalculationTrace(trace: CalculationTraceValue): TraceFormatResult {
  const rawVariables = getRawVariables(trace);
  const context = { rawVariables };
  const summaryFormatter = TRACE_SUMMARY_FORMATTERS[trace.ruleName];
  const stepKeys = trace.stepKeys ?? [];
  const steps = stepKeys.length > 0
    ? stepKeys.map((stepKey, index) => formatTraceStep(stepKey, context, trace.steps[index]))
    : trace.steps;

  return {
    summary: summaryFormatter ? summaryFormatter(context) : trace.ruleName,
    steps,
  };
}
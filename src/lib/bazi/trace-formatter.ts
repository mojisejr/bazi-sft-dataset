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

function getAdjustmentCount(rawVariables: TraceVariables, key: string) {
  const value = rawVariables[key];

  return Array.isArray(value) ? value.length : 0;
}

function getDeveloperTracePayload(trace: CalculationTraceValue) {
  const payload = {
    ruleName: trace.ruleName,
    stepKeys: trace.stepKeys ?? [],
    rawVariables: getRawVariables(trace),
  };

  return JSON.stringify(payload, null, 2);
}

const TRACE_SUMMARY_FORMATTERS: Record<string, TraceSummaryFormatter> = {
  [TRACE_RULE_NAMES.mingGong]: () =>
    "ตรวจเสาเดือนและยามเกิด แล้วเช็กจุดจงชี่ก่อนสรุปลัคนาตามเกณฑ์โหราศาสตร์จีนสาย orthodox",
  [TRACE_RULE_NAMES.strengthScore]: () =>
    "ชั่งน้ำหนักกำลังเจ้าชะตาจากตำแหน่งที่หนุนจริง เชี่ยงแซในโซนหลัก และแรงปะทะที่ยังเหลือ เพื่อสรุปคะแนนรวม",
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
    `เริ่มจากชั่งน้ำหนักตำแหน่งก้านและกิ่งที่หนุนดิถี ${getArrayLength(rawVariables, "visibleContributions")} จุด ก่อนดูโซนเชี่ยงแซที่เกี่ยวข้อง`,
  [TRACE_STEP_KEYS.strengthScore.addRelations]: ({ rawVariables }) =>
    `เติมแรงเสริมจากโซนเชี่ยงแซ ${getAdjustmentCount(rawVariables, "qiAdjustments")} จุด และเทียบความสัมพันธ์กับดิถี ${getString(rawVariables, "dayMasterStem")}`,
  [TRACE_STEP_KEYS.strengthScore.applyPenalties]: ({ rawVariables }) =>
    `หักเฉพาะแรงปะทะที่ยังเหลือ ${getAdjustmentCount(rawVariables, "relationAdjustments")} จุด ก่อนสรุปกำลังดิถี ${formatNumber(getNumber(rawVariables, "result"))}`,
};

function formatTraceStep(stepKey: string, context: TraceFormatterContext, fallbackStep?: string) {
  const formatter = TRACE_STEP_FORMATTERS[stepKey];

  if (formatter) {
    return formatter(context);
  }

  if (fallbackStep && fallbackStep.length > 0) {
    return fallbackStep;
  }

  return "ระบบมีรายละเอียดการคำนวณภายในเพิ่มเติมสำหรับขั้นตอนนี้";
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
    summary: summaryFormatter
      ? summaryFormatter(context)
      : "ระบบใช้กฎคำนวณเฉพาะสำหรับรายการนี้",
    steps,
  };
}

export function formatDeveloperTraceSnapshot(trace: CalculationTraceValue) {
  const rawVariables = getRawVariables(trace);

  if ((trace.stepKeys?.length ?? 0) === 0 && Object.keys(rawVariables).length === 0) {
    return null;
  }

  return getDeveloperTracePayload(trace);
}
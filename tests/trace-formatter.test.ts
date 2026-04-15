import { describe, expect, test } from "vitest";

import { CalculationTraceSchema } from "@/lib/bazi/schema-types";
import { formatCalculationTrace } from "@/lib/bazi/trace-formatter";
import { TRACE_STEP_KEYS } from "@/lib/bazi/trace-keys";

describe("formatCalculationTrace", () => {
  test("formats Ming Gong trace keys into Thai explanation steps", () => {
    const trace = CalculationTraceSchema.parse({
      engine: "orthodox-override",
      ruleName: "MingGong_ZhongQi_Adjustment",
      stepKeys: [
        TRACE_STEP_KEYS.mingGong.readBranches,
        TRACE_STEP_KEYS.mingGong.resolveBoundary,
        TRACE_STEP_KEYS.mingGong.finalize,
      ],
      rawVariables: {
        monthBranch: "亥",
        adjustedMonthBranch: "子",
        timeBranch: "子",
        zhongQiName: "冬至",
        isPastZhongQi: true,
        monthZhiIndex: 1,
        timeZhiIndex: 1,
        result: "乙巳",
      },
    });

    const formatted = formatCalculationTrace(trace);

    expect(formatted.summary).toContain("ลัคนา");
    expect(formatted.steps).toEqual([
      "อ่านเสาเดือน 亥 และยาม 子 จากดวงกำเนิด",
      "เวลาเกิดเลยจุด 冬至 แล้ว จึงขยับเดือนลัคนาจาก 亥 เป็น 子",
      "ใช้ดัชนีเดือน 1 กับดัชนียาม 1 เพื่อสรุปลัคนา 乙巳",
    ]);
  });

  test("falls back to legacy step text when step keys are absent", () => {
    const trace = CalculationTraceSchema.parse({
      engine: "orthodox-override",
      ruleName: "LegacyRule",
      steps: ["legacy trace copy"],
    });

    expect(formatCalculationTrace(trace)).toEqual({
      summary: "LegacyRule",
      steps: ["legacy trace copy"],
    });
  });
});
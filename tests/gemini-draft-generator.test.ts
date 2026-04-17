import { describe, expect, test } from "vitest";

import {
  extractReferenceCaseExcerpt,
  GeneratedDraftAnnotationDataSchema,
  selectReferenceCaseExamplePaths,
} from "@/lib/bazi/gemini-draft-generator";
import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

const SAMPLE_RAW_INPUT: RawInputValue = {
  birthDate: "1981-03-12",
  birthTime: "05:59",
  gender: "male",
  province: "Bangkok",
  calendarSystem: "solar",
  timezone: "Asia/Bangkok",
};

describe("gemini draft generator helpers", () => {
  test("extracts only the relevant reference excerpt", () => {
    const markdown = `# DNA

เกิดวันที่ 12 มีนาคม พ.ศ.2524 เวลา 05.59 น.

คุณเป็นคนเกิดวันธาตุดินพลังหยิน มีความจริงจังและรอบคอบ

## สภาพธรรมชาติตามพื้นที่ดวง

ส่วนนี้ไม่ควรถูกดึงมา`;

    const excerpt = extractReferenceCaseExcerpt(markdown, 400);

    expect(excerpt).toContain("เกิดวันที่ 12 มีนาคม พ.ศ.2524 เวลา 05.59 น.");
    expect(excerpt).toContain("คุณเป็นคนเกิดวันธาตุดินพลังหยิน");
    expect(excerpt).not.toContain("สภาพธรรมชาติตามพื้นที่ดวง");
  });

  test("selects deterministic rotating reference paths", () => {
    const selected = selectReferenceCaseExamplePaths(SAMPLE_RAW_INPUT, [
      "/tmp/case1.md",
      "/tmp/case2.md",
      "/tmp/case3.md",
    ]);

    expect(selected.length).toBeGreaterThanOrEqual(2);
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected).toEqual(selectReferenceCaseExamplePaths(SAMPLE_RAW_INPUT, [
      "/tmp/case1.md",
      "/tmp/case2.md",
      "/tmp/case3.md",
    ]));
  });

  test("requires complete non-empty generated dimensions", () => {
    expect(() =>
      GeneratedDraftAnnotationDataSchema.parse({
        version: "1.6",
        reviewSummary: "สรุปภาพรวมของดวงนี้อย่างกระชับ",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
          dimension_name: dimensionName,
          thought_process: `วิเคราะห์ ${dimensionName}`,
          final_prediction: `สรุป ${dimensionName}`,
          supporting_signals: ["dayMaster=己", "monthBranch=卯"],
        })),
      }),
    ).not.toThrow();

    expect(() =>
      GeneratedDraftAnnotationDataSchema.parse({
        version: "1.6",
        reviewSummary: "สรุปภาพรวมของดวงนี้อย่างกระชับ",
        dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => ({
          dimension_name: dimensionName,
          thought_process: dimensionName === "chart_foundation" ? "" : "มีข้อมูล",
          final_prediction: "สรุปผล",
          supporting_signals: ["dayMaster=己"],
        })),
      }),
    ).toThrow();
  });
});
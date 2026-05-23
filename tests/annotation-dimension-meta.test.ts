import { describe, expect, test } from "vitest";

import {
  ANNOTATION_DIMENSION_META,
  ANNOTATION_DIMENSION_TITLE_MAP,
  PROOF_WORKSPACE_DIMENSION_META,
  PROOF_WORKSPACE_DIMENSION_ORDER,
} from "@/lib/bazi/annotation-dimension-meta";

describe("annotation dimension meta", () => {
  test("backs proof titles with topic registry labels when a topic mapping exists", () => {
    expect(
      ANNOTATION_DIMENSION_META.find((dimension) => dimension.dimensionName === "personality_psychology")?.title,
    ).toBe("นิสัย/บุคลิกพื้นฐาน");
    expect(
      ANNOTATION_DIMENSION_META.find((dimension) => dimension.dimensionName === "love_and_family")?.title,
    ).toBe("ครอบครัว / ความรัก");
    expect(
      ANNOTATION_DIMENSION_META.find((dimension) => dimension.dimensionName === "career_potential")?.title,
    ).toBe("อาชีพที่เหมาะสม / หุ้นส่วน");
  });

  test("keeps legacy export labels stable", () => {
    expect(ANNOTATION_DIMENSION_TITLE_MAP.chart_foundation).toBe("ฐานดวงเดิม และภาพรวม");
    expect(ANNOTATION_DIMENSION_TITLE_MAP.annual_star_energy).toBe("พลังดาวประจำปีจร");
    expect(ANNOTATION_DIMENSION_TITLE_MAP.red_flags).toBe("คำเตือน (Red Flags)");
  });

  test("preserves the full 15-section proof order", () => {
    expect(ANNOTATION_DIMENSION_META).toHaveLength(15);
    expect(ANNOTATION_DIMENSION_META.map((dimension) => dimension.step)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  test("defines a proof-only workspace order without mutating legacy metadata order", () => {
    expect(PROOF_WORKSPACE_DIMENSION_ORDER).toHaveLength(15);
    expect(Array.from(new Set(PROOF_WORKSPACE_DIMENSION_ORDER))).toHaveLength(15);
    expect(PROOF_WORKSPACE_DIMENSION_ORDER[0]).toBe("personality_psychology");
    expect(PROOF_WORKSPACE_DIMENSION_ORDER).toContain("chart_foundation");

    expect(PROOF_WORKSPACE_DIMENSION_META[0]?.dimensionName).toBe("personality_psychology");
    expect(PROOF_WORKSPACE_DIMENSION_META[0]?.title).toBe("นิสัย/บุคลิกพื้นฐาน");
    expect(PROOF_WORKSPACE_DIMENSION_META[1]?.dimensionName).toBe("chart_foundation");

    expect(ANNOTATION_DIMENSION_META[0]?.dimensionName).toBe("chart_foundation");
    expect(ANNOTATION_DIMENSION_META[9]?.dimensionName).toBe("personality_psychology");
  });
});
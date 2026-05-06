import { describe, expect, test } from "vitest";

import {
  formatStagePair,
  localizeTwelveQiLabel,
  resolveDisplayStemPairStage,
  resolveStemReferenceBranch,
} from "@/lib/bazi/pillar-display";

describe("pillar display helpers", () => {
  test("uses the school vocabulary for twelve qi labels", () => {
    expect(localizeTwelveQiLabel("临官")).toBe("ลิ่มกัว");
    expect(localizeTwelveQiLabel("帝旺")).toBe("ตี้อ๋วง");
    expect(localizeTwelveQiLabel("病")).toBe("แป่");
    expect(localizeTwelveQiLabel("绝")).toBe("เจ๊าะ");
    expect(localizeTwelveQiLabel("胎")).toBe("ทอ");
  });

  test("derives upper stem-stage from the target stem's birth branch", () => {
    expect(resolveStemReferenceBranch("丁")).toBe("酉");
    expect(resolveStemReferenceBranch("壬")).toBe("申");
    expect(resolveStemReferenceBranch("乙")).toBe("午");

    expect(resolveDisplayStemPairStage("戊", "丁")).toBe("ซี่");
    expect(resolveDisplayStemPairStage("戊", "壬")).toBe("แป่");
    expect(resolveDisplayStemPairStage("戊", "乙")).toBe("ตี้อ๋วง");
    expect(resolveDisplayStemPairStage("甲", "乙")).toBe("ซี่");
    expect(resolveDisplayStemPairStage("甲", "壬")).toBe("เจ๊าะ");
    expect(resolveDisplayStemPairStage("甲", "辛")).toBe("หมกยก");
  });

  test("formats stage pairs in A/B notation", () => {
    expect(formatStagePair("เจ๊าะ", "หมอ")).toBe("เจ๊าะ/หมอ");
    expect(formatStagePair("ตี้อ๋วง", undefined)).toBe("ตี้อ๋วง");
    expect(formatStagePair(undefined, "หมอ")).toBe("หมอ");
  });
});

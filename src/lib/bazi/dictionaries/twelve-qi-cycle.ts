import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createBaseCalculatedKeywords } from "@/lib/bazi/dictionaries/shared";

export const twelveQiCycleDictionary: HybridDictionarySpec = {
  dimensionName: "twelve_qi_cycle",
  sourceRelativePaths: [
    "ตาราง 12 เชี่ยงแซ/ตาราง 12 เชี่ยงแซ.md",
    "ระบบ 12 เชี่ยงแซ 十二長生.md",
  ],
  buildKeywords: (calculatedState) => createBaseCalculatedKeywords(calculatedState),
};

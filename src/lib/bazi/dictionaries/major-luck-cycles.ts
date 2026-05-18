import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createLifeCycleKeywords } from "@/lib/bazi/dictionaries/shared";

export const majorLuckCyclesDictionary: HybridDictionarySpec = {
  dimensionName: "major_luck_cycles",
  sourceRelativePaths: [
    "การทายวัยจร/การทายวัยจร.md",
    "สูตรคำนวณวัยจรลัคนา/2026-04-23_major-luck-formula.csv",
    "สูตรคำนวณวัยจรลัคนา/2026-04-23_lagna-formula.csv",
  ],
  buildKeywords: (calculatedState) => createLifeCycleKeywords(calculatedState),
};

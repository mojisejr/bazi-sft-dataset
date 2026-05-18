import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createElementKeywords } from "@/lib/bazi/dictionaries/shared";

export const healthOverviewDictionary: HybridDictionarySpec = {
  dimensionName: "health_overview",
  sourceRelativePaths: [
    "สุขภาพ(พื้นฐาน)/สุขภาพ(พื้นฐาน).md",
    "Source3_ สุขภาพ(พื้นฐาน)/Source3_ สุขภาพ(พื้นฐาน).md",
  ],
  buildKeywords: (calculatedState) => createElementKeywords(calculatedState),
};

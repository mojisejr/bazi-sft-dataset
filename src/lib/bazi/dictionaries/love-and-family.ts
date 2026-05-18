import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createBaseCalculatedKeywords } from "@/lib/bazi/dictionaries/shared";

export const loveAndFamilyDictionary: HybridDictionarySpec = {
  dimensionName: "love_and_family",
  sourceRelativePaths: [
    "ความรักและความสัมพันธ์/ความรักและความสัมพันธ์.md",
    "Source5_ ความรักและความสัมพันธ์/Source5_ ความรักและความสัมพันธ์.md",
    "คู่สมพงษ์(ความรัก)/คู่สมพงษ์(ความรัก) - หลักวันเท่านั้น.csv",
  ],
  buildKeywords: (calculatedState) => createBaseCalculatedKeywords(calculatedState),
};

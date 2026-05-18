import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createBaseCalculatedKeywords } from "@/lib/bazi/dictionaries/shared";

export const careerPotentialDictionary: HybridDictionarySpec = {
  dimensionName: "career_potential",
  sourceRelativePaths: [
    "การงานและธุรกิจ/การงานและธุรกิจ.md",
    "Source6_ การงานและธุรกิจ/Source6_ การงานและธุรกิจ.md",
    "ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร/ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร - อาชีพถูกดวง.csv",
  ],
  buildKeywords: (calculatedState) => createBaseCalculatedKeywords(calculatedState),
};

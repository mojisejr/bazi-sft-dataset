import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createBaseCalculatedKeywords } from "@/lib/bazi/dictionaries/shared";

export const personalityPsychologyDictionary: HybridDictionarySpec = {
  dimensionName: "personality_psychology",
  sourceRelativePaths: [
    "1.นิสัยโดยพื้นฐาน/1.นิสัยโดยพื้นฐาน.md",
    "ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร/ลักษณะ ของ ดิถี 10 ราศีบน 60กะจื่อ วัยจร - ข้อมูลช่องนิสัย.csv",
    "ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ/ลักษณะนิสัย60แบบ_ราศีบน-ล่าง_12เซี่ยงแซ - นิสัยราศีบน,ล่าง,เซี่ยงแซ.csv",
  ],
  buildKeywords: (calculatedState) => createBaseCalculatedKeywords(calculatedState),
  buildNotes: (calculatedState) => [
    `Anchor day master on ${calculatedState.dayMaster} before synthesizing personality language.`,
  ],
};

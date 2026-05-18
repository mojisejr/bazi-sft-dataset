import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createElementKeywords } from "@/lib/bazi/dictionaries/shared";

export const wealthAndInvestmentDictionary: HybridDictionarySpec = {
  dimensionName: "wealth_and_investment",
  sourceRelativePaths: [
    "การเงินและการลงทุน/การเงินและการลงทุน.md",
    "Source4_ การเงินและการลงทุน/Source4_ การเงินและการลงทุน.md",
  ],
  buildKeywords: (calculatedState) => createElementKeywords(calculatedState),
};

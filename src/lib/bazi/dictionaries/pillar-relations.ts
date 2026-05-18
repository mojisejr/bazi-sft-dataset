import type { HybridDictionarySpec } from "@/lib/bazi/dictionaries/shared";
import { createRelationKeywords } from "@/lib/bazi/dictionaries/shared";

export const pillarRelationsDictionary: HybridDictionarySpec = {
  dimensionName: "pillar_relations",
  sourceRelativePaths: [
    "ตารางชงเฮ้งไห่ผั่ว/ตารางชงเฮ้งไห่ผั่ว.md",
    "ชงเฮ้งไห่ผั่วภาคี(เนื้อหา).docx.md",
  ],
  buildKeywords: (calculatedState) => createRelationKeywords(calculatedState),
};

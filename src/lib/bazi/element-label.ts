import {
  BRANCH_TO_ELEMENT,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

// Thai element label ("ไม้"/"ไฟ"/"ดิน"/"ทอง"/"น้ำ") for a day-master symbol — resolves the stem's
// element first, then falls back to the branch's, then "" if neither maps. Extracted from the
// public-calc route so /api/home and /api/bazi/public-calc read the SAME element vocabulary from a
// single source (no drift between the two surfaces). Pure — no engine change, just the label lookup.
export function elementLabelForSymbol(symbol: string): string {
  const stemEn = STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT];
  if (stemEn) return ELEMENT_LABELS_TH[stemEn];
  const branchEn = BRANCH_TO_ELEMENT[symbol as keyof typeof BRANCH_TO_ELEMENT];
  return branchEn ? ELEMENT_LABELS_TH[branchEn] : "";
}

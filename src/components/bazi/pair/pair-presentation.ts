/** Shared presentation helpers for the pair-matching UI + print report. */
import type { PairComparisonResult, PairDomain, PairMatchPair } from "@/lib/bazi/pair-types";

export const DOMAIN_LABEL: Record<PairDomain, string> = { work: "การงาน", love: "ความรัก" };

export function verdictLabel(percent: number | null): string {
  if (percent == null) return "ไม่พบข้อมูล";
  if (percent >= 83) return "เข้ากันดีเยี่ยม";
  if (percent >= 66) return "เข้ากันดี";
  if (percent >= 50) return "พอไปด้วยกันได้";
  if (percent >= 33) return "ต้องปรับเข้าหากัน";
  return "ท้าทาย ควรระวัง";
}

/** เลือกคำทำนายพื้นฐานของสี่ซิ้งให้ตรงโดเมน. */
export function sisingDomainAspects(
  s: { aspects: Record<string, string> },
  domain: PairDomain,
): { label: string; text: string }[] {
  const pick =
    domain === "work"
      ? [["การงาน", "work"], ["ธุรกิจ", "business"], ["การเงิน", "money"]]
      : [["ความรัก", "love"], ["ครอบครัว", "family"], ["สุขภาพ", "health"]];
  return pick
    .map(([label, key]) => ({ label, text: s.aspects[key] ?? "" }))
    .filter((a) => a.text);
}

export function buildEngineText(
  pair: PairMatchPair,
  domain: PairDomain,
  comparison: PairComparisonResult,
): string {
  const f = pair.forward;
  const r = pair.reverse;
  const lines = [
    `โดเมน: ${DOMAIN_LABEL[domain]}`,
    `คะแนนรวม (ไม่ขึ้นกับลำดับ): ${pair.overallPercent ?? "-"}% (เกรด ${pair.overallGrade})`,
    `• คนที่ 1 (${f.ourPillar}) มองคนที่ 2 (${f.partnerPillar}): ${f.percent ?? "-"}% เกรด ${f.grade} — ${f.ratingText}`,
    f.sising ? `  สี่ซิ้ง: ${f.sising.nameTh} (${f.sising.nameCn})` : "",
    `• คนที่ 2 (${r.ourPillar}) มองคนที่ 1 (${r.partnerPillar}): ${r.percent ?? "-"}% เกรด ${r.grade} — ${r.ratingText}`,
    r.sising ? `  สี่ซิ้ง: ${r.sising.nameTh} (${r.sising.nameCn})` : "",
    `ปฏิกิริยาธาตุ: ${comparison.elementInteraction.summaryTh}`,
  ];
  return lines.filter(Boolean).join("\n");
}

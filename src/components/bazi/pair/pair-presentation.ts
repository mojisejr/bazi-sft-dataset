/** Shared presentation helpers for the pair-matching UI + print report. */
import type {
  MatchFacet,
  PairComparisonResult,
  PairDomain,
  PairMatchPair,
  RelationshipType,
  WorkCandidate,
} from "@/lib/bazi/pair-types";

export const DOMAIN_LABEL: Record<PairDomain, string> = { work: "การงาน", love: "ความรัก" };

/**
 * เมตาดาต้าความสัมพันธ์สำหรับ UI (ป้าย/โดเมน) — สำเนาเบาๆ ฝั่ง client
 * เพื่อไม่ต้อง import RELATIONSHIP_SPECS (ที่ลากตาราง 60×60 1.8MB) เข้า bundle.
 */
export const RELATIONSHIP_META: Record<
  RelationshipType,
  { label: string; ourLabel: string; partnerLabel: string; domain: PairDomain }
> = {
  love: { label: "คู่รัก", ourLabel: "ตัวเรา", partnerLabel: "เขา", domain: "love" },
  partner: { label: "หุ้นส่วน", ourLabel: "เรา", partnerLabel: "หุ้นส่วน", domain: "work" },
  boss: { label: "เจ้านาย", ourLabel: "เรา (ลูกน้อง)", partnerLabel: "เจ้านาย", domain: "work" },
  subordinate: { label: "ลูกน้อง", ourLabel: "เรา", partnerLabel: "ลูกน้อง", domain: "work" },
};

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

/** engine-truth สำหรับ LLM เรียบเรียง (อิงมิติคำทำนายหลัก + ทุกมิติตามความสัมพันธ์). */
export function buildFacetEngineText(
  relationship: RelationshipType,
  facets: MatchFacet[],
  mainFacet: MatchFacet | null,
  comparison: PairComparisonResult,
): string {
  const meta = RELATIONSHIP_META[relationship];
  const lines = [
    `ความสัมพันธ์: ${meta.label} (${meta.ourLabel} ↔ ${meta.partnerLabel}) · ด้าน${DOMAIN_LABEL[meta.domain]}`,
    mainFacet
      ? `คำทำนายหลัก — ${mainFacet.label} (${mainFacet.pairingLabel}): ${mainFacet.percent ?? "-"}% เกรด ${mainFacet.grade} — ${mainFacet.ratingText}`
      : "",
    mainFacet?.sising ? `  สี่ซิ้ง: ${mainFacet.sising.nameTh} (${mainFacet.sising.nameCn})` : "",
    "มิติย่อย (พร้อมคำทำนายรายแท่ง):",
    ...facets.flatMap((f) => [
      `• ${f.label} (${f.pairingLabel}): ${f.percent ?? "-"}% เกรด ${f.grade}`,
      ...f.lines.map((ln) => `    - ${ln.slot}${ln.name ? ` (${ln.name})` : ""}: ${ln.text}`),
    ]),
    `ปฏิกิริยาธาตุ: ${comparison.elementInteraction.summaryTh}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** engine-truth ของผู้สมัครงานหนึ่งคน (เทียบกับ "เรา") สำหรับส่งเข้า LLM. */
export function buildWorkEngineText(
  selfLabel: string,
  candidateLabel: string,
  candidate: WorkCandidate,
): string {
  const m = candidate.match;
  const f = m.forward;
  const r = m.reverse;
  const lines = [
    `โดเมน: การงาน — เปรียบเทียบ "${selfLabel}" กับ "${candidateLabel}"`,
    `คะแนนจัดอันดับ (${selfLabel}→${candidateLabel}): ${f.percent ?? "-"}% เกรด ${f.grade}`,
    `คะแนนรวมสองทิศ: ${m.overallPercent ?? "-"}% (เกรด ${m.overallGrade})`,
    `• ${selfLabel} มอง ${candidateLabel} (${f.ourPillar}×${f.partnerPillar}): ${f.percent ?? "-"}% — ${f.ratingText}`,
    f.sising ? `  สี่ซิ้ง: ${f.sising.nameTh} (${f.sising.nameCn})` : "",
    `• ${candidateLabel} มอง ${selfLabel} (${r.ourPillar}×${r.partnerPillar}): ${r.percent ?? "-"}% — ${r.ratingText}`,
    `ปฏิกิริยาธาตุ: ${candidate.elementInteraction.summaryTh}`,
    ...candidate.roles.map((role) => `บทบาท ${role.perspective} · ${role.stageName}: ${role.narrative}`),
  ];
  return lines.filter(Boolean).join("\n");
}

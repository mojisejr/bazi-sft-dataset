/**
 * Edge providers — resolve "lazy edge" ของ matrix หนาแน่น (pair 60×60, domain-power) ตอน query
 * artifact เก็บแค่ descriptor; cell จริง compute ผ่านฟังก์ชัน engine เดิม (source of truth เดียว)
 */
import { computePairMatch } from "@/lib/bazi/pair-matching";
import {
  computeCareerPower,
  computeFriendsPower,
  computeLearningPower,
  computeWealthPower,
  type DomainPowerChart,
} from "@/lib/bazi/symbolic-engine.domain-power";

import { getEdgeProvider } from "./graph-store";
import { entityIdFor } from "./entity-registry";
import type { GraphProvenance, KnowledgeGraphEvidence } from "./graph-types";

function ganzhiToPillar(ganzhi: string): { stem: string; branch: string } {
  return { stem: ganzhi.slice(0, 1), branch: ganzhi.slice(1, 2) };
}

function providerProvenance(id: string): GraphProvenance {
  const descriptor = getEdgeProvider(id);
  if (!descriptor) {
    return { sourceTable: id, sourceFile: "(unknown)", ref: id };
  }
  return descriptor.provenance;
}

/** สมพงษ์ (การงาน/ความรัก) ระหว่าง 2 หลักวัน → evidence (null เมื่อไม่พบคู่) */
export function resolvePairEdge(
  providerId: "pair-work" | "pair-love",
  ourGanzhi: string,
  partnerGanzhi: string,
): KnowledgeGraphEvidence | null {
  const domain = providerId === "pair-work" ? "work" : "love";
  const result = computePairMatch(ganzhiToPillar(ourGanzhi), ganzhiToPillar(partnerGanzhi), domain);
  if (!result.found) return null;
  const provenance = providerProvenance(providerId);
  const label = domain === "work" ? "สมพงษ์การงาน" : "สมพงษ์ความรัก";
  return {
    title: `${label} ${ourGanzhi}×${partnerGanzhi}`,
    sourcePath: provenance.sourceFile,
    excerpt: `${label} ${ourGanzhi} × ${partnerGanzhi}: ${result.percent ?? "-"}% เกรด ${result.grade} — ${result.ratingText}`,
    matchedKeywords: [ourGanzhi, partnerGanzhi, label],
    provenance: { ...provenance, ref: `${providerId}:${ourGanzhi}|${partnerGanzhi}` },
    entityIds: [entityIdFor("sixty-jiazi", ourGanzhi), entityIdFor("sixty-jiazi", partnerGanzhi)],
    discipline: providerId,
    relation: domain,
    weight: typeof result.percent === "number" ? result.percent / 100 : 0.5,
  };
}

const DOMAIN_PROVIDERS = [
  { id: "domain-career", discipline: "career", label: "พลังการงาน", compute: computeCareerPower },
  { id: "domain-learning", discipline: "learning", label: "พลังการเรียน/ความเข้าใจ", compute: computeLearningPower },
  { id: "domain-friends", discipline: "friends", label: "พลังเพื่อน/บริวาร", compute: computeFriendsPower },
  { id: "domain-wealth", discipline: "wealth", label: "พลังการเงิน", compute: computeWealthPower },
] as const;

/** ค่าพลังรายด้านจากดวงเต็ม (ต้องมี chart) → evidence ต่อด้าน */
export function resolveDomainPowerEvidence(
  chart: DomainPowerChart,
  disciplines?: readonly string[],
): KnowledgeGraphEvidence[] {
  const dayGanzhi = `${chart.day.stem}${chart.day.branch}`;
  const out: KnowledgeGraphEvidence[] = [];
  for (const provider of DOMAIN_PROVIDERS) {
    if (disciplines && !disciplines.includes(provider.discipline)) continue;
    const score = provider.compute(chart);
    if (!score.basis.length && !score.interpretation) continue;
    const provenance = providerProvenance(provider.id);
    const interpretation = score.interpretation ? ` — ${score.interpretation}` : "";
    out.push({
      title: `${provider.label} (${dayGanzhi})`,
      sourcePath: provenance.sourceFile,
      excerpt: `${provider.label}: ${score.score}% (${score.band})${interpretation}`,
      matchedKeywords: [provider.discipline, dayGanzhi],
      provenance: { ...provenance, ref: `${provider.id}:${dayGanzhi}` },
      entityIds: [entityIdFor("sixty-jiazi", dayGanzhi)],
      discipline: provider.discipline,
      relation: "domain-power",
      weight: score.coefficient,
    });
  }
  return out;
}

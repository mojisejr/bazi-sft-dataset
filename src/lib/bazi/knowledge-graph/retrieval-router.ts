/**
 * Retrieval router — NL question → entity → edge ข้ามศาสตร์ → KnowledgeEvidencePacket
 *
 * deterministic ล้วน (ไม่เรียก LLM): resolve entity → ดึง edge ที่ materialize + lazy (pair/domain)
 * → dedupe + จัดอันดับ + ทำ citation. คำตอบจริงเรียบเรียงภายหลังที่ qa-composer (Phase 3)
 */
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import type { DomainPowerChart } from "@/lib/bazi/symbolic-engine.domain-power";

import { buildCitations } from "./citation";
import { resolveDomainPowerEvidence, resolvePairEdge } from "./edge-providers";
import {
  deriveQiStageEntity,
  resolveDisciplines,
  resolveEntities,
  seedEntitiesFromState,
} from "./entity-resolver";
import { getNode, neighbors } from "./graph-store";
import type {
  GraphEdge,
  KnowledgeEvidencePacket,
  KnowledgeGraphEvidence,
  ResolvedEntity,
} from "./graph-types";

/** ตระกูลความสัมพันธ์โครงสร้าง — เก็บเป็น context เสมอแม้ผู้ใช้ถามเจาะด้าน */
const STRUCTURAL_DISCIPLINES = new Set(["element", "ten-god", "interaction", "hidden-stem"]);
const DOMAIN_DISCIPLINES = new Set(["career", "learning", "friends", "wealth"]);
const DEFAULT_MAX_EVIDENCE = 16;

export type RetrieveOptions = {
  /** จำกัด/ระบุด้านที่สนใจ (bare id เช่น "career") — ถ้าไม่ส่ง จะใช้ที่ resolve จากคำถาม */
  disciplines?: string[];
  maxEvidence?: number;
};

function bareDiscipline(id: string): string {
  return id.startsWith("discipline:") ? id.slice("discipline:".length) : id;
}

function chartFromState(state: CalculatedStateValue): DomainPowerChart {
  const p = state.fourPillars;
  return {
    year: { stem: p.year.stem, branch: p.year.branch },
    month: { stem: p.month.stem, branch: p.month.branch },
    day: { stem: p.day.stem, branch: p.day.branch },
    hour: { stem: p.hour.stem, branch: p.hour.branch },
  };
}

function edgeToEvidence(edge: GraphEdge): KnowledgeGraphEvidence {
  const src = getNode(edge.source);
  const tgt = getNode(edge.target);
  const fallback = `${src?.labelZh ?? src?.labelTh ?? edge.source} —${edge.relation}→ ${tgt?.labelTh ?? tgt?.labelZh ?? edge.target}`;
  return {
    title: `${edge.discipline}:${edge.relation}`,
    sourcePath: edge.provenance.sourceFile,
    excerpt: edge.meaningTh || fallback,
    matchedKeywords: [src?.labelTh, src?.labelZh, tgt?.labelTh].filter(
      (value): value is string => Boolean(value),
    ),
    provenance: edge.provenance,
    entityIds: [edge.source, edge.target],
    edgeId: edge.id,
    discipline: edge.discipline,
    relation: edge.relation,
    weight: edge.weight,
  };
}

function qiStageEvidence(qiEntityId: string): KnowledgeGraphEvidence | null {
  const node = getNode(qiEntityId);
  if (!node || node.kind !== "qi-stage" || !node.meaningTh) return null;
  return {
    title: `qi-stage:${node.labelTh}`,
    sourcePath: "src/lib/bazi/symbolic-engine.constants.ts",
    excerpt: `เชี่ยงแซ ${node.labelTh} (${node.labelZh}): ${node.meaningTh}`,
    matchedKeywords: [node.labelTh, node.labelZh].filter((value): value is string => Boolean(value)),
    provenance: {
      sourceTable: "TWELVE_QI_MEANINGS_TH",
      sourceFile: "src/lib/bazi/symbolic-engine.constants.ts",
      ref: `qi:${node.labelZh}`,
    },
    entityIds: [qiEntityId],
    discipline: "timing",
    relation: "qi-stage",
    weight: 0.9,
  };
}

export function retrieveKnowledgeForQuestion(
  question: string,
  calculatedState?: CalculatedStateValue,
  opts: RetrieveOptions = {},
): KnowledgeEvidencePacket {
  const notes: string[] = [];

  // 1) resolve entity (คำถาม + seed จากดวง)
  const resolved: ResolvedEntity[] = [...resolveEntities(question)];
  const seenIds = new Set(resolved.map((entity) => entity.id));
  if (calculatedState) {
    for (const seeded of seedEntitiesFromState(calculatedState)) {
      if (!seenIds.has(seeded.id)) {
        seenIds.add(seeded.id);
        resolved.push(seeded);
      }
    }
  }

  // 2) resolve discipline
  const requestedBare = (
    opts.disciplines?.map(bareDiscipline) ?? resolveDisciplines(question).map(bareDiscipline)
  );
  const requestedSet = new Set(requestedBare);

  // 3) เก็บ evidence
  const dayMaster = calculatedState?.dayMaster ?? resolved.find((e) => e.kind === "stem")?.id.split(":")[1];
  const highValue: KnowledgeGraphEvidence[] = [];
  const primary: KnowledgeGraphEvidence[] = [];
  const structural: KnowledgeGraphEvidence[] = [];

  // 3a) qi stage จาก day-master × กิ่งที่พบ (เช่น "วัยจรตก…")
  const branchEntities = resolved.filter((entity) => entity.kind === "branch");
  for (const branch of branchEntities) {
    const qi = deriveQiStageEntity(dayMaster, branch.id.split(":")[1]);
    if (qi) {
      const evidence = qiStageEvidence(qi.id);
      if (evidence) highValue.push(evidence);
    }
  }
  // qi-stage ที่ผู้ใช้พิมพ์ตรง ๆ
  for (const qiEntity of resolved.filter((entity) => entity.kind === "qi-stage")) {
    const evidence = qiStageEvidence(qiEntity.id);
    if (evidence) highValue.push(evidence);
  }

  // 3b) edge ของ node ที่ resolve ได้
  for (const entity of resolved) {
    for (const edge of neighbors(entity.id)) {
      const isStructural = STRUCTURAL_DISCIPLINES.has(edge.discipline);
      const isRequested = requestedSet.size === 0 || requestedSet.has(edge.discipline);
      if (isStructural) {
        structural.push(edgeToEvidence(edge));
      } else if (isRequested) {
        primary.push(edgeToEvidence(edge));
      }
    }
  }

  // 3c) ค่าพลังรายด้าน (ต้องมีดวงเต็ม)
  if (calculatedState) {
    const wantDomains = requestedSet.size === 0
      ? [...DOMAIN_DISCIPLINES]
      : [...requestedSet].filter((d) => DOMAIN_DISCIPLINES.has(d));
    if (wantDomains.length) {
      highValue.push(...resolveDomainPowerEvidence(chartFromState(calculatedState), wantDomains));
    }
  }

  // 3d) สมพงษ์ (ต้องมี 2 หลักวัน + ขอด้าน pair)
  const jiazi = resolved.filter((entity) => entity.kind === "sixty-jiazi").map((e) => e.id.split(":")[1]);
  if (jiazi.length >= 2) {
    for (const providerId of ["pair-work", "pair-love"] as const) {
      if (requestedSet.size === 0 || requestedSet.has(providerId)) {
        const edge = resolvePairEdge(providerId, jiazi[0], jiazi[1]);
        if (edge) highValue.push(edge);
      }
    }
  }

  // 4) รวม + dedupe ตาม ref + จัดอันดับ (high-value ก่อน, แล้ว weight)
  const ordered = [...highValue, ...primary, ...structural];
  const byRef = new Map<string, KnowledgeGraphEvidence>();
  for (const item of ordered) {
    if (!byRef.has(item.provenance.ref)) byRef.set(item.provenance.ref, item);
  }
  const maxEvidence = opts.maxEvidence ?? DEFAULT_MAX_EVIDENCE;
  const evidence = [...byRef.values()].slice(0, maxEvidence);

  if (!resolved.length) notes.push("ไม่พบ entity ที่ตรงกับคำถาม (อาจต้องระบุดิถี/กิ่ง/ด้านให้ชัด)");
  if (resolved.length && !evidence.length) notes.push("พบ entity แต่ไม่มีกฎข้ามศาสตร์ที่ตรงด้านที่ถาม");

  return {
    question,
    coverage: evidence.length ? "full" : resolved.length ? "partial" : "missing",
    fallbackRequired: evidence.length === 0,
    resolvedEntities: resolved,
    evidence,
    conflicts: [],
    citations: buildCitations(evidence),
    notes,
  };
}

/**
 * Knowledge Graph — schema + types (single source of truth)
 *
 * substrate ของ Graph RAG ข้ามศาสตร์ (in-process). กราฟ "ถูก derive" จากตาราง/ค่าคงที่ที่มีอยู่
 * (constants, KNOWLEDGE_CATALOG, data/*.json) ผ่าน scripts/compile-knowledge-graph.ts → knowledge-graph.json
 *
 * - node = entity (ก้าน/กิ่ง/ธาตุ/60กะจื่อ/12จี้/สิบเทพ/เลขโทร/ไพ่/เซียมซี/เทพปฏิทิน/แบนด์กำลัง/ศาสตร์)
 * - edge = กฎ entity×entity→ความหมาย (materialized) — ทุก edge ติด provenance ให้อ้างอิงได้
 * - edge provider = matrix หนาแน่น (pair/domain/almanac) เก็บแค่ descriptor แล้ว resolve ตอน query
 *
 * เทียบ pattern กับ knowledge/topic-types.ts (Zod schema → z.infer) ให้ทั้งทีมอ่านง่าย
 */
import { z } from "zod";

import type { HybridRetrievalEvidence } from "@/lib/bazi/hybrid-retrieval";

export const GRAPH_ENTITY_KINDS = [
  "stem",
  "branch",
  "element",
  "sixty-jiazi",
  "qi-stage",
  "ten-god",
  "shen-sha",
  "phone-digit",
  "card",
  "stick",
  "almanac-deity",
  "strength-band",
  "discipline",
] as const;

export const GraphEntityKindSchema = z.enum(GRAPH_ENTITY_KINDS);
export type GraphEntityKind = z.infer<typeof GraphEntityKindSchema>;

/** ที่มาของกฎหนึ่งช่อง — backbone ของ citation */
export const GraphProvenanceSchema = z.object({
  /** ชื่อตาราง/ค่าคงที่ต้นทาง เช่น "CLASH_PAIRS", "FACULTY_BY_ELEMENT_TH", "pair-matrix.json[work]" */
  sourceTable: z.string().min(1),
  /** ไฟล์ต้นทาง เช่น "src/lib/bazi/symbolic-engine.constants.ts" */
  sourceFile: z.string().min(1),
  /** cite key เสถียร เช่น "clash:子|午", "faculty:wood" — ใช้ dedupe citation */
  ref: z.string().min(1),
});
export type GraphProvenance = z.infer<typeof GraphProvenanceSchema>;

export const GraphNodeSchema = z.object({
  /** "stem:癸", "branch:亥", "qi-stage:长生", "discipline:career" */
  id: z.string().min(1),
  kind: GraphEntityKindSchema,
  /** อักษรจีน (ถ้ามี) เช่น 癸 */
  labelZh: z.string().optional(),
  /** ป้ายไทย เช่น "กุน", "เชี่ยงแซ", "การงาน" */
  labelTh: z.string().optional(),
  /** ความหมายตั้งต้นที่ผูกกับ node เอง (เช่น meaning ของ 12 จี้, ไพ่, เซียมซี) */
  meaningTh: z.string().optional(),
  /** คำพ้อง/สำหรับ NL matching (เติมเพิ่มใน entity-resolver) */
  aliases: z.array(z.string()).default([]),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /** ป้ายศาสตร์/ตระกูลความสัมพันธ์ เช่น "element", "ten-god", "interaction", "education" */
  discipline: z.string().min(1),
  /** ชนิดความสัมพันธ์ เช่น "generates", "controls", "clash", "正财", "faculty" */
  relation: z.string().min(1),
  meaningTh: z.string().default(""),
  weight: z.number().default(1),
  provenance: GraphProvenanceSchema,
  /** true => ความหมาย compute ตอน query ผ่าน edge provider (ไม่ serialize) */
  lazy: z.boolean().default(false),
});
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

/** descriptor ของ matrix หนาแน่น — เก็บแค่ "ชนิด" ไม่ materialize ทุก cell */
export const EdgeProviderDescriptorSchema = z.object({
  id: z.string().min(1),
  discipline: z.string().min(1),
  sourceEntityKind: GraphEntityKindSchema,
  targetEntityKind: GraphEntityKindSchema,
  provenance: GraphProvenanceSchema,
  /** ชื่อฟังก์ชัน resolver (เพื่อ audit ว่ามีจริง) */
  resolverFn: z.string().min(1),
});
export type EdgeProviderDescriptor = z.infer<typeof EdgeProviderDescriptorSchema>;

export const KnowledgeGraphArtifactSchema = z.object({
  version: z.literal("1.0.0"),
  generatedAt: z.string().min(1),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  edgeProviderCount: z.number().int().nonnegative(),
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  edgeProviders: z.array(EdgeProviderDescriptorSchema),
});
export type KnowledgeGraphArtifact = z.infer<typeof KnowledgeGraphArtifactSchema>;

/**
 * evidence ของกราฟ — superset ของ HybridRetrievalEvidence (title/sourcePath/excerpt/matchedKeywords)
 * เพื่อให้ downstream ที่กิน HybridRetrievalEvidence[] ใช้ต่อได้โดยไม่ต้องแก้
 */
export type KnowledgeGraphEvidence = HybridRetrievalEvidence & {
  provenance: GraphProvenance;
  entityIds: string[];
  edgeId?: string;
  discipline: string;
  relation: string;
  weight: number;
};

export type ResolvedEntity = {
  id: string;
  kind: GraphEntityKind;
  matchedPhrase: string;
  confidence: "exact" | "fuzzy";
};

export type CitationEntry = {
  index: number;
  ref: string;
  sourceTable: string;
  sourceFile: string;
};

export type ConflictNote = {
  discipline: string;
  summary: string;
  evidenceRefs: string[];
};

/** packet ที่ router คืน — เทียบเคียง HybridRetrievalPacket + ข้อมูลกราฟ */
export type KnowledgeEvidencePacket = {
  question: string;
  coverage: "full" | "partial" | "missing";
  fallbackRequired: boolean;
  resolvedEntities: ResolvedEntity[];
  evidence: KnowledgeGraphEvidence[];
  conflicts: ConflictNote[];
  citations: CitationEntry[];
  notes: string[];
};

/**
 * type-level guard: KnowledgeGraphEvidence ต้องประกอบเป็น HybridRetrievalEvidence ได้
 * (ถ้า HybridRetrievalEvidence เปลี่ยน shape จนไม่ compatible จะ error ตรงนี้)
 */
const _evidenceCompat: HybridRetrievalEvidence = {
  title: "",
  sourcePath: "",
  excerpt: "",
  matchedKeywords: [],
} satisfies Pick<
  KnowledgeGraphEvidence,
  "title" | "sourcePath" | "excerpt" | "matchedKeywords"
>;
void _evidenceCompat;

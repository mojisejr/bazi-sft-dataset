/**
 * Graph store — โหลด knowledge-graph.json (static import) + สร้าง index ครั้งเดียวตอน module load
 * เทียบ pattern กับ knowledge/knowledge-loader.ts (cast + consistency check)
 *
 * อ่านอย่างเดียว: getNode / neighbors / edgesBetween / edgeProviders
 */
import artifactJson from "./knowledge-graph.json";

import type {
  EdgeProviderDescriptor,
  GraphEdge,
  GraphEntityKind,
  GraphNode,
  KnowledgeGraphArtifact,
} from "./graph-types";

const artifact = artifactJson as KnowledgeGraphArtifact;

if (artifact.nodeCount !== artifact.nodes.length) {
  throw new Error("knowledge-graph artifact node count is inconsistent.");
}
if (artifact.edgeCount !== artifact.edges.length) {
  throw new Error("knowledge-graph artifact edge count is inconsistent.");
}
if (artifact.edgeProviderCount !== artifact.edgeProviders.length) {
  throw new Error("knowledge-graph artifact edge provider count is inconsistent.");
}

const nodesById = new Map<string, GraphNode>(artifact.nodes.map((node) => [node.id, node]));
const nodesByKind = new Map<GraphEntityKind, GraphNode[]>();
for (const node of artifact.nodes) {
  const bucket = nodesByKind.get(node.kind) ?? [];
  bucket.push(node);
  nodesByKind.set(node.kind, bucket);
}

const edgesBySource = new Map<string, GraphEdge[]>();
const edgesByTarget = new Map<string, GraphEdge[]>();
for (const edge of artifact.edges) {
  const outBucket = edgesBySource.get(edge.source) ?? [];
  outBucket.push(edge);
  edgesBySource.set(edge.source, outBucket);
  const inBucket = edgesByTarget.get(edge.target) ?? [];
  inBucket.push(edge);
  edgesByTarget.set(edge.target, inBucket);
}

const edgeProvidersById = new Map<string, EdgeProviderDescriptor>(
  artifact.edgeProviders.map((provider) => [provider.id, provider]),
);

export function getArtifact(): KnowledgeGraphArtifact {
  return artifact;
}

export function getNode(id: string): GraphNode | undefined {
  return nodesById.get(id);
}

export function hasNode(id: string): boolean {
  return nodesById.has(id);
}

export function getNodesByKind(kind: GraphEntityKind): GraphNode[] {
  return nodesByKind.get(kind) ?? [];
}

export type NeighborOptions = {
  discipline?: string;
  /** "out" = source==id, "in" = target==id, "both" (default) = ทั้งสองทิศ */
  direction?: "out" | "in" | "both";
};

/** edge ทั้งหมดที่แตะ node นี้ (กรอง discipline ได้) */
export function neighbors(id: string, opts: NeighborOptions = {}): GraphEdge[] {
  const direction = opts.direction ?? "both";
  const out = direction === "in" ? [] : edgesBySource.get(id) ?? [];
  const incoming = direction === "out" ? [] : edgesByTarget.get(id) ?? [];
  const all = direction === "both" ? [...out, ...incoming] : direction === "out" ? out : incoming;
  if (!opts.discipline) return all;
  return all.filter((edge) => edge.discipline === opts.discipline);
}

/** edge ที่เชื่อม a↔b โดยตรง (materialized, ไม่สนทิศ) */
export function edgesBetween(a: string, b: string): GraphEdge[] {
  return (edgesBySource.get(a) ?? [])
    .filter((edge) => edge.target === b)
    .concat((edgesBySource.get(b) ?? []).filter((edge) => edge.target === a));
}

export function getEdgeProvider(id: string): EdgeProviderDescriptor | undefined {
  return edgeProvidersById.get(id);
}

export function listEdgeProviders(): EdgeProviderDescriptor[] {
  return artifact.edgeProviders;
}

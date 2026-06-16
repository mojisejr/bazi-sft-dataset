/**
 * Compile knowledge graph — derive node/edge จากตาราง/ค่าคงที่ที่มีอยู่ → knowledge-graph.json
 *
 * source of truth เดียว: ค่าคงที่ engine + KNOWLEDGE_CATALOG + data/*.json
 * เทียบ pattern กับ scripts/compile-knowledge.ts (idempotent write: เปลี่ยน JSON เฉพาะตอน rule เปลี่ยนจริง)
 *
 * รัน: npx tsx scripts/compile-knowledge-graph.ts   (หรือ npm run build:knowledge-graph)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_LABELS_TH,
  CLASH_PAIRS,
  CONTROLS,
  DESTRUCTION_PAIRS,
  ELEMENT_LABELS_TH,
  ELEMENT_TH_TO_EN,
  GENERATES,
  HARM_PAIRS,
  PUNISHMENT_PAIR_KEYS,
  PUNISHMENT_TRIOS,
  SAN_HE_GROUPS,
  SAN_HUI_GROUPS,
  SELF_PUNISHMENT_BRANCHES,
  SIX_COMBINATION_PAIRS,
  TWELVE_QI_LABELS_TH,
} from "@/lib/bazi/symbolic-engine.constants";
import { STEM_ORDER } from "@/lib/bazi/knowledge/standalone-tables";
import { resolveTenGodForStem } from "@/lib/bazi/pillar-display";
import { KNOWLEDGE_CATALOG } from "@/lib/bazi/knowledge/knowledge-catalog";
import {
  buildEntityRegistry,
  entityIdFor,
} from "@/lib/bazi/knowledge-graph/entity-registry";
import {
  EdgeProviderDescriptorSchema,
  KnowledgeGraphArtifactSchema,
  type EdgeProviderDescriptor,
  type GraphEdge,
  type GraphNode,
  type KnowledgeGraphArtifact,
} from "@/lib/bazi/knowledge-graph/graph-types";

const CONSTANTS_FILE = "src/lib/bazi/symbolic-engine.constants.ts";
const CATALOG_FILE = "src/lib/bazi/knowledge/knowledge-catalog.ts";
const PILLAR_FILE = "src/lib/bazi/pillar-display.ts";

const OUTPUT_RELATIVE_PATH = path.join(
  "src",
  "lib",
  "bazi",
  "knowledge-graph",
  "knowledge-graph.json",
);

/** map ตาราง KNOWLEDGE_CATALOG (keyKind สะอาด) → discipline; ที่เหลือ → "knowledge" */
const TABLE_DISCIPLINE: Record<string, string> = {
  QI_WEALTH_TH: "wealth",
  QI_MARKET_TH: "career",
  QI_TALENT_POS_TH: "talent",
  QI_FAMILY_TH: "family",
  YEAR_CUSTOMER_TH: "career",
  OUTPUT_CHANNEL_TH: "career",
  ELEMENT_HEALTH_BEHAVIOR_TH: "health",
  RESOURCE_VIRTUE_TH: "benefactor",
  ELEMENT_IMAGERY_TH: "personality",
  EXCESS_HEALTH_TH: "health",
  ELEMENT_COLOR_BENEFIT_TH: "colors",
  ELEMENT_SHAPE_TH: "colors",
  ELEMENT_CLOTHING_TH: "colors",
  ELEMENT_MONEYTOOL_TH: "wealth",
  ELEMENT_DIRECTION_TH: "colors",
  FACULTY_BY_ELEMENT_TH: "learning",
  ELEMENT_DEITY_BENEFIT_TH: "deities",
  ELEMENT_APTITUDE_FIELD_TH: "talent",
  SOURCE7_CAREER_TH: "career",
  HEALTH_BY_ELEMENT_TH: "health",
  ELEMENT_DEITY_NEGOTIATION_TH: "deities",
  ELEMENT_DEITY_WEALTH_TH: "deities",
  STEM_NATURE_TH: "personality",
  DEITY_UPPER_TH: "deities",
  PO_PILLAR_MEANING_TH: "timing",
};

/** keyKind → entity kind ของ source node (เฉพาะที่ map เป็น node เดี่ยวได้) */
const KEYKIND_TO_ENTITY: Record<string, "element" | "qi-stage" | "stem" | "sixty-jiazi"> = {
  element: "element",
  qi: "qi-stage",
  stem: "stem",
  ganzhi: "sixty-jiazi",
};

/** กลับด้าน TWELVE_QI_LABELS_TH (ไทย → จีน) — ตาราง qi ใน catalog key เป็นชื่อไทย */
const QI_TH_TO_ZH: Record<string, string> = Object.fromEntries(
  Object.entries(TWELVE_QI_LABELS_TH).map(([zh, th]) => [th, zh]),
);

/** แปลง key ของ catalog เป็น entity key ที่ตรงกับ node id; null = ข้าม */
function normalizeEntityKey(
  sourceKind: "element" | "qi-stage" | "stem" | "sixty-jiazi",
  key: string,
): string | null {
  if (sourceKind === "element") return ELEMENT_TH_TO_EN[key] ?? null;
  if (sourceKind === "qi-stage") {
    if (key in TWELVE_QI_LABELS_TH) return key; // จีนอยู่แล้ว
    return QI_TH_TO_ZH[key] ?? null;
  }
  return key;
}

type BuildStats = {
  skippedCatalogTables: string[];
  skippedCatalogEntries: number;
  droppedEdges: number;
};

function resolveOutputPath(repoRoot = process.cwd()) {
  return path.resolve(repoRoot, OUTPUT_RELATIVE_PATH);
}

function readDataJson<T>(repoRoot: string, relative: string): T {
  const full = path.resolve(repoRoot, "src", "lib", "bazi", "data", relative);
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

export function buildKnowledgeGraphArtifact(repoRoot = process.cwd()): {
  artifact: KnowledgeGraphArtifact;
  stats: BuildStats;
} {
  const stats: BuildStats = {
    skippedCatalogTables: [],
    skippedCatalogEntries: 0,
    droppedEdges: 0,
  };

  const nodes: GraphNode[] = buildEntityRegistry();
  const edges: GraphEdge[] = [];

  // ── node เพิ่มจาก JSON (เลขโทร / ไพ่ / เซียมซี) ────────────────────────────
  const phoneDigits = readDataJson<Record<string, { keyword?: string; planet?: string; element?: string }>>(
    repoRoot,
    "phone/phone-digit-meanings.json",
  );
  for (const [digit, info] of Object.entries(phoneDigits)) {
    nodes.push({
      id: entityIdFor("phone-digit", digit),
      kind: "phone-digit",
      labelTh: info.keyword ?? digit,
      meaningTh: [info.planet, info.element, info.keyword].filter(Boolean).join(" · "),
      aliases: [digit],
    });
  }

  const cards = readDataJson<{ no: number; name?: string; keywordEn?: string; keywords?: string; prophecy?: string }[]>(
    repoRoot,
    "divine-cards.json",
  );
  for (const card of cards) {
    nodes.push({
      id: entityIdFor("card", String(card.no)),
      kind: "card",
      labelTh: card.name ?? `ไพ่ #${card.no}`,
      meaningTh: [card.keywords, card.prophecy].filter(Boolean).join("\n"),
      aliases: [card.name, card.keywordEn].filter((value): value is string => Boolean(value)),
    });
  }

  const sticks = readDataJson<{ no: number; pillar?: string; nayin?: string; personality?: string; deity?: string }[]>(
    repoRoot,
    "fortune-sage.json",
  );
  const stickByPillar = new Map<string, (typeof sticks)[number]>();
  const seenStickIds = new Set<string>();
  for (const stick of sticks) {
    const pillar = stick.pillar ?? `#${stick.no}`;
    const stickId = entityIdFor("stick", pillar);
    if (!seenStickIds.has(stickId)) {
      seenStickIds.add(stickId);
      nodes.push({
        id: stickId,
        kind: "stick",
        labelTh: `เซียมซี #${stick.no} ${pillar}`,
        meaningTh: [stick.nayin, stick.personality].filter(Boolean).join(" · "),
        aliases: [pillar],
      });
    }
    if (stick.pillar) stickByPillar.set(stick.pillar, stick);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  const pushEdge = (edge: GraphEdge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      stats.droppedEdges += 1;
      return;
    }
    edges.push(edge);
  };

  // ── ธาตุ: เกิด/ข่ม (相生/相克) ───────────────────────────────────────────
  for (const [src, dst] of Object.entries(GENERATES)) {
    pushEdge({
      id: `element:generates:${src}`,
      source: entityIdFor("element", src),
      target: entityIdFor("element", dst),
      discipline: "element",
      relation: "generates",
      meaningTh: `ธาตุ${ELEMENT_LABELS_TH[src as keyof typeof ELEMENT_LABELS_TH]}เสริมธาตุ${ELEMENT_LABELS_TH[dst as keyof typeof ELEMENT_LABELS_TH]} (相生)`,
      weight: 1,
      provenance: { sourceTable: "GENERATES", sourceFile: CONSTANTS_FILE, ref: `generates:${src}` },
      lazy: false,
    });
  }
  for (const [src, dst] of Object.entries(CONTROLS)) {
    pushEdge({
      id: `element:controls:${src}`,
      source: entityIdFor("element", src),
      target: entityIdFor("element", dst),
      discipline: "element",
      relation: "controls",
      meaningTh: `ธาตุ${ELEMENT_LABELS_TH[src as keyof typeof ELEMENT_LABELS_TH]}ข่มธาตุ${ELEMENT_LABELS_TH[dst as keyof typeof ELEMENT_LABELS_TH]} (相克)`,
      weight: 1,
      provenance: { sourceTable: "CONTROLS", sourceFile: CONSTANTS_FILE, ref: `controls:${src}` },
      lazy: false,
    });
  }

  // ── สิบเทพ (十神) stem→stem ────────────────────────────────────────────
  for (const dayMaster of STEM_ORDER) {
    for (const target of STEM_ORDER) {
      const god = resolveTenGodForStem(dayMaster, target);
      if (!god) continue;
      pushEdge({
        id: `tengod:${dayMaster}:${target}`,
        source: entityIdFor("stem", dayMaster),
        target: entityIdFor("stem", target),
        discipline: "ten-god",
        relation: god,
        meaningTh: `ดิถี ${dayMaster} เห็น ${target} เป็น ${god} (สิบเทพ)`,
        weight: 1,
        provenance: { sourceTable: "resolveTenGodForStem", sourceFile: PILLAR_FILE, ref: `tengod:${dayMaster}:${target}` },
        lazy: false,
      });
    }
  }

  // ── ปฏิกิริยากิ่ง: ชง/ไห่/ผั่ว/ภาคี ────────────────────────────────────
  const branchPairEdge = (
    pairKey: string,
    relation: string,
    table: string,
    labelTh: string,
  ) => {
    const [a, b] = pairKey.split("|");
    if (!a || !b) return;
    pushEdge({
      id: `${relation}:${pairKey}`,
      source: entityIdFor("branch", a),
      target: entityIdFor("branch", b),
      discipline: "interaction",
      relation,
      meaningTh: `${labelTh}: ${BRANCH_LABELS_TH[a as keyof typeof BRANCH_LABELS_TH]} ↔ ${BRANCH_LABELS_TH[b as keyof typeof BRANCH_LABELS_TH]}`,
      weight: 1,
      provenance: { sourceTable: table, sourceFile: CONSTANTS_FILE, ref: `${relation}:${pairKey}` },
      lazy: false,
    });
  };
  for (const key of CLASH_PAIRS) branchPairEdge(key, "clash", "CLASH_PAIRS", "ชง (冲)");
  for (const key of HARM_PAIRS) branchPairEdge(key, "harm", "HARM_PAIRS", "ไห่ (害)");
  for (const key of DESTRUCTION_PAIRS) branchPairEdge(key, "destruction", "DESTRUCTION_PAIRS", "ผั่ว (破)");
  for (const key of SIX_COMBINATION_PAIRS) branchPairEdge(key, "six-combination", "SIX_COMBINATION_PAIRS", "ลั่วฮะ (六合)");
  for (const key of PUNISHMENT_PAIR_KEYS) branchPairEdge(key, "punishment", "PUNISHMENT_PAIR_KEYS", "เฮ้ง (刑)");

  // สามฮะ/สามหุ่ย: กิ่ง → ธาตุที่รวมได้
  const groupElementEdges = (
    groups: readonly { branches: readonly string[]; element: string }[],
    relation: string,
    table: string,
    labelTh: string,
  ) => {
    for (const group of groups) {
      for (const branch of group.branches) {
        pushEdge({
          id: `${relation}:${branch}:${group.element}`,
          source: entityIdFor("branch", branch),
          target: entityIdFor("element", group.element),
          discipline: "interaction",
          relation,
          meaningTh: `${labelTh}: ${group.branches.join("")} รวมเป็นธาตุ${ELEMENT_LABELS_TH[group.element as keyof typeof ELEMENT_LABELS_TH]}`,
          weight: 1,
          provenance: { sourceTable: table, sourceFile: CONSTANTS_FILE, ref: `${relation}:${group.branches.join("")}` },
          lazy: false,
        });
      }
    }
  };
  groupElementEdges(SAN_HE_GROUPS, "san-he", "SAN_HE_GROUPS", "ซำฮะ (三合)");
  groupElementEdges(SAN_HUI_GROUPS, "san-hui", "SAN_HUI_GROUPS", "ซำหุ่ย (三會)");

  // เฮ้งสามเส้า (刑) เป็นคู่ + เฮ้งตนเอง
  for (const trio of PUNISHMENT_TRIOS) {
    for (let i = 0; i < trio.length; i += 1) {
      for (let j = i + 1; j < trio.length; j += 1) {
        const a = trio[i];
        const b = trio[j];
        pushEdge({
          id: `punishment:${a}:${b}`,
          source: entityIdFor("branch", a),
          target: entityIdFor("branch", b),
          discipline: "interaction",
          relation: "punishment",
          meaningTh: `เฮ้ง (刑): ${BRANCH_LABELS_TH[a as keyof typeof BRANCH_LABELS_TH]} ↔ ${BRANCH_LABELS_TH[b as keyof typeof BRANCH_LABELS_TH]}`,
          weight: 1,
          provenance: { sourceTable: "PUNISHMENT_TRIOS", sourceFile: CONSTANTS_FILE, ref: `punishment:${a}:${b}` },
          lazy: false,
        });
      }
    }
  }
  for (const branch of SELF_PUNISHMENT_BRANCHES) {
    pushEdge({
      id: `self-punishment:${branch}`,
      source: entityIdFor("branch", branch),
      target: entityIdFor("branch", branch),
      discipline: "interaction",
      relation: "self-punishment",
      meaningTh: `เฮ้งตนเอง (自刑): ${BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH]}`,
      weight: 1,
      provenance: { sourceTable: "SELF_PUNISHMENT_BRANCHES", sourceFile: CONSTANTS_FILE, ref: `self-punishment:${branch}` },
      lazy: false,
    });
  }

  // ── ก้านแฝงในกิ่ง (藏干) ───────────────────────────────────────────────
  for (const [branch, hidden] of Object.entries(BRANCH_HIDDEN_STEMS)) {
    (hidden as readonly string[]).forEach((stem, index) => {
      pushEdge({
        id: `hidden:${branch}:${stem}:${index}`,
        source: entityIdFor("branch", branch),
        target: entityIdFor("stem", stem),
        discipline: "hidden-stem",
        relation: index === 0 ? "hidden-primary" : "hidden-secondary",
        meaningTh: `ราศีล่าง ${branch} (${BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH]}) เก็บก้าน ${stem}`,
        weight: index === 0 ? 1 : 0.6,
        provenance: { sourceTable: "BRANCH_HIDDEN_STEMS", sourceFile: CONSTANTS_FILE, ref: `hidden:${branch}:${stem}` },
        lazy: false,
      });
    });
  }

  // ── KNOWLEDGE_CATALOG → entity→discipline meaning edges (keyKind สะอาด) ──
  for (const entry of KNOWLEDGE_CATALOG) {
    const sourceKind = KEYKIND_TO_ENTITY[entry.keyKind];
    if (!sourceKind) {
      stats.skippedCatalogTables.push(entry.tableId);
      continue;
    }
    const discipline = TABLE_DISCIPLINE[entry.tableId] ?? "knowledge";
    for (const [key, text] of Object.entries(entry.defaults)) {
      const meaning = (text ?? "").trim();
      if (!meaning) continue;
      const entityKey = normalizeEntityKey(sourceKind, key);
      if (!entityKey) {
        stats.skippedCatalogEntries += 1;
        continue;
      }
      pushEdge({
        id: `cat:${entry.tableId}:${key}`,
        source: entityIdFor(sourceKind, entityKey),
        target: entityIdFor("discipline", discipline),
        discipline,
        relation: entry.tableId,
        meaningTh: meaning,
        weight: 1,
        provenance: { sourceTable: entry.tableId, sourceFile: CATALOG_FILE, ref: `${entry.tableId}:${key}` },
        lazy: false,
      });
    }
  }

  // ── เลขโทร: คู่เลข (digit×digit) ─────────────────────────────────────────
  const phonePairs = readDataJson<Record<string, { feeling?: string; work?: string; money?: string; love?: string }>>(
    repoRoot,
    "phone/phone-pair-meanings.json",
  );
  for (const [pair, info] of Object.entries(phonePairs)) {
    const a = pair[0];
    const b = pair[1];
    if (!a || !b) continue;
    pushEdge({
      id: `phone-pair:${pair}`,
      source: entityIdFor("phone-digit", a),
      target: entityIdFor("phone-digit", b),
      discipline: "phone",
      relation: "phone-pair",
      meaningTh: [info.feeling, info.work, info.money, info.love].filter(Boolean).join(" / "),
      weight: 1,
      provenance: { sourceTable: "phone-pair-meanings.json", sourceFile: "src/lib/bazi/data/phone/phone-pair-meanings.json", ref: `phone-pair:${pair}` },
      lazy: false,
    });
  }

  // ── เซียมซี: 60กะจื่อ → ไม้เซียมซี ───────────────────────────────────────
  for (const [pillar, stick] of stickByPillar.entries()) {
    pushEdge({
      id: `fortune-stick:${pillar}`,
      source: entityIdFor("sixty-jiazi", pillar),
      target: entityIdFor("stick", pillar),
      discipline: "sticks",
      relation: "fortune-stick",
      meaningTh: stick.personality ?? "",
      weight: 1,
      provenance: { sourceTable: "fortune-sage.json", sourceFile: "src/lib/bazi/data/fortune-sage.json", ref: `fortune-stick:${pillar}` },
      lazy: false,
    });
  }

  // ── edge provider (matrix หนาแน่น) — descriptor เท่านั้น ─────────────────
  const edgeProviders: EdgeProviderDescriptor[] = [
    {
      id: "pair-work",
      discipline: "pair-work",
      sourceEntityKind: "sixty-jiazi",
      targetEntityKind: "sixty-jiazi",
      provenance: { sourceTable: "pair-matrix.json[work]", sourceFile: "src/lib/bazi/data/pair/pair-matrix.json", ref: "pair-work" },
      resolverFn: "computePairMatch",
    },
    {
      id: "pair-love",
      discipline: "pair-love",
      sourceEntityKind: "sixty-jiazi",
      targetEntityKind: "sixty-jiazi",
      provenance: { sourceTable: "pair-matrix.json[love]", sourceFile: "src/lib/bazi/data/pair/pair-matrix.json", ref: "pair-love" },
      resolverFn: "computePairMatch",
    },
    {
      id: "domain-career",
      discipline: "career",
      sourceEntityKind: "sixty-jiazi",
      targetEntityKind: "sixty-jiazi",
      provenance: { sourceTable: "domain-power/matrix.json", sourceFile: "src/lib/bazi/data/domain-power/matrix.json", ref: "domain-career" },
      resolverFn: "computeCareerPower",
    },
    {
      id: "domain-learning",
      discipline: "learning",
      sourceEntityKind: "sixty-jiazi",
      targetEntityKind: "sixty-jiazi",
      provenance: { sourceTable: "domain-power/matrix.json", sourceFile: "src/lib/bazi/data/domain-power/matrix.json", ref: "domain-learning" },
      resolverFn: "computeLearningPower",
    },
    {
      id: "domain-friends",
      discipline: "friends",
      sourceEntityKind: "sixty-jiazi",
      targetEntityKind: "sixty-jiazi",
      provenance: { sourceTable: "domain-power/friends.json", sourceFile: "src/lib/bazi/data/domain-power/friends.json", ref: "domain-friends" },
      resolverFn: "computeFriendsPower",
    },
    {
      id: "domain-wealth",
      discipline: "wealth",
      sourceEntityKind: "sixty-jiazi",
      targetEntityKind: "sixty-jiazi",
      provenance: { sourceTable: "domain-power/matrix.json", sourceFile: "src/lib/bazi/data/domain-power/matrix.json", ref: "domain-wealth" },
      resolverFn: "computeWealthPower",
    },
  ].map((descriptor) => EdgeProviderDescriptorSchema.parse(descriptor));

  const artifact = KnowledgeGraphArtifactSchema.parse({
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    edgeProviderCount: edgeProviders.length,
    nodes,
    edges,
    edgeProviders,
  });

  return { artifact, stats };
}

export function writeKnowledgeGraphArtifact(repoRoot = process.cwd()) {
  const { artifact, stats } = buildKnowledgeGraphArtifact(repoRoot);
  const outputPath = resolveOutputPath(repoRoot);

  if (existsSync(outputPath)) {
    const previous = KnowledgeGraphArtifactSchema.parse(JSON.parse(readFileSync(outputPath, "utf8")));
    const { generatedAt: _prev, ...previousComparable } = previous;
    const { generatedAt: _next, ...nextComparable } = artifact;
    if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable)) {
      artifact.generatedAt = previous.generatedAt;
    }
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { outputPath, artifact, stats };
}

function isMainModule() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return currentFilePath === executedPath;
}

if (isMainModule()) {
  const { outputPath, artifact, stats } = writeKnowledgeGraphArtifact();
  console.log(`Knowledge graph written to ${outputPath}`);
  console.log(
    `  nodes=${artifact.nodeCount} edges=${artifact.edgeCount} providers=${artifact.edgeProviderCount}`,
  );
  console.log(
    `  skipped catalog tables (non-entity keyKind)=${stats.skippedCatalogTables.length} skipped entries=${stats.skippedCatalogEntries} dropped edges=${stats.droppedEdges}`,
  );
}

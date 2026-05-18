import type {
  BaseChartParticipantValue,
  BaseChartReactionBadgeValue,
  CalculatedStateValue,
} from "@/lib/bazi/schema-types";
import { ELEMENT_TH_TO_EN } from "@/lib/bazi/symbolic-engine.constants";

export type SemanticPillarKey = "year" | "month" | "day" | "hour";

export type SemanticGraphLayer =
  | "pillar-structure"
  | "daymaster-meaning"
  | "element-flow"
  | "element-interaction"
  | "inter-pillar-reaction"
  | "shen-sha-overlay";

export type SemanticOverlayTier = "visible" | "secondary";

export type SemanticNodeKind = "pillar" | "marker" | "stem-node" | "branch-node";

export type SemanticPillarDisplayMode = "day-anchor" | "outer-full";

export type PillarStageSlot = {
  label: string;
  value: string;
  source: "upper" | "sitting" | "lower";
};

export type PillarMeaningSlot = {
  source: "stem" | "branch";
  symbol: string;
  translation?: string;
  relationLabel: string;
  meaningShort: string;
  badge: BaseChartReactionBadgeValue;
};

export type SemanticPillarNodeData = {
  kind: "pillar";
  layer: "pillar-structure";
  pillarKey: SemanticPillarKey;
  pillarLabel: string;
  displayMode: SemanticPillarDisplayMode;
  stem: string;
  branch: string;
  stemTranslation?: string;
  branchTranslation?: string;
  isFocal: boolean;
  stageSlots: PillarStageSlot[];
  meaningSlots: PillarMeaningSlot[];
};

export type SemanticMarkerNodeData = {
  kind: "marker";
  layer: "shen-sha-overlay";
  tier: SemanticOverlayTier;
  badge: BaseChartReactionBadgeValue;
  displayLabel: string;
  attachedPillarKey: SemanticPillarKey | null;
};

export type SemanticStemNodeData = {
  kind: "stem-node";
  layer: "pillar-structure";
  pillarKey: SemanticPillarKey;
  pillarLabel: string;
  stem: string;
  stemTranslation?: string;
  element: string;
  isFocal: boolean;
  tenGod?: string;
  hiddenStems: string[];
  hiddenStemCompactLabel?: string;
  markerLabels: string[];
};

export type SemanticBranchNodeData = {
  kind: "branch-node";
  layer: "pillar-structure";
  pillarKey: SemanticPillarKey;
  pillarLabel: string;
  branch: string;
  branchTranslation?: string;
  element: string;
  isFocal: boolean;
  tenGod?: string;
  stageDisplay?: string;
  hiddenStems: string[];
  hiddenStemCompactLabel?: string;
  markerLabels: string[];
};

export type SemanticNodeData = SemanticPillarNodeData | SemanticMarkerNodeData | SemanticStemNodeData | SemanticBranchNodeData;

export type SemanticNode = {
  id: string;
  type: "chamberPillar" | "chamberMarker" | "chamberStemNode" | "chamberBranchNode";
  data: SemanticNodeData;
  position: { x: number; y: number };
  width?: number;
  height?: number;
};

export type SemanticEdgeData = {
  layer: Exclude<SemanticGraphLayer, "pillar-structure">;
  badge: BaseChartReactionBadgeValue;
  readingOrder: number;
  schoolCluster: SemanticSchoolCluster | null;
  sourceDetail?: string;
  targetDetail?: string;
  tier?: string;
  parallelOffset?: number;
  schoolLabel?: string;
  flowCycleType?: "generating" | "controlling" | "neutral";
  flowDirection?: "outward" | "inward" | "none" | "both";
  flowLabel?: string;
  flowElement?: string;
  arrowMode?: "none" | "forward" | "both";
};

export type SemanticEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data: SemanticEdgeData;
  label?: string;
  className?: string;
};

export type SemanticEdgeBadgeContract = {
  relationLabel: string;
  directionLabel?: string;
  directionSymbol: string;
  badgeMode: "flow" | "reaction";
};

import {
  applySchoolRevealPolicy,
  DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
  filterEdgesBySchoolRevealPolicy,
  resolveSchoolRevealPolicyConfig,
  type SchoolRevealPolicyConfig,
} from "@/lib/bazi/school-reveal-policy";

export type SemanticChamberGraph = {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  schoolClusters: SemanticSchoolCluster[];
  hiddenSecondaryOverlays: BaseChartReactionBadgeValue[];
};

export function isFocalSemanticNode(node: SemanticNode): boolean {
  return "isFocal" in node.data && Boolean(node.data.isFocal);
}

export function getSemanticDayFocusNodeIds(graph: SemanticChamberGraph): string[] {
  const ids = graph.nodes
    .filter((node) => {
      if (!isFocalSemanticNode(node)) {
        return false;
      }

      if (node.data.kind === "stem-node" || node.data.kind === "branch-node") {
        return node.data.pillarKey === "day";
      }

      if (node.data.kind === "pillar") {
        return node.data.pillarKey === "day";
      }

      return false;
    })
    .sort((left, right) => {
      const priority = (node: SemanticNode) => {
        if (node.data.kind === "stem-node") return 0;
        if (node.data.kind === "branch-node") return 1;
        return 2;
      };

      return priority(left) - priority(right);
    })
    .map((node) => node.id);

  if (ids.length > 0) {
    return ids;
  }

  return graph.nodes.some((node) => node.id === "pillar:day") ? ["pillar:day"] : [];
}

export type SemanticSchoolCluster = {
  id: string;
  schoolLabel: string;
  title: string;
  humanSummary: string;
  badgeIds: string[];
  sourcePillarKeys: SemanticPillarKey[];
  branchParticipantLabels: string[];
  accentMarkerLabels: string[];
};

const PILLAR_KEYS: SemanticPillarKey[] = ["year", "month", "day", "hour"];

const PILLAR_LABEL: Record<SemanticPillarKey, string> = {
  year: "ปี",
  month: "เดือน",
  day: "ดิถี",
  hour: "ยาม",
};

const STEM_TO_ELEMENT: Record<string, string> = {
  甲: "ไม้", 乙: "ไม้",
  丙: "ไฟ", 丁: "ไฟ",
  戊: "ดิน", 己: "ดิน",
  庚: "ทอง", 辛: "ทอง",
  壬: "น้ำ", 癸: "น้ำ",
};

const BRANCH_TO_ELEMENT: Record<string, string> = {
  子: "น้ำ", 丑: "ดิน", 寅: "ไม้", 卯: "ไม้",
  辰: "ดิน", 巳: "ไฟ", 午: "ไฟ", 未: "ดิน",
  申: "ทอง", 酉: "ทอง", 戌: "ดิน", 亥: "น้ำ",
};

type FlowCategory = "output" | "wealth" | "power" | "resource" | "companion";
type FlowCycleType = "generating" | "controlling" | "neutral";
type FlowDirection = "outward" | "inward" | "none";

type TenGodFlowInfo = {
  category: FlowCategory;
  cycleType: FlowCycleType;
  direction: FlowDirection;
  label: string;
};

const TEN_GOD_FLOW_MAP: Record<string, TenGodFlowInfo> = {
  食神: { category: "output", cycleType: "generating", direction: "outward", label: "ถ่ายเท" },
  伤官: { category: "output", cycleType: "generating", direction: "outward", label: "ถ่ายเท" },
  偏财: { category: "wealth", cycleType: "controlling", direction: "outward", label: "โชคลาภ" },
  正财: { category: "wealth", cycleType: "controlling", direction: "outward", label: "โชคลาภ" },
  偏印: { category: "resource", cycleType: "generating", direction: "inward", label: "ส่งเสริม" },
  正印: { category: "resource", cycleType: "generating", direction: "inward", label: "ส่งเสริม" },
  七杀: { category: "power", cycleType: "controlling", direction: "inward", label: "พิฆาต" },
  正官: { category: "power", cycleType: "controlling", direction: "inward", label: "พิฆาต" },
  比肩: { category: "companion", cycleType: "neutral", direction: "none", label: "คู่ธาตุ" },
  劫财: { category: "companion", cycleType: "neutral", direction: "none", label: "คู่ธาตุ" },
};

const PILLAR_LABEL_REVERSE: Record<string, SemanticPillarKey> = {
  ปี: "year",
  เดือน: "month",
  วัน: "day",
  ดิถี: "day",
  ยาม: "hour",
  ชั่วยาม: "hour",
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
};

type NodePosition = { x: number; y: number };

const GRID_PILLAR_ORDER: SemanticPillarKey[] = ["hour", "day", "month", "year"];
const GRID_COLUMN_SPACING = 180;
const GRID_ROW_SPACING = 200;
const GRID_ORIGIN_X = 100;
const GRID_STEM_ROW_Y = 100;
const GRID_BRANCH_ROW_Y = GRID_STEM_ROW_Y + GRID_ROW_SPACING;
const GRID_MARKER_ROW_Y = GRID_BRANCH_ROW_Y + GRID_ROW_SPACING + 40;

function gridColumnIndex(pillarKey: SemanticPillarKey): number {
  return GRID_PILLAR_ORDER.indexOf(pillarKey);
}

function computeStemNodePositions(): Record<SemanticPillarKey, NodePosition> {
  const positions: Partial<Record<SemanticPillarKey, NodePosition>> = {};
  for (const key of PILLAR_KEYS) {
    const col = gridColumnIndex(key);
    positions[key] = {
      x: GRID_ORIGIN_X + col * GRID_COLUMN_SPACING,
      y: GRID_STEM_ROW_Y,
    };
  }
  return positions as Record<SemanticPillarKey, NodePosition>;
}

function computeBranchNodePositions(): Record<SemanticPillarKey, NodePosition> {
  const positions: Partial<Record<SemanticPillarKey, NodePosition>> = {};
  for (const key of PILLAR_KEYS) {
    const col = gridColumnIndex(key);
    positions[key] = {
      x: GRID_ORIGIN_X + col * GRID_COLUMN_SPACING,
      y: GRID_BRANCH_ROW_Y,
    };
  }
  return positions as Record<SemanticPillarKey, NodePosition>;
}

function computeMarkerPosition(pillarKey: SemanticPillarKey): NodePosition {
  const col = gridColumnIndex(pillarKey);
  return {
    x: GRID_ORIGIN_X + col * GRID_COLUMN_SPACING,
    y: GRID_MARKER_ROW_Y,
  };
}

function pillarNodeId(pillarKey: SemanticPillarKey): string {
  return `pillar:${pillarKey}`;
}

function stemNodeId(pillarKey: SemanticPillarKey): string {
  return `stem:${pillarKey}`;
}

function branchNodeId(pillarKey: SemanticPillarKey): string {
  return `branch:${pillarKey}`;
}

function markerNodeId(badge: BaseChartReactionBadgeValue): string {
  return `marker:${badge.id}`;
}

function resolvePillarKeyFromString(candidate: string | undefined): SemanticPillarKey | null {
  if (!candidate) {
    return null;
  }

  return PILLAR_LABEL_REVERSE[candidate.trim()] ?? null;
}

function resolvePillarKeyFromBadgeParticipant(
  participant: BaseChartReactionBadgeValue["participants"][number],
): SemanticPillarKey | null {
  return (
    resolvePillarKeyFromString(participant.pillarKey) ??
    resolvePillarKeyFromString(participant.pillarLabel)
  );
}

function formatParticipantForGraph(participant: BaseChartParticipantValue): string {
  const pillarLabel = participant.pillarLabel ?? participant.pillarKey ?? "จุดอ้างอิง";
  const sideLabel = participant.type === "stem"
    ? "ราศีบน"
    : participant.type === "branch"
      ? "ราศีล่าง"
      : participant.type === "marker"
        ? "ดาวประกอบ"
        : "เสา";
  const translation = participant.translation ? ` (${participant.translation})` : "";

  return `${pillarLabel} · ${sideLabel} · ${participant.symbol}${translation}`;
}

function getParticipantPillarKeys(badge: BaseChartReactionBadgeValue): SemanticPillarKey[] {
  const keys = new Set<SemanticPillarKey>();
  badge.participants.forEach((participant) => {
    const pillarKey = resolvePillarKeyFromBadgeParticipant(participant);
    if (pillarKey) {
      keys.add(pillarKey);
    }
  });

  return Array.from(keys);
}

function getPrimarySchoolLabel(badge: BaseChartReactionBadgeValue): string {
  if (badge.semanticKind === "branch-punishment-trio") {
    return "ซำเฮ้ง";
  }

  return badge.schoolLabel ?? badge.shortLabel ?? badge.label;
}

function resolveFlowDirectionContract(edge: SemanticEdge): { label: string; symbol: string } {
  if (edge.data.flowDirection === "outward") {
    return { label: "ส่งออก", symbol: "→" };
  }
  if (edge.data.flowDirection === "inward") {
    return { label: "รับเข้า", symbol: "←" };
  }
  if (edge.data.flowDirection === "both") {
    return { label: "สองทิศ", symbol: "↔" };
  }

  return { label: "คู่ธาตุ", symbol: "↔" };
}

function resolveReactionFamilyLabel(badge: BaseChartReactionBadgeValue): string {
  if (badge.semanticKind === "stem-clash") {
    return "ชง";
  }

  if (
    badge.semanticKind === "stem-combination"
    || badge.semanticKind === "branch-liu-he"
    || badge.semanticKind === "branch-combination"
    || badge.semanticKind === "branch-san-he"
    || badge.semanticKind === "branch-ban-san-he"
  ) {
    return "ภาคี";
  }

  if (badge.semanticKind === "branch-punishment-trio") {
    return "ซำเฮ้ง";
  }

  return getPrimarySchoolLabel(badge);
}

function resolveReactionMetaLabel(badge: BaseChartReactionBadgeValue): string | undefined {
  if (badge.doctrineKey === "interaction:branch-clash" || badge.doctrineKey === "interaction:heavenly-stem-clash") {
    return "คู่ปะทะ";
  }

  if (badge.doctrineKey === "interaction:branch-harm") {
    return "เบียดเบียน";
  }

  if (badge.doctrineKey === "interaction:branch-destruction" || badge.doctrineKey === "interaction:intra-pillar-destruction") {
    return "แตกหัก";
  }

  if (badge.doctrineKey === "interaction:branch-punishment-pair" || badge.doctrineKey === "interaction:branch-punishment-self") {
    return "กดดัน";
  }

  if (badge.semanticKind === "branch-punishment-trio") {
    return "วุ่นวาย";
  }

  if (
    badge.semanticKind === "stem-combination"
    || badge.semanticKind === "branch-liu-he"
    || badge.semanticKind === "branch-combination"
  ) {
    return "ดึงดูด";
  }

  if (badge.semanticKind === "branch-san-he" || badge.semanticKind === "branch-ban-san-he") {
    return "รวมพลัง";
  }

  return undefined;
}

export function resolveSemanticEdgeBadgeContract(edge: SemanticEdge): SemanticEdgeBadgeContract | null {
  if (edge.data.layer === "shen-sha-overlay" || edge.data.layer === "daymaster-meaning") {
    return null;
  }

  if (edge.data.layer === "element-flow") {
    const direction = resolveFlowDirectionContract(edge);
    return {
      relationLabel: edge.data.flowLabel ?? edge.data.badge.shortLabel ?? edge.data.badge.label,
      directionLabel: direction.label,
      directionSymbol: direction.symbol,
      badgeMode: "flow",
    };
  }

  if (edge.data.layer === "element-interaction") {
    const direction = resolveFlowDirectionContract(edge);
    return {
      relationLabel: edge.data.flowLabel ?? edge.data.badge.shortLabel ?? edge.data.badge.label,
      directionLabel: direction.label,
      directionSymbol: direction.symbol,
      badgeMode: "flow",
    };
  }

  return {
    relationLabel: resolveReactionFamilyLabel(edge.data.badge),
    directionLabel: resolveReactionMetaLabel(edge.data.badge),
    directionSymbol: "↔",
    badgeMode: "reaction",
  };
}

function getSchoolHumanSummary(badge: BaseChartReactionBadgeValue): string {
  if (badge.doctrineKey === "interaction:branch-clash") {
    return "ปะทะ กระแทก ชน ทำให้เกิดการเปลี่ยนแปลง";
  }
  if (badge.doctrineKey === "interaction:branch-harm") {
    return "ให้ร้าย กล่าวโทษ กล่าวหา ต่อว่า";
  }
  if (badge.semanticKind === "branch-punishment-trio" || badge.doctrineKey === "interaction:branch-punishment-pair" || badge.doctrineKey === "interaction:branch-punishment-self") {
    return badge.semanticKind === "branch-punishment-trio"
      ? "โต้เถียง วุ่นวาย ชวนทะเลาะวิวาท"
      : "ทำร้าย เบียดเบียน ให้โทษ";
  }
  if (badge.doctrineKey === "interaction:branch-destruction" || badge.doctrineKey === "interaction:intra-pillar-destruction") {
    return "ทำให้เสียหาย";
  }
  if (badge.doctrineKey === "interaction:branch-combination" || badge.doctrineKey === "interaction:stem-combination") {
    return "เกี่ยวข้องกัน ดึงดูดกัน และอาจแปรธาตุ";
  }
  if (badge.doctrineKey === "marker:nobleman") {
    return "แรงอุปถัมภ์ ผู้ใหญ่ช่วยเหลือ หรือมีคนค้ำชู";
  }
  if (badge.doctrineKey === "marker:wenchang") {
    return "แรงของความคิด การเรียน การเขียน หรือชื่อเสียงจากความรู้";
  }

  return "อ่านความหมายร่วมกับตำแหน่งเสาและราศีที่เกี่ยวข้อง";
}

function buildSchoolClusterForBadge(
  badge: BaseChartReactionBadgeValue,
  visibleMarkerBadges: BaseChartReactionBadgeValue[],
): SemanticSchoolCluster {
  const schoolLabel = getPrimarySchoolLabel(badge);
  const sourcePillarKeys = getParticipantPillarKeys(badge);
  const sourcePillarSet = new Set(sourcePillarKeys);
  const accentMarkerLabels = Array.from(new Set(visibleMarkerBadges
    .filter((marker) => {
      const markerPillarKeys = getParticipantPillarKeys(marker);
      return markerPillarKeys.some((pillarKey) => sourcePillarSet.has(pillarKey));
    })
    .map(getOverlayDisplayLabel)));
  const branchParticipantLabels = Array.from(new Set(badge.participants
    .filter((participant) => participant.type === "branch")
    .map(formatParticipantForGraph)));
  const humanSummary = getSchoolHumanSummary(badge);

  return {
    id: `cluster:${badge.id}`,
    schoolLabel,
    title: `${schoolLabel}: ${humanSummary}`,
    humanSummary,
    badgeIds: [badge.id],
    sourcePillarKeys,
    branchParticipantLabels,
    accentMarkerLabels,
  };
}

function buildPillarNodes(calculatedState: CalculatedStateValue): SemanticNode[] {
  const reading = calculatedState.baseChartReading;
  if (!reading) {
    return [];
  }

  const stemPositions = computeStemNodePositions();
  const branchPositions = computeBranchNodePositions();
  const nodes: SemanticNode[] = [];

  for (const pillarKey of PILLAR_KEYS) {
    const pillar = calculatedState.fourPillars[pillarKey];
    const isFocal = pillarKey === "day";
    const pillarLabel = PILLAR_LABEL[pillarKey];
    const stemElement = STEM_TO_ELEMENT[pillar.stem] ?? "ไม้";
    const branchElement = BRANCH_TO_ELEMENT[pillar.branch] ?? "ไม้";
    const stemTenGod = pillar.tenGod && pillar.tenGod !== "ดิถี" ? pillar.tenGod : undefined;
    const hiddenStems = pillar.hiddenStems ?? [];
    const compactHiddenStemLabel = hiddenStems.length <= 2
      ? hiddenStems.join(" · ")
      : `${hiddenStems.slice(0, 2).join(" · ")} +${hiddenStems.length - 2}`;
    const markerLabels = Array.from(new Set(
      reading.markerBadges
        .filter((badge) => getParticipantPillarKeys(badge).includes(pillarKey))
        .map((badge) => getOverlayDisplayLabel(badge)),
    ));

    nodes.push({
      id: stemNodeId(pillarKey),
      type: "chamberStemNode",
      data: {
        kind: "stem-node",
        layer: "pillar-structure",
        pillarKey,
        pillarLabel,
        stem: pillar.stem,
        stemTranslation: pillar.stemTranslation,
        element: stemElement,
        isFocal,
        tenGod: stemTenGod,
        hiddenStems,
        hiddenStemCompactLabel: compactHiddenStemLabel,
        markerLabels,
      },
      position: stemPositions[pillarKey],
      width: 80,
      height: 80,
    } satisfies SemanticNode);

    nodes.push({
      id: branchNodeId(pillarKey),
      type: "chamberBranchNode",
      data: {
        kind: "branch-node",
        layer: "pillar-structure",
        pillarKey,
        pillarLabel,
        branch: pillar.branch,
        branchTranslation: pillar.branchTranslation,
        element: branchElement,
        isFocal,
        tenGod: undefined,
        stageDisplay: pillar.sittingStage ?? pillar.lowerStageDisplay,
        hiddenStems,
        hiddenStemCompactLabel: compactHiddenStemLabel,
        markerLabels,
      },
      position: branchPositions[pillarKey],
      width: 80,
      height: 80,
    } satisfies SemanticNode);
  }

  return nodes;
}

function getOverlayTier(badge: BaseChartReactionBadgeValue): SemanticOverlayTier {
  if (badge.doctrineKey === "marker:nobleman") {
    return "visible";
  }

  if (badge.doctrineKey === "marker:wenchang") {
    return "visible";
  }

  return "secondary";
}

function getOverlayDisplayLabel(badge: BaseChartReactionBadgeValue): string {
  if (badge.doctrineKey === "marker:nobleman") {
    return "กุ้ยนั้ง/อุปถัมภ์ (天乙贵人)";
  }

  if (badge.doctrineKey === "marker:wenchang") {
    return "บุ่งเชียง/วิชาการ (文昌)";
  }

  return badge.shortLabel ?? badge.label;
}

function buildMarkerNodes(markerBadges: BaseChartReactionBadgeValue[]): SemanticNode[] {
  return markerBadges
    .filter((badge) => getOverlayTier(badge) === "visible")
    .map((badge) => {
      const attachedPillarKey = badge.participants.length > 0
        ? resolvePillarKeyFromBadgeParticipant(badge.participants[0])
        : null;

      const markerPosition = attachedPillarKey
        ? computeMarkerPosition(attachedPillarKey)
        : { x: 640, y: 620 };

      const data: SemanticMarkerNodeData = {
        kind: "marker",
        layer: "shen-sha-overlay",
        tier: "visible",
        badge,
        displayLabel: getOverlayDisplayLabel(badge),
        attachedPillarKey,
      };

      return {
        id: markerNodeId(badge),
        type: "chamberMarker",
        data,
        position: markerPosition,
        width: 90,
        height: 32,
      } satisfies SemanticNode;
    });
}

function buildDaymasterRelationEdges(roleBadges: BaseChartReactionBadgeValue[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];

  roleBadges.forEach((badge, index) => {
    const participant = badge.participants[0];
    const targetPillarKey = participant ? resolvePillarKeyFromBadgeParticipant(participant) : null;

    if (!targetPillarKey || targetPillarKey === "day") {
      return;
    }

    const isStem = participant.type === "stem";
    const sourceNodeId = isStem ? stemNodeId("day") : branchNodeId("day");
    const targetNodeId = isStem ? stemNodeId(targetPillarKey) : branchNodeId(targetPillarKey);

    const sourceHandle = isStem ? "source-top" : "source-bottom";
    const targetHandle = isStem ? "target-top" : "target-bottom";

    edges.push({
        id: `daymaster:${badge.id}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle,
        targetHandle,
        data: {
          layer: "daymaster-meaning",
          badge,
          readingOrder: index + 1,
          schoolCluster: null,
          sourceDetail: "ดิถี · จุดอ้างอิง",
          targetDetail: formatParticipantForGraph(participant),
          arrowMode: "none",
        },
        className: `chamber-edge chamber-edge--daymaster chamber-edge--guide chamber-edge--${badge.status}`,
    });
  });

  return edges;
}

function buildElementFlowEdges(roleBadges: BaseChartReactionBadgeValue[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];

  roleBadges.forEach((badge) => {
    const participant = badge.participants[0];
    const targetPillarKey = participant ? resolvePillarKeyFromBadgeParticipant(participant) : null;

    if (!targetPillarKey || targetPillarKey === "day") {
      return;
    }

    const tenGodKey = badge.doctrineKey?.startsWith("ten-god:")
      ? badge.doctrineKey.slice("ten-god:".length)
      : null;
    const flowInfo = tenGodKey ? TEN_GOD_FLOW_MAP[tenGodKey] : null;
    if (!flowInfo) {
      return;
    }

    const isStem = participant.type === "stem";
    const targetElementTH = isStem
      ? (STEM_TO_ELEMENT[participant.symbol] ?? "ไม้")
      : (BRANCH_TO_ELEMENT[participant.symbol] ?? "ไม้");
    const targetElementEN = ELEMENT_TH_TO_EN[targetElementTH] ?? "wood";

    const dayNodeId = isStem ? stemNodeId("day") : branchNodeId("day");
    const targetNodeId = isStem ? stemNodeId(targetPillarKey) : branchNodeId(targetPillarKey);

    let sourceHandle: string;
    let targetHandle: string;
    let source: string;
    let target: string;

    if (flowInfo.direction === "outward") {
      source = dayNodeId;
      target = targetNodeId;
      sourceHandle = isStem ? "source-top" : "source-bottom";
      targetHandle = isStem ? "target-top" : "target-bottom";
    } else if (flowInfo.direction === "inward") {
      source = targetNodeId;
      target = dayNodeId;
      sourceHandle = isStem ? "source-top" : "source-bottom";
      targetHandle = isStem ? "target-top" : "target-bottom";
    } else {
      source = dayNodeId;
      target = targetNodeId;
      sourceHandle = isStem ? "source-top" : "source-bottom";
      targetHandle = isStem ? "target-top" : "target-bottom";
    }

    const edgeClasses = [
      "chamber-edge",
      "chamber-edge--element-flow",
      `chamber-edge--element-flow-${flowInfo.cycleType}`,
      `chamber-edge--element-${targetElementEN}`,
    ].join(" ");

    edges.push({
      id: `element-flow:${badge.id}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      data: {
        layer: "element-flow",
        badge,
        readingOrder: 0,
        schoolCluster: null,
        sourceDetail: "ดิถี",
        targetDetail: formatParticipantForGraph(participant),
        flowCycleType: flowInfo.cycleType,
        flowDirection: flowInfo.direction,
        flowLabel: flowInfo.label,
        flowElement: targetElementEN,
        arrowMode: flowInfo.direction === "none" ? "none" : "forward",
      },
      className: edgeClasses,
    });
  });

  return edges;
}

function buildElementInteractionEdges(badges: BaseChartReactionBadgeValue[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];

  badges.forEach((badge, badgeIndex) => {
    const graphParticipants = badge.participants
      .map((participant) => ({
        participant,
        pillarKey: resolvePillarKeyFromBadgeParticipant(participant),
      }))
      .filter((entry): entry is { participant: BaseChartParticipantValue; pillarKey: SemanticPillarKey } => Boolean(entry.pillarKey));

    if (graphParticipants.length < 2) {
      return;
    }

    const source = graphParticipants[0];
    const target = graphParticipants[1];
    const sourceIsStem = source.participant.type === "stem";
    const targetIsStem = target.participant.type === "stem";
    const sourceNodeId = sourceIsStem ? stemNodeId(source.pillarKey) : branchNodeId(source.pillarKey);
    const targetNodeId = targetIsStem ? stemNodeId(target.pillarKey) : branchNodeId(target.pillarKey);
    const { sourceHandle, targetHandle } = resolveInteractionHandles(
      source.pillarKey,
      target.pillarKey,
      sourceIsStem,
      targetIsStem,
    );
    const flowCycleType = badge.semanticKind === "element-generate"
      ? "generating"
      : badge.semanticKind === "element-control"
        ? "controlling"
        : "neutral";
    const flowElement = badge.modal.details.find((detail) => detail.label === "ธาตุปลายทาง")?.value;

    edges.push({
      id: `element-interaction:${badge.id}`,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle,
      targetHandle,
      data: {
        layer: "element-interaction",
        badge,
        readingOrder: badgeIndex + 1,
        schoolCluster: null,
        sourceDetail: formatParticipantForGraph(source.participant),
        targetDetail: formatParticipantForGraph(target.participant),
        tier: badge.tier,
        schoolLabel: badge.schoolLabel,
        flowCycleType,
        flowDirection: flowCycleType === "generating" ? "both" : "outward",
        flowLabel: badge.schoolLabel ?? badge.shortLabel ?? badge.label,
        flowElement: flowElement ? ELEMENT_TH_TO_EN[flowElement] ?? undefined : undefined,
        arrowMode: flowCycleType === "generating" ? "both" : "forward",
      },
      label: badge.schoolLabel ?? badge.shortLabel ?? badge.label,
      className: [
        "chamber-edge",
        "chamber-edge--element-interaction",
        `chamber-edge--element-flow-${flowCycleType}`,
        badge.status ? `chamber-edge--${badge.status}` : "",
        flowElement ? `chamber-edge--element-${ELEMENT_TH_TO_EN[flowElement] ?? flowElement}` : "",
      ].filter(Boolean).join(" "),
    });
  });

  return edges;
}

function normalizeSchoolToEdgeClass(schoolLabel: string | undefined, badge?: BaseChartReactionBadgeValue): string {
  if (badge?.semanticKind === "stem-combination") return "school-faa-pakhee";
  if (badge?.semanticKind === "stem-clash") return "school-faa-phikat";
  if (badge?.semanticKind === "branch-liu-he") return "school-pakhee";
  if (badge?.semanticKind === "branch-san-he") return "school-pakhee";
  if (badge?.semanticKind === "branch-ban-san-he") return "school-pakhee";
  if (badge?.semanticKind === "branch-combination") return "school-pakhee";
  if (badge?.semanticKind === "branch-clash") return "school-chong";
  if (badge?.semanticKind === "branch-harm") return "school-hai";
  if (badge?.semanticKind === "branch-destruction" || badge?.semanticKind === "intra-pillar-destruction") return "school-pua";
  if (badge?.semanticKind === "branch-punishment-pair" || badge?.semanticKind === "branch-punishment-self") return "school-heng";
  if (badge?.semanticKind === "branch-punishment-trio") return "school-sam-heng";
  if (badge?.semanticKind === "element-generate" || badge?.semanticKind === "element-control") return "";
  if (badge?.semanticKind === "marker-nobleman") return "school-nobleman";
  if (badge?.semanticKind === "marker-wenchang") return "school-wenchang";
  if (!schoolLabel) return "";
  const normalized = schoolLabel.toLowerCase().replace(/[^a-z\u0e00-\u0e7f]/g, "");
  if (normalized.includes("ภาคี") || normalized.includes("ราศีบน")) return "school-pakhee";
  if (normalized === "ชง") return "school-chong";
  if (normalized === "ไห่") return "school-hai";
  if (normalized === "ผั่ว") return "school-pua";
  if (normalized === "เฮ้ง" || normalized === "เฮ้งคู่") return "school-heng";
  if (normalized.includes("ซำเฮ้ง")) return "school-sam-heng";
  if (normalized.includes("ฟ้าภาคี") || normalized.includes("ราศีบน")) return "school-faa-pakhee";
  if (normalized.includes("ฟ้าพิฆาต") || normalized.includes("พิฆาตราศีบน")) return "school-faa-phikat";
  if (normalized.includes("กุ้ยนั้ง") || normalized.includes("อุปถัมภ์")) return "school-nobleman";
  if (normalized.includes("บุ่งเชียง") || normalized.includes("วิชาการ")) return "school-wenchang";
  return "";
}

function resolveInteractionHandles(
  sourcePillarKey: SemanticPillarKey,
  targetPillarKey: SemanticPillarKey,
  sourceIsStem: boolean,
  targetIsStem: boolean,
): { sourceHandle: string; targetHandle: string } {
  // Stem -> Stem: Top -> Top
  if (sourceIsStem && targetIsStem) {
    return { sourceHandle: "source-top", targetHandle: "target-top" };
  }
  // Branch -> Branch: Bottom -> Bottom
  if (!sourceIsStem && !targetIsStem) {
    return { sourceHandle: "source-bottom", targetHandle: "target-bottom" };
  }
  // Stem -> Branch (Heaven to Earth): Bottom -> Top
  if (sourceIsStem && !targetIsStem) {
    return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  }
  // Branch -> Stem (Earth to Heaven): Top -> Bottom
  if (!sourceIsStem && targetIsStem) {
    return { sourceHandle: "source-top", targetHandle: "target-bottom" };
  }

  // Fallback (should not be reached)
  return { sourceHandle: "source-top", targetHandle: "target-top" };
}

function buildInteractionEdges(
  badges: BaseChartReactionBadgeValue[],
  visibleMarkerBadges: BaseChartReactionBadgeValue[],
): SemanticEdge[] {
  const edges: SemanticEdge[] = [];

  badges.forEach((badge, badgeIndex) => {
    const cluster = buildSchoolClusterForBadge(badge, visibleMarkerBadges);
    const graphParticipants = badge.participants
      .map((participant) => ({
        participant,
        pillarKey: resolvePillarKeyFromBadgeParticipant(participant),
      }))
      .filter((entry): entry is { participant: BaseChartParticipantValue; pillarKey: SemanticPillarKey } => Boolean(entry.pillarKey));

    if (graphParticipants.length < 2) {
      return;
    }

    for (let index = 1; index < graphParticipants.length; index += 1) {
      const source = graphParticipants[0];
      const target = graphParticipants[index];
      const sourceIsStem = source.participant.type === "stem";
      const targetIsStem = target.participant.type === "stem";
      const sourceNodeId = sourceIsStem ? stemNodeId(source.pillarKey) : branchNodeId(source.pillarKey);
      const targetNodeId = targetIsStem ? stemNodeId(target.pillarKey) : branchNodeId(target.pillarKey);

      const { sourceHandle, targetHandle } = resolveInteractionHandles(
        source.pillarKey,
        target.pillarKey,
        sourceIsStem,
        targetIsStem,
      );

      const tier = badge.tier;
      const tierClass = tier ? `chamber-edge--tier-${tier}` : "";
      const tierSuffix = tier === "secondary" ? " (รอง)" : tier === "tertiary" ? " (เสริม)" : "";

      edges.push({
        id: `reaction:${badge.id}:${index}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle,
        targetHandle,
        data: {
          layer: "inter-pillar-reaction",
          badge,
          readingOrder: badgeIndex + 1,
          schoolCluster: cluster,
          sourceDetail: formatParticipantForGraph(source.participant),
          targetDetail: formatParticipantForGraph(target.participant),
          tier,
          schoolLabel: cluster.schoolLabel,
          arrowMode: "none",
        },
        label: `${cluster.schoolLabel}${tierSuffix}`,
        className: [
          "chamber-edge",
          "chamber-edge--reaction",
          `chamber-edge--${badge.status}`,
          normalizeSchoolToEdgeClass(cluster.schoolLabel, badge),
          tierClass,
        ].filter(Boolean).join(" "),
      });
    }
  });

  return edges;
}

function buildOverlayEdges(markerBadges: BaseChartReactionBadgeValue[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];

  markerBadges.forEach((badge, index) => {
    if (getOverlayTier(badge) !== "visible") {
      return;
    }

    const attachedPillarKey = badge.participants.length > 0
      ? resolvePillarKeyFromBadgeParticipant(badge.participants[0])
      : null;

    if (!attachedPillarKey) {
      return;
    }

    edges.push({
        id: `overlay:${badge.id}`,
        source: branchNodeId(attachedPillarKey),
        target: markerNodeId(badge),
        sourceHandle: "source-bottom",
        targetHandle: "target-left",
        data: {
          layer: "shen-sha-overlay",
          badge,
          readingOrder: index + 1,
          schoolCluster: buildSchoolClusterForBadge(badge, [badge]),
          sourceDetail: `${PILLAR_LABEL[attachedPillarKey]} · source`,
          targetDetail: getOverlayDisplayLabel(badge),
          arrowMode: "none",
        },
        className: "chamber-edge chamber-edge--overlay chamber-edge--active",
    });
  });

  return edges;
}

function shouldOffsetLayer(layer: SemanticEdge["data"]["layer"]): boolean {
  return layer === "inter-pillar-reaction";
}

function getOffsetGroupKey(edge: SemanticEdge): string {
  return `${edge.source}->${edge.target}`;
}

function getOffsetStride(layer: SemanticEdge["data"]["layer"]): number {
  if (layer === "inter-pillar-reaction") {
    return 18;
  }

  return 0;
}

function assignParallelOffsets(edges: SemanticEdge[]): void {
  const groups = new Map<string, SemanticEdge[]>();

  for (const edge of edges) {
    edge.data.parallelOffset = 0;
    if (!shouldOffsetLayer(edge.data.layer)) continue;

    const key = getOffsetGroupKey(edge);
    const group = groups.get(key);
    if (group) {
      group.push(edge);
    } else {
      groups.set(key, [edge]);
    }
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const stride = getOffsetStride(group[0].data.layer);
    for (let index = 0; index < group.length; index += 1) {
      group[index].data.parallelOffset = index * stride;
    }
  }
}

export function buildSemanticGraphModel(
  calculatedState: CalculatedStateValue,
  config: Partial<SchoolRevealPolicyConfig> = DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
): SemanticChamberGraph | null {
  const reading = calculatedState.baseChartReading;
  const policy = resolveSchoolRevealPolicyConfig(config);

  if (!reading) {
    return null;
  }

  const pillarNodes = buildPillarNodes(calculatedState);
  const visibleMarkerBadges = policy.showOverlay
    ? reading.markerBadges.filter((badge) => getOverlayTier(badge) === "visible")
    : [];
  
  // Apply SchoolRevealPolicy adapter
  const interactionBadges = applySchoolRevealPolicy(
    [...reading.stemInteractionBadges, ...reading.branchInteractionBadges],
    config
  );
  
  const elementalInteractionBadges = interactionBadges.filter(
    (badge) => badge.semanticKind === "element-generate" || badge.semanticKind === "element-control",
  );
  const schoolInteractionBadges = interactionBadges.filter(
    (badge) => badge.semanticKind !== "element-generate" && badge.semanticKind !== "element-control",
  );
  const visibleMarkerNodes = policy.showOverlay ? buildMarkerNodes(reading.markerBadges) : [];
  const hiddenSecondaryOverlays = reading.markerBadges.filter((badge) => getOverlayTier(badge) === "secondary");

  const edges = [
    ...buildDaymasterRelationEdges(reading.roleBadges),
    ...buildElementFlowEdges(reading.roleBadges),
    ...buildInteractionEdges(schoolInteractionBadges, visibleMarkerBadges),
    ...buildElementInteractionEdges(elementalInteractionBadges),
    ...buildOverlayEdges(reading.markerBadges),
  ];

  return {
    nodes: [...pillarNodes, ...visibleMarkerNodes],
    edges: filterEdgesBySchoolRevealPolicy(edges, policy),
    schoolClusters: schoolInteractionBadges.map((badge) => buildSchoolClusterForBadge(badge, visibleMarkerBadges)),
    hiddenSecondaryOverlays,
  };
}

export function buildSemanticChamberGraph(
  calculatedState: CalculatedStateValue,
  config: Partial<SchoolRevealPolicyConfig> = DEFAULT_SCHOOL_REVEAL_POLICY_CONFIG,
): SemanticChamberGraph {
  const graph = buildSemanticGraphModel(calculatedState, config);

  if (!graph) {
    return { nodes: [], edges: [], schoolClusters: [], hiddenSecondaryOverlays: [] };
  }

  const stemPositions = computeStemNodePositions();
  const branchPositions = computeBranchNodePositions();

  for (const node of graph.nodes) {
    if (node.data.kind === "stem-node") {
      node.position = stemPositions[node.data.pillarKey];
    } else if (node.data.kind === "branch-node") {
      node.position = branchPositions[node.data.pillarKey];
    } else if (node.data.kind === "marker" && node.data.attachedPillarKey) {
      node.position = computeMarkerPosition(node.data.attachedPillarKey);
    } else if (node.data.kind === "marker") {
      node.position = { x: 640, y: 620 };
    }
  }

  assignParallelOffsets(graph.edges);

  return graph;
}

export const __testing__ = {
  pillarNodeId,
  markerNodeId,
  resolvePillarKeyFromString,
  getOverlayTier,
  getOverlayDisplayLabel,
  shouldOffsetLayer,
  getOffsetGroupKey,
  getOffsetStride,
};

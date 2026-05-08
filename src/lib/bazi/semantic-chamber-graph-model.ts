import type {
  BaseChartParticipantValue,
  BaseChartReactionBadgeValue,
  CalculatedStateValue,
} from "@/lib/bazi/schema-types";
import { ELEMENT_TH_TO_EN } from "@/lib/bazi/symbolic-engine.constants";

import {
  type SemanticChamberGraph,
  type SemanticEdge,
  type SemanticNode,
  type SemanticPillarKey,
  type SemanticSchoolCluster,
  type SemanticOverlayTier,
  getSemanticDayFocusNodeIds,
  isFocalSemanticNode,
} from "@/lib/bazi/semantic-chamber-graph";

export type {
  SemanticChamberGraph,
  SemanticEdge,
  SemanticNode,
  SemanticPillarKey,
  SemanticSchoolCluster,
  SemanticOverlayTier,
};

export { getSemanticDayFocusNodeIds, isFocalSemanticNode };

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
    const key = resolvePillarKeyFromBadgeParticipant(participant);
    if (key) {
      keys.add(key);
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
      },
      position: { x: 0, y: 0 },
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
      },
      position: { x: 0, y: 0 },
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

      return {
        id: markerNodeId(badge),
        type: "chamberMarker",
        data: {
          kind: "marker",
          layer: "shen-sha-overlay",
          tier: "visible",
          badge,
          displayLabel: getOverlayDisplayLabel(badge),
          attachedPillarKey,
        },
        position: { x: 0, y: 0 },
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
      sourceHandle = "source-top";
      targetHandle = "target-top";
    } else if (flowInfo.direction === "inward") {
      source = targetNodeId;
      target = dayNodeId;
      sourceHandle = "source-top";
      targetHandle = "target-bottom";
    } else {
      source = dayNodeId;
      target = targetNodeId;
      sourceHandle = "source-top";
      targetHandle = "target-top";
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
      },
      className: edgeClasses,
    });
  });

  return edges;
}

function normalizeSchoolToEdgeClass(schoolLabel: string | undefined, badge?: BaseChartReactionBadgeValue): string {
  if (badge?.semanticKind === "stem-combination") return "school-faa-pakhee";
  if (badge?.semanticKind === "stem-clash") return "school-faa-phikat";
  if (badge?.semanticKind === "branch-combination") return "school-pakhee";
  if (badge?.semanticKind === "branch-clash") return "school-chong";
  if (badge?.semanticKind === "branch-harm") return "school-hai";
  if (badge?.semanticKind === "branch-destruction" || badge?.semanticKind === "intra-pillar-destruction") return "school-pua";
  if (badge?.semanticKind === "branch-punishment-pair" || badge?.semanticKind === "branch-punishment-self") return "school-heng";
  if (badge?.semanticKind === "branch-punishment-trio") return "school-sam-heng";
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

function buildInteractionEdges(
  badges: BaseChartReactionBadgeValue[],
  visibleMarkerBadges: BaseChartReactionBadgeValue[],
  resolveHandles: (
    sourcePillarKey: SemanticPillarKey,
    targetPillarKey: SemanticPillarKey,
    sourceIsStem: boolean,
    targetIsStem: boolean,
  ) => { sourceHandle: string; targetHandle: string },
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

      const { sourceHandle, targetHandle } = resolveHandles(
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
        },
        className: "chamber-edge chamber-edge--overlay chamber-edge--active",
    });
  });

  return edges;
}

export function buildChamberSemanticModel(
  calculatedState: CalculatedStateValue,
  resolveHandles: (
    sourcePillarKey: SemanticPillarKey,
    targetPillarKey: SemanticPillarKey,
    sourceIsStem: boolean,
    targetIsStem: boolean,
  ) => { sourceHandle: string; targetHandle: string },
): SemanticChamberGraph | null {
  const reading = calculatedState.baseChartReading;

  if (!reading) {
    return null;
  }

  const pillarNodes = buildPillarNodes(calculatedState);
  const visibleMarkerBadges = reading.markerBadges.filter((badge) => getOverlayTier(badge) === "visible");
  const interactionBadges = [...reading.stemInteractionBadges, ...reading.branchInteractionBadges];
  const visibleMarkerNodes = buildMarkerNodes(reading.markerBadges);
  const hiddenSecondaryOverlays = reading.markerBadges.filter((badge) => getOverlayTier(badge) === "secondary");

  return {
    nodes: [...pillarNodes, ...visibleMarkerNodes],
    edges: [
      ...buildDaymasterRelationEdges(reading.roleBadges),
      ...buildElementFlowEdges(reading.roleBadges),
      ...buildInteractionEdges(interactionBadges, visibleMarkerBadges, resolveHandles),
      ...buildOverlayEdges(reading.markerBadges),
    ],
    schoolClusters: interactionBadges.map((badge) => buildSchoolClusterForBadge(badge, visibleMarkerBadges)),
    hiddenSecondaryOverlays,
  };
}

export const __testing__ = {
  pillarNodeId,
  markerNodeId,
  resolvePillarKeyFromString,
  getOverlayTier,
  getOverlayDisplayLabel,
};

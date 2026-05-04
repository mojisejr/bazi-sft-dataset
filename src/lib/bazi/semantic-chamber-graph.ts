import type {
  BaseChartParticipantValue,
  BaseChartReactionBadgeValue,
  CalculatedStateValue,
} from "@/lib/bazi/schema-types";

export type SemanticPillarKey = "year" | "month" | "day" | "hour";

export type SemanticGraphLayer =
  | "pillar-structure"
  | "daymaster-meaning"
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

export type SemanticChamberGraph = {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  schoolClusters: SemanticSchoolCluster[];
  hiddenSecondaryOverlays: BaseChartReactionBadgeValue[];
};

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

const STEM_NODE_RADIUS = 180;
const BRANCH_NODE_RADIUS = 260;
const MARKER_NODE_RADIUS = 320;

function computeStemNodePositions(): Record<SemanticPillarKey, NodePosition> {
  const angles: Record<SemanticPillarKey, number> = {
    day: 0,
    year: -Math.PI / 2,
    month: Math.PI,
    hour: Math.PI / 2,
  };
  const positions: Partial<Record<SemanticPillarKey, NodePosition>> = {};
  for (const key of PILLAR_KEYS) {
    const angle = angles[key];
    positions[key] = {
      x: 450 + STEM_NODE_RADIUS * Math.cos(angle) - 40,
      y: 350 + STEM_NODE_RADIUS * Math.sin(angle) - 30,
    };
  }
  return positions as Record<SemanticPillarKey, NodePosition>;
}

function computeBranchNodePositions(): Record<SemanticPillarKey, NodePosition> {
  const angles: Record<SemanticPillarKey, number> = {
    day: 0,
    year: -Math.PI / 2,
    month: Math.PI,
    hour: Math.PI / 2,
  };
  const positions: Partial<Record<SemanticPillarKey, NodePosition>> = {};
  for (const key of PILLAR_KEYS) {
    const angle = angles[key] + Math.PI / 8;
    positions[key] = {
      x: 450 + BRANCH_NODE_RADIUS * Math.cos(angle) - 40,
      y: 350 + BRANCH_NODE_RADIUS * Math.sin(angle) - 30,
    };
  }
  return positions as Record<SemanticPillarKey, NodePosition>;
}

function computeMarkerPosition(pillarKey: SemanticPillarKey): NodePosition {
  const angles: Record<SemanticPillarKey, number> = {
    day: Math.PI / 6,
    year: -Math.PI / 3,
    month: Math.PI + Math.PI / 4,
    hour: Math.PI / 2 + Math.PI / 6,
  };
  const angle = angles[pillarKey];
  return {
    x: 450 + MARKER_NODE_RADIUS * Math.cos(angle) - 60,
    y: 350 + MARKER_NODE_RADIUS * Math.sin(angle) - 30,
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
  if (badge.schoolLabel?.includes("เฮ้ง") && badge.participants.length >= 3) {
    return "ซำเฮ้ง";
  }

  return badge.schoolLabel ?? badge.shortLabel ?? badge.label;
}

function getSchoolHumanSummary(label: string): string {
  if (label.includes("ชง")) {
    return "ปะทะ กระแทก ชน ทำให้เกิดการเปลี่ยนแปลง";
  }
  if (label.includes("ไห่")) {
    return "ให้ร้าย กล่าวโทษ กล่าวหา ต่อว่า";
  }
  if (label.includes("เฮ้ง") || label.includes("ซำเฮ้ง")) {
    return label.includes("ซำเฮ้ง")
      ? "โต้เถียง วุ่นวาย ชวนทะเลาะวิวาท"
      : "ทำร้าย เบียดเบียน ให้โทษ";
  }
  if (label.includes("ผั่ว")) {
    return "ทำให้เสียหาย";
  }
  if (label.includes("ภาคี")) {
    return "เกี่ยวข้องกัน ดึงดูดกัน และอาจแปรธาตุ";
  }
  if (label.includes("กุ้ยนั้ง") || label.includes("天乙") || label.includes("ขุนนาง")) {
    return "แรงอุปถัมภ์ ผู้ใหญ่ช่วยเหลือ หรือมีคนค้ำชู";
  }
  if (label.includes("บุ่งเชียง") || label.includes("文昌")) {
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
  const accentMarkerLabels = visibleMarkerBadges
    .filter((marker) => {
      const markerPillarKeys = getParticipantPillarKeys(marker);
      return markerPillarKeys.some((pillarKey) => sourcePillarSet.has(pillarKey));
    })
    .map(getOverlayDisplayLabel);
  const branchParticipantLabels = badge.participants
    .filter((participant) => participant.type === "branch")
    .map(formatParticipantForGraph);
  const humanSummary = getSchoolHumanSummary(schoolLabel);

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
      },
      position: branchPositions[pillarKey],
      width: 80,
      height: 80,
    } satisfies SemanticNode);
  }

  return nodes;
}

function getOverlayTier(badge: BaseChartReactionBadgeValue): SemanticOverlayTier {
  const text = `${badge.label} ${badge.shortLabel ?? ""} ${badge.schoolLabel ?? ""}`;
  if (text.includes("天乙") || text.includes("ขุนนาง") || text.includes("กุ้ยนั้ง")) {
    return "visible";
  }

  if (text.includes("文昌") || text.includes("บุ่งเชียง") || text.includes("วิชาการ")) {
    return "visible";
  }

  return "secondary";
}

function getOverlayDisplayLabel(badge: BaseChartReactionBadgeValue): string {
  const text = `${badge.label} ${badge.shortLabel ?? ""} ${badge.schoolLabel ?? ""}`;
  if (text.includes("天乙") || text.includes("ขุนนาง") || text.includes("กุ้ยนั้ง")) {
    return "กุ้ยนั้ง/อุปถัมภ์ (天乙贵人)";
  }

  if (text.includes("文昌") || text.includes("บุ่งเชียง") || text.includes("วิชาการ")) {
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
        width: 240,
        height: 130,
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

    edges.push({
        id: `daymaster:${badge.id}`,
        source: sourceNodeId,
        target: targetNodeId,
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

function normalizeSchoolToEdgeClass(schoolLabel: string | undefined): string {
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
      const isStem = source.participant.type === "stem";
      const sourceNodeId = isStem ? stemNodeId(source.pillarKey) : branchNodeId(source.pillarKey);
      const targetNodeId = isStem ? stemNodeId(target.pillarKey) : branchNodeId(target.pillarKey);

      edges.push({
        id: `reaction:${badge.id}:${index}`,
        source: sourceNodeId,
        target: targetNodeId,
        data: {
          layer: "inter-pillar-reaction",
          badge,
          readingOrder: badgeIndex + 1,
          schoolCluster: cluster,
          sourceDetail: formatParticipantForGraph(source.participant),
          targetDetail: formatParticipantForGraph(target.participant),
        },
        label: cluster.schoolLabel,
        className: [
          "chamber-edge",
          "chamber-edge--reaction",
          `chamber-edge--${badge.status}`,
          normalizeSchoolToEdgeClass(cluster.schoolLabel),
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

export function buildSemanticChamberGraph(calculatedState: CalculatedStateValue): SemanticChamberGraph {
  const reading = calculatedState.baseChartReading;

  if (!reading) {
    return { nodes: [], edges: [], schoolClusters: [], hiddenSecondaryOverlays: [] };
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
      ...buildInteractionEdges(interactionBadges, visibleMarkerBadges),
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
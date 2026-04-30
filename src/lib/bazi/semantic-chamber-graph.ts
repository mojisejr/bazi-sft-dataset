import type {
  BaseChartParticipantValue,
  BaseChartReactionBadgeValue,
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

export type SemanticPillarKey = "year" | "month" | "day" | "hour";

export type SemanticGraphLayer =
  | "pillar-structure"
  | "daymaster-meaning"
  | "inter-pillar-reaction"
  | "shen-sha-overlay";

export type SemanticOverlayTier = "visible" | "secondary";

export type SemanticNodeKind = "pillar" | "marker";

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

export type SemanticNodeData = SemanticPillarNodeData | SemanticMarkerNodeData;

export type SemanticNode = {
  id: string;
  type: "chamberPillar" | "chamberMarker";
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

const RADIAL_POSITIONS: Record<SemanticPillarKey, { x: number; y: number }> = {
  year: { x: 417, y: -21 },
  month: { x: 43, y: 320 },
  day: { x: 450, y: 430 },
  hour: { x: 857, y: 320 },
};

const MARKER_OFFSETS: Partial<Record<SemanticPillarKey, { x: number; y: number }>> = {
  year: { x: 736, y: 34 },
  month: { x: 43, y: 672 },
  day: { x: 714, y: 661 },
  hour: { x: 1121, y: 441 },
};

const PILLAR_HANDLE_BY_TARGET: Record<SemanticPillarKey, Partial<Record<SemanticPillarKey, string>>> = {
  year: { month: "left", day: "bottom", hour: "right" },
  month: { year: "top", day: "right", hour: "bottom" },
  day: { year: "top", month: "left", hour: "right" },
  hour: { year: "top", month: "bottom", day: "left" },
};

function pillarNodeId(pillarKey: SemanticPillarKey): string {
  return `pillar:${pillarKey}`;
}

function markerNodeId(badge: BaseChartReactionBadgeValue): string {
  return `marker:${badge.id}`;
}

function resolveEdgeHandle(from: SemanticPillarKey, to: SemanticPillarKey): string {
  return PILLAR_HANDLE_BY_TARGET[from][to] ?? "right";
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

function getStageSlots(pillar: PillarValue, pillarKey: SemanticPillarKey): PillarStageSlot[] {
  if (pillarKey === "day") {
    const daySlots: PillarStageSlot[] = [];
    if (pillar.lowerStageDisplay) {
      daySlots.push({ label: "ล่าง", value: pillar.lowerStageDisplay, source: "lower" });
    }
    return daySlots;
  }

  return [
    pillar.upperStageDisplay
      ? { label: "บน", value: pillar.upperStageDisplay, source: "upper" as const }
      : null,
    pillar.sittingStage
      ? { label: "นั่ง", value: pillar.sittingStage, source: "sitting" as const }
      : null,
    pillar.lowerStageDisplay
      ? { label: "ล่าง", value: pillar.lowerStageDisplay, source: "lower" as const }
      : null,
  ].filter((slot): slot is PillarStageSlot => Boolean(slot));
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

function getMeaningSlotFromBadge(badge: BaseChartReactionBadgeValue): PillarMeaningSlot | null {
  const participant = badge.participants.find((entry) => entry.type === "stem" || entry.type === "branch");

  if (!participant || (participant.type !== "stem" && participant.type !== "branch")) {
    return null;
  }

  return {
    source: participant.type,
    symbol: participant.symbol,
    translation: participant.translation,
    relationLabel: badge.shortLabel ?? badge.schoolLabel ?? badge.label,
    meaningShort: badge.meaningShort,
    badge,
  };
}

function getRoleBadgesForPillar(
  badges: BaseChartReactionBadgeValue[],
  pillarKey: SemanticPillarKey,
): BaseChartReactionBadgeValue[] {
  return badges.filter((badge) =>
    badge.participants.some((participant) =>
      resolvePillarKeyFromBadgeParticipant(participant) === pillarKey,
    ),
  );
}

function buildPillarNodes(calculatedState: CalculatedStateValue): SemanticNode[] {
  const reading = calculatedState.baseChartReading;
  if (!reading) {
    return [];
  }

  return PILLAR_KEYS.map((pillarKey) => {
    const pillar = calculatedState.fourPillars[pillarKey];
    const meaningSlots = getRoleBadgesForPillar(reading.roleBadges, pillarKey)
      .map(getMeaningSlotFromBadge)
      .filter((slot): slot is PillarMeaningSlot => Boolean(slot));

    const data: SemanticPillarNodeData = {
      kind: "pillar",
      layer: "pillar-structure",
      pillarKey,
      pillarLabel: PILLAR_LABEL[pillarKey],
      displayMode: pillarKey === "day" ? "day-anchor" : "outer-full",
      stem: pillar.stem,
      branch: pillar.branch,
      stemTranslation: pillar.stemTranslation,
      branchTranslation: pillar.branchTranslation,
      isFocal: pillarKey === "day",
      stageSlots: getStageSlots(pillar, pillarKey),
      meaningSlots,
    };

    return {
      id: pillarNodeId(pillarKey),
      type: "chamberPillar",
      data,
      position: RADIAL_POSITIONS[pillarKey],
      width: pillarKey === "day" ? 220 : 270,
      height: pillarKey === "day" ? 220 : 360,
    } satisfies SemanticNode;
  });
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
        ? MARKER_OFFSETS[attachedPillarKey] ?? { x: 640, y: 620 }
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

    edges.push({
        id: `daymaster:${badge.id}`,
        source: pillarNodeId("day"),
        target: pillarNodeId(targetPillarKey),
        sourceHandle: resolveEdgeHandle("day", targetPillarKey),
        targetHandle: resolveEdgeHandle(targetPillarKey, "day"),
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
      edges.push({
        id: `reaction:${badge.id}:${index}`,
        source: pillarNodeId(source.pillarKey),
        target: pillarNodeId(target.pillarKey),
        sourceHandle: resolveEdgeHandle(source.pillarKey, target.pillarKey),
        targetHandle: resolveEdgeHandle(target.pillarKey, source.pillarKey),
        data: {
          layer: "inter-pillar-reaction",
          badge,
          readingOrder: badgeIndex + 1,
          schoolCluster: cluster,
          sourceDetail: formatParticipantForGraph(source.participant),
          targetDetail: formatParticipantForGraph(target.participant),
        },
        label: cluster.schoolLabel,
        className: `chamber-edge chamber-edge--reaction chamber-edge--${badge.status}`,
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
        source: pillarNodeId(attachedPillarKey),
        target: markerNodeId(badge),
        sourceHandle: attachedPillarKey === "hour" ? "right" : "bottom",
        targetHandle: "left",
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
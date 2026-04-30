import type {
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

export type PillarStageSlot = {
  label: string;
  value: string;
  source: "upper" | "sitting" | "looking" | "lower";
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
};

export type SemanticEdge = {
  id: string;
  source: string;
  target: string;
  data: SemanticEdgeData;
  label?: string;
  className?: string;
};

export type SemanticChamberGraph = {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  hiddenSecondaryOverlays: BaseChartReactionBadgeValue[];
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

function pillarNodeId(pillarKey: SemanticPillarKey): string {
  return `pillar:${pillarKey}`;
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

function getStageSlots(pillar: PillarValue): PillarStageSlot[] {
  return [
    pillar.upperStageDisplay
      ? { label: "ชั้นบน", value: pillar.upperStageDisplay, source: "upper" as const }
      : null,
    pillar.sittingStage
      ? { label: "ชั้นกลาง", value: pillar.sittingStage, source: "sitting" as const }
      : null,
    pillar.lookingStage
      ? { label: "ชั้นมอง", value: pillar.lookingStage, source: "looking" as const }
      : null,
    pillar.lowerStageDisplay
      ? { label: "ชั้นล่าง", value: pillar.lowerStageDisplay, source: "lower" as const }
      : null,
  ].filter((slot): slot is PillarStageSlot => Boolean(slot));
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
      stem: pillar.stem,
      branch: pillar.branch,
      stemTranslation: pillar.stemTranslation,
      branchTranslation: pillar.branchTranslation,
      isFocal: pillarKey === "day",
      stageSlots: getStageSlots(pillar),
      meaningSlots,
    };

    return {
      id: pillarNodeId(pillarKey),
      type: "chamberPillar",
      data,
      position: { x: 0, y: 0 },
      width: 260,
      height: pillarKey === "day" ? 280 : 250,
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
        position: { x: 0, y: 0 },
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
        data: { layer: "daymaster-meaning", badge, readingOrder: index + 1 },
        label: badge.shortLabel ?? badge.schoolLabel ?? badge.label,
        className: `chamber-edge chamber-edge--daymaster chamber-edge--${badge.status}`,
    });
  });

  return edges;
}

function buildInteractionEdges(badges: BaseChartReactionBadgeValue[]): SemanticEdge[] {
  const edges: SemanticEdge[] = [];

  badges.forEach((badge, badgeIndex) => {
    const participantPillarKeys = new Set<SemanticPillarKey>();

    badge.participants.forEach((participant) => {
      const pillarKey = resolvePillarKeyFromBadgeParticipant(participant);
      if (pillarKey) {
        participantPillarKeys.add(pillarKey);
      }
    });

    const pillarKeys = Array.from(participantPillarKeys);

    if (pillarKeys.length < 2) {
      return;
    }

    for (let index = 1; index < pillarKeys.length; index += 1) {
      edges.push({
        id: `reaction:${badge.id}:${index}`,
        source: pillarNodeId(pillarKeys[0]),
        target: pillarNodeId(pillarKeys[index]),
        data: { layer: "inter-pillar-reaction", badge, readingOrder: badgeIndex + 1 },
        label: badge.shortLabel ?? badge.label,
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
        data: { layer: "shen-sha-overlay", badge, readingOrder: index + 1 },
        className: "chamber-edge chamber-edge--overlay chamber-edge--active",
    });
  });

  return edges;
}

export function buildSemanticChamberGraph(calculatedState: CalculatedStateValue): SemanticChamberGraph {
  const reading = calculatedState.baseChartReading;

  if (!reading) {
    return { nodes: [], edges: [], hiddenSecondaryOverlays: [] };
  }

  const pillarNodes = buildPillarNodes(calculatedState);
  const visibleMarkerNodes = buildMarkerNodes(reading.markerBadges);
  const hiddenSecondaryOverlays = reading.markerBadges.filter((badge) => getOverlayTier(badge) === "secondary");

  return {
    nodes: [...pillarNodes, ...visibleMarkerNodes],
    edges: [
      ...buildDaymasterRelationEdges(reading.roleBadges),
      ...buildInteractionEdges([...reading.stemInteractionBadges, ...reading.branchInteractionBadges]),
      ...buildOverlayEdges(reading.markerBadges),
    ],
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
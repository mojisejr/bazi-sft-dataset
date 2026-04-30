import type {
  BaseChartReactionBadgeValue,
  BaseChartReadingValue,
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

export type ChamberPillarKey = "year" | "month" | "day" | "hour";

export type ChamberNodeKind = "pillar" | "marker";

export type ChamberPillarNodeData = {
  kind: "pillar";
  pillarKey: ChamberPillarKey;
  pillarLabel: string;
  stem: string;
  branch: string;
  stemTranslation?: string;
  branchTranslation?: string;
  isFocal: boolean;
  roleBadges: BaseChartReactionBadgeValue[];
};

export type ChamberMarkerNodeData = {
  kind: "marker";
  badge: BaseChartReactionBadgeValue;
  attachedPillarKey: ChamberPillarKey | null;
};

export type ChamberNodeData = ChamberPillarNodeData | ChamberMarkerNodeData;

export type ChamberNode = {
  id: string;
  type: "chamberPillar" | "chamberMarker";
  data: ChamberNodeData;
  position: { x: number; y: number };
  width?: number;
  height?: number;
};

export type ChamberEdgeData = {
  badge: BaseChartReactionBadgeValue;
};

export type ChamberEdge = {
  id: string;
  source: string;
  target: string;
  data: ChamberEdgeData;
  label?: string;
  className?: string;
};

export type ChamberGraph = {
  nodes: ChamberNode[];
  edges: ChamberEdge[];
};

const PILLAR_KEYS: ChamberPillarKey[] = ["year", "month", "day", "hour"];

const PILLAR_LABEL: Record<ChamberPillarKey, string> = {
  year: "ปี",
  month: "เดือน",
  day: "ดิถี",
  hour: "ยาม",
};

const PILLAR_LABEL_REVERSE: Record<string, ChamberPillarKey> = {
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

function pillarNodeId(pillarKey: ChamberPillarKey): string {
  return `pillar:${pillarKey}`;
}

function markerNodeId(badge: BaseChartReactionBadgeValue): string {
  return `marker:${badge.id}`;
}

function resolvePillarKeyFromString(candidate: string | undefined): ChamberPillarKey | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  return PILLAR_LABEL_REVERSE[trimmed] ?? null;
}

function resolvePillarKeyFromBadgeParticipant(
  participant: BaseChartReactionBadgeValue["participants"][number],
): ChamberPillarKey | null {
  return (
    resolvePillarKeyFromString(participant.pillarKey) ??
    resolvePillarKeyFromString(participant.pillarLabel)
  );
}

function buildPillarNodes(
  fourPillars: CalculatedStateValue["fourPillars"],
  reading: BaseChartReadingValue,
): ChamberNode[] {
  return PILLAR_KEYS.map((pillarKey) => {
    const pillar: PillarValue = fourPillars[pillarKey];
    const roleBadges = reading.roleBadges.filter((badge) =>
      badge.participants.some((participant) =>
        resolvePillarKeyFromBadgeParticipant(participant) === pillarKey,
      ),
    );

    const data: ChamberPillarNodeData = {
      kind: "pillar",
      pillarKey,
      pillarLabel: PILLAR_LABEL[pillarKey],
      stem: pillar.stem,
      branch: pillar.branch,
      stemTranslation: pillar.stemTranslation,
      branchTranslation: pillar.branchTranslation,
      isFocal: pillarKey === "day",
      roleBadges,
    };

    return {
      id: pillarNodeId(pillarKey),
      type: "chamberPillar",
      data,
      position: { x: 0, y: 0 },
      width: 220,
      height: pillarKey === "day" ? 220 : 180,
    } satisfies ChamberNode;
  });
}

function buildMarkerNodes(reading: BaseChartReadingValue): ChamberNode[] {
  return reading.markerBadges.map((badge) => {
    const attachedPillarKey =
      badge.participants.length > 0
        ? resolvePillarKeyFromBadgeParticipant(badge.participants[0])
        : null;

    const data: ChamberMarkerNodeData = {
      kind: "marker",
      badge,
      attachedPillarKey,
    };

    return {
      id: markerNodeId(badge),
      type: "chamberMarker",
      data,
      position: { x: 0, y: 0 },
      width: 200,
      height: 110,
    } satisfies ChamberNode;
  });
}

function buildInteractionEdges(
  badges: BaseChartReactionBadgeValue[],
): ChamberEdge[] {
  const edges: ChamberEdge[] = [];

  badges.forEach((badge) => {
    const participantPillarKeys = new Set<ChamberPillarKey>();

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
      const source = pillarNodeId(pillarKeys[0]);
      const target = pillarNodeId(pillarKeys[index]);

      edges.push({
        id: `edge:${badge.id}:${index}`,
        source,
        target,
        data: { badge },
        label: badge.shortLabel ?? badge.label,
        className: `chamber-edge chamber-edge--${badge.family} chamber-edge--${badge.status}`,
      });
    }
  });

  return edges;
}

function buildMarkerEdges(reading: BaseChartReadingValue): ChamberEdge[] {
  const edges: ChamberEdge[] = [];

  reading.markerBadges.forEach((badge) => {
    const attachedPillarKey =
      badge.participants.length > 0
        ? resolvePillarKeyFromBadgeParticipant(badge.participants[0])
        : null;

    if (!attachedPillarKey) {
      return;
    }

    edges.push({
      id: `edge:${badge.id}`,
      source: pillarNodeId(attachedPillarKey),
      target: markerNodeId(badge),
      data: { badge },
      className: "chamber-edge chamber-edge--marker chamber-edge--supplementary",
    });
  });

  return edges;
}

export function buildChamberGraphFromCalculatedState(
  calculatedState: CalculatedStateValue,
): ChamberGraph {
  const reading = calculatedState.baseChartReading;

  if (!reading) {
    return { nodes: [], edges: [] };
  }

  const pillarNodes = buildPillarNodes(calculatedState.fourPillars, reading);
  const markerNodes = buildMarkerNodes(reading);

  const stemEdges = buildInteractionEdges(reading.stemInteractionBadges);
  const branchEdges = buildInteractionEdges(reading.branchInteractionBadges);
  const markerEdges = buildMarkerEdges(reading);

  return {
    nodes: [...pillarNodes, ...markerNodes],
    edges: [...stemEdges, ...branchEdges, ...markerEdges],
  };
}

export const __testing__ = {
  resolvePillarKeyFromString,
  pillarNodeId,
  markerNodeId,
};

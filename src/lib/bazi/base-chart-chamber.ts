import type {
  BaseChartDetailItemValue,
  BaseChartReactionBadgeValue,
  CalculatedStateValue,
  PillarValue,
} from "@/lib/bazi/schema-types";

export type BaseChartChamberAnchorKey = "ming-gong" | "hour" | "day" | "month" | "year";

export type BaseChartRouteDetail = {
  kicker: string;
  title: string;
  summary: string;
  explanation: string;
  details: BaseChartDetailItemValue[];
};

export type BaseChartChamberRouteSlot = {
  id: string;
  label: string;
  value: string;
  detail: BaseChartRouteDetail;
};

export type BaseChartChamberAnchor = {
  id: BaseChartChamberAnchorKey;
  label: string;
  pillarCode: string;
  stem: string;
  stemTranslation?: string;
  branch: string;
  branchTranslation?: string;
  isDayMaster: boolean;
  roleBadges: BaseChartReactionBadgeValue[];
  markerBadges: BaseChartReactionBadgeValue[];
  routeSlots: BaseChartChamberRouteSlot[];
};

export type BaseChartChamberEdge = {
  id: string;
  badge: BaseChartReactionBadgeValue;
  anchorKeys: BaseChartChamberAnchorKey[];
  tone: "support" | "pressure" | "harm" | "fracture" | "tension" | "neutral";
};

export type BaseChartChamberCore = {
  id: "core";
  title: string;
  symbol: string;
  summary: string;
  routeSummary: string;
  details: BaseChartDetailItemValue[];
};

export type BaseChartChamberSelection =
  | { kind: "core" }
  | { kind: "anchor"; anchorId: BaseChartChamberAnchorKey }
  | { kind: "edge"; edgeId: string }
  | { kind: "marker"; markerId: string }
  | { kind: "route"; anchorId: BaseChartChamberAnchorKey; routeId: string };

export type BaseChartChamberDetailAction =
  | { kind: "reaction"; badge: BaseChartReactionBadgeValue }
  | { kind: "route"; detail: BaseChartRouteDetail }
  | null;

export type BaseChartChamberResolvedSelection = {
  key: string;
  kicker: string;
  title: string;
  summary: string;
  meaning: string;
  details: BaseChartDetailItemValue[];
  detailAction: BaseChartChamberDetailAction;
};

export type BaseChartChamberModel = {
  core: BaseChartChamberCore;
  anchors: BaseChartChamberAnchor[];
  edges: BaseChartChamberEdge[];
  markers: BaseChartReactionBadgeValue[];
  defaultSelection: BaseChartChamberSelection;
};

const ANCHOR_META: Array<{ key: BaseChartChamberAnchorKey; label: string }> = [
  { key: "ming-gong", label: "ลัคนา" },
  { key: "hour", label: "ยาม" },
  { key: "day", label: "วัน" },
  { key: "month", label: "เดือน" },
  { key: "year", label: "ปี" },
];

const PILLAR_KEY_MAP: Record<string, BaseChartChamberAnchorKey> = {
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
};

const PILLAR_LABEL_MAP: Record<string, BaseChartChamberAnchorKey> = {
  ปี: "year",
  เดือน: "month",
  วัน: "day",
  ยาม: "hour",
  ลัคนา: "ming-gong",
};

function formatPillarCode(pillar: PillarValue | undefined) {
  if (!pillar) {
    return "-";
  }

  return `${pillar.stem}${pillar.branch}`;
}

function makeDetail(label: string, value: string): BaseChartDetailItemValue {
  return { label, value };
}

export function buildBaseChartRouteDetail(
  columnLabel: string,
  stageLabel: string,
  value: string,
  pillar: PillarValue | undefined,
): BaseChartRouteDetail {
  return {
    kicker: "route",
    title: `${columnLabel} · ${stageLabel}`,
    summary: `${stageLabel}ของ${columnLabel}แสดงค่า ${value}`,
    explanation: "ชั้น route ใช้บอกคุณภาพของเส้นทางในพื้นดวงก่อนอ่านบทบาทต่อดิถีและปฏิกิริยาระหว่างตัวในดวง",
    details: [
      makeDetail("ฐาน", columnLabel),
      makeDetail("ชั้น", stageLabel),
      makeDetail("ค่า", value),
      makeDetail("เสา", pillar ? `${pillar.stem}${pillar.branch}` : "-"),
    ],
  };
}

function buildRouteSlots(anchorId: BaseChartChamberAnchorKey, label: string, pillar: PillarValue | undefined) {
  if (!pillar) {
    return [];
  }

  const slots: BaseChartChamberRouteSlot[] = [];

  if (pillar.upperStageDisplay && anchorId !== "day") {
    slots.push({
      id: `${anchorId}-route-upper`,
      label: "บน",
      value: pillar.upperStageDisplay,
      detail: buildBaseChartRouteDetail(label, "ชั้นบน", pillar.upperStageDisplay, pillar),
    });
  }

  if (pillar.sittingStage) {
    slots.push({
      id: `${anchorId}-route-middle`,
      label: "กลาง",
      value: pillar.sittingStage,
      detail: buildBaseChartRouteDetail(label, "ชั้นกลาง", pillar.sittingStage, pillar),
    });
  }

  if (pillar.lowerStageDisplay) {
    slots.push({
      id: `${anchorId}-route-lower`,
      label: "ล่าง",
      value: pillar.lowerStageDisplay,
      detail: buildBaseChartRouteDetail(label, "ชั้นล่าง", pillar.lowerStageDisplay, pillar),
    });
  }

  return slots;
}

function mapBadgeToAnchorKey(badge: BaseChartReactionBadgeValue): BaseChartChamberAnchorKey | null {
  const participant = badge.participants.find((entry) => entry.pillarKey || entry.pillarLabel);

  if (participant?.pillarKey && PILLAR_KEY_MAP[participant.pillarKey]) {
    return PILLAR_KEY_MAP[participant.pillarKey];
  }

  if (participant?.pillarLabel && PILLAR_LABEL_MAP[participant.pillarLabel]) {
    return PILLAR_LABEL_MAP[participant.pillarLabel];
  }

  return null;
}

function resolveEdgeTone(badge: BaseChartReactionBadgeValue): BaseChartChamberEdge["tone"] {
  const schoolLabel = badge.schoolLabel ?? badge.label;

  if (schoolLabel.includes("ภาคี")) {
    return "support";
  }

  if (schoolLabel.includes("ชง") || schoolLabel.includes("พิฆาต")) {
    return "pressure";
  }

  if (schoolLabel.includes("ไห่")) {
    return "harm";
  }

  if (schoolLabel.includes("ผั่ว")) {
    return "fracture";
  }

  if (schoolLabel.includes("เฮ้ง")) {
    return "tension";
  }

  return "neutral";
}

function buildCore(calculatedState: CalculatedStateValue): BaseChartChamberCore {
  const routeSummary = calculatedState.fourPillars.day.lowerStageDisplay
    ?? calculatedState.fourPillars.day.sittingStage
    ?? calculatedState.twelveQi.dayBranch
    ?? "-";
  const strengthLabel = calculatedState.dayMasterStrengthProfile?.displayLabel
    ?? calculatedState.dayMasterStrengthProfile?.displayBand
    ?? calculatedState.dayMasterStrengthProfile?.strengthState
    ?? `คะแนน ${calculatedState.strengthScore.toFixed(2)}`;

  return {
    id: "core",
    title: "ดิถี",
    symbol: calculatedState.dayMaster,
    summary: strengthLabel,
    routeSummary,
    details: [
      makeDetail("ดิถี", calculatedState.dayMaster),
      makeDetail("ภาวะ", strengthLabel),
      makeDetail("route", routeSummary),
      makeDetail("คะแนน", calculatedState.strengthScore.toFixed(2)),
    ],
  };
}

export function buildBaseChartChamberModel(calculatedState: CalculatedStateValue): BaseChartChamberModel | null {
  const reading = calculatedState.baseChartReading;

  if (!reading) {
    return null;
  }

  const roleMap = new Map<BaseChartChamberAnchorKey, BaseChartReactionBadgeValue[]>();
  const markerMap = new Map<BaseChartChamberAnchorKey, BaseChartReactionBadgeValue[]>();

  for (const badge of reading.roleBadges) {
    const anchorKey = mapBadgeToAnchorKey(badge);

    if (!anchorKey) {
      continue;
    }

    roleMap.set(anchorKey, [...(roleMap.get(anchorKey) ?? []), badge]);
  }

  for (const badge of reading.markerBadges) {
    const anchorKey = mapBadgeToAnchorKey(badge);

    if (!anchorKey) {
      continue;
    }

    markerMap.set(anchorKey, [...(markerMap.get(anchorKey) ?? []), badge]);
  }

  const anchors = ANCHOR_META.map(({ key, label }) => {
    const pillar = key === "ming-gong"
      ? calculatedState.mingGong
      : calculatedState.fourPillars[key];

    return {
      id: key,
      label,
      pillarCode: formatPillarCode(pillar),
      stem: pillar?.stem ?? "-",
      stemTranslation: pillar?.stemTranslation,
      branch: pillar?.branch ?? "-",
      branchTranslation: pillar?.branchTranslation,
      isDayMaster: key === "day",
      roleBadges: roleMap.get(key) ?? [],
      markerBadges: markerMap.get(key) ?? [],
      routeSlots: buildRouteSlots(key, label, pillar),
    } satisfies BaseChartChamberAnchor;
  });

  const edges = [...reading.stemInteractionBadges, ...reading.branchInteractionBadges]
    .map((badge) => {
      const anchorKeys = Array.from(new Set(
        badge.participants
          .map((participant) => {
            if (participant.pillarKey && PILLAR_KEY_MAP[participant.pillarKey]) {
              return PILLAR_KEY_MAP[participant.pillarKey];
            }

            if (participant.pillarLabel && PILLAR_LABEL_MAP[participant.pillarLabel]) {
              return PILLAR_LABEL_MAP[participant.pillarLabel];
            }

            return null;
          })
          .filter((anchorKey): anchorKey is BaseChartChamberAnchorKey => Boolean(anchorKey)),
      ));

      return {
        id: badge.id,
        badge,
        anchorKeys,
        tone: resolveEdgeTone(badge),
      } satisfies BaseChartChamberEdge;
    })
    .filter((edge) => edge.anchorKeys.length >= 2);

  const primaryEdge = edges.find(
    (edge) => edge.badge.priority === "primary" && edge.badge.status === "active",
  );

  return {
    core: buildCore(calculatedState),
    anchors,
    edges,
    markers: reading.markerBadges,
    defaultSelection: primaryEdge ? { kind: "edge", edgeId: primaryEdge.id } : { kind: "anchor", anchorId: "day" },
  };
}

function joinValues(values: string[]) {
  return values.length > 0 ? values.join(" • ") : "-";
}

export function resolveBaseChartChamberSelection(
  model: BaseChartChamberModel,
  selection: BaseChartChamberSelection,
): BaseChartChamberResolvedSelection {
  if (selection.kind === "core") {
    return {
      key: selection.kind,
      kicker: "core",
      title: `${model.core.title} ${model.core.symbol}`,
      summary: model.core.summary,
      meaning: model.core.routeSummary,
      details: model.core.details,
      detailAction: null,
    };
  }

  if (selection.kind === "anchor") {
    const anchor = model.anchors.find((entry) => entry.id === selection.anchorId) ?? model.anchors[0];
    const roleSummary = joinValues(anchor.roleBadges.map((badge) => badge.shortLabel ?? badge.label));
    const markerSummary = joinValues(anchor.markerBadges.map((badge) => badge.shortLabel ?? badge.label));
    const routeSummary = joinValues(anchor.routeSlots.map((slot) => `${slot.label}:${slot.value}`));

    return {
      key: `${selection.kind}-${anchor.id}`,
      kicker: "anchor",
      title: `${anchor.label} · ${anchor.pillarCode}`,
      summary: anchor.isDayMaster ? "ฐานดิถีใน reaction chamber" : "anchor ของพื้นดวง",
      meaning: anchor.roleBadges[0]?.meaningShort ?? routeSummary,
      details: [
        makeDetail("ราศีบน", anchor.stemTranslation ? `${anchor.stem} (${anchor.stemTranslation})` : anchor.stem),
        makeDetail("ราศีล่าง", anchor.branchTranslation ? `${anchor.branch} (${anchor.branchTranslation})` : anchor.branch),
        makeDetail("role", roleSummary),
        makeDetail("route", routeSummary),
        makeDetail("marker", markerSummary),
      ],
      detailAction: anchor.roleBadges[0] ? { kind: "reaction", badge: anchor.roleBadges[0] } : null,
    };
  }

  if (selection.kind === "edge") {
    const edge = model.edges.find((entry) => entry.id === selection.edgeId) ?? model.edges[0];

    return {
      key: `${selection.kind}-${edge.id}`,
      kicker: edge.badge.modal.family,
      title: edge.badge.modal.title,
      summary: edge.badge.modal.summary,
      meaning: edge.badge.modal.explanation,
      details: edge.badge.modal.details,
      detailAction: { kind: "reaction", badge: edge.badge },
    };
  }

  if (selection.kind === "marker") {
    const marker = model.markers.find((entry) => entry.id === selection.markerId) ?? model.markers[0];

    return {
      key: `${selection.kind}-${marker.id}`,
      kicker: marker.modal.family,
      title: marker.modal.title,
      summary: marker.modal.summary,
      meaning: marker.modal.explanation,
      details: marker.modal.details,
      detailAction: { kind: "reaction", badge: marker },
    };
  }

  const anchor = model.anchors.find((entry) => entry.id === selection.anchorId) ?? model.anchors[0];
  const route = anchor.routeSlots.find((entry) => entry.id === selection.routeId) ?? anchor.routeSlots[0];

  return {
    key: `${selection.kind}-${route.id}`,
    kicker: route.detail.kicker,
    title: route.detail.title,
    summary: route.detail.summary,
    meaning: route.detail.explanation,
    details: route.detail.details,
    detailAction: { kind: "route", detail: route.detail },
  };
}
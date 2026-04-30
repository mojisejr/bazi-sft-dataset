import { useState } from "react";

import type {
  BaseChartChamberAnchor,
  BaseChartChamberSelection,
  BaseChartRouteDetail,
} from "@/lib/bazi/base-chart-chamber";
import type {
  BaseChartReactionBadgeValue,
  CalculatedStateValue,
} from "@/lib/bazi/schema-types";
import {
  buildBaseChartChamberModel,
  resolveBaseChartChamberSelection,
} from "@/lib/bazi/base-chart-chamber";
import { BaseChartEdgeLayer } from "@/components/bazi/BaseChartEdgeLayer";
import { BaseChartInspector } from "@/components/bazi/BaseChartInspector";

type BaseChartReactionChamberProps = {
  calculatedState: CalculatedStateValue;
  onOpenReactionBadge: (badge: BaseChartReactionBadgeValue) => void;
  onOpenRouteDetail: (detail: BaseChartRouteDetail) => void;
};

type Position = { top: string; left: string };

const ANCHOR_POSITIONS: Record<BaseChartChamberAnchor["id"], Position> = {
  "ming-gong": { top: "8%", left: "50%" },
  hour: { top: "31%", left: "18%" },
  day: { top: "74%", left: "50%" },
  month: { top: "31%", left: "82%" },
  year: { top: "69%", left: "27%" },
};

function formatGlyphWithTranslation(symbol: string, translation?: string) {
  return translation ? `${symbol} (${translation})` : symbol;
}

function isSelectionAvailable(model: NonNullable<ReturnType<typeof buildBaseChartChamberModel>>, selection: BaseChartChamberSelection) {
  if (selection.kind === "core") {
    return true;
  }

  if (selection.kind === "anchor") {
    return model.anchors.some((anchor) => anchor.id === selection.anchorId);
  }

  if (selection.kind === "edge") {
    return model.edges.some((edge) => edge.id === selection.edgeId);
  }

  if (selection.kind === "marker") {
    return model.markers.some((marker) => marker.id === selection.markerId);
  }

  return model.anchors.some(
    (anchor) => anchor.id === selection.anchorId && anchor.routeSlots.some((route) => route.id === selection.routeId),
  );
}

export function BaseChartReactionChamber({
  calculatedState,
  onOpenReactionBadge,
  onOpenRouteDetail,
}: BaseChartReactionChamberProps) {
  const model = buildBaseChartChamberModel(calculatedState);
  const [selection, setSelection] = useState<BaseChartChamberSelection>(model?.defaultSelection ?? { kind: "core" });

  if (!model) {
    return null;
  }

  const activeSelection = isSelectionAvailable(model, selection) ? selection : model.defaultSelection;
  const selected = resolveBaseChartChamberSelection(model, activeSelection);

  function handleOpenDetail() {
    if (!selected.detailAction) {
      return;
    }

    if (selected.detailAction.kind === "reaction") {
      onOpenReactionBadge(selected.detailAction.badge);
      return;
    }

    onOpenRouteDetail(selected.detailAction.detail);
  }

  return (
    <section className="surface inset-card base-chart-chamber-section" aria-label="base chart reaction chamber" data-reading-block="C">
      <div className="section-heading section-heading--compact base-chart-chamber-section__header">
        <div>
          <p className="section-kicker">Reaction Chamber</p>
          <h3>ปฏิกิริยาพื้นดวง</h3>
        </div>
      </div>

      <div className="base-chart-chamber-layout">
        <div className="base-chart-chamber-stage" data-selected-kind={selection.kind}>
          <BaseChartEdgeLayer
            edges={model.edges}
            selectedEdgeId={activeSelection.kind === "edge" ? activeSelection.edgeId : undefined}
            onSelectEdge={(edgeId) => setSelection({ kind: "edge", edgeId })}
          />

          <button
            type="button"
            className={`base-chart-core${activeSelection.kind === "core" ? " base-chart-core--selected" : ""}`}
            onClick={() => setSelection({ kind: "core" })}
          >
            <span className="base-chart-core__label">{model.core.title}</span>
            <strong className="base-chart-core__symbol">{model.core.symbol}</strong>
            <span className="base-chart-core__summary">{model.core.summary}</span>
            <span className="base-chart-core__route">{model.core.routeSummary}</span>
          </button>

          {model.anchors.map((anchor) => {
            const isSelected = activeSelection.kind === "anchor" && activeSelection.anchorId === anchor.id;

            return (
              <article
                key={anchor.id}
                className={`base-chart-anchor${isSelected ? " base-chart-anchor--selected" : ""}${anchor.isDayMaster ? " base-chart-anchor--day-master" : ""}`}
                data-anchor-key={anchor.id}
                style={ANCHOR_POSITIONS[anchor.id]}
              >
                <button
                  type="button"
                  className="base-chart-anchor__main"
                  onClick={() => setSelection({ kind: "anchor", anchorId: anchor.id })}
                >
                  <span className="base-chart-anchor__label">{anchor.label}</span>
                  <span className="base-chart-anchor__code">{anchor.pillarCode}</span>
                  <span className="base-chart-anchor__glyph">{formatGlyphWithTranslation(anchor.stem, anchor.stemTranslation)}</span>
                  <span className="base-chart-anchor__glyph base-chart-anchor__glyph--branch">{formatGlyphWithTranslation(anchor.branch, anchor.branchTranslation)}</span>
                  {anchor.roleBadges[0] ? (
                    <span className="base-chart-anchor__role">{anchor.roleBadges[0].shortLabel ?? anchor.roleBadges[0].label}</span>
                  ) : null}
                </button>

                {anchor.routeSlots.length > 0 ? (
                  <div className="base-chart-anchor__routes">
                    {anchor.routeSlots.map((route) => (
                      <button
                        key={route.id}
                        type="button"
                        className={`base-chart-anchor__route${activeSelection.kind === "route" && activeSelection.routeId === route.id ? " base-chart-anchor__route--selected" : ""}`}
                        onClick={() => setSelection({ kind: "route", anchorId: anchor.id, routeId: route.id })}
                      >
                        <span>{route.label}</span>
                        <strong>{route.value}</strong>
                      </button>
                    ))}
                  </div>
                ) : null}

                {anchor.markerBadges.length > 0 ? (
                  <div className="base-chart-anchor__markers">
                    {anchor.markerBadges.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        className={`base-chart-anchor__marker${activeSelection.kind === "marker" && activeSelection.markerId === marker.id ? " base-chart-anchor__marker--selected" : ""}`}
                        onClick={() => setSelection({ kind: "marker", markerId: marker.id })}
                      >
                        {marker.shortLabel ?? marker.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <BaseChartInspector selection={selected} onOpenDetail={handleOpenDetail} />
      </div>
    </section>
  );
}
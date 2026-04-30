import type { BaseChartChamberResolvedSelection } from "@/lib/bazi/base-chart-chamber";

type BaseChartInspectorProps = {
  selection: BaseChartChamberResolvedSelection;
  onOpenDetail: () => void;
};

export function BaseChartInspector({ selection, onOpenDetail }: BaseChartInspectorProps) {
  return (
    <aside className="base-chart-inspector" aria-label="reaction chamber inspector">
      <div className="base-chart-inspector__header">
        <p className="section-kicker">{selection.kicker}</p>
        <h4 className="base-chart-inspector__title">{selection.title}</h4>
      </div>

      <p className="base-chart-inspector__summary">{selection.summary}</p>
      <p className="base-chart-inspector__meaning">{selection.meaning}</p>

      <dl className="base-chart-inspector__details">
        {selection.details.map((detail) => (
          <div key={`${selection.key}-${detail.label}-${detail.value}`} className="base-chart-inspector__detail-row">
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>

      {selection.detailAction ? (
        <button type="button" className="secondary-action base-chart-inspector__action" onClick={onOpenDetail}>
          เปิดรายละเอียด
        </button>
      ) : null}
    </aside>
  );
}
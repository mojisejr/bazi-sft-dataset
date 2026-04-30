import type {
  BaseChartChamberAnchorKey,
  BaseChartChamberEdge,
} from "@/lib/bazi/base-chart-chamber";

type EdgeLayerProps = {
  edges: BaseChartChamberEdge[];
  selectedEdgeId?: string;
  onSelectEdge: (edgeId: string) => void;
};

type Point = { x: number; y: number };

const ANCHOR_POINTS: Record<BaseChartChamberAnchorKey, Point> = {
  "ming-gong": { x: 50, y: 14 },
  hour: { x: 18, y: 36 },
  day: { x: 50, y: 86 },
  month: { x: 82, y: 36 },
  year: { x: 28, y: 78 },
};

function buildPoints(anchorKeys: BaseChartChamberAnchorKey[]) {
  return anchorKeys.map((anchorKey) => ANCHOR_POINTS[anchorKey]);
}

function getPathString(points: Point[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function getMidpoint(points: Point[]) {
  const total = points.reduce((accumulator, point) => ({
    x: accumulator.x + point.x,
    y: accumulator.y + point.y,
  }), { x: 0, y: 0 });

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

export function BaseChartEdgeLayer({ edges, selectedEdgeId, onSelectEdge }: EdgeLayerProps) {
  return (
    <svg className="base-chart-edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {edges.map((edge) => {
        const points = buildPoints(edge.anchorKeys);
        const midpoint = getMidpoint(points);
        const isSelected = edge.id === selectedEdgeId;
        const pathString = getPathString(points);

        return (
          <g
            key={edge.id}
            className={`base-chart-edge base-chart-edge--${edge.tone} base-chart-edge--${edge.badge.status}${isSelected ? " base-chart-edge--selected" : ""}`}
            onClick={() => onSelectEdge(edge.id)}
          >
            <title>{edge.badge.label}</title>
            <polyline className="base-chart-edge__hit" points={pathString} />
            <polyline className="base-chart-edge__line" points={pathString} />
            <circle className="base-chart-edge__label-backdrop" cx={midpoint.x} cy={midpoint.y} r="4.2" />
            <text className="base-chart-edge__label" x={midpoint.x} y={midpoint.y + 1.1} textAnchor="middle">
              {edge.badge.shortLabel ?? edge.badge.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
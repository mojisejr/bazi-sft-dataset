import {
  ChartPillarTable,
  type ColumnHighlight,
  type PillarColumnData,
} from "@/components/bazi/reading/ChartPillarTable";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

/** สี่เสาเรียงตามสเก็ตช์: ยาม · วัน · เดือน · ปี */
function pillarCols(state: CalculatedStateValue): PillarColumnData[] {
  const p = state.fourPillars;
  return [
    { label: "ยาม", pillar: p.hour },
    { label: "วัน", pillar: p.day },
    { label: "เดือน", pillar: p.month },
    { label: "ปี", pillar: p.year },
  ];
}

/** ฝั่ง "เขา" เน้นเสาวัน (idx 1) + เสาปี (idx 3); เสาอื่นจะถูกทำจางด้วย CSS */
const PARTNER_HIGHLIGHTS = new Map<number, ColumnHighlight>([
  [1, { color: "#1b9aaf", roleLabels: [] }],
  [3, { color: "#1b9aaf", roleLabels: [] }],
]);

/** เทียบสี่เสาของสองคนบนหน้าเดียว (ตัวเรา = เต็ม, เขา = เน้นวัน+ปี). */
export function PairPillarsCompare({
  personA,
  personB,
}: {
  personA: CalculatedStateValue;
  personB: CalculatedStateValue;
}) {
  return (
    <div className="pair-pillars-compare">
      <div className="pair-pillars-compare__chart">
        <span className="pair-pillars-compare__who">ตัวเรา</span>
        <ChartPillarTable cols={pillarCols(personA)} variant="chapter" />
      </div>
      <div className="pair-pillars-compare__chart pair-pillars-compare__chart--partner">
        <span className="pair-pillars-compare__who">เขา</span>
        <ChartPillarTable cols={pillarCols(personB)} highlights={PARTNER_HIGHLIGHTS} variant="chapter" />
      </div>
    </div>
  );
}

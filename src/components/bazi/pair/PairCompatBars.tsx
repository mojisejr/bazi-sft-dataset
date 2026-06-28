import type { MatchFacet } from "@/lib/bazi/pair-types";

/** กราฟแท่งมิติความเข้ากัน (ความสูงแท่ง = เปอร์เซ็นต์ความเข้ากัน); แท่ง ⭐ = คำทำนายหลัก. */
export function PairCompatBars({ facets }: { facets: MatchFacet[] }) {
  return (
    <div className="pair-compat-bars" role="img" aria-label={`กราฟความเข้ากัน ${facets.length} มิติ`}>
      {facets.map((f) => {
        const pct = f.percent;
        const height = pct == null ? 0 : Math.max(2, Math.min(100, pct));
        return (
          <div key={f.key} className="pair-compat-bar" data-main={f.isMain || undefined}>
            <span className="pair-compat-bar__value">
              {pct == null ? "—" : `${Math.round(pct)}%`}
              {pct != null && f.grade ? <em className="pair-compat-bar__grade">{f.grade}</em> : null}
            </span>
            <div className="pair-compat-bar__track">
              <div className="pair-compat-bar__fill" style={{ height: `${height}%` }} />
            </div>
            <span className="pair-compat-bar__label">
              {f.isMain ? "⭐ " : ""}{f.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

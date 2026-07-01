import type { MatchFacet } from "@/lib/bazi/pair-types";

type Props = {
  facets: MatchFacet[];
  /**
   * "main" (ค่าเริ่มต้น) — ⭐ ที่มิติคำทำนายหลัก (isMain).
   * "extremes" — ⭐ ที่มิติดีสุดของวัน + ⚠️ ป้ายเตือนที่มิติแย่สุด (ใช้ในการ์ด Man Vs Day).
   */
  emphasis?: "main" | "extremes";
};

/** หา index มิติดีสุด/แย่สุด (เฉพาะที่มีคะแนน). */
function extremeIndices(facets: MatchFacet[]): { best: number; worst: number } {
  let best = -1;
  let worst = -1;
  facets.forEach((f, i) => {
    if (f.percent == null) return;
    if (best < 0 || f.percent > (facets[best].percent ?? -1)) best = i;
    if (worst < 0 || f.percent < (facets[worst].percent ?? 101)) worst = i;
  });
  // ถ้าทุกแท่งเท่ากันจนดีสุด=แย่สุด ไม่ต้องเตือน
  if (best === worst) worst = -1;
  return { best, worst };
}

/** กราฟแท่งมิติความเข้ากัน (ความสูงแท่ง = เปอร์เซ็นต์ความเข้ากัน). */
export function PairCompatBars({ facets, emphasis = "main" }: Props) {
  const { best, worst } = emphasis === "extremes" ? extremeIndices(facets) : { best: -1, worst: -1 };

  return (
    <div className="pair-compat-bars" role="img" aria-label={`กราฟความเข้ากัน ${facets.length} มิติ`}>
      {facets.map((f, i) => {
        const pct = f.percent;
        const height = pct == null ? 0 : Math.max(2, Math.min(100, pct));
        const isBest = i === best;
        const isWorst = i === worst;
        const star = emphasis === "extremes" ? isBest : f.isMain;
        return (
          <div
            key={f.key}
            className="pair-compat-bar"
            data-main={star || undefined}
            data-worst={isWorst || undefined}
          >
            <span className="pair-compat-bar__value">
              {pct == null ? "—" : `${Math.round(pct)}%`}
              {pct != null && f.grade ? <em className="pair-compat-bar__grade">{f.grade}</em> : null}
            </span>
            {isBest && emphasis === "extremes" ? (
              <span className="pair-compat-bar__badge pair-compat-bar__badge--best">⭐ วันดีของคุณ</span>
            ) : null}
            {isWorst ? (
              <span className="pair-compat-bar__badge pair-compat-bar__badge--warn">⚠️ ควรระวัง</span>
            ) : null}
            <div className="pair-compat-bar__track">
              <div className="pair-compat-bar__fill" style={{ height: `${height}%` }} />
            </div>
            <span className="pair-compat-bar__label">
              {star ? "⭐ " : ""}{isWorst ? "⚠️ " : ""}{f.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

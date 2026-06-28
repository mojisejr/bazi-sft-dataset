import type { MatchFacet } from "@/lib/bazi/pair-types";

/**
 * คำทำนายรายมิติ (รายแท่ง) — แต่ละมิติมี 3 บรรทัด: ก้าน / กิ่ง / สี่ซิ้ง
 * ตามที่ซินแสกำหนดในชีต Matching.xlsx (โค้ด A1..A12 / B1..B12 ต่อช่อง).
 */
export function PairFacetReadings({ facets }: { facets: MatchFacet[] }) {
  return (
    <div className="pair-facet-readings">
      {facets.map((f) => (
        <div key={f.key} className="pair-facet-reading" data-main={f.isMain || undefined}>
          <div className="pair-facet-reading__head">
            <span className="pair-facet-reading__label">
              {f.isMain ? "⭐ " : ""}{f.label}
            </span>
            <span className="pair-facet-reading__meta">
              {f.pairingLabel} · {f.percent ?? "-"}% {f.grade}
            </span>
          </div>
          {f.lines.length ? (
            <ul className="pair-facet-reading__lines">
              {f.lines.map((ln, i) => (
                <li key={i} className="pair-facet-reading__line">
                  <span className="pair-facet-reading__slot" title={ln.code}>
                    {ln.slot}{ln.name ? ` · ${ln.name}` : ""}
                  </span>
                  <span className="pair-facet-reading__text">{ln.text || "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pair-rating-text">ไม่พบคำทำนายสำหรับมิตินี้</p>
          )}
        </div>
      ))}
    </div>
  );
}

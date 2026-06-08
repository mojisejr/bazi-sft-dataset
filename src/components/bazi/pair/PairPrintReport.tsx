"use client";

import type { CalculatedStateValue, PillarValue, RawInputValue } from "@/lib/bazi/schema-types";
import type { PairComparisonResult, PairDomain, PairMatchPair } from "@/lib/bazi/pair-types";
import { DOMAIN_LABEL, sisingDomainAspects, verdictLabel } from "@/components/bazi/pair/pair-presentation";
import { formatThaiBirthMoment } from "@/lib/bazi/trainer-workspace";

type PairResponse = {
  personA: CalculatedStateValue;
  personB: CalculatedStateValue;
  comparison: PairComparisonResult;
};

type PairPrintReportProps = {
  result: PairResponse;
  birthA: RawInputValue | null;
  birthB: RawInputValue | null;
  dateText: string;
  currentYear: number;
};

type PillarCell = { glyph: string; sub: string };

const PILLAR_ROWS: { key: "year" | "month" | "day" | "hour"; label: string }[] = [
  { key: "year", label: "เสาปี" },
  { key: "month", label: "เสาเดือน" },
  { key: "day", label: "เสาวัน (ดิถี)" },
  { key: "hour", label: "เสายาม" },
];

function pillarCell(p: PillarValue | undefined): PillarCell {
  if (!p) return { glyph: "-", sub: "" };
  const sub = [p.stemTranslation, p.branchTranslation].filter(Boolean).join(" / ");
  return { glyph: `${p.stem}${p.branch}`, sub };
}

function currentYearCell(state: CalculatedStateValue, currentYear: number): PillarCell {
  const entry = state.liuNianSeries?.find((y) => y.year === currentYear);
  if (entry) {
    return {
      glyph: `${entry.stem}${entry.branch}`,
      sub: entry.twelveQiDisplay ?? "",
    };
  }
  if (state.liuNian) return pillarCell(state.liuNian);
  return { glyph: "-", sub: "" };
}

function ChartCompareTable({ a, b, currentYear }: { a: CalculatedStateValue; b: CalculatedStateValue; currentYear: number }) {
  const rows: { label: string; a: PillarCell; b: PillarCell }[] = [
    ...PILLAR_ROWS.map((r) => ({ label: r.label, a: pillarCell(a.fourPillars[r.key]), b: pillarCell(b.fourPillars[r.key]) })),
    { label: "ลัคนา (มิ่งกง)", a: pillarCell(a.mingGong), b: pillarCell(b.mingGong) },
    { label: `ปีปัจจุบัน (${currentYear})`, a: currentYearCell(a, currentYear), b: currentYearCell(b, currentYear) },
  ];
  return (
    <table className="pair-print__chart">
      <thead>
        <tr>
          <th>ตำแหน่ง</th>
          <th>คนที่ 1</th>
          <th>คนที่ 2</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} data-row={row.label.startsWith("ปีปัจจุบัน") ? "current" : undefined}>
            <td className="pair-print__chart-pos">{row.label}</td>
            <td>
              <span className="pair-print__glyph">{row.a.glyph}</span>
              {row.a.sub ? <span className="pair-print__sub"> {row.a.sub}</span> : null}
            </td>
            <td>
              <span className="pair-print__glyph">{row.b.glyph}</span>
              {row.b.sub ? <span className="pair-print__sub"> {row.b.sub}</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DomainBlock({ pair, domain, comparison }: { pair: PairMatchPair; domain: PairDomain; comparison: PairComparisonResult }) {
  const found = pair.forward.found || pair.reverse.found;
  return (
    <section className="pair-print__domain">
      <h2 className="pair-print__domain-title">ความเข้ากันด้าน{DOMAIN_LABEL[domain]}</h2>
      {found ? (
        <>
          <p className="pair-print__verdict">
            <strong>{pair.overallGrade}</strong> · {verdictLabel(pair.overallPercent)} · คะแนนรวม {pair.overallPercent}%
          </p>
          <div className="pair-print__dirs">
            {[
              { dir: pair.forward, label: "คนที่ 1 ได้รับจากคนที่ 2" },
              { dir: pair.reverse, label: "คนที่ 2 ได้รับจากคนที่ 1" },
            ].map(({ dir, label }) => (
              <div key={label} className="pair-print__dir">
                <p className="pair-print__dir-head">
                  {label}: <strong>{dir.grade}</strong> ({dir.percent ?? "-"}%)
                  {dir.sising ? ` · สี่ซิ้ง ${dir.sising.nameTh}` : ""}
                </p>
                <p>{dir.ratingText}</p>
              </div>
            ))}
          </div>
          <p className="pair-print__elem">ปฏิกิริยาธาตุ: {comparison.elementInteraction.summaryTh}</p>
          {pair.forward.sising ? (
            <div className="pair-print__sising">
              <p>
                <strong>สี่ซิ้งประจำคู่: {pair.forward.sising.nameTh}</strong> ({pair.forward.sising.nameCn} · พลัง {pair.forward.sising.score})
              </p>
              <p>{pair.forward.sising.long || pair.forward.sising.short}</p>
              {sisingDomainAspects(pair.forward.sising, domain).map((a) => (
                <p key={a.label}>
                  <strong>{a.label}:</strong> {a.text}
                </p>
              ))}
            </div>
          ) : null}
          {(domain === "work" ? comparison.workRoles : comparison.loveRoles).length ? (
            <div className="pair-print__roles">
              <p><strong>บทบาทด้าน{DOMAIN_LABEL[domain]}</strong></p>
              {(domain === "work" ? comparison.workRoles : comparison.loveRoles).map((r, i) => (
                <p key={i}>
                  <strong>{r.perspective} · {r.stageName}:</strong> {r.narrative}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p>ไม่พบข้อมูลสมพงษ์สำหรับคู่หลักวันนี้</p>
      )}
    </section>
  );
}

/** รายงานฉบับพิมพ์ (ซ่อนบนจอ แสดงเฉพาะตอน print → Save as PDF) รวมทั้งสองด้านในไฟล์เดียว. */
export function PairPrintReport({ result, birthA, birthB, dateText, currentYear }: PairPrintReportProps) {
  const { comparison } = result;
  const a = comparison.personA;
  const b = comparison.personB;
  return (
    <div className="pair-print-report" aria-hidden="true">
      <header className="pair-print__header">
        <h1>รายงานเปรียบเทียบดวง 2 คน · คู่สมพงษ์</h1>
        <p className="pair-print__date">จัดทำเมื่อ {dateText}</p>
      </header>

      <section className="pair-print__people">
        {[
          { who: "คนที่ 1", p: a, birth: birthA },
          { who: "คนที่ 2", p: b, birth: birthB },
        ].map(({ who, p, birth }) => (
          <div key={who} className="pair-print__person">
            <h3>
              {who} — หลักวัน {p.dayPillar.stem}{p.dayPillar.branch} · ดิถี{p.elementTh}
              {p.stageTh ? ` · ${p.stageTh}` : ""}
            </h3>
            <p className="pair-print__birth">{formatThaiBirthMoment(birth)}</p>
            <ul>
              {p.nisai.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="pair-print__domain">
        <h2 className="pair-print__domain-title">พื้นดวงเทียบกัน</h2>
        <ChartCompareTable a={result.personA} b={result.personB} currentYear={currentYear} />
      </section>

      <DomainBlock pair={comparison.match.love} domain="love" comparison={comparison} />
      <DomainBlock pair={comparison.match.work} domain="work" comparison={comparison} />

      <footer className="pair-print__footer">
        คะแนนรวมเป็นค่าเฉลี่ยสองทิศ จึงไม่ขึ้นกับลำดับการกรอก · จับคู่จากหลักวัน (วันเกิด) ตามตำราคู่สมพงษ์
      </footer>
    </div>
  );
}

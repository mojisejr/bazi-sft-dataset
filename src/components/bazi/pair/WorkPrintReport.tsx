"use client";

import type { CalculatedStateValue, PillarValue, RawInputValue } from "@/lib/bazi/schema-types";
import type { WorkComparisonResult } from "@/lib/bazi/pair-types";
import { sisingDomainAspects, verdictLabel } from "@/components/bazi/pair/pair-presentation";
import { formatThaiBirthMoment } from "@/lib/bazi/trainer-workspace";

type WorkResponse = {
  self: CalculatedStateValue;
  candidates: CalculatedStateValue[];
  comparison: WorkComparisonResult;
};

type WorkPrintReportProps = {
  result: WorkResponse;
  selfBirth: RawInputValue | null;
  candidateBirths: RawInputValue[];
  candidateNames: string[];
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
  if (entry) return { glyph: `${entry.stem}${entry.branch}`, sub: entry.twelveQiDisplay ?? "" };
  if (state.liuNian) return pillarCell(state.liuNian);
  return { glyph: "-", sub: "" };
}

function ChartCompareTable({
  self,
  candidate,
  name,
  currentYear,
}: {
  self: CalculatedStateValue;
  candidate: CalculatedStateValue;
  name: string;
  currentYear: number;
}) {
  const rows: { label: string; a: PillarCell; b: PillarCell }[] = [
    ...PILLAR_ROWS.map((r) => ({ label: r.label, a: pillarCell(self.fourPillars[r.key]), b: pillarCell(candidate.fourPillars[r.key]) })),
    { label: "ลัคนา (มิ่งกง)", a: pillarCell(self.mingGong), b: pillarCell(candidate.mingGong) },
    { label: `ปีปัจจุบัน (${currentYear})`, a: currentYearCell(self, currentYear), b: currentYearCell(candidate, currentYear) },
  ];
  return (
    <table className="pair-print__chart">
      <thead>
        <tr>
          <th>ตำแหน่ง</th>
          <th>เรา</th>
          <th>{name}</th>
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

/** รายงานฉบับพิมพ์ของหน้าเปรียบเทียบงาน (เรา vs ผู้ร่วมงาน เรียงตามอันดับ). */
export function WorkPrintReport({ result, selfBirth, candidateBirths, candidateNames, dateText, currentYear }: WorkPrintReportProps) {
  const { comparison } = result;
  const self = comparison.self;
  const ranked = comparison.ranking.map((idx, rank) => ({ rank, idx, candidate: comparison.candidates[idx] }));

  return (
    <div className="pair-print-report" aria-hidden="true">
      <header className="pair-print__header">
        <h1>รายงานเปรียบเทียบการงาน · คู่สมพงษ์</h1>
        <p className="pair-print__date">จัดทำเมื่อ {dateText}</p>
      </header>

      <section className="pair-print__person">
        <h3>
          เรา — หลักวัน {self.dayPillar.stem}{self.dayPillar.branch} · ดิถี{self.elementTh}
          {self.stageTh ? ` · ${self.stageTh}` : ""}
        </h3>
        <p className="pair-print__birth">{formatThaiBirthMoment(selfBirth)}</p>
        <ul>
          {self.nisai.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="pair-print__domain">
        <h2 className="pair-print__domain-title">ผลจัดอันดับ (ด้านการงาน)</h2>
        <ol>
          {ranked.map(({ rank, idx, candidate }) => (
            <li key={idx}>
              <strong>{rank === 0 ? "👑 " : `#${rank + 1} `}{candidateNames[idx] ?? `ผู้สมัครคนที่ ${idx + 1}`}</strong>
              {" — "}เรา → เขา {candidate.match.forward.percent ?? "-"}% (เกรด {candidate.match.forward.grade})
            </li>
          ))}
        </ol>
      </section>

      {ranked.map(({ rank, idx, candidate }) => {
        const name = candidateNames[idx] ?? `ผู้สมัครคนที่ ${idx + 1}`;
        const f = candidate.match.forward;
        const r = candidate.match.reverse;
        return (
          <section key={idx} className="pair-print__domain">
            <h2 className="pair-print__domain-title">
              {rank === 0 ? "👑 อันดับ 1 — " : `อันดับ ${rank + 1} — `}{name}
            </h2>
            <p className="pair-print__birth">{formatThaiBirthMoment(candidateBirths[idx] ?? null)}</p>
            {f.found || r.found ? (
              <>
                <p className="pair-print__verdict">
                  <strong>{f.grade}</strong> · {verdictLabel(f.percent)} · เรา → {name} {f.percent ?? "-"}% · เฉลี่ยสองทิศ {candidate.match.overallPercent ?? "-"}%
                </p>
                <ChartCompareTable self={result.self} candidate={result.candidates[idx]} name={name} currentYear={currentYear} />
                <div className="pair-print__dirs">
                  {[
                    { dir: f, label: `เรา มอง ${name}` },
                    { dir: r, label: `${name} มอง เรา` },
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
                <p className="pair-print__elem">ปฏิกิริยาธาตุ: {candidate.elementInteraction.summaryTh}</p>
                {f.sising ? (
                  <div className="pair-print__sising">
                    <p><strong>สี่ซิ้งประจำคู่: {f.sising.nameTh}</strong> ({f.sising.nameCn} · พลัง {f.sising.score})</p>
                    <p>{f.sising.long || f.sising.short}</p>
                    {sisingDomainAspects(f.sising, "work").map((a) => (
                      <p key={a.label}><strong>{a.label}:</strong> {a.text}</p>
                    ))}
                  </div>
                ) : null}
                {candidate.roles.length ? (
                  <div className="pair-print__roles">
                    <p><strong>บทบาทด้านการงาน</strong></p>
                    {candidate.roles.map((role, i) => (
                      <p key={i}><strong>{role.perspective} · {role.stageName}:</strong> {role.narrative}</p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p>ไม่พบข้อมูลสมพงษ์สำหรับคู่หลักวันนี้</p>
            )}
          </section>
        );
      })}

      <footer className="pair-print__footer">
        จัดอันดับจากคะแนนทิศ “เรา → ผู้ร่วมงาน” (forward) · จับคู่จากหลักวัน (วันเกิด) ตามตำราคู่สมพงษ์ด้านการงาน
      </footer>
    </div>
  );
}

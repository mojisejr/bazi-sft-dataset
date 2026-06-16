"use client";

import { useCallback, useEffect, useState } from "react";

type Pillar = { stem: string; branch: string; ganzhi: string; element: string };
type GateInfo = { name: string; direction: string; meaning: string | null };
type SpiritInfo = { name: string; keywords: string[] };
type ColorInfo = { element: string; colors: string };
type PatronInfo = { branch: string; number: number | null; zodiac: string };
type AsuraDirections = { day: string; month: string; year: string };
type MonthInfo = { deity: string | null; caishenDir: string | null; lapDir: string | null };
type LuckyHour = { code: string; range: string };
type Strength = { ratioTotal: number; ratioDay: number; exact: boolean };
type AlmanacDay = {
  date: string;
  yearBE: number;
  weekday: string;
  dayPillar: Pillar;
  monthPillar: Pillar;
  yearPillar: Pillar;
  officer: string | null;
  officerDesc: string | null;
  deity: string | null;
  colors: ColorInfo[];
  luckyDirection: string | null;
  asura: AsuraDirections;
  patrons: PatronInfo[];
  gates: GateInfo[];
  spirits: SpiritInfo[];
  luckyHours: LuckyHour[];
  monthInfo: MonthInfo;
  strength: Strength;
};
type AlmanacMonth = { yearBE: number; month: number; days: AlmanacDay[] };

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const CURRENT_YEAR_BE = new Date().getFullYear() + 543;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function AlmanacWorkspace() {
  const [yearBE, setYearBE] = useState(CURRENT_YEAR_BE);
  const [month, setMonth] = useState(1);
  const [data, setData] = useState<AlmanacMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/almanac?yearBE=${yearBE}&month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "โหลดปฏิทินไม่สำเร็จ");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [yearBE, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthInfo = data?.days[0]?.monthInfo;
  const monthPillar = data?.days[0]?.monthPillar.ganzhi;

  return (
    <section className="almanac-workspace">
      <div className="almanac-controls">
        <label>
          ปี (พ.ศ.)
          <input
            type="number"
            min={2400}
            max={2700}
            value={yearBE}
            onChange={(e) => setYearBE(Number(e.target.value))}
          />
        </label>
        <label>
          เดือน
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <a className="almanac-download" href={`/api/almanac?yearBE=${yearBE}&format=xlsx`}>
          ⬇️ ดาวน์โหลด Excel ทั้งปี
        </a>
      </div>

      {loading && <p className="almanac-status">กำลังโหลด…</p>}
      {error && <p className="almanac-status almanac-error">{error}</p>}

      {data && !loading && (
        <>
          <div className="almanac-monthbar">
            <h2 className="almanac-title">
              {MONTH_NAMES[data.month - 1]} {data.yearBE}
              {monthPillar && <span className="almanac-monthpillar"> · เสาเดือน {monthPillar}</span>}
            </h2>
            {monthInfo && (
              <p className="almanac-monthmeta">
                {monthInfo.deity && <span>เทพประจำเดือน: <b>{monthInfo.deity}</b></span>}
                {monthInfo.caishenDir && <span>ทิศไฉ่ซิ้ง: <b>{monthInfo.caishenDir}</b></span>}
                {monthInfo.lapDir && <span>ทิศลาภเดือน: <b>{monthInfo.lapDir}</b></span>}
              </p>
            )}
          </div>

          <div className="almanac-grid">
            {data.days.map((day) => (
              <article key={day.date} className="almanac-day">
                <header className="almanac-day-head">
                  <span className="almanac-daynum">{Number(day.date.slice(8, 10))}</span>
                  <span className="almanac-weekday">{day.weekday}</span>
                  <span className="almanac-strength" title="กำลังดิถี E = (O+P+Q+R)/รวม max">
                    {pct(day.strength.ratioDay)}
                    {!day.strength.exact && <span className="almanac-approx"> ~</span>}
                  </span>
                  <span className="almanac-pillar">{day.dayPillar.ganzhi}</span>
                </header>

                {day.officer && (
                  <p className="almanac-officer">
                    <strong>{day.officer}</strong>
                    {day.officerDesc ? ` — ${day.officerDesc}` : ""}
                  </p>
                )}

                <dl className="almanac-meta">
                  <div><dt>เสาเดือน/ปี</dt><dd>{day.monthPillar.ganzhi} / {day.yearPillar.ganzhi}</dd></div>
                  {day.deity && <div><dt>เทพประจำวัน</dt><dd>{day.deity}</dd></div>}
                  {day.colors.length > 0 && (
                    <div><dt>สีมงคล</dt><dd>{day.colors.map((c) => c.colors).join(" / ")}</dd></div>
                  )}
                  {day.luckyDirection && <div><dt>ทิศโชคลาภ</dt><dd>{day.luckyDirection}</dd></div>}
                  <div><dt>ทิศอสูร ว/ด/ป</dt><dd>{day.asura.day} · {day.asura.month} · {day.asura.year}</dd></div>
                  {day.patrons.length > 0 && (
                    <div><dt>เทพอุปถัมภ์</dt><dd>{day.patrons.map((p) => p.zodiac).join(", ")}</dd></div>
                  )}
                  <div>
                    <dt>กำลัง (ดิถี/รวม)</dt>
                    <dd>{pct(day.strength.ratioDay)} / {pct(day.strength.ratioTotal)}
                      {!day.strength.exact && <span className="almanac-approx"> (ประมาณ)</span>}</dd>
                  </div>
                </dl>

                {day.luckyHours.length > 0 && (
                  <p className="almanac-hours">
                    ⏰ {day.luckyHours.map((h) => h.range).join(", ")}
                  </p>
                )}

                {day.gates.length > 0 && (
                  <details className="almanac-detail">
                    <summary>8 ประตู 八門</summary>
                    <ul className="almanac-tags">
                      {day.gates.map((g) => (
                        <li key={g.name}>{g.name} {g.meaning ?? ""} <em>{g.direction}</em></li>
                      ))}
                    </ul>
                  </details>
                )}

                {day.spirits.length > 0 && (
                  <details className="almanac-detail">
                    <summary>8 เทพ 八神 + คีย์เวิร์ด</summary>
                    <ul className="almanac-spirits">
                      {day.spirits.map((s, i) => (
                        <li key={`${s.name}-${i}`}>
                          <b>{s.name}</b> {s.keywords.join(" · ")}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

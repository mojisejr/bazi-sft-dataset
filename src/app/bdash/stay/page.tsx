// /bdash/stay — อยู่ต่อไหม (mumate-bdash-v2-001 slice 2): สมัครแล้วกลับมาใช้ไหม และคนสมัครฟรียอมจ่ายเงินไหม.
// แสดงกลุ่มที่สมัครในช่วงที่เลือก ใหม่สุดอยู่บน สูงสุด 12 สัปดาห์.
import { loadStay } from "@/lib/bdash/live";
import { weekOf, type BdashRange } from "@/lib/bdash/range";
import type { BdashCohort } from "@/lib/bdash/types";
import { int, pct, thDate } from "@/lib/bdash/view";

import { BarChart } from "../_ui/charts";
import { bdashMetadata, BdashShell, extra, openBdash, readOrHeavy, ShowAll, TooHeavy, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

/** ค่ากลางของแอปแบบ freemium ในเอเชียตะวันออกเฉียงใต้ (RevenueCat 2026) — เส้นอ้างอิงในกราฟ */
const SEA_FREE_TO_PAID = 0.014;
const MAX_WEEKS = 12;

export default async function BdashStay({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  const r = await readOrHeavy(loadStay(range));
  return (
    <BdashShell active="stay" range={range} at={r?.at ?? null}>
      {r ? <Stay cohorts={r.value.cohorts} range={range} /> : <TooHeavy range={range} />}
    </BdashShell>
  );
}

/** กลุ่มที่สมัครในช่วงนี้ (สัปดาห์ที่ครอบวันแรกของช่วงนับด้วย) ใหม่สุดก่อน */
export function cohortsIn(cohorts: BdashCohort[], range: Pick<BdashRange, "from" | "to">): BdashCohort[] {
  const first = weekOf(range.from);
  return cohorts
    .filter((c) => c.week >= first && c.week <= range.to && c.signups > 0)
    .sort((a, b) => (a.week < b.week ? 1 : -1))
    .slice(0, MAX_WEEKS);
}

function Stay({ cohorts, range }: { cohorts: BdashCohort[]; range: BdashRange }) {
  const rows = cohortsIn(cohorts, range);
  return (
    <section className="bd-grid">
      <div className="bd-card">
        <h3>สมัครแล้ว กลับมาใช้อีกไหม</h3>
        <p className="bd-hint">
          แต่ละแถว = คนที่สมัครในสัปดาห์นั้น · ตัวเลข = กี่ % ของกลุ่มนั้นกลับมาทำอะไรสักอย่างในแอป · สีเข้ม = กลับมาเยอะ · ขีด = ยังไม่ถึงช่วงนั้น · ใหม่สุดอยู่บน
          แสดง {MAX_WEEKS} สัปดาห์ล่าสุดของช่วงที่เลือก
        </p>
        {rows.length === 0 ? (
          <p className="bd-hint">ไม่มีคนสมัครในช่วงนี้</p>
        ) : (
          <div className="bd-scroll">
            <table>
              <thead>
                <tr>
                  <th>สมัครสัปดาห์ของ</th>
                  <th>จำนวนคน</th>
                  <th>วันถัดไป</th>
                  <th>สัปดาห์ที่ 2</th>
                  <th>1 เดือนต่อมา</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.week} className={extra(i)}>
                    <td className="txt">{thDate(c.week)}</td>
                    <td>{int(c.signups)}</td>
                    <Heat c={c} n={c.d1} max={0.45} />
                    <Heat c={c} n={c.d7} max={0.2} />
                    <Heat c={c} n={c.d30} max={0.1} />
                  </tr>
                ))}
              </tbody>
            </table>
            <ShowAll id="stay-all" total={rows.length} label={(n) => `ดูอีก ${n} สัปดาห์`} />
          </div>
        )}
      </div>
      <div className="bd-card">
        <h3>คนสมัครฟรี ยอมจ่ายเงินไหม</h3>
        <p className="bd-hint">
          แต่ละแท่ง = คนที่สมัครในสัปดาห์นั้น จ่ายเงินครั้งแรกภายใน 5 สัปดาห์กี่ % · แท่งเส้นประ = ยังไม่ครบ 5 สัปดาห์ ตัวเลขยังขึ้นได้อีก · เส้นทอง = ค่ากลางของแอปแบบนี้ในแถบเรา
          (1.4%) · ชี้ที่แท่งเพื่อดูว่ากี่วันกว่าจะจ่าย
        </p>
        <BarChart
          aria="กี่ % ของคนที่สมัครแต่ละสัปดาห์ จ่ายเงินภายใน 5 สัปดาห์"
          floor={0.04}
          fmt={(t) => `${Math.round(t * 1000) / 10}%`}
          reference={{ value: SEA_FREE_TO_PAID, tip: "ค่ากลางแอปแบบนี้ในเอเชียตะวันออกเฉียงใต้ 1.4% (RevenueCat 2026)" }}
          bars={[...rows].reverse().map((c) => {
            const v = c.paid35 / c.signups;
            return {
              key: c.week,
              label: thDate(c.week),
              value: v,
              partial: !c.paid35Complete,
              valueText: pct(v),
              tip: `สมัครสัปดาห์ของ ${thDate(c.week)}: จ่ายเงิน ${int(c.paid35)} จาก ${int(c.signups)} คน (${pct(v)})${
                c.medianDaysToPay === null ? "" : ` · ใช้เวลาประมาณ ${Math.round(c.medianDaysToPay)} วัน`
              }${c.paid35Complete ? "" : " · ยังไม่ครบ 5 สัปดาห์"}`,
            };
          })}
        />
      </div>
    </section>
  );
}

function Heat({ c, n, max }: { c: BdashCohort; n: number | null; max: number }) {
  if (n === null || c.signups === 0) return <td className="na">—</td>;
  const v = n / c.signups;
  const a = Math.min(1, v / max);
  return (
    <td className="heat">
      <span
        title={`${int(n)} จาก ${int(c.signups)} คน`}
        style={{ background: `color-mix(in srgb, var(--bd-teal) ${Math.round(a * 70) + 8}%, transparent)`, color: a > 0.55 ? "#FFFFFF" : "var(--bd-ink)" }}
      >
        {pct(v)}
      </span>
    </td>
  );
}

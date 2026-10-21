// /bdash/money — เงินเข้า (mumate-bdash-v2-001 slice 2): กดจ่ายแล้วติดตรงไหน. รายชื่อคนจ่ายเงินมาใน slice 3.
// แถวละวิธีจ่าย ไม่แยกผู้รับเงิน (จ่ายผ่าน Beam อย่างเดียวแล้ว) · ตาราง 5 คอลัมน์บนคอม · บนมือถือเป็นกล่องละวิธีจ่าย ตัวเลขอยู่ใต้แถบสี (ไม่ต้องเลื่อนซ้ายขวา).
import { loadMoney } from "@/lib/bdash/live";
import type { BdashPaymentRow } from "@/lib/bdash/types";
import { failureTh, int, METHOD_TH, pct, ratio } from "@/lib/bdash/view";

import { bdashMetadata, BdashShell, extra, openBdash, readOrHeavy, ShowAll, TooHeavy, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashMoney({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  const r = await readOrHeavy(loadMoney(range));
  return (
    <BdashShell active="money" range={range} at={r?.at ?? null}>
      {r ? <Payments payments={r.value.payments} /> : <TooHeavy range={range} />}
    </BdashShell>
  );
}

const rateColor = (r: number | null) => (r === null ? undefined : r >= 0.8 ? "var(--bd-ok)" : r < 0.7 ? "var(--bd-bad)" : undefined);

function Stack({ p }: { p: BdashPaymentRow }) {
  const w = (n: number) => `${(n / p.created) * 100}%`;
  return (
    <div className="bd-stack">
      <span style={{ width: w(p.approved), background: "var(--bd-ok)" }} />
      <span style={{ width: w(p.rejected), background: "var(--bd-bad)" }} />
      <span style={{ width: w(p.expired), background: "var(--bd-gold-a)" }} />
      <span style={{ width: w(p.waiting), background: "var(--bd-line)" }} />
    </div>
  );
}

/** "สำเร็จ 45 · ปฏิเสธ 2 · QR หมดเวลา 13 · รอผล 13" เฉพาะที่ไม่เป็นศูนย์ */
function parts(p: BdashPaymentRow): string {
  return [
    `สำเร็จ ${int(p.approved)}`,
    p.rejected ? `ปฏิเสธ ${int(p.rejected)}` : "",
    p.expired ? `QR หมดเวลา ${int(p.expired)}` : "",
    p.waiting ? `รอผล ${int(p.waiting)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function Payments({ payments }: { payments: BdashPaymentRow[] }) {
  return (
    <section className="bd-card bd-pay">
      <h3>กดจ่ายแล้ว ติดตรงไหน</h3>
      <p className="bd-hint">แยกตามวิธีจ่าย · ตัวเลขมาจากผลที่ผู้รับเงินแจ้งกลับมา</p>
      <div className="bd-legend">
        <span>
          <i style={{ background: "var(--bd-ok)" }} />
          จ่ายสำเร็จ
        </span>
        <span>
          <i style={{ background: "var(--bd-bad)" }} />
          ธนาคาร/บัตรปฏิเสธ
        </span>
        <span>
          <i style={{ background: "var(--bd-gold-a)" }} />
          QR หมดเวลา
        </span>
        <span>
          <i style={{ background: "var(--bd-line)" }} />
          ยังรอผล
        </span>
      </div>
      {payments.length === 0 ? (
        <p className="bd-hint">ไม่มีการกดจ่ายในช่วงนี้</p>
      ) : (
        <>
          <table className="bd-wide">
            <thead>
              <tr>
                <th>วิธีจ่าย</th>
                <th>กดจ่าย</th>
                <th>สำเร็จ %</th>
                <th>ผลการจ่าย</th>
                <th>ไม่สำเร็จบ่อยสุด</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const r = ratio(p.approved, p.created);
                return (
                  <tr key={p.method}>
                    <td className="txt">
                      {METHOD_TH[p.method] ?? p.method}
                    </td>
                    <td>{int(p.created)}</td>
                    <td style={{ fontWeight: 600, color: rateColor(r) }}>{pct(r)}</td>
                    <td title={parts(p)}>
                      <Stack p={p} />
                    </td>
                    <td className="txt">{failureTh(p.topFailure)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bd-list bd-narrow">
            {payments.map((p, i) => {
              const r = ratio(p.approved, p.created);
              return (
                <div key={p.method} className={`bd-item ${extra(i) ?? ""}`}>
                  <div className="bd-item-head">
                    <b>
                      {METHOD_TH[p.method] ?? p.method}
                    </b>
                    <span className="num" style={{ color: rateColor(r) }}>
                      <b>{pct(r)}</b> สำเร็จ
                    </span>
                  </div>
                  <Stack p={p} />
                  <span className="bd-sub">
                    กดจ่าย <b className="num">{int(p.created)}</b> ครั้ง · {parts(p)}
                  </span>
                  {p.topFailure ? <span className="bd-sub">ไม่สำเร็จบ่อยสุด: {failureTh(p.topFailure)}</span> : null}
                </div>
              );
            })}
            <ShowAll id="pay-all" total={payments.length} label={(n) => `ดูอีก ${n} วิธีจ่าย`} />
          </div>
        </>
      )}
    </section>
  );
}

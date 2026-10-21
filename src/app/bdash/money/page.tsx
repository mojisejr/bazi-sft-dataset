// /bdash/money — เงินเข้า (mumate-bdash-v2-001 slice 2): กดจ่ายแล้วติดตรงไหน · (slice 3) ใครจ่าย และกลับมาซื้ออีกไหม.
// แถวละวิธีจ่าย ไม่แยกผู้รับเงิน (จ่ายผ่าน Beam อย่างเดียวแล้ว) · ตาราง 5 คอลัมน์บนคอม · บนมือถือเป็นกล่องละวิธีจ่าย ตัวเลขอยู่ใต้แถบสี (ไม่ต้องเลื่อนซ้ายขวา).
// รายชื่อคนจ่าย: ชื่ออย่างเดียว ไม่มี id อีเมล หรือเบอร์ ทั้งบนจอและใน HTML (owner 2026-10-21) — key ของแถวจึงเป็นลำดับ ไม่ใช่ id.
import { todayBangkok } from "@/lib/bazi/manifest/dates";
import { loadMoney } from "@/lib/bdash/live";
import type { BdashPayer, BdashPayerSummary, BdashPaymentRow } from "@/lib/bdash/types";
import { failureTh, int, METHOD_TH, pct, ratio, thDate, thDateYy } from "@/lib/bdash/view";

import { bdashMetadata, BdashShell, extra, openBdash, readOrHeavy, ShowAll, TooHeavy, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashMoney({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  const r = await readOrHeavy(loadMoney(range));
  return (
    <BdashShell active="money" range={range} at={r?.at ?? null}>
      {r ? (
        <>
          <Payments payments={r.value.payments} />
          <BuyAgain s={r.value.payerSummary} />
          <Payers payers={r.value.payers} today={todayBangkok()} />
        </>
      ) : (
        <TooHeavy range={range} />
      )}
    </BdashShell>
  );
}

function BuyAgain({ s }: { s: BdashPayerSummary }) {
  const share = ratio(s.again, s.payers);
  return (
    <section className="bd-card">
      <h3>คนที่จ่ายแล้ว กลับมาซื้ออีกไหม</h3>
      <p className="bd-hint">
        นับคนที่จ่ายสำเร็จในช่วงนี้ · &quot;ซื้ออีก&quot; = เคยจ่ายสำเร็จมาแล้วอย่างน้อยสองวัน (จ่ายสองครั้งในวันเดียวกันนับเป็นครั้งเดียว) ·
        ยิ่งสูงยิ่งดี
      </p>
      <div className="bd-stats">
        <div className="bd-stat">
          คนที่จ่าย<b>{int(s.payers)} คน</b>
          <span className="bd-sub">จ่าย {int(s.payments)} ครั้ง</span>
        </div>
        <div className="bd-stat">
          ซื้อครั้งเดียว<b>{int(s.once)} คน</b>
        </div>
        <div className="bd-stat">
          ซื้ออีก<b>{int(s.again)} คน</b>
          <span className="bd-sub">{pct(share)} ของคนที่จ่าย</span>
        </div>
        <div className="bd-stat">
          ซื้ออีกห่างกันเฉลี่ย<b>{s.avgGapDays === null ? "—" : `${int(s.avgGapDays)} วัน`}</b>
        </div>
      </div>
      {s.yearly > 0 ? (
        <p className="bd-hint">
          {int(s.yearly)} จาก {int(s.payments)} ครั้งในช่วงนี้เป็นสมาชิกรายปี คนกลุ่มนี้จะต่ออายุได้เมื่อครบปี ตัวเลขซื้ออีกของเขาจึงยังไม่ขึ้นจนกว่าจะครบปี
        </p>
      ) : null}
    </section>
  );
}

function MemberEnd({ day, today }: { day: string | null; today: string }) {
  if (!day) return <>—</>;
  return day < today ? <span className="bd-sub-in">หมดแล้ว {thDateYy(day)}</span> : <>{thDateYy(day)}</>;
}

function Payers({ payers, today }: { payers: BdashPayer[]; today: string }) {
  return (
    <section className="bd-card bd-payers">
      <h3>ใครจ่ายบ้าง</h3>
      <p className="bd-hint">เรียงตามยอดที่จ่ายในช่วงนี้ · จำนวนครั้ง ยอด และแพ็กเป็นของช่วงนี้ · วันหมดสมาชิกเป็นของวันนี้</p>
      {payers.length === 0 ? (
        <p className="bd-hint">ไม่มีใครจ่ายสำเร็จในช่วงนี้</p>
      ) : (
        <>
          <table className="bd-wide">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>จ่าย (ครั้ง)</th>
                <th>รวม (บาท)</th>
                <th>จ่ายล่าสุด</th>
                <th>แพ็กล่าสุด</th>
                <th>สมาชิกถึง</th>
              </tr>
            </thead>
            <tbody>
              {payers.map((p, i) => (
                <tr key={i}>
                  <td className="txt bd-name">{p.name}</td>
                  <td>{int(p.times)}</td>
                  <td>{int(p.baht)}</td>
                  <td className="txt">{thDate(p.lastDay)}</td>
                  <td className="txt">{p.lastPackage}</td>
                  <td className="txt">
                    <MemberEnd day={p.memberEnd} today={today} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bd-list bd-narrow">
            {payers.map((p, i) => (
              <div key={i} className={`bd-item ${extra(i) ?? ""}`}>
                <div className="bd-item-head">
                  <b className="bd-name">{p.name}</b>
                  <span className="num">
                    <b>{int(p.baht)}</b> บาท
                  </span>
                </div>
                <span className="bd-sub">
                  จ่าย {int(p.times)} ครั้ง · ล่าสุด {thDate(p.lastDay)} · {p.lastPackage}
                </span>
                <span className="bd-sub">
                  สมาชิกถึง <MemberEnd day={p.memberEnd} today={today} />
                </span>
              </div>
            ))}
            <ShowAll id="payers-all" total={payers.length} label={(n) => `ดูอีก ${n} คน`} />
          </div>
        </>
      )}
    </section>
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

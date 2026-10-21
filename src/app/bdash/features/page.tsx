// /bdash/features — ฟีเจอร์และ AI (mumate-bdash-v2-001 slice 2): การ์ด C (ฟีเจอร์ละแถว + กราฟความเคลื่อนไหว) และแจก QI มากไปไหม.
import { PEOPLE_FROM, type FeatureCard, type FeatureRow } from "@/lib/bdash/features";
import { loadFeatures, type FeaturesData } from "@/lib/bdash/live";
import type { BdashRange } from "@/lib/bdash/range";
import type { BdashQiDay } from "@/lib/bdash/types";
import { baht, int, qiByWeek, qiFree, ratio, thDate } from "@/lib/bdash/view";

import { LineChart } from "../_ui/charts";
import { bdashMetadata, BdashShell, extra, openBdash, readOrHeavy, ShowAll, TooHeavy, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashFeatures({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  const r = await readOrHeavy(loadFeatures(range));
  return (
    <BdashShell active="features" range={range} at={r?.at ?? null}>
      {r ? <Features d={r.value} range={range} /> : <TooHeavy range={range} />}
    </BdashShell>
  );
}

function Features({ d, range }: { d: FeaturesData; range: BdashRange }) {
  return (
    <section className="bd-grid">
      <CardC card={d.card} activeMembers={d.activeMembers} range={range} />
      <QiCard days={d.qiDays} balance={d.qiBalance} range={range} />
    </section>
  );
}

const share = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const people = (r: FeatureRow) => (r.people === null ? "—" : int(r.people));
const perPerson = (r: FeatureRow) => (r.usesPerPerson === null ? "" : ` (${r.usesPerPerson.toFixed(1)})`);
const why = (r: FeatureRow) => (r.backoffice ? "งานของทีม ไม่มีสมาชิก" : !r.tracked ? "ยังไม่บันทึกว่าใครใช้" : null);

function PaidBar({ r }: { r: FeatureRow }) {
  return (
    <span className="bd-paid">
      <span className="track">
        <span style={{ width: `${Math.round((r.paidShare ?? 0) * 100)}%` }} />
      </span>
      <b className="num">{share(r.paidShare)}</b>
    </span>
  );
}

const SERIES = ["s1", "s2", "s3", "s4"];

function CardC({ card, activeMembers, range }: { card: FeatureCard; activeMembers: number; range: BdashRange }) {
  const per = range.bucket === "day" ? "รายวัน" : "รายสัปดาห์";
  const views = [
    { key: "people", label: "คนใช้", fmt: (v: number) => int(v), top: undefined, pick: (s: FeatureCard["series"][number]) => s.people },
    { key: "thb", label: "ค่า AI", fmt: (v: number) => (v >= 10 ? int(v) : v.toFixed(1)), top: undefined, pick: (s: FeatureCard["series"][number]) => s.thb },
    { key: "paid", label: "% เป็นลูกค้า", fmt: (v: number) => `${Math.round(v * 100)}%`, top: 1, pick: (s: FeatureCard["series"][number]) => s.paidShare },
  ] as const;
  return (
    <div className="bd-card bd-cardc">
      <h3>ฟีเจอร์ไหนคนใช้ ฟีเจอร์ไหนลูกค้าที่จ่ายเงินใช้ และกินค่า AI เท่าไร</h3>
      <p className="bd-hint">
        คนใช้ = คนที่กดดูดวงหรือถามจริง ไม่ใช่แค่เปิดหน้า · &quot;ในนั้นเป็นลูกค้า&quot; = กี่ % เคยจ่ายเงิน (ยิ่งสูงยิ่งดี) · บอกว่าลูกค้าชอบใช้อะไร ยังไม่ได้พิสูจน์ว่าฟีเจอร์ทำให้เขาจ่าย
      </p>
      {card.peoplePartial ? <p className="bd-note">นับคนใช้ได้ตั้งแต่ {thDate(PEOPLE_FROM)} วันที่ระบบเริ่มบันทึก · ก่อนหน้านั้นมีแต่จำนวนครั้งและค่า AI</p> : null}

      {card.rows.length === 0 ? (
        <p className="bd-hint">ไม่มีการใช้ฟีเจอร์ AI ในช่วงนี้</p>
      ) : (
        <>
          <table className="bd-wide">
            <thead>
              <tr>
                <th>ฟีเจอร์</th>
                <th>คนใช้</th>
                <th>ครั้ง (ต่อคน)</th>
                <th>ในนั้นเป็นลูกค้าที่จ่ายเงิน</th>
                <th>ค่า AI (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {card.rows.map((r) => (
                <tr key={r.feature}>
                  <td className="txt">
                    {r.feature}
                    {r.rule || why(r) ? <span className="bd-sub">{r.rule ?? why(r)}</span> : null}
                  </td>
                  <td>{people(r)}</td>
                  <td>
                    {int(r.uses)}
                    <span className="bd-sub-in">{perPerson(r)}</span>
                  </td>
                  <td>{r.tracked && !r.backoffice ? <PaidBar r={r} /> : "—"}</td>
                  <td style={{ fontWeight: 600 }}>{baht(r.thb)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bd-list bd-narrow">
            {card.rows.map((r, i) => (
              <div key={r.feature} className={`bd-item ${extra(i) ?? ""}`}>
                <div className="bd-item-head">
                  <b>{r.feature}</b>
                  <span className="num">
                    <b>{baht(r.thb)}</b> บาท
                  </span>
                </div>
                <span className="bd-sub">
                  {r.people === null ? (why(r) ?? "") : <>คนใช้ <b className="num">{people(r)}</b></>} · <span className="num">{int(r.uses)}</span> ครั้ง{perPerson(r).replace(")", "/คน)")}
                </span>
                {r.tracked && !r.backoffice ? <PaidBar r={r} /> : null}
              </div>
            ))}
            <ShowAll id="feat-all" total={card.rows.length} label={(n) => `ดูอีก ${n} ฟีเจอร์`} />
          </div>
        </>
      )}

      <p className="bd-sub">
        ค่า AI รวม <b className="num">{baht(card.totalThb)}</b> บาท · <b className="num">{int(activeMembers)}</b> คนที่ใช้งาน · เฉลี่ย{" "}
        <b className="num">{(ratio(card.totalThb, activeMembers) ?? 0).toFixed(2)}</b> บาทต่อคน
      </p>

      {card.series.length ? (
        <div className="bd-switch">
          <h4>ความเคลื่อนไหว{per}</h4>
          <div className="bd-seg bd-tabs" role="radiogroup" aria-label="ดูกราฟแบบ">
            {views.map((v, i) => (
              <label key={v.key}>
                <input type="radio" name="cardc-view" value={v.key} defaultChecked={i === 0} />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
          <div className="bd-legend">
            {card.series.map((s, i) => (
              <span key={s.feature}>
                <i className={`dot-${SERIES[i]}`} />
                {s.feature}
              </span>
            ))}
          </div>
          {views.map((v) => (
            <div key={v.key} className={`bd-view view-${v.key}`}>
              <LineChart
                aria={`${v.label} ${per} ของ ${card.series.map((s) => s.feature).join(" ")}`}
                buckets={card.buckets}
                bucket={range.bucket}
                fmt={v.fmt}
                top={v.top}
                markers={card.markers}
                lines={card.series.map((s, i) => ({ key: s.feature, label: s.feature, cls: SERIES[i], values: v.pick(s) }))}
              />
            </div>
          ))}
          <p className="bd-sub">
            เลือก 7/30 วัน = เส้นรายวัน · 90 วันขึ้นไป = รายสัปดาห์ · % เป็นลูกค้า = เฉลี่ยย้อน 4 สัปดาห์ · เส้นประตั้ง = วันที่ทีมเปลี่ยนกติกา
          </p>
        </div>
      ) : null}
    </div>
  );
}

function QiCard({ days, balance, range }: { days: BdashQiDay[]; balance: { median: number }; range: BdashRange }) {
  const points = range.bucket === "day" ? days : qiByWeek(days);
  const sum = (f: (d: BdashQiDay) => number) => days.reduce((n, d) => n + f(d), 0);
  const free = sum(qiFree);
  const spent = sum((d) => d.spend);
  const qiRatio = ratio(free, spent);
  return (
    <div className="bd-card">
      <h3>แจก QI มากเกินไปไหม</h3>
      <p className="bd-hint">
        ถ้าเส้น &quot;ระบบแจกฟรี&quot; อยู่เหนือเส้น &quot;ถูกใช้&quot; นานๆ คนจะมี QI ฟรีเหลือจนไม่ต้องซื้อ · สองเส้นใกล้กัน = สมดุลดี · QI ที่ทีมแจกเองแสดงแยกข้างล่าง
      </p>
      <div className="bd-stats">
        <div className="bd-stat">
          ระบบแจกฟรีรวม<b>{int(free)}</b>
        </div>
        <div className="bd-stat">
          ถูกใช้รวม<b>{int(spent)}</b>
        </div>
        <div className="bd-stat">
          แจกมากกว่าใช้<b>{qiRatio === null ? "—" : `${qiRatio.toFixed(2)} เท่า`}</b>
        </div>
        <div className="bd-stat">
          คนซื้อเอง<b>{int(sum((d) => d.buy))}</b>
        </div>
        <div className="bd-stat">
          ทีมแจกเอง (สุทธิ)<b>{int(sum((d) => d.team))}</b>
        </div>
        <div className="bd-stat">
          ค่ากลาง QI ที่สมาชิกถือ<b>{int(balance.median)}</b>
        </div>
      </div>
      <div className="bd-legend">
        <span>
          <i className="dot-gold" />
          ระบบแจกฟรี (ภารกิจ + กิจกรรม + ชวนเพื่อน)
        </span>
        <span>
          <i className="dot-teal" />
          ถูกใช้
        </span>
      </div>
      <LineChart
        aria={`QI ที่ระบบแจกฟรีเทียบกับ QI ที่ถูกใช้ ${range.bucket === "day" ? "รายวัน" : "รายสัปดาห์"}`}
        buckets={points.map((d) => d.day)}
        bucket={range.bucket}
        fmt={(v) => int(v)}
        lines={[
          { key: "free", label: "ระบบแจกฟรี", cls: "gold", values: points.map(qiFree) },
          { key: "spend", label: "ถูกใช้", cls: "teal", values: points.map((d) => d.spend) },
        ]}
      />
    </div>
  );
}

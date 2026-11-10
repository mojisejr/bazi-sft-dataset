// /bdash/ebook — ขาย E-Book (mumate-manychat-ebook-001 slice 4, plan 0.7, แบบ 1 ที่เจ้าของเลือก 2026-11-11):
// หน้าตาตามหน้าที่ทีมทำเอง เท่าที่ข้อมูลของบอทมี · ค่าแอด ต้นทุนต่อคนซื้อ กำไรขาดทุน และแอดที่วิ่งอยู่มาใน slice 5 (Meta).
// นับเป็นจำนวนอย่างเดียว ไม่มีชื่อหรือ id ของลูกค้า · ไม่มี JavaScript ฝั่งเครื่อง.
import { EBOOK_FROM, EBOOK_PRICE, type Choice, type EbookCard } from "@/lib/bdash/ebook";
import { loadEbook } from "@/lib/bdash/live";
import { EBOOK_DEFAULT, EBOOK_PRESETS, weekOf, type BdashRange } from "@/lib/bdash/range";
import { int, thDate, thRange } from "@/lib/bdash/view";

import { BarChart, HourChart } from "../_ui/charts";
import { bdashMetadata, BdashShell, Kpi, openBdash, readOrHeavy, TooHeavy, type SearchParams } from "../_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashEbook({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams, { presets: EBOOK_PRESETS, def: EBOOK_DEFAULT });
  const r = await readOrHeavy(loadEbook(range));
  return (
    <BdashShell active="ebook" range={range} at={r?.at ?? null} presets={EBOOK_PRESETS}>
      {r ? <Ebook c={r.value} range={range} /> : <TooHeavy range={range} />}
    </BdashShell>
  );
}

const share = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}`);

function Ebook({ c, range }: { c: EbookCard; range: BdashRange }) {
  const worst = c.funnel.find((s) => s.worst);
  const topReason = c.reasons[0];
  return (
    <>
      {c.partial ? <p className="bd-note">บอทเริ่มตรวจสลิปให้ทุกคนตั้งแต่ {thDate(EBOOK_FROM)} · ก่อนหน้านั้นแอดมินตรวจเอง ยอดช่วงนั้นไม่อยู่ในหน้านี้</p> : null}
      <div className="bd-hero">
        <span className="eyebrow">{thRange(range.from, range.to)}</span>
        <p>
          ขายได้ <b>{int(c.sold)}</b> เล่ม เงินเข้า <b>{int(c.baht)}</b> บาท
          {worst && worst.drop !== null ? ` · หลุดมากที่สุดก่อน${worst.label} (${share(worst.drop)}%)` : ""}
          {topReason ? ` · เหตุผลที่ไม่โอนอันดับหนึ่งคือ “${topReason.label}”` : ""}
        </p>
      </div>

      <div className="bd-kpis">
        <Kpi icon="book" label="ขายได้" big={int(c.sold)} unit="เล่ม" dir="ยิ่งสูงยิ่งดี">
          ธนาคารยืนยันแล้วทุกใบ
        </Kpi>
        <Kpi icon="coin" label="เงินเข้า" big={int(c.baht)} unit="บาท" dir="ยิ่งสูงยิ่งดี">
          ยังไม่หักค่าแอด · ราคาเล่มละ {EBOOK_PRICE} บาท
        </Kpi>
        <Kpi icon="loop" label="กดซื้อแล้วส่งสลิป" big={share(c.payRate)} unit="%" dir="ยิ่งสูงยิ่งดี">
          {int(c.slipPeople)} จาก {int(c.buyers)} คน
        </Kpi>
        <Kpi icon="card" label="สลิปตรวจไม่ผ่าน" big={int(c.rejected + c.toAdmin)} unit="ใบ" dir="ยิ่งต่ำยิ่งดี">
          ส่งให้แอดมินดูต่อในแชต
        </Kpi>
      </div>

      <section className="bd-grid">
        <div className="bd-card">
          <h3>คนหลุดตรงไหนมากที่สุด</h3>
          <p className="bd-hint">นับเป็นคน ไม่นับซ้ำ · สีแดงคือขั้นที่หลุดมากที่สุด · นับคนทักเข้าไม่ได้ (ManyChat ส่งต่อจากข้อความแรกไม่ได้) จึงเริ่มที่กดสั่งซื้อ</p>
          <div className="bd-funnel">
            {c.funnel.map((s) => {
              const top = Math.max(1, ...c.funnel.map((x) => x.people));
              return (
                <div key={s.key} className={`bd-step ${s.worst ? "worst" : ""}`}>
                  <div className="bd-step-head">
                    <b>{s.label}</b>
                    <span className="bd-sub-in">{s.hint}</span>
                    {s.drop !== null && s.drop > 0 ? <span className={`bd-pill ${s.worst ? "down" : ""}`}>หลุด {share(s.drop)}%</span> : null}
                  </div>
                  <div className="bd-paid">
                    <span className="track">
                      <span style={{ width: `${(s.people / top) * 100}%` }} />
                    </span>
                    <b className="num">{int(s.people)}</b>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="bd-hint">ดูตัวอย่างหนังสือ {int(c.samplers)} คน (นับแยก คนกดซื้อได้โดยไม่ต้องดูตัวอย่าง)</p>
        </div>

        <div className="bd-card">
          <h3>ทำไมคนกดซื้อแล้วไม่โอน</h3>
          <p className="bd-hint">
            ปุ่มที่กดในข้อความติดตาม 30 นาทีหลังกดซื้อ · ได้ข้อความนี้ {int(c.asked)} คน กดตอบ {int(c.answered)} คน
          </p>
          <Choices rows={c.reasons} empty="ยังไม่มีใครกดเลือกเหตุผลในช่วงนี้" color="var(--bd-s2)" />
        </div>

        <div className="bd-card">
          <h3>คนโอนต่อ{range.bucket === "day" ? "วัน" : "สัปดาห์"}</h3>
          <p className="bd-hint">นับตามเวลาเงินเข้าบนสลิป · ยิ่งสูงยิ่งดี</p>
          <BarChart
            bars={c.days.map((d) => ({
              key: d.day,
              label: range.bucket === "day" ? thDate(d.day) : `${thDate(weekOf(d.day))}`,
              value: d.sold,
              partial: false,
              valueText: int(d.sold),
              tip: `${thDate(d.day)}: ขาย ${int(d.sold)} เล่ม ${int(d.baht)} บาท · กดซื้อ ${int(d.buyers)} คน`,
            }))}
            fmt={(v) => int(v)}
            floor={4}
            aria="คนโอนต่อวัน"
          />
        </div>

        <div className="bd-card">
          <h3>ก่อนซื้อ คนสงสัยเรื่องอะไร</h3>
          <p className="bd-hint">นับคนที่กดแต่ละข้อในเมนูคำถามที่พบบ่อย</p>
          <Choices rows={c.faq} empty="ยังไม่มีใครเปิดคำถามในช่วงนี้" color="var(--bd-s4)" />
        </div>

        <div className="bd-card">
          <h3>โค้ดแถมถูกใช้แค่ไหน</h3>
          <p className="bd-hint">โค้ด mumate plus 1 เดือน ใช้โค้ดเดียวกันทุกคน จึงบอกได้แค่จำนวน ไม่รู้ว่าใครกรอก · ยิ่งสูงยิ่งดี</p>
          <div className="bd-stats">
            <div className="bd-stat">
              ส่งโค้ดไป<b>{int(c.coupon.sent)} คน</b>
            </div>
            <div className="bd-stat">
              กรอกโค้ดแล้ว<b>{c.coupon.redeemed === null ? "—" : `${int(c.coupon.redeemed)} คน`}</b>
              <span className="bd-sub">{c.coupon.redeemed === null ? "ไม่พบโค้ดในระบบแลกโค้ด" : "กรอกในช่วงนี้ (อาจได้โค้ดก่อนช่วง)"}</span>
            </div>
          </div>
        </div>

        <div className="bd-card bd-wait">
          <h3>รอเชื่อม Meta</h3>
          <p className="bd-hint">เมื่อทีมส่ง token ของ Meta มา ส่วนนี้จะขึ้นในหน้านี้</p>
          <ul>
            <li>แสดงแอด คนเห็น กดแอด เริ่มแชท</li>
            <li>ค่าแอดต่อวัน และต้นทุนต่อคนซื้อเทียบเป้า</li>
            <li>กำไรขาดทุน (ค่าแอด VAT ManyChat Slip2Go)</li>
            <li>แอดที่วิ่งอยู่ พร้อมสถานะ ผ่าน / ไม่ผ่าน</li>
          </ul>
        </div>

        <div className="bd-card">
          <h3>คนกดซื้อและคนโอน ตามชั่วโมง</h3>
          <p className="bd-hint">รวมทุกวันในช่วงนี้ เวลาไทย · ช่วงแรเงาคือ 22:00–07:00 ที่ทีมแนะนำให้ปิดแอด · คนโอนนับตามเวลาเงินเข้า</p>
          <div className="bd-legend">
            <span>
              <i className="dot-a" />
              กดซื้อ (ครั้ง)
            </span>
            <span>
              <i className="dot-b" />
              คนโอน (ใบ)
            </span>
            <span>
              <i className="dot-quiet" />
              22:00–07:00
            </span>
          </div>
          <HourChart
            hours={c.hours.map((h) => ({ hour: h.hour, a: h.buys, b: h.sold, quiet: h.quiet }))}
            aria="คนกดซื้อและคนโอนตามชั่วโมง"
            tip={(h) => `${String(h.hour).padStart(2, "0")}:00–${String(h.hour).padStart(2, "0")}:59 · กดซื้อ ${int(h.a)} ครั้ง · โอน ${int(h.b)} ใบ`}
          />
        </div>
      </section>
    </>
  );
}

function Choices({ rows, empty, color }: { rows: Choice[]; empty: string; color: string }) {
  if (rows.length === 0) return <p className="bd-hint">{empty}</p>;
  const top = Math.max(1, ...rows.map((r) => r.people));
  return (
    <div className="bd-list">
      {rows.map((r) => (
        <div key={r.label} className="bd-paid">
          <span style={{ minWidth: "10.5em", fontSize: "13.5px" }}>{r.label}</span>
          <span className="track">
            <span style={{ width: `${(r.people / top) * 100}%`, background: color }} />
          </span>
          <b className="num">{int(r.people)}</b>
        </div>
      ))}
    </div>
  );
}

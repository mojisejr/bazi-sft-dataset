// /bdash — ภาพรวม (mumate-bdash-v2-001 slice 2). อ่านอย่างเดียว · อ่านสดตามช่วงที่เลือก (src/lib/bdash/live.ts).
// เปิดได้ผ่าน host ของ bdash (Caddy ติดป้าย x-mumate-backstage: bdash → ประตู BDASH_KEY ใน src/proxy.ts) หรือ
// host หลังบ้าน (BACKSTAGE_KEY). คำขอที่ไม่ผ่าน host ไหนเลย (เรียกภายใน) ได้ 404 บน production.
import { PEOPLE_FROM } from "@/lib/bdash/features";
import { loadOverview, type OverviewData } from "@/lib/bdash/live";
import { withRange, type BdashRange } from "@/lib/bdash/range";
import { BDASH_RETENTION_FROM } from "@/lib/bdash/types";
import { baht, int, kpis, paymentToWatch, pct, points, ratio, thDate } from "@/lib/bdash/view";

import { bdashMetadata, BdashShell, Kpi, menu, openBdash, readOrHeavy, TooHeavy, type MenuKey, type SearchParams } from "./_ui/shell";

export const dynamic = "force-dynamic";
export const metadata = bdashMetadata;

export default async function BdashOverview({ searchParams }: { searchParams: SearchParams }) {
  const range = await openBdash(searchParams);
  const r = await readOrHeavy(loadOverview(range));
  return (
    <BdashShell active="overview" range={range} at={r?.at ?? null}>
      {r ? <Overview d={r.value} range={range} /> : <TooHeavy range={range} />}
    </BdashShell>
  );
}

function Overview({ d, range }: { d: OverviewData; range: BdashRange }) {
  const k = kpis(d);
  const watch = paymentToWatch(d.payments);
  const created = d.payments.reduce((n, p) => n + p.created, 0);
  const approved = d.payments.reduce((n, p) => n + p.approved, 0);
  const used = d.card.rows.filter((r) => (r.people ?? 0) > 0);
  const mostUsed = used[0];
  const mostPaid = used.filter((r) => (r.people ?? 0) >= 5).sort((a, b) => (b.paidShare ?? 0) - (a.paidShare ?? 0))[0];
  const link = (key: MenuKey) => withRange(menu(key).path, range);

  return (
    <>
      <section className="bd-hero">
        <span className="eyebrow">สรุปสั้นๆ</span>
        <p>
          {k.d7Latest !== null ? (
            <>
              ช่วงนี้คนกลับมาใช้ในสัปดาห์ที่ 2 <b>{pct(k.d7Latest)}</b>
              {k.d7Delta !== null && Math.abs(k.d7Delta) >= 0.0005 ? (
                <>
                  {" "}
                  {k.d7Delta > 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(k.d7Delta * 100).toFixed(1)} จุด
                </>
              ) : null}
            </>
          ) : (
            <>ยังไม่มีกลุ่มที่ครบ 2 สัปดาห์หลังสมัคร</>
          )}
          {created > 0 ? (
            <>
              {" "}· กดจ่ายสำเร็จ <b>{pct(k.paySuccess)}</b>
            </>
          ) : (
            <> · ช่วงนี้ยังไม่มีการกดจ่าย</>
          )}
          {watch ? (
            <>
              {" "}· {watch.method}
              {watch.reason === "expired" ? "หมดเวลาก่อนจ่าย" : "ถูกปฏิเสธ"} {int(watch.n)} จาก {int(watch.created)} ครั้ง ควรดู
            </>
          ) : null}
        </p>
      </section>

      <section className="bd-kpis">
        <Kpi icon="loop" label="สมัครแล้ว สัปดาห์ที่ 2 ยังกลับมาใช้" big={pct(k.d7Latest)} dir="ยิ่งสูงยิ่งดี" href={link("stay")} go={menu("stay").label}>
          {k.d7Delta !== null ? (
            <>
              <span className={`bd-pill ${k.d7Delta >= 0 ? "up" : "down"}`}>{points(k.d7Delta)}</span> เทียบกลุ่มสัปดาห์ก่อนหน้า
            </>
          ) : (
            <>ยังไม่มีกลุ่มก่อนหน้าให้เทียบ</>
          )}
        </Kpi>
        <Kpi icon="coin" label="คนสมัครฟรีที่ยอมจ่ายเงิน ภายใน 5 สัปดาห์แรก" big={pct(k.conv35)} dir="ยิ่งสูงยิ่งดี" href={link("stay")} go={menu("stay").label}>
          {k.conv35FirstReady ? <>กลุ่มแรกครบ 5 สัปดาห์วันที่ {thDate(k.conv35FirstReady)}</> : <>แอปแบบนี้ในแถบเรา ค่ากลางราว 1.4%</>}
        </Kpi>
        <Kpi icon="card" label="กดจ่ายแล้วจ่ายสำเร็จ" big={pct(k.paySuccess)} dir="ยิ่งสูงยิ่งดี" href={link("money")} go={menu("money").label}>
          QR หมดเวลาก่อนจ่าย <span className="bd-pill">{pct(k.expiredShare)}</span>
        </Kpi>
        <Kpi
          icon="chat"
          label="ค่า AI ที่เราจ่าย ต่อคนที่ใช้งาน"
          big={k.aiPerActive === null ? "—" : baht(k.aiPerActive)}
          unit="บาท"
          dir="ยิ่งต่ำยิ่งดี"
          href={link("features")}
          go={menu("features").label}
        >
          รวม {baht(d.ai.totalThb)} บาท · {int(d.ai.activeMembers)} คนที่ใช้งาน
        </Kpi>
      </section>

      <section className="bd-links">
        <a className="bd-link" href={link("money")}>
          <span>
            <b>กดจ่ายแล้ว ติดตรงไหน</b>
            <span>{created > 0 ? `กดจ่าย ${int(created)} ครั้ง · สำเร็จ ${pct(ratio(approved, created))}` : "ช่วงนี้ยังไม่มีการกดจ่าย"}</span>
          </span>
          <i aria-hidden="true">›</i>
        </a>
        <a className="bd-link" href={link("features")}>
          <span>
            <b>ฟีเจอร์ไหนคนใช้ และคุ้มค่า AI ไหม</b>
            <span>
              {mostUsed
                ? `${mostUsed.feature}คนใช้มากสุด${mostPaid && mostPaid.feature !== mostUsed.feature ? ` · ${mostPaid.feature}มีลูกค้าจ่ายเงินสัดส่วนสูงสุด` : ""}`
                : `เริ่มนับคนใช้ตั้งแต่ ${thDate(PEOPLE_FROM)}`}
            </span>
          </span>
          <i aria-hidden="true">›</i>
        </a>
        <a className="bd-link" href={link("chat")}>
          <span>
            <b>คนถามแชตเรื่องอะไร</b>
            <span>เริ่มเก็บหัวข้อแล้วตั้งแต่ {thDate(PEOPLE_FROM)} · การ์ดนี้ตามมาในรอบถัดไป</span>
          </span>
          <i aria-hidden="true">›</i>
        </a>
      </section>

      <p className="bd-foot">
        ตัวเลขอ่านสดจากฐานข้อมูลของแอปตามช่วงที่เลือก และเก็บไว้ 10 นาที · &quot;กลับมาใช้&quot; นับจากสิ่งที่ระบบบันทึกเป็นรายคน (ทำภารกิจ, ได้หรือใช้ QI, แชร์, กดจ่าย,
        manifest) ไม่ใช่การเปิดแอปเฉยๆ ตัวเลขจึงต่ำกว่าจริง และนับเฉพาะคนที่สมัครตั้งแต่ {thDate(BDASH_RETENTION_FROM)} · คนใช้ต่อฟีเจอร์นับได้ตั้งแต่ {thDate(PEOPLE_FROM)} ·
        ค่า AI คิดจากตารางราคาของ bazi ที่ 1 ดอลลาร์ = 32 บาท ไม่รวมการใช้คีย์ของผู้ใช้เอง · ยังไม่มี: คนมาจากช่องทางไหน (โฆษณา/ชวนเพื่อน), ประวัติการเข้าแอป,
        วันที่เงินเข้าจริงและการคืนเงิน, การเทียบกับ GA4
      </p>
    </>
  );
}

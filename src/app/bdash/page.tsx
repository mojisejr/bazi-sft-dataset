// /bdash — ภาพรวมธุรกิจสำหรับทีม business (mumate-business-metrics-001). อ่านอย่างเดียว.
// เปิดได้ผ่าน host ของ bdash (Caddy ติดป้าย x-mumate-backstage: bdash → ประตู BDASH_KEY ใน src/proxy.ts) หรือ
// host หลังบ้าน (BACKSTAGE_KEY). คำขอที่ไม่ผ่าน host ไหนเลย (เรียกภายใน) ได้ 404 บน production.
// หน้านี้อ่านแถวล่าสุดของ bdash_snapshot แถวเดียว — ตัวเลขคำนวณไว้แล้วตอนตี 3 (/api/cron/bdash-snapshot).
import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { createDbClient } from "@/db/client";
import { bdashSnapshot } from "@/db/schema";
import { doorOf } from "@/lib/backstage/gate";
import type { BdashCohort, BdashQiDay, BdashSnapshot } from "@/lib/bdash/types";
import {
  baht,
  failureTh,
  GATEWAY_TH,
  int,
  kpis,
  METHOD_TH,
  pct,
  points,
  qiFree,
  ratio,
  thDate,
} from "@/lib/bdash/view";

import "./bdash.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "MuMate ภาพรวมธุรกิจ", robots: { index: false, follow: false } };

/** ค่ากลางของแอปแบบ freemium ในเอเชียตะวันออกเฉียงใต้ (RevenueCat 2026) — เส้นอ้างอิงในกราฟ */
const SEA_FREE_TO_PAID = 0.014;

export default async function BdashPage() {
  const h = await headers();
  if (!doorOf(h) && process.env.NODE_ENV === "production") notFound();

  const db = createDbClient();
  const [row] = await db.select().from(bdashSnapshot).orderBy(desc(bdashSnapshot.asOf)).limit(1);
  const snap = row?.payload as BdashSnapshot | undefined;

  return (
    <div className="bd-page">
      <div className="bd">
        <Header asOf={snap?.asOf ?? null} />
        {snap ? <Body s={snap} /> : <p className="bd-empty">ยังไม่มีตัวเลข — ระบบคำนวณครั้งแรกตอนตี 3 คืนนี้ แล้วหน้านี้จะแสดงข้อมูลของเมื่อวาน</p>}
      </div>
    </div>
  );
}

function Header({ asOf }: { asOf: string | null }) {
  return (
    <div className="bd-top">
      <div className="bd-brand">
        <div className="bd-logo" aria-hidden="true">mu</div>
        <div>
          <h1>ภาพรวมธุรกิจ MuMate</h1>
          <p>สำหรับทีม business · อ่านอย่างเดียว</p>
        </div>
      </div>
      <div className="bd-chips">
        <span className="bd-chip">
          <span className="dot" />
          ข้อมูลถึง <span className="num">{asOf ? thDate(asOf) : "—"}</span> · อัปเดตทุกตี 3
        </span>
      </div>
    </div>
  );
}

function Body({ s }: { s: BdashSnapshot }) {
  const k = kpis(s);
  const freeTotal = s.qiDaily.reduce((n, d) => n + qiFree(d), 0);
  const spentTotal = s.qiDaily.reduce((n, d) => n + d.spend, 0);
  const boughtTotal = s.qiDaily.reduce((n, d) => n + d.buy, 0);
  const teamTotal = s.qiDaily.reduce((n, d) => n + d.team, 0);
  const qiRatio = ratio(freeTotal, spentTotal);

  return (
    <>
      <section className="bd-hero">
        <span className="eyebrow">สรุปสั้นๆ</span>
        <p>
          {k.d7Latest !== null && k.d7Week ? (
            <>
              คนที่สมัครสัปดาห์ของ {thDate(k.d7Week)} กลับมาใช้ในสัปดาห์ที่ 2 <b>{pct(k.d7Latest)}</b>{" "}
            </>
          ) : (
            <>ยังไม่มีกลุ่มที่ครบ 2 สัปดาห์หลังสมัคร </>
          )}
          {k.conv35 !== null ? (
            <>
              คนสมัครฟรียอมจ่ายเงินภายใน 5 สัปดาห์ <b>{pct(k.conv35)}</b>{" "}
            </>
          ) : null}
          และคนที่กดจ่ายใน 30 วันล่าสุดจ่ายสำเร็จ <b>{pct(k.paySuccess)}</b>
        </p>
      </section>

      <section className="bd-kpis">
        <Kpi icon="loop" label="สมัครแล้ว สัปดาห์ที่ 2 ยังกลับมาใช้" big={pct(k.d7Latest)} dir="ยิ่งสูงยิ่งดี">
          {k.d7Delta !== null ? (
            <>
              <span className={`bd-pill ${k.d7Delta >= 0 ? "up" : "down"}`}>{points(k.d7Delta)}</span> เทียบกลุ่มสัปดาห์ก่อนหน้า
            </>
          ) : (
            <>ยังไม่มีกลุ่มก่อนหน้าให้เทียบ</>
          )}
        </Kpi>
        <Kpi icon="coin" label="คนสมัครฟรีที่ยอมจ่ายเงิน ภายใน 5 สัปดาห์แรก" big={pct(k.conv35)} dir="ยิ่งสูงยิ่งดี">
          {k.conv35FirstReady ? <>กลุ่มแรกครบ 5 สัปดาห์วันที่ {thDate(k.conv35FirstReady)}</> : <>แอปแบบนี้ในแถบเรา ค่ากลางราว 1.4%</>}
        </Kpi>
        <Kpi icon="card" label="กดจ่ายแล้วจ่ายสำเร็จ · 30 วันล่าสุด" big={pct(k.paySuccess)} dir="ยิ่งสูงยิ่งดี">
          QR หมดเวลาก่อนจ่าย <span className="bd-pill">{pct(k.expiredShare)}</span>
        </Kpi>
        <Kpi icon="chat" label="ค่า AI ที่เราจ่าย ต่อคนที่ใช้งาน · 30 วันล่าสุด" big={k.aiPerActive === null ? "—" : baht(k.aiPerActive)} unit="บาท" dir="ยิ่งต่ำยิ่งดี">
          รวม {baht(s.ai.totalThb)} บาท · {int(s.ai.activeMembers)} คนที่ใช้งาน
        </Kpi>
      </section>

      <section className="bd-sec">
        <h2>คนที่สมัครเข้ามา อยู่ต่อไหม และยอมจ่ายไหม</h2>
        <div className="bd-grid">
          <div className="bd-card">
            <h3>สมัครแล้ว กลับมาใช้อีกไหม</h3>
            <p className="bd-hint">
              แต่ละแถว = คนที่สมัครในสัปดาห์นั้น · ตัวเลข = กี่ % ของกลุ่มนั้นกลับมาทำอะไรสักอย่างในแอป · สีเข้ม = กลับมาเยอะ · ขีด = ยังไม่ถึงช่วงนั้น
            </p>
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
                  {s.cohorts.map((c) => (
                    <tr key={c.week}>
                      <td className="txt">{thDate(c.week)}</td>
                      <td>{int(c.signups)}</td>
                      <Heat c={c} n={c.d1} max={0.45} />
                      <Heat c={c} n={c.d7} max={0.2} />
                      <Heat c={c} n={c.d30} max={0.1} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bd-card">
            <h3>คนสมัครฟรี ยอมจ่ายเงินไหม</h3>
            <p className="bd-hint">
              แต่ละแท่ง = คนที่สมัครในสัปดาห์นั้น จ่ายเงินครั้งแรกภายใน 5 สัปดาห์กี่ % · แท่งเส้นประ = ยังไม่ครบ 5 สัปดาห์ ตัวเลขยังขึ้นได้อีก · เส้นทอง = ค่ากลางของแอปแบบนี้ในแถบเรา · ชี้ที่แท่งเพื่อดูว่ากี่วันกว่าจะจ่าย
            </p>
            <ConvChart cohorts={s.cohorts} />
          </div>
        </div>
      </section>

      <section className="bd-sec">
        <h2>เงินเข้าจริง</h2>
        <div className="bd-card">
          <h3>กดจ่ายแล้ว ติดตรงไหน · 30 วันล่าสุด</h3>
          <p className="bd-hint">แยกตามวิธีจ่ายและผู้รับเงิน (Beam / Omise) · ตัวเลขมาจากผลที่ผู้รับเงินแจ้งกลับมา</p>
          <div className="bd-legend">
            <span><i style={{ background: "var(--bd-ok)" }} />จ่ายสำเร็จ</span>
            <span><i style={{ background: "var(--bd-bad)" }} />ธนาคาร/บัตรปฏิเสธ</span>
            <span><i style={{ background: "var(--bd-gold-a)" }} />QR หมดเวลา</span>
            <span><i style={{ background: "var(--bd-line)" }} />ยังรอผล</span>
          </div>
          <div className="bd-scroll">
            <table>
              <thead>
                <tr>
                  <th>วิธีจ่าย</th>
                  <th>ผู้รับเงิน</th>
                  <th>กดจ่าย</th>
                  <th>จ่ายสำเร็จ</th>
                  <th>ธนาคาร/บัตรปฏิเสธ</th>
                  <th>QR หมดเวลา</th>
                  <th>ยังรอผล</th>
                  <th>สำเร็จ %</th>
                  <th>สัดส่วน</th>
                  <th>สาเหตุที่ไม่สำเร็จบ่อยสุด</th>
                </tr>
              </thead>
              <tbody>
                {s.payments.length === 0 ? (
                  <tr>
                    <td className="txt" colSpan={10}>ไม่มีการกดจ่ายใน 30 วันนี้</td>
                  </tr>
                ) : (
                  s.payments.map((p) => {
                    const r = ratio(p.approved, p.created);
                    const w = (n: number) => `${(n / p.created) * 100}%`;
                    return (
                      <tr key={`${p.method}|${p.gateway}`}>
                        <td className="txt">{METHOD_TH[p.method] ?? p.method}</td>
                        <td className="txt">{GATEWAY_TH[p.gateway] ?? p.gateway}</td>
                        <td>{int(p.created)}</td>
                        <td>{int(p.approved)}</td>
                        <td>{int(p.rejected)}</td>
                        <td>{int(p.expired)}</td>
                        <td>{int(p.waiting)}</td>
                        <td style={{ fontWeight: 600, color: r === null ? undefined : r >= 0.8 ? "var(--bd-ok)" : r < 0.7 ? "var(--bd-bad)" : undefined }}>{pct(r)}</td>
                        <td>
                          <div className="bd-stack">
                            <span style={{ width: w(p.approved), background: "var(--bd-ok)" }} />
                            <span style={{ width: w(p.rejected), background: "var(--bd-bad)" }} />
                            <span style={{ width: w(p.expired), background: "var(--bd-gold-a)" }} />
                            <span style={{ width: w(p.waiting), background: "var(--bd-line)" }} />
                          </div>
                        </td>
                        <td className="txt">{failureTh(p.topFailure)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bd-sec">
        <h2>QI และค่าใช้จ่าย AI</h2>
        <div className="bd-grid">
          <div className="bd-card">
            <h3>แจก QI มากเกินไปไหม · 28 วันล่าสุด</h3>
            <p className="bd-hint">
              ถ้าเส้น &quot;ระบบแจกฟรี&quot; อยู่เหนือเส้น &quot;ถูกใช้&quot; นานๆ คนจะมี QI ฟรีเหลือจนไม่ต้องซื้อ · สองเส้นใกล้กัน = สมดุลดี · QI ที่ทีมแจกเองแสดงแยกข้างล่าง
            </p>
            <div className="bd-stats">
              <div className="bd-stat">ระบบแจกฟรีรวม<b>{int(freeTotal)}</b></div>
              <div className="bd-stat">ถูกใช้รวม<b>{int(spentTotal)}</b></div>
              <div className="bd-stat">แจกมากกว่าใช้<b>{qiRatio === null ? "—" : `${qiRatio.toFixed(2)} เท่า`}</b></div>
              <div className="bd-stat">คนซื้อเอง<b>{int(boughtTotal)}</b></div>
              <div className="bd-stat">ทีมแจกเอง (สุทธิ)<b>{int(teamTotal)}</b></div>
              <div className="bd-stat">ค่ากลาง QI ที่สมาชิกถือ<b>{int(s.qiBalance.median)}</b></div>
            </div>
            <div className="bd-legend">
              <span><i style={{ background: "var(--bd-gold-a)" }} />ระบบแจกฟรี (ภารกิจ + กิจกรรม + ชวนเพื่อน)</span>
              <span><i style={{ background: "var(--bd-teal)" }} />ถูกใช้</span>
            </div>
            <QiChart days={s.qiDaily} />
          </div>
          <div className="bd-card">
            <h3>AI กินเงินเท่าไร · 30 วันล่าสุด</h3>
            <p className="bd-hint">
              ค่าใช้จ่ายที่เราจ่ายให้ผู้ให้บริการ AI แยกตามฟีเจอร์ · ระบบไม่ได้บันทึกว่าใครเป็นคนใช้ จึงดูได้แค่ยอดรวมและเฉลี่ยต่อคนที่ใช้งาน
            </p>
            <div className="bd-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ฟีเจอร์</th>
                    <th>ครั้งที่เรียก AI</th>
                    <th>ล้าน token</th>
                    <th>ค่า AI (บาท)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.ai.features.map((f) => (
                    <tr key={f.feature}>
                      <td className="txt">{f.feature}</td>
                      <td>{int(f.calls)}</td>
                      <td>{(f.tokens / 1_000_000).toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>{baht(f.thb)}</td>
                      <td style={{ minWidth: "6rem" }}>
                        <span className="bd-mini" style={{ width: `${s.ai.totalThb > 0 ? (f.thb / s.ai.totalThb) * 100 : 0}%` }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <p className="bd-foot">
        ตัวเลขอัปเดตวันละครั้งตอนตี 3 จากฐานข้อมูลของแอป หน้านี้ไม่ทำให้แอปช้าลง · &quot;กลับมาใช้&quot; นับจากสิ่งที่ระบบบันทึกเป็นรายคน (ทำภารกิจ, ได้หรือใช้ QI, แชร์, กดจ่าย, manifest) ไม่ใช่การเปิดแอปเฉยๆ ตัวเลขจึงต่ำกว่าจริง
        และนับเฉพาะคนที่สมัครตั้งแต่ {thDate(s.retentionFrom)} · ค่า AI คิดจากตารางราคาของ bazi ที่ 1 ดอลลาร์ = 32 บาท ไม่รวมการใช้คีย์ของผู้ใช้เอง · ยังไม่มีในรุ่นแรก:
        คนมาจากช่องทางไหน (โฆษณา/ชวนเพื่อน), ประวัติการเข้าแอป, วันที่เงินเข้าจริงและการคืนเงิน, การเทียบกับ GA4
      </p>
    </>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  loop: (
    <>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5" />
      <path d="M12 6.5v1.5M12 16v1.5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" />
    </>
  ),
};

function Kpi(props: { icon: string; label: string; big: string; unit?: string; dir: string; children: React.ReactNode }) {
  return (
    <div className="bd-kpi">
      <div className="head">
        <span className="bd-ico">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[props.icon]}
          </svg>
        </span>
        <span className="label">{props.label}</span>
      </div>
      <span className="big">
        {props.big}
        {props.unit ? <span className="unit">{props.unit}</span> : null}
      </span>
      <span className="sub">{props.children}</span>
      <span className="bd-dir">{props.dir}</span>
    </div>
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

const W = 560;
const H = 230;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p;
}

function ConvChart({ cohorts }: { cohorts: BdashCohort[] }) {
  const rows = cohorts.filter((c) => c.signups > 0);
  if (rows.length === 0) return <p className="bd-hint">ยังไม่มีข้อมูล</p>;
  const m = { t: 24, r: 8, b: 28, l: 40 };
  const top = niceMax(Math.max(0.04, ...rows.map((c) => (c.paid35 / c.signups) * 1.25)));
  const y = (v: number) => H - m.b - (v / top) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / rows.length;
  const bw = Math.min(36, band * 0.6);
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  return (
    <div className="bd-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="กี่ % ของคนที่สมัครแต่ละสัปดาห์ จ่ายเงินภายใน 5 สัปดาห์">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
            <text className="tick" x={m.l - 8} y={y(t)} dy=".32em" textAnchor="end">{`${Math.round(t * 1000) / 10}%`}</text>
          </g>
        ))}
        {rows.map((c, i) => {
          const v = c.paid35 / c.signups;
          const x = m.l + i * band + (band - bw) / 2;
          const tip = `สมัครสัปดาห์ของ ${thDate(c.week)}: จ่ายเงิน ${int(c.paid35)} จาก ${int(c.signups)} คน (${pct(v)})${
            c.medianDaysToPay === null ? "" : ` · ใช้เวลาประมาณ ${Math.round(c.medianDaysToPay)} วัน`
          }${c.paid35Complete ? "" : " · ยังไม่ครบ 5 สัปดาห์"}`;
          return (
            <g key={c.week}>
              <rect className={c.paid35Complete ? "bar" : "bar partial"} x={x} width={bw} y={y(v)} height={Math.max(0, y(0) - y(v))} rx={10}>
                <title>{tip}</title>
              </rect>
              <text className="val" x={x + bw / 2} y={y(v) - 6} textAnchor="middle">{pct(v)}</text>
              <text className="tick" x={x + bw / 2} y={H - 8} textAnchor="middle">{thDate(c.week)}</text>
            </g>
          );
        })}
        <line className="ref" x1={m.l} x2={W - m.r} y1={y(SEA_FREE_TO_PAID)} y2={y(SEA_FREE_TO_PAID)} />
        <text className="tick" x={W - m.r} y={y(SEA_FREE_TO_PAID) - 6} textAnchor="end">ค่ากลางแถบเรา 1.4%</text>
      </svg>
    </div>
  );
}

function QiChart({ days }: { days: BdashQiDay[] }) {
  if (days.length < 2) return <p className="bd-hint">ยังไม่มีข้อมูล</p>;
  const m = { t: 12, r: 12, b: 28, l: 48 };
  const top = niceMax(Math.max(1, ...days.map((d) => Math.max(qiFree(d), d.spend)) ) * 1.1);
  const x = (i: number) => m.l + (i / (days.length - 1)) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v / top) * (H - m.t - m.b);
  const path = (val: (d: BdashQiDay) => number) => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(val(d)).toFixed(1)}`).join("");
  const ticks = [0, top / 4, top / 2, (top * 3) / 4, top];
  const labelEvery = Math.ceil(days.length / 5);
  const slot = (W - m.l - m.r) / (days.length - 1);
  return (
    <div className="bd-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="QI ที่ระบบแจกฟรีเทียบกับ QI ที่ถูกใช้ รายวัน">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
            <text className="tick" x={m.l - 8} y={y(t)} dy=".32em" textAnchor="end">{int(t)}</text>
          </g>
        ))}
        {days.map((d, i) =>
          i % labelEvery === 0 || i === days.length - 1 ? (
            <text key={d.day} className="tick" x={x(i)} y={H - 8} textAnchor="middle">{thDate(d.day)}</text>
          ) : null,
        )}
        <path className="line-a" d={path(qiFree)} />
        <path className="line-b" d={path((d) => d.spend)} />
        {days.map((d, i) => (
          <rect key={`hit-${d.day}`} className="hit" x={x(i) - slot / 2} y={m.t} width={slot} height={H - m.t - m.b}>
            <title>{`${thDate(d.day)} · ระบบแจกฟรี ${int(qiFree(d))} · ถูกใช้ ${int(d.spend)} · ซื้อ ${int(d.buy)} · ทีมแจก ${int(d.team)}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}

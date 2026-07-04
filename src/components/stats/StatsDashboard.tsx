"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FeatureStat = {
  feature: string;
  label: string;
  calls: number;
  tokens: number;
  costUsd: number;
  costThb: number;
};
type DailyStat = { date: string; tokens: number; costUsd: number; calls: number };
type RecentRow = {
  feature: string;
  featureLabel: string;
  createdAt: string;
  model: string;
  provider: string;
  inTokens: number;
  outTokens: number;
  totalTokens: number;
  label: string | null;
  costUsd: number;
};
type ChatUser = { anonId: string; questions: number; costUsd: number; lastAt: string };
type ChatCompare = {
  calls: number; flashThb: number; flashLiteThb: number; savedThb: number; savedPct: number; currentModel: string;
};
type Stats = {
  usdToThb: number;
  totals: { calls: number; tokens: number; costUsd: number; costThb: number; features: number; chatUsers: number };
  byFeature: FeatureStat[];
  daily: DailyStat[];
  recent: RecentRow[];
  chatUsers: ChatUser[];
  chatCompare: ChatCompare | null;
};

const fmtInt = (n: number) => n.toLocaleString("th-TH");
const fmtUsd = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(6) : n.toFixed(4)}`;
const fmtThb = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
/** บาทแบบละเอียดสำหรับต้นทุนต่อแถวที่มีค่าน้อยมาก */
const fmtThbSmall = (n: number) => `฿${n > 0 && n < 1 ? n.toFixed(4) : n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);
const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

const FEATURE_COLORS: Record<string, string> = {
  reading_topic: "#6b5bd2",
  divine_cards: "#e6337f",
  oracle_cards: "#c0264e",
  honeycomb: "#e0a021",
  pair_rephrase: "#2aa198",
  reading_draft: "#8a6d3b",
  louise_hay: "#ff7ab0",
};
const colorOf = (f: string) => FEATURE_COLORS[f] ?? "#888";

/** กราฟแท่งแนวนอน: ต้นทุน (USD) ต่อฟีเจอร์ */
function CostByFeatureChart({ data }: { data: FeatureStat[] }) {
  const max = Math.max(1e-9, ...data.map((d) => d.costUsd));
  if (data.length === 0) return <p className="stats-msg">ยังไม่มีข้อมูล</p>;
  return (
    <div className="stats-barh">
      {data.map((d) => (
        <div key={d.feature} className="stats-barh__row">
          <span className="stats-barh__label">{d.label}</span>
          <div className="stats-barh__track">
            <div
              className="stats-barh__fill"
              style={{ width: `${(d.costUsd / max) * 100}%`, background: colorOf(d.feature) }}
            />
          </div>
          <span className="stats-barh__val">{fmtUsd(d.costUsd)}</span>
        </div>
      ))}
    </div>
  );
}

const CHART_DIMS = { w: 640, h: 180, pad: 28 };

/** กราฟเส้น/พื้นที่: ต้นทุนรายวัน (SVG ล้วน) */
function DailyCostChart({ data }: { data: DailyStat[] }) {
  const dims = CHART_DIMS;
  const path = useMemo(() => {
    if (data.length === 0) return null;
    const max = Math.max(1e-9, ...data.map((d) => d.costUsd));
    const innerW = dims.w - dims.pad * 2;
    const innerH = dims.h - dims.pad * 2;
    const x = (i: number) => dims.pad + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => dims.pad + innerH - (v / max) * innerH;
    const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.costUsd).toFixed(1)}`).join(" ");
    const area = `${line} L${x(data.length - 1).toFixed(1)},${(dims.h - dims.pad).toFixed(1)} L${x(0).toFixed(1)},${(dims.h - dims.pad).toFixed(1)} Z`;
    return { line, area, max, x, y };
  }, [data, dims]);

  if (!path) return <p className="stats-msg">ยังไม่มีข้อมูล</p>;
  return (
    <div className="stats-linewrap">
      <svg viewBox={`0 0 ${dims.w} ${dims.h}`} className="stats-line" preserveAspectRatio="none" role="img" aria-label="ต้นทุนรายวัน">
        <line x1={dims.pad} y1={dims.h - dims.pad} x2={dims.w - dims.pad} y2={dims.h - dims.pad} stroke="#eedbe6" />
        <path d={path.area} fill="rgba(230,51,127,0.10)" />
        <path d={path.line} fill="none" stroke="#e6337f" strokeWidth={2} />
        {data.map((d, i) => (
          <circle key={d.date} cx={path.x(i)} cy={path.y(d.costUsd)} r={2.5} fill="#e6337f">
            <title>{`${d.date}: ${fmtUsd(d.costUsd)} · ${fmtInt(d.tokens)} tok`}</title>
          </circle>
        ))}
      </svg>
      <div className="stats-line__axis">
        <span>{data[0]?.date}</span>
        <span>สูงสุด/วัน {fmtUsd(path.max)}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

type Tab = "recent" | "chatUsers";
type Preset = "today" | "7d" | "30d" | "custom";

const PRESET_LABEL: Record<Preset, string> = {
  today: "24 ชม.",
  "7d": "7 วัน",
  "30d": "30 วัน",
  custom: "กำหนดเอง",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function StatsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recent");
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(daysAgoStr(7));
  const [customTo, setCustomTo] = useState(todayStr());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let from: string, to: string;
      if (preset === "custom") {
        from = new Date(`${customFrom}T00:00:00`).toISOString();
        const t = new Date(`${customTo}T00:00:00`);
        t.setDate(t.getDate() + 1); // ให้ครอบทั้งวันสุดท้าย
        to = t.toISOString();
      } else {
        const days = preset === "today" ? 1 : preset === "7d" ? 7 : 30;
        to = new Date().toISOString();
        from = new Date(Date.now() - days * 86_400_000).toISOString();
      }
      const res = await fetch(`/api/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`โหลดสถิติไม่สำเร็จ (${res.status})`);
      setStats((await res.json()) as Stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) return <p className="stats-msg">กำลังโหลดสถิติ…</p>;
  if (error && !stats) return <p className="stats-msg stats-msg--err">{error}</p>;
  if (!stats) return null;

  const { totals, byFeature, daily, recent, chatUsers, usdToThb, chatCompare } = stats;
  const chartTitle =
    preset === "custom"
      ? `ต้นทุน ${customFrom} → ${customTo}`
      : preset === "today"
        ? "ต้นทุนราย 24 ชั่วโมง (รายชั่วโมง)"
        : `ต้นทุนรายวัน (${preset === "7d" ? 7 : 30} วันล่าสุด)`;

  return (
    <section className="stats">
      <div className="stats-toolbar">
        <div className="stats-range">
          {(["today", "7d", "30d", "custom"] as Preset[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`stats-range__btn${preset === r ? " is-active" : ""}`}
              onClick={() => setPreset(r)}
            >
              {PRESET_LABEL[r]}
            </button>
          ))}
          {preset === "custom" && (
            <span className="stats-range__custom">
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} />
              <span>–</span>
              <input type="date" value={customTo} min={customFrom} max={todayStr()} onChange={(e) => setCustomTo(e.target.value)} />
            </span>
          )}
        </div>
        <button type="button" className="stats-refresh" onClick={() => void load()} disabled={loading}>
          {loading ? "…" : "↻ รีเฟรช"}
        </button>
      </div>
      <div className="stats-toolbar stats-toolbar--rate">
        <span className="stats-rate">เรต 1 USD ≈ {usdToThb} THB · ราคาเป็นค่าประมาณ</span>
      </div>

      <div className="stats-kpis">
        <div className="stats-kpi stats-kpi--cost">
          <span className="stats-kpi__label">ต้นทุนรวม</span>
          <span className="stats-kpi__value">{fmtThb(totals.costThb)}</span>
          <span className="stats-kpi__sub">{fmtUsd(totals.costUsd)}</span>
        </div>
        <div className="stats-kpi">
          <span className="stats-kpi__label">การเรียก LLM</span>
          <span className="stats-kpi__value">{fmtInt(totals.calls)}</span>
          <span className="stats-kpi__sub">{totals.features} ฟีเจอร์</span>
        </div>
        <div className="stats-kpi">
          <span className="stats-kpi__label">โทเคนรวม</span>
          <span className="stats-kpi__value">{fmtInt(totals.tokens)}</span>
        </div>
        <div className="stats-kpi">
          <span className="stats-kpi__label">ผู้ใช้แชท</span>
          <span className="stats-kpi__value">{fmtInt(totals.chatUsers)}</span>
        </div>
      </div>

      <div className="stats-grid2">
        <div className="stats-card">
          <h3 className="stats-card__title">ต้นทุนต่อฟีเจอร์</h3>
          <CostByFeatureChart data={byFeature} />
        </div>
        <div className="stats-card">
          <h3 className="stats-card__title">{chartTitle}</h3>
          <DailyCostChart data={daily} />
        </div>
      </div>

      {chatCompare && chatCompare.calls > 0 && (
        <div className="stats-card stats-compare">
          <h3 className="stats-card__title">
            เทียบต้นทุนแชท: flash-lite vs flash <span className="stats-compare__n">({fmtInt(chatCompare.calls)} ข้อความในช่วงนี้)</span>
          </h3>
          <div className="stats-compare__bars">
            <div className="stats-compare__row">
              <span className="stats-compare__lbl">
                gemini-2.5-flash-lite <span className="stats-compare__badge is-now">ใช้อยู่</span>
              </span>
              <div className="stats-compare__track">
                <div
                  className="stats-compare__fill is-lite"
                  style={{ width: `${chatCompare.flashThb > 0 ? (chatCompare.flashLiteThb / chatCompare.flashThb) * 100 : 0}%` }}
                />
              </div>
              <span className="stats-compare__val">{fmtThb(chatCompare.flashLiteThb)}</span>
            </div>
            <div className="stats-compare__row">
              <span className="stats-compare__lbl">
                gemini-2.5-flash <span className="stats-compare__badge is-old">เดิม</span>
              </span>
              <div className="stats-compare__track">
                <div className="stats-compare__fill is-flash" style={{ width: "100%" }} />
              </div>
              <span className="stats-compare__val">{fmtThb(chatCompare.flashThb)}</span>
            </div>
          </div>
          <p className="stats-compare__save">
            ประหยัด <b>{fmtThb(chatCompare.savedThb)}</b> ({chatCompare.savedPct.toFixed(0)}%) จากการสลับเป็น flash-lite
            <span className="stats-compare__muted"> · คิดจากโทเคนแชทจริงในช่วงที่เลือก</span>
          </p>
        </div>
      )}

      <div className="stats-card">
        <h3 className="stats-card__title">สรุปต่อฟีเจอร์</h3>
        <div className="stats-tablewrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>ฟีเจอร์</th>
                <th className="num">เรียก</th>
                <th className="num">โทเคน</th>
                <th className="num">ต้นทุน (USD)</th>
                <th className="num">ต้นทุน (THB)</th>
              </tr>
            </thead>
            <tbody>
              {byFeature.map((f) => (
                <tr key={f.feature}>
                  <td>
                    <span className="stats-dot" style={{ background: colorOf(f.feature) }} /> {f.label}
                  </td>
                  <td className="num">{fmtInt(f.calls)}</td>
                  <td className="num">{fmtInt(f.tokens)}</td>
                  <td className="num">{fmtUsd(f.costUsd)}</td>
                  <td className="num">{fmtThb(f.costThb)}</td>
                </tr>
              ))}
              {byFeature.length === 0 && (
                <tr><td colSpan={5} className="stats-msg">ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stats-tabs">
        <button className={tab === "recent" ? "is-active" : ""} onClick={() => setTab("recent")}>
          รายการล่าสุด ({recent.length})
        </button>
        <button className={tab === "chatUsers" ? "is-active" : ""} onClick={() => setTab("chatUsers")}>
          ผู้ใช้แชท ({chatUsers.length})
        </button>
      </div>

      {tab === "recent" && (
        <div className="stats-tablewrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ฟีเจอร์</th>
                <th>รายละเอียด</th>
                <th>โมเดล</th>
                <th className="num">โทเคน (in/out)</th>
                <th className="num">ต้นทุน (฿)</th>
                <th className="num">ต้นทุน ($)</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={`${r.feature}-${r.createdAt}-${i}`}>
                  <td className="nowrap">{fmtTime(r.createdAt)}</td>
                  <td>
                    <span className="stats-dot" style={{ background: colorOf(r.feature) }} /> {r.featureLabel}
                  </td>
                  <td className="stats-lbl" title={r.label ?? undefined}>{r.label ?? <span className="muted">—</span>}</td>
                  <td className="nowrap"><code>{r.model}</code></td>
                  <td className="num">{fmtInt(r.inTokens)}/{fmtInt(r.outTokens)}</td>
                  <td className="num">{fmtThbSmall(r.costUsd * usdToThb)}</td>
                  <td className="num stats-usd-sub">{fmtUsd(r.costUsd)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={7} className="stats-msg">ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "chatUsers" && (
        <div className="stats-tablewrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>ผู้ใช้ (anon)</th>
                <th className="num">คำถาม</th>
                <th className="num">ต้นทุน (฿)</th>
                <th className="num">ต้นทุน ($)</th>
                <th>ล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {chatUsers.map((u) => (
                <tr key={u.anonId}>
                  <td title={u.anonId}><code>{shortId(u.anonId)}</code></td>
                  <td className="num">{fmtInt(u.questions)}</td>
                  <td className="num">{fmtThbSmall(u.costUsd * usdToThb)}</td>
                  <td className="num stats-usd-sub">{fmtUsd(u.costUsd)}</td>
                  <td>{fmtTime(u.lastAt)}</td>
                </tr>
              ))}
              {chatUsers.length === 0 && (
                <tr><td colSpan={5} className="stats-msg">ยังไม่มีผู้ใช้แชท</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

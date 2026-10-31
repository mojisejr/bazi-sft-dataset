"use client";
/**
 * ตรวจคะแนน (ซินแสนุ้ย 2026-10-31) — ใส่วันเกิด ดูที่มาของ "ค่าพลัง 4 ด้าน" และ "คะแนนปฏิทินรายวัน"
 * ใช้ /api/bazi/man-vs-day ตัวเดียวกับปฏิทินในแอป ตัวเลขจึงตรงกับที่ลูกค้าเห็น · หน้านี้อ่านอย่างเดียว ไม่เซฟ
 */
import { useState, type CSSProperties } from "react";

type Pillar = { stem: string; branch: string };
type Power = { score: number; coefficient: number; band: string; basis: string[]; interpretation?: string; approximate?: boolean };
type DaySummary = { date: string; dayOfMonth: number; weekday: string; dayGanzhi: string; overallPercent: number | null; dayStrength: number; dayClash: boolean; grade?: string | null };
type Facet = { key: string; label: string; pairingLabel: string; ourGanzhi: string; partnerGanzhi: string; percent: number | null; grade: string; found: boolean };
type DayDetail = { date?: string; dayGanzhi: string; overallPercent: number | null; grade?: string | null; facets: Facet[]; dayClash: boolean; summaryHeadline?: string };
type MonthResp = {
  person: { fourPillars: Record<"year" | "month" | "day" | "hour", Pillar>; domainPower: Record<string, Power> };
  days: DaySummary[];
};

const DOMAINS: { key: string; label: string; how: string }[] = [
  { key: "wealth", label: "สกิลเรียกทรัพย์", how: "เฉลี่ยตารางคู่ของ (หลักวัน, หลักเดือน) × ตำแหน่งลาภ" },
  { key: "career", label: "ตัวท็อป", how: "ตารางคู่ หลักวัน × หลักเดือน" },
  { key: "friends", label: "สกิลอินฟลู", how: "ตารางเพื่อน ดูจากหลักวันอย่างเดียว" },
  { key: "learning", label: "สกิลเรียนรู้", how: "ตารางคู่ หลักวัน × หลักยาม" },
];

const cell: CSSProperties = { border: "1px solid #ddd", padding: "6px 8px", fontSize: 14, textAlign: "left" };
const input: CSSProperties = { padding: 8, border: "1px solid #bbb", borderRadius: 8 };

export function ScoreAuditWorkspace() {
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("12:00");
  const [gender, setGender] = useState("female");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<MonthResp | null>(null);
  const [day, setDay] = useState<DayDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const person = () => ({ birthDate, birthTime, gender, province: "กรุงเทพมหานคร", calendarSystem: "solar", timezone: "Asia/Bangkok" });
  const post = async (extra: Record<string, string>) => {
    const r = await fetch("/api/bazi/man-vs-day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ person: person(), ...extra }) });
    const j = await r.json();
    if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "คำนวณไม่สำเร็จ");
    return j;
  };
  const run = async () => {
    setBusy(true); setError(""); setDay(null);
    try { setData((await post({ month })) as MonthResp); }
    catch (e) { setError(e instanceof Error ? e.message : "คำนวณไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const openDay = async (date: string) => {
    setError("");
    try { setDay({ ...(await post({ date })), date } as DayDetail); }
    catch (e) { setError(e instanceof Error ? e.message : "โหลดวันไม่สำเร็จ"); }
  };

  return (
    <div data-testid="score-audit" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
        <label>วันเกิด (ค.ศ.)<br /><input style={input} type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
        <label>เวลาเกิด<br /><input style={input} type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} /></label>
        <label>เพศ<br />
          <select style={input} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="female">หญิง</option><option value="male">ชาย</option>
          </select>
        </label>
        <label>เดือนปฏิทิน<br /><input style={input} type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <button type="button" onClick={() => void run()} disabled={busy || !birthDate} style={{ ...input, cursor: "pointer", fontWeight: 700 }}>{busy ? "กำลังคำนวณ…" : "ตรวจคะแนน"}</button>
      </section>
      {error ? <p role="alert" style={{ color: "#b3261e" }}>{error}</p> : null}

      {data ? (
        <>
          <p>
            ผังดวง: ปี <b>{data.person.fourPillars.year.stem}{data.person.fourPillars.year.branch}</b> · เดือน <b>{data.person.fourPillars.month.stem}{data.person.fourPillars.month.branch}</b> · วัน <b>{data.person.fourPillars.day.stem}{data.person.fourPillars.day.branch}</b> · ยาม <b>{data.person.fourPillars.hour.stem}{data.person.fourPillars.hour.branch}</b>
          </p>
          <section>
            <h2>ค่าพลัง 4 ด้าน</h2>
            <table style={{ borderCollapse: "collapse", width: "100%" }} data-testid="audit-power">
              <thead><tr><th style={cell}>สกิล</th><th style={cell}>%</th><th style={cell}>วิธีคิด</th><th style={cell}>คู่ที่เปิดตาราง</th><th style={cell}>หมายเหตุ</th></tr></thead>
              <tbody>
                {DOMAINS.map((d) => {
                  const p = data.person.domainPower?.[d.key];
                  return (
                    <tr key={d.key}>
                      <td style={cell}>{d.label}</td>
                      <td style={cell}><b>{p ? p.score.toFixed(2) : "-"}</b></td>
                      <td style={cell}>{d.how}</td>
                      <td style={cell}>{p?.basis.join(" · ") || "ไม่พบในตาราง"}</td>
                      <td style={cell}>{p?.approximate ? "ค่าประมาณ (ลาภแฝง/ก้านซ่อน/หลายตำแหน่ง)" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <section>
            <h2>คะแนนปฏิทิน {month}</h2>
            <p style={{ fontSize: 13 }}>คะแนนรวม = เฉลี่ย 4 มิติ · กดวันเพื่อดูที่มา</p>
            <table style={{ borderCollapse: "collapse", width: "100%" }} data-testid="audit-days">
              <thead><tr><th style={cell}>วันที่</th><th style={cell}>วัน</th><th style={cell}>เสาวัน</th><th style={cell}>%</th><th style={cell}>เกรด</th><th style={cell}>กำลังดิถี</th><th style={cell}>วันชง</th></tr></thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date} onClick={() => void openDay(d.date)} style={{ cursor: "pointer", background: day?.date === d.date ? "#eef3ff" : undefined }}>
                    <td style={cell}>{d.dayOfMonth}</td><td style={cell}>{d.weekday}</td><td style={cell}>{d.dayGanzhi}</td>
                    <td style={cell}><b>{d.overallPercent ?? "-"}</b></td><td style={cell}>{d.grade ?? "-"}</td><td style={cell}>{d.dayStrength}</td><td style={cell}>{d.dayClash ? "ชง" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {day ? (
            <section data-testid="audit-day">
              <h2>ที่มาคะแนนวันที่ {day.date} ({day.dayGanzhi})</h2>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr><th style={cell}>มิติ</th><th style={cell}>คู่เสา</th><th style={cell}>เรา × วัน</th><th style={cell}>%</th><th style={cell}>เกรด</th></tr></thead>
                <tbody>
                  {day.facets.map((f) => (
                    <tr key={f.key}><td style={cell}>{f.label}</td><td style={cell}>{f.pairingLabel}</td><td style={cell}>{f.ourGanzhi} × {f.partnerGanzhi}</td><td style={cell}>{f.found ? f.percent : "ไม่พบในตาราง"}</td><td style={cell}>{f.grade}</td></tr>
                  ))}
                </tbody>
              </table>
              <p>คะแนนรวม <b>{day.overallPercent ?? "-"}</b>{day.grade ? ` (${day.grade})` : ""}{day.dayClash ? " · วันชงดิถี" : ""}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

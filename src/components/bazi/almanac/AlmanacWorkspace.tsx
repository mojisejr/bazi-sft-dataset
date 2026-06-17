"use client";

import { useCallback, useEffect, useState } from "react";

type Pillar = { stem: string; branch: string; ganzhi: string; element: string };
type GateInfo = { name: string; direction: string; meaning: string | null };
type SpiritInfo = { name: string; keywords: string[] };
type ColorInfo = { element: string; colors: string };
type PatronInfo = { branch: string; number: number | null; zodiac: string };
type AsuraDirections = { day: string; month: string; year: string };
type MonthInfo = { deity: string | null; caishenDir: string | null; lapDir: string | null };
type LuckyHour = { code: string; range: string; branch: string; god: string; meaning: string };
type DayStar = { name: string; activity: string | null; polarity: "good" | "bad" };
type HourQuality = {
  date: string; hour: number; dayPillar: string; hourBranch: string;
  range: string; god: string; meaning: string; score: number; good: boolean;
};
type Strength = { ratioTotal: number; ratioDay: number; exact: boolean };
type SolarTerm = { kind: "major" | "minor"; name: string; nameTh: string; time: string; isMonthChange: boolean };
type ThaiLunar = {
  lunarMonth: number; isLeapMonth: boolean; monthLabel: string;
  phase: "ขึ้น" | "แรม"; kham: number; label: string; isWanPhra: boolean;
};
type SpecialDayCategory =
  | "religion" | "government" | "festival-thai" | "festival-chinese" | "chinese-religious" | "thai-buddhist";
type SpecialDay = { id: string; name: string; category: SpecialDayCategory };
type AlmanacDay = {
  date: string;
  yearBE: number;
  weekday: string;
  dayPillar: Pillar;
  monthPillar: Pillar;
  yearPillar: Pillar;
  officer: string | null;
  officerDesc: string | null;
  deities: string[];
  deity: string | null;
  colors: ColorInfo[];
  luckyDirection: string | null;
  asura: AsuraDirections;
  patrons: PatronInfo[];
  gates: GateInfo[];
  spirits: SpiritInfo[];
  luckyHours: LuckyHour[];
  monthInfo: MonthInfo;
  dayStars: DayStar[];
  solarTerm: SolarTerm | null;
  thaiLunar: ThaiLunar;
  specialDays: SpecialDay[];
  note: string | null;
  strength: Strength;
};
type RuleEntry = { id: string; name: string; [k: string]: unknown };
type AlmanacMonth = { yearBE: number; month: number; days: AlmanacDay[] };

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const CURRENT_YEAR_BE = new Date().getFullYear() + 543;

const SPECIAL_CAT: Record<SpecialDayCategory, { label: string; cls: string }> = {
  religion: { label: "ศาสนา", cls: "almanac-sp--religion" },
  government: { label: "ราชการ", cls: "almanac-sp--government" },
  "festival-thai": { label: "เทศกาลไทย", cls: "almanac-sp--festival-thai" },
  "festival-chinese": { label: "เทศกาลจีน", cls: "almanac-sp--festival-chinese" },
  "chinese-religious": { label: "วันพระจีน", cls: "almanac-sp--chinese-religious" },
  "thai-buddhist": { label: "วันพระไทย", cls: "almanac-sp--thai-buddhist" },
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ฟิลด์ที่แก้รายวันได้ "ทุกอย่าง" (text=ช่องสั้น, textarea=ข้อความ, json=โครงสร้าง)
type DayField = { key: string; label: string; type: "text" | "textarea" | "json" };
const DAY_FIELDS: DayField[] = [
  { key: "note", label: "หมายเหตุ", type: "textarea" },
  { key: "weekday", label: "วันในสัปดาห์", type: "text" },
  { key: "officer", label: "ดิถี (officer)", type: "text" },
  { key: "officerDesc", label: "คำอธิบายดิถี", type: "text" },
  { key: "deity", label: "เทพประจำวัน (หลัก)", type: "text" },
  { key: "luckyDirection", label: "ทิศโชคลาภ", type: "text" },
  { key: "dayPillar", label: "เสาวัน", type: "json" },
  { key: "monthPillar", label: "เสาเดือน", type: "json" },
  { key: "yearPillar", label: "เสาปี", type: "json" },
  { key: "deities", label: "เทพประจำวัน (รายการ)", type: "json" },
  { key: "colors", label: "สีมงคล", type: "json" },
  { key: "asura", label: "ทิศอสูร (ว/ด/ป)", type: "json" },
  { key: "patrons", label: "เทพอุปถัมภ์", type: "json" },
  { key: "dayStars", label: "ดาวประจำวัน", type: "json" },
  { key: "specialDays", label: "วันสำคัญ", type: "json" },
  { key: "luckyHours", label: "เวลามงคล", type: "json" },
  { key: "gates", label: "8 ประตู", type: "json" },
  { key: "spirits", label: "8 เทพ", type: "json" },
  { key: "monthInfo", label: "ข้อมูลเดือน", type: "json" },
  { key: "solarTerm", label: "ขอบสารท", type: "json" },
  { key: "thaiLunar", label: "จันทรคติไทย", type: "json" },
  { key: "strength", label: "กำลัง", type: "json" },
];

export function AlmanacWorkspace() {
  const [yearBE, setYearBE] = useState(CURRENT_YEAR_BE);
  const [month, setMonth] = useState(1);
  const [data, setData] = useState<AlmanacMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ตรวจยามเดียว (เลือกวัน+เวลา)
  const today = new Date().toISOString().slice(0, 10);
  const [checkDate, setCheckDate] = useState(today);
  const [checkHour, setCheckHour] = useState(9);
  const [hourResult, setHourResult] = useState<HourQuality | null>(null);

  async function onCheckHour() {
    try {
      const res = await fetch(`/api/almanac?checkDate=${checkDate}&checkHour=${checkHour}`);
      const json = await res.json();
      if (res.ok) setHourResult(json);
    } catch {
      /* ignore */
    }
  }

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

  // ----- แก้ไขรายวัน (override ทุกฟิลด์) -----
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editInit, setEditInit] = useState<Record<string, string>>({});
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function fieldToStr(day: AlmanacDay, f: DayField): string {
    const v = (day as unknown as Record<string, unknown>)[f.key];
    if (f.type === "json") return JSON.stringify(v ?? null, null, 2);
    return v == null ? "" : String(v);
  }

  function openEditor(day: AlmanacDay) {
    const init: Record<string, string> = {};
    for (const f of DAY_FIELDS) init[f.key] = fieldToStr(day, f);
    setEditDate(day.date);
    setEditInit(init);
    setEditDraft({ ...init });
  }
  const setField = (key: string, val: string) => setEditDraft((d) => ({ ...d, [key]: val }));

  async function putOverride(kind: string, groupKey: string, itemKey: string, text: string) {
    await fetch("/api/almanac", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, groupKey, itemKey, text }),
    });
  }
  async function delOverride(kind: string, groupKey: string, itemKey: string) {
    await fetch(`/api/almanac?kind=${kind}&groupKey=${encodeURIComponent(groupKey)}&itemKey=${encodeURIComponent(itemKey)}`, {
      method: "DELETE",
    });
  }

  async function saveDay() {
    if (!editDate) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of DAY_FIELDS) {
        const cur = editDraft[f.key] ?? "";
        if (cur === (editInit[f.key] ?? "")) continue; // ไม่เปลี่ยน → ข้าม
        if (cur.trim() === "") {
          await delOverride("almanac-day", editDate, f.key); // เว้นว่าง = คืนค่าเดิม
          continue;
        }
        let text: string;
        if (f.type === "json") {
          try {
            JSON.parse(cur);
          } catch {
            setError(`${f.label}: JSON ไม่ถูกต้อง`);
            return;
          }
          text = cur;
        } else {
          text = JSON.stringify(cur); // scalar เก็บเป็น JSON string
        }
        await putOverride("almanac-day", editDate, f.key, text);
      }
      setEditDate(null);
      await load(); // รันใหม่อัตโนมัติ
    } finally {
      setBusy(false);
    }
  }

  async function resetDay(date: string) {
    setBusy(true);
    try {
      for (const f of DAY_FIELDS) await delOverride("almanac-day", date, f.key);
      setEditDate(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  // ----- แก้ตาราง/กฎ (day-stars / special-days) -----
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<{ dayStars: RuleEntry[]; specialDays: RuleEntry[] } | null>(null);
  const [ruleDraft, setRuleDraft] = useState<Record<string, string>>({});

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/almanac?meta=rules");
    if (res.ok) setRules(await res.json());
  }, []);

  function openRules() {
    setShowRules((v) => !v);
    if (!rules) void loadRules();
  }

  async function saveRule(group: "day-stars" | "special-days", id: string) {
    const text = ruleDraft[`${group}|${id}`];
    if (text === undefined) return;
    setBusy(true);
    try {
      JSON.parse(text); // ตรวจ JSON ก่อนส่ง
      await putOverride("almanac-rule", group, id, text);
      await loadRules();
      await load();
    } catch (err) {
      setError(err instanceof Error ? `JSON ไม่ถูกต้อง: ${err.message}` : "JSON ไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  }
  async function resetRule(group: "day-stars" | "special-days", id: string) {
    setBusy(true);
    try {
      await delOverride("almanac-rule", group, id);
      setRuleDraft((d) => { const n = { ...d }; delete n[`${group}|${id}`]; return n; });
      await loadRules();
      await load();
    } finally {
      setBusy(false);
    }
  }

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
        <button type="button" className="almanac-editbtn" onClick={openRules}>
          ⚙️ แก้ตาราง/กฎ
        </button>
      </div>

      {showRules && (
        <div className="almanac-rules">
          <p className="almanac-rules-hint">
            แก้ JSON ของแต่ละรายการแล้วกด “บันทึก” (กระทบทุกวันที่เข้าเงื่อนไข) · เพิ่มรายการใหม่ได้โดยตั้ง id ใหม่ในตัวแก้รายวันไม่ได้ — แก้ที่นี่เท่านั้น
          </p>
          {!rules && <p className="almanac-status">กำลังโหลดกฎ…</p>}
          {rules && (
            <>
              {(["day-stars", "special-days"] as const).map((group) => (
                <details key={group} className="almanac-detail" open>
                  <summary>{group === "day-stars" ? "ดาวประจำวัน (day-stars)" : "วันสำคัญ (special-days)"}</summary>
                  {(group === "day-stars" ? rules.dayStars : rules.specialDays).map((entry) => {
                    const k = `${group}|${entry.id}`;
                    const value = ruleDraft[k] ?? JSON.stringify(entry, null, 2);
                    return (
                      <div key={entry.id} className="almanac-rule-item">
                        <div className="almanac-rule-head">
                          <b>{entry.name}</b> <code>{entry.id}</code>
                        </div>
                        <textarea
                          value={value}
                          onChange={(e) => setRuleDraft((d) => ({ ...d, [k]: e.target.value }))}
                          rows={Math.min(12, value.split("\n").length + 1)}
                        />
                        <div className="almanac-editor-actions">
                          <button type="button" className="almanac-download" disabled={busy} onClick={() => saveRule(group, entry.id)}>
                            💾 บันทึก
                          </button>
                          <button type="button" className="almanac-editbtn" disabled={busy} onClick={() => resetRule(group, entry.id)}>
                            ♻️ คืนค่าเดิม
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </details>
              ))}
            </>
          )}
        </div>
      )}

      <div className="almanac-controls almanac-hourcheck">
        <label>
          ตรวจยาม — วันที่ (ค.ศ.)
          <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
        </label>
        <label>
          เวลา (ชม. 0–23)
          <input type="number" min={0} max={23} value={checkHour} onChange={(e) => setCheckHour(Number(e.target.value))} />
        </label>
        <button type="button" className="almanac-download" onClick={onCheckHour}>
          🔎 ตรวจยาม
        </button>
        {hourResult && (
          <span className={`almanac-chip ${hourResult.good ? "almanac-chip-good" : "almanac-chip-bad"}`}>
            {hourResult.good ? "✅" : "⛔"} ยาม{hourResult.hourBranch} ({hourResult.range}) — {hourResult.god} {hourResult.meaning} · {hourResult.score}%
          </span>
        )}
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
              <article
                key={day.date}
                className={`almanac-day${day.solarTerm ? ` almanac-day--term-${day.solarTerm.kind}` : ""}`}
              >
                {day.solarTerm && (
                  <div className={`almanac-term almanac-term--${day.solarTerm.kind}`}>
                    <span>{day.solarTerm.isMonthChange ? "🟠 เปลี่ยนเดือน" : "🔵 สารทเล็ก"}</span>
                    <span className="almanac-term-cn">{day.solarTerm.name}</span>
                    <span>{day.solarTerm.nameTh}</span>
                    <span className="almanac-term-time">⏱ {day.solarTerm.time}</span>
                  </div>
                )}
                <header className="almanac-day-head">
                  <span className="almanac-daynum">{Number(day.date.slice(8, 10))}</span>
                  <span className="almanac-weekday">{day.weekday}</span>
                  <span className="almanac-strength" title="กำลังดิถี E = (O+P+Q+R)/รวม max">
                    {pct(day.strength.ratioDay)}
                    {!day.strength.exact && <span className="almanac-approx"> ~</span>}
                  </span>
                  <span className="almanac-pillar">{day.dayPillar.ganzhi}</span>
                </header>

                <p className="almanac-thailine">
                  {day.thaiLunar.isWanPhra && <span className="almanac-wanphra">🙏 วันพระ</span>}
                  <span className="almanac-lunarlabel">{day.thaiLunar.label}</span>
                </p>

                {day.specialDays.length > 0 && (
                  <div className="almanac-special">
                    {day.specialDays.map((s) => (
                      <span
                        key={s.id}
                        className={`almanac-spchip ${SPECIAL_CAT[s.category]?.cls ?? ""}`}
                        title={SPECIAL_CAT[s.category]?.label ?? ""}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}

                {day.officer && (
                  <p className="almanac-officer">
                    <strong>{day.officer}</strong>
                    {day.officerDesc ? ` — ${day.officerDesc}` : ""}
                  </p>
                )}

                <dl className="almanac-meta">
                  <div><dt>เสาเดือน</dt><dd>{day.monthPillar.ganzhi}</dd></div>
                  <div><dt>เสาปี</dt><dd>{day.yearPillar.ganzhi}</dd></div>
                  {day.deities.length > 0 && (
                    <div><dt>เทพประจำวัน</dt><dd>{day.deities.join(" / ")}</dd></div>
                  )}
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
                      {!day.strength.exact && <span className="almanac-approx"> (รวมประมาณ)</span>}</dd>
                  </div>
                </dl>

                {day.dayStars.length > 0 && (
                  <div className="almanac-deities">
                    {day.dayStars.map((s) => (
                      <span
                        key={s.name}
                        className={`almanac-chip ${s.polarity === "good" ? "almanac-chip-good" : "almanac-chip-bad"}`}
                        title={s.activity ?? ""}
                      >
                        {s.polarity === "good" ? "✅" : "⛔"} {s.name}
                      </span>
                    ))}
                  </div>
                )}

                {day.luckyHours.length > 0 && (
                  <div className="almanac-hours">
                    <span className="almanac-hours-label">⏰ เวลามงคล</span>
                    <ul className="almanac-hourlist">
                      {day.luckyHours.map((h) => (
                        <li key={h.code}>
                          <b>{h.range}</b> {h.god} <em>{h.meaning}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
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

                {day.note && <p className="almanac-note">📝 {day.note}</p>}

                <div className="almanac-edit-row">
                  <button type="button" className="almanac-editbtn" onClick={() => openEditor(day)}>
                    ✏️ แก้ไข
                  </button>
                </div>

                {editDate === day.date && (
                  <div className="almanac-editor">
                    <p className="almanac-editor-hint">แก้ได้ทุกฟิลด์ · เว้นว่าง = คืนค่าเดิมของฟิลด์นั้น</p>
                    {DAY_FIELDS.map((f) => (
                      <label key={f.key}>
                        {f.label}
                        {f.type === "textarea" ? (
                          <textarea value={editDraft[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} rows={2} />
                        ) : f.type === "json" ? (
                          <textarea
                            className="almanac-json"
                            value={editDraft[f.key] ?? ""}
                            onChange={(e) => setField(f.key, e.target.value)}
                            rows={Math.min(10, (editDraft[f.key] ?? "").split("\n").length + 1)}
                            spellCheck={false}
                          />
                        ) : (
                          <input value={editDraft[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
                        )}
                      </label>
                    ))}
                    <div className="almanac-editor-actions">
                      <button type="button" className="almanac-download" disabled={busy} onClick={saveDay}>
                        💾 บันทึก + รันใหม่
                      </button>
                      <button type="button" className="almanac-editbtn" disabled={busy} onClick={() => resetDay(day.date)}>
                        ♻️ คืนค่าทั้งวัน
                      </button>
                      <button type="button" className="almanac-editbtn" disabled={busy} onClick={() => setEditDate(null)}>
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

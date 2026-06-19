"use client";

import { useCallback, useEffect, useState } from "react";

type Pillar = { stem: string; branch: string; ganzhi: string; element: string };
type GateInfo = { name: string; direction: string; meaning: string | null };
type SpiritInfo = { name: string; keywords: string[] };
type ColorInfo = { element: string; colors: string };
type PatronInfo = { branch: string; number: number | null; zodiac: string };
type AsuraDirections = { day: string; month: string; year: string };
type MonthInfo = { deity: string | null; caishenDir: string | null; lapDir: string | null; asuraDir: string | null; spiritDirs: [string, string][] | null };
type YearInfo = { pillar: string; asuraDir: string | null; caishenDir: string | null; lapDir: string | null; deity: string | null; spiritDirs: [string, string][] | null };
type LuckyHour = { code: string; range: string; branch: string; god: string; meaning: string };
type DayStar = { name: string; activity: string | null; polarity: "good" | "bad" };
type Strength = { ratioTotal: number; ratioDay: number; exact: boolean; values?: number[]; max?: number[] };
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
  jianchu: { name: string; meaning: string } | null;
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
  yearInfo: YearInfo;
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

// ลำดับวัน (อาทิตย์=0) สำหรับจัดตาราง 7 คอลัมน์ + ตัวย่อหัวคอลัมน์
const WEEKDAY_ORDER = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEKDAY_ABBR = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// กิ่งนักษัตร → emoji สัตว์ (แทนรูปปั้นในปฏิทินจริง — เทพอุปถัมภ์)
const BRANCH_EMOJI: Record<string, string> = {
  子: "🐭", 丑: "🐮", 寅: "🐯", 卯: "🐰", 辰: "🐲", 巳: "🐍",
  午: "🐴", 未: "🐑", 申: "🐵", 酉: "🐔", 戌: "🐶", 亥: "🐷",
};

// สีตัวอักษร 八門/八神 ตามปฏิทินจริง (ค่าโดยประมาณ)
const GATE_COLOR: Record<string, string> = {
  // 八門
  開: "#222", 休: "#2b6cb0", 生: "#2f855a", 傷: "#b7791f", 杜: "#444", 景: "#2f855a", 死: "#c53030", 驚: "#6b46c1",
  // 八神
  陳: "#8a5a2b", 雀: "#c53030", 地: "#b7791f", 天: "#2b6cb0", 符: "#2f855a", 蛇: "#c53030", 陰: "#444", 合: "#2f855a",
  虎: "#8a5a2b", 玄: "#2b6cb0",
};
const gateColor = (ch: string) => GATE_COLOR[ch] ?? "#333";

// คะแนน → สีจุด (แถว "สิ่งมงคล")
function dotColor(score: number): string {
  if (!score) return "#d8d8d8";
  if (score < 50) return "#e0524b";
  if (score < 80) return "#e6b800";
  return "#3aa657";
}

// ตัวอักษร 八門/八神 มาตรฐาน (legend หัวเดือน)
const GATE_CHARS = ["開", "休", "生", "傷", "杜", "景", "死", "驚"];
const SPIRIT_CHARS = ["天", "地", "玄", "虎", "合", "陰", "蛇", "符"];
// ความหมายย่อสำหรับ tooltip (เอาเมาส์ชี้)
const GATE_MEANING: Record<string, string> = {
  開: "เปิด", 休: "พักผ่อน", 生: "เกิด", 傷: "บาดเจ็บ", 杜: "อุดตัน", 景: "เสน่ห์", 死: "ตาย", 驚: "กลัว",
};
const SPIRIT_MEANING: Record<string, string> = {
  天: "วิสัยทัศน์", 地: "วางโครงสร้าง", 玄: "ลึกลับ/เร้นลับ", 虎: "กล้า/บุก", 合: "เยียวยา/ประสาน",
  陰: "กลยุทธ์", 蛇: "เหนือธรรมชาติ", 符: "เพิ่มขวัญกำลังใจ", 陳: "ลิขสิทธิ์/คดีความ", 雀: "โฆษณา/การตลาด",
};

// แถว 八門 (ตัวอักษร + tooltip ความหมาย) + 八神 (ตัวอักษร + ทิศ + tooltip) สำหรับหัวปี/เดือน
function HeadGateRows({ spiritDirs }: { spiritDirs: [string, string][] | null }) {
  const spirits: [string, string][] =
    spiritDirs && spiritDirs.length ? spiritDirs : SPIRIT_CHARS.map((c) => [c, ""] as [string, string]);
  return (
    <>
      <span className="almanac-headgates">
        {GATE_CHARS.map((c) => (
          <span key={c} className="almanac-gatechar" style={{ color: gateColor(c) }} title={GATE_MEANING[c] ?? ""}>{c}</span>
        ))}
      </span>
      <span className="almanac-headgates">
        {spirits.map(([c, dir], i) => (
          <span key={`${c}-${i}`} className="almanac-gatecell" title={SPIRIT_MEANING[c] ?? ""}>
            <span className="almanac-gatechar" style={{ color: gateColor(c) }}>{c}</span>
            {dir && <span className="almanac-gatedir">{dir}</span>}
          </span>
        ))}
      </span>
    </>
  );
}

// คำสีไทย → CSS (สำหรับแถบสีมงคล) — รองรับคำที่พบในข้อมูล
const THAI_COLOR: Record<string, string> = {
  ขาว: "#ffffff", ครีม: "#f3e9cf", เหลือง: "#f2c94c", ทอง: "#d4af37", น้ำตาล: "#8b5a2b",
  แดง: "#d6342c", ชมพู: "#f48fb1", ส้ม: "#f2862f", ม่วง: "#8e44ad",
  เขียว: "#2f9e44", ฟ้า: "#56b4e9", น้ำเงิน: "#1c4fa0", เทา: "#9e9e9e",
  ดำ: "#222222", เงิน: "#c7c7c7",
};
// ดึงคำสี (unique) จาก day.colors แล้ว map เป็น swatch
function colorSwatches(colors: { colors: string }[]): { word: string; hex: string }[] {
  const out: { word: string; hex: string }[] = [];
  const seen = new Set<string>();
  for (const c of colors) {
    for (const word of c.colors.split(/\s+/).filter(Boolean)) {
      if (seen.has(word) || !THAI_COLOR[word]) continue;
      seen.add(word);
      out.push({ word, hex: THAI_COLOR[word] });
    }
  }
  return out;
}

const NOW = new Date();
const CURRENT_YEAR_BE = NOW.getFullYear() + 543;
const CURRENT_MONTH = NOW.getMonth() + 1;
const TODAY_ISO = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}-${String(NOW.getDate()).padStart(2, "0")}`;

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
  { key: "jianchu", label: "建除 (jianchu)", type: "json" },
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
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [data, setData] = useState<AlmanacMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // วันที่เปิดดูรายละเอียด (modal) — null = ไม่เปิด
  const [detailDate, setDetailDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/almanac?yearBE=${yearBE}&month=${month}`);
      // ระวังกรณี dev server กำลัง recompile → ตอบ HTML ไม่ใช่ JSON (res.json() จะพัง)
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error(
          res.ok
            ? "เซิร์ฟเวอร์กำลังคอมไพล์ใหม่ — ลองโหลดอีกครั้ง"
            : `โหลดปฏิทินไม่สำเร็จ (HTTP ${res.status})`
        );
      }
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

  // เสาเดือน "หลัก" ของหน้านี้ = ตัวที่ครองวันมากสุด (mode) — ตรงกับปฏิทินเล่ม
  // (วันต้นเดือนยังเป็นเสาเดือนเก่าจนกว่าจะถึงสารท 節 จึงเปลี่ยน)
  const principalDay = (() => {
    if (!data?.days.length) return null;
    const counts = new Map<string, number>();
    for (const d of data.days) counts.set(d.monthPillar.ganzhi, (counts.get(d.monthPillar.ganzhi) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return data.days.find((d) => d.monthPillar.ganzhi === top) ?? data.days[0];
  })();
  const monthInfo = principalDay?.monthInfo;
  const yearInfo = principalDay?.yearInfo;
  const monthPillar = principalDay?.monthPillar.ganzhi;

  // เนื้อหารายละเอียดเต็มของ 1 วัน (ใช้ใน modal เมื่อคลิกช่องปฏิทิน)
  const renderDayDetail = (day: AlmanacDay) => (
    <>
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
        {day.date === TODAY_ISO && <span className="almanac-today-badge">วันนี้</span>}
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

      {(day.officer || day.officerDesc || day.jianchu) && (
        <ul className="almanac-officer">
          {day.officer && <li>{day.officer}</li>}
          {day.officerDesc && <li>{day.officerDesc}</li>}
          {day.jianchu && <li>{day.jianchu.meaning}</li>}
        </ul>
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
          <div><dt>เทพอุปถัมภ์</dt><dd>
            <ul className="almanac-patrons">
              {day.patrons.map((p, i) => (
                <li key={`${p.branch}-${i}`}>{p.zodiac}/ทิศ{p.zodiac.replace("คนเกิดปี", "")}</li>
              ))}
            </ul>
          </dd></div>
        )}
        <div>
          <dt>กำลัง (ดิถี)</dt>
          <dd>{pct(day.strength.ratioDay)}</dd>
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
                <b>{h.range}</b> <em>{h.meaning}</em>
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
    </>
  );

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

      {loading && <p className="almanac-status">กำลังโหลด…</p>}
      {error && <p className="almanac-status almanac-error">{error}</p>}

      {data && !loading && (
        <>
          <div className="almanac-monthbar">
            <h2 className="almanac-title">{MONTH_NAMES[data.month - 1]} {data.yearBE}</h2>
            <div className="almanac-headcols">
              {yearInfo && (
                <div className="almanac-headcol">
                  <h3>ปี <span className="almanac-headpillar">{yearInfo.pillar}</span></h3>
                  <HeadGateRows spiritDirs={yearInfo.spiritDirs} />
                  {yearInfo.asuraDir && <span>อสูรปี: <b>{yearInfo.asuraDir}</b></span>}
                  {yearInfo.caishenDir && <span>ทิศไฉ่ซิ้งปี: <b>{yearInfo.caishenDir}</b></span>}
                  {yearInfo.lapDir && <span>โชคลาภปี: <b>{yearInfo.lapDir}</b></span>}
                  {yearInfo.deity && <span>เทพประจำปี: <b>{yearInfo.deity}</b></span>}
                </div>
              )}
              {monthInfo && (
                <div className="almanac-headcol">
                  <h3>เดือน <span className="almanac-headpillar">{monthPillar}</span></h3>
                  <HeadGateRows spiritDirs={monthInfo.spiritDirs} />
                  {monthInfo.asuraDir && <span>อสูรเดือน: <b>{monthInfo.asuraDir}</b></span>}
                  {monthInfo.caishenDir && <span>ทิศไฉ่ซิ้ง: <b>{monthInfo.caishenDir}</b></span>}
                  {monthInfo.lapDir && <span>ทิศลาภเดือน: <b>{monthInfo.lapDir}</b></span>}
                  {monthInfo.deity && <span>เทพประจำเดือน: <b>{monthInfo.deity}</b></span>}
                </div>
              )}
            </div>
          </div>

          <div className="almanac-cal">
            {WEEKDAY_ABBR.map((wd, i) => (
              <div key={wd} className={`almanac-cal-head${i === 0 ? " almanac-cal-head--sun" : ""}${i === 6 ? " almanac-cal-head--sat" : ""}`}>
                {wd}
              </div>
            ))}
            {Array.from({ length: Math.max(0, WEEKDAY_ORDER.indexOf(data.days[0]?.weekday ?? "")) }).map((_, i) => (
              <div key={`blank-${i}`} className="almanac-cell almanac-cell--empty" />
            ))}
            {data.days.map((day) => {
              const wi = WEEKDAY_ORDER.indexOf(day.weekday);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setDetailDate(day.date)}
                  className={`almanac-cell${day.solarTerm ? ` almanac-cell--term-${day.solarTerm.kind}` : ""}${day.date === TODAY_ISO ? " almanac-cell--today" : ""}${wi === 0 ? " almanac-cell--sun" : ""}${wi === 6 ? " almanac-cell--sat" : ""}`}
                >
                  <span className="almanac-cell-top">
                    <span className="almanac-cell-num">{Number(day.date.slice(8, 10))}</span>
                    <span className="almanac-cell-ganzhi">
                      <span>{day.dayPillar.stem}</span>
                      <span>{day.dayPillar.branch}</span>
                    </span>
                    <span className="almanac-cell-cai">
                      {day.luckyDirection && <span className="almanac-cell-dir">財 {day.luckyDirection.replace("ทิศ ", "")}</span>}
                      <span className="almanac-cell-strength">{pct(day.strength.ratioDay)}</span>
                    </span>
                  </span>

                  <span className="almanac-cell-row2">
                    <span className="almanac-cell-dots" title="สิ่งมงคล (長生/黃道เดือน/黃道ปี/建除)">
                      {[2, 3, 4, 5].map((idx) => (
                        <span key={idx} className="almanac-dot" style={{ background: dotColor(day.strength.values?.[idx] ?? 0) }} />
                      ))}
                    </span>
                    {colorSwatches(day.colors).length > 0 && (
                      <span className="almanac-cell-colors" title={`สีมงคล: ${day.colors.map((c) => c.colors).join(" / ")}`}>
                        {colorSwatches(day.colors).map((c) => (
                          <span key={c.word} className="almanac-swatch" style={{ background: c.hex }} title={c.word} />
                        ))}
                      </span>
                    )}
                  </span>

                  {day.officer && <span className="almanac-cell-officer">{day.officer}</span>}

                  {(day.deities.length > 0 || day.patrons.length > 0) && (
                    <span className="almanac-cell-figs">
                      {day.deities.length > 0 && (
                        <span className="almanac-cell-deity" title={day.deities.join(" / ")}>🛕 {day.deities.join(" ")}</span>
                      )}
                      {day.patrons.length > 0 && (
                        <span className="almanac-cell-animals" title={`เทพอุปถัมภ์: ${day.patrons.map((p) => p.zodiac).join(", ")}`}>
                          {day.patrons.map((p, i) => (
                            <span key={`${p.branch}-${i}`}>{BRANCH_EMOJI[p.branch] ?? "🐾"}</span>
                          ))}
                        </span>
                      )}
                    </span>
                  )}

                  {day.gates.length > 0 && (
                    <span className="almanac-cell-gaterow">
                      {day.gates.map((g, i) => (
                        <span key={`${g.name}-${i}`} className="almanac-gatecell" title={`${g.meaning ?? ""} · ${g.direction}`}>
                          <span className="almanac-gatechar" style={{ color: gateColor(g.name) }}>{g.name}</span>
                          <span className="almanac-gatedir">{g.direction}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  {day.spirits.length > 0 && (
                    <span className="almanac-cell-gates">
                      {day.spirits.map((s, i) => (
                        <span key={`${s.name}-${i}`} className="almanac-gatechar" style={{ color: gateColor(s.name) }} title={s.keywords.join(" · ")}>{s.name}</span>
                      ))}
                    </span>
                  )}

                  {(day.date === TODAY_ISO || day.thaiLunar.isWanPhra || day.solarTerm) && (
                    <span className="almanac-cell-marks">
                      {day.date === TODAY_ISO && <span className="almanac-cell-mark almanac-cell-mark--today">วันนี้</span>}
                      {day.thaiLunar.isWanPhra && <span className="almanac-cell-mark" title="วันพระ">🙏 วันพระ</span>}
                      {day.solarTerm && <span className="almanac-cell-mark" title={`${day.solarTerm.name} ${day.solarTerm.nameTh}`}>{day.solarTerm.isMonthChange ? "🟠" : "🔵"} {day.solarTerm.time}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {(() => {
            const gateLegend = Array.from(new Map((data.days[0]?.gates ?? []).map((g) => [g.name, g])).values());
            const spiritLegend = Array.from(new Map((data.days[0]?.spirits ?? []).map((s) => [s.name, s])).values());
            if (!gateLegend.length && !spiritLegend.length) return null;
            return (
              <details className="almanac-legend">
                <summary>📖 ตารางความหมาย (八門 / 八神)</summary>
                <div className="almanac-legend-grid">
                  {gateLegend.length > 0 && (
                    <div>
                      <h4>8 ประตู 八門</h4>
                      <ul>
                        {gateLegend.map((g) => (
                          <li key={g.name}>
                            <span className="almanac-gatechar" style={{ color: gateColor(g.name) }}>{g.name}</span> {g.meaning ?? ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {spiritLegend.length > 0 && (
                    <div>
                      <h4>8 เทพ 八神</h4>
                      <ul>
                        {spiritLegend.map((s) => (
                          <li key={s.name}>
                            <span className="almanac-gatechar" style={{ color: gateColor(s.name) }}>{s.name}</span> {s.keywords.join(" · ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            );
          })()}

          {detailDate && (() => {
            const day = data.days.find((d) => d.date === detailDate);
            if (!day) return null;
            const close = () => { setDetailDate(null); setEditDate(null); };
            return (
              <div className="almanac-modal-backdrop" onClick={close}>
                <div
                  className={`almanac-modal almanac-day${day.solarTerm ? ` almanac-day--term-${day.solarTerm.kind}` : ""}${day.date === TODAY_ISO ? " almanac-day--today" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button type="button" className="almanac-modal-close" onClick={close} aria-label="ปิด">✕</button>
                  {renderDayDetail(day)}

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
                </div>
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
}

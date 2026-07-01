"use client";

import type { ManVsDayDaySummary } from "@/lib/bazi/manvsday";

const WEEKDAY_HEADERS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** สีระบายช่องตามคะแนนรวม (วันดี = เขียว, วันเสีย = แดง). */
function scoreColor(percent: number | null): string {
  if (percent == null) return "#e5e7eb";
  if (percent >= 66) return "#86efac"; // เขียว
  if (percent >= 50) return "#d9f99d"; // เขียวอ่อน
  if (percent >= 33) return "#fed7aa"; // ส้ม
  return "#fecaca"; // แดง
}

type Props = {
  days: ManVsDayDaySummary[];
  /** ISO ของวันที่กำลังเลือกอยู่ (ไฮไลต์กรอบ) */
  selectedDate?: string | null;
  onSelectDay: (date: string) => void;
};

export function ManVsDayCalendar({ days, selectedDate, onSelectDay }: Props) {
  if (!days.length) return null;
  // ช่องว่างนำหน้าให้ตรงวันในสัปดาห์ (getDay ของวันที่ 1)
  const first = days[0];
  const firstWeekday = new Date(`${first.date}T00:00:00`).getDay();
  const leading = Array.from({ length: firstWeekday }, (_, i) => i);

  return (
    <div className="mvd-calendar">
      <div className="mvd-calendar__grid mvd-calendar__grid--head">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="mvd-calendar__wd">{w}</div>
        ))}
      </div>
      <div className="mvd-calendar__grid">
        {leading.map((i) => (
          <div key={`lead-${i}`} className="mvd-calendar__cell mvd-calendar__cell--empty" />
        ))}
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className="mvd-calendar__cell"
            data-selected={d.date === selectedDate}
            style={{ background: scoreColor(d.overallPercent) }}
            onClick={() => onSelectDay(d.date)}
            title={`${d.date} · ${d.dayGanzhi} · เหมาะ ${d.overallPercent ?? "-"}% · กำลังวัน ${Math.round(d.dayStrength * 100)}%`}
          >
            <span className="mvd-calendar__num">{d.dayOfMonth}</span>
            <span className="mvd-calendar__gz">{d.dayGanzhi}</span>
            <span className="mvd-calendar__pct">{d.overallPercent ?? "-"}%</span>
          </button>
        ))}
      </div>
      <div className="mvd-calendar__legend">
        <span><i style={{ background: "#86efac" }} /> วันดีมาก ≥66%</span>
        <span><i style={{ background: "#d9f99d" }} /> ดี 50–65%</span>
        <span><i style={{ background: "#fed7aa" }} /> ปานกลาง 33–49%</span>
        <span><i style={{ background: "#fecaca" }} /> ควรระวัง &lt;33%</span>
      </div>
    </div>
  );
}

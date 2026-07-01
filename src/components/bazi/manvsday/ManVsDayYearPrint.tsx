"use client";

import type { ManVsDayMonth } from "@/lib/bazi/manvsday";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAY_HEADERS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function scoreColor(percent: number | null): string {
  if (percent == null) return "#e5e7eb";
  if (percent >= 66) return "#86efac";
  if (percent >= 50) return "#d9f99d";
  if (percent >= 33) return "#fed7aa";
  return "#fecaca";
}

function MonthGrid({ month }: { month: ManVsDayMonth }) {
  const first = month.days[0];
  const leading = first ? new Date(`${first.date}T00:00:00`).getDay() : 0;
  return (
    <div className="mvd-print__month">
      <h3>{TH_MONTHS[month.month - 1]}</h3>
      <div className="mvd-print__grid mvd-print__grid--head">
        {WEEKDAY_HEADERS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="mvd-print__grid">
        {Array.from({ length: leading }, (_, i) => <span key={`l${i}`} className="mvd-print__empty" />)}
        {month.days.map((d) => (
          <span key={d.date} className="mvd-print__day" style={{ background: scoreColor(d.overallPercent) }}>
            <b>{d.dayOfMonth}</b>
            <em>{d.dayGanzhi}</em>
            <i>{d.overallPercent ?? "-"}</i>
          </span>
        ))}
      </div>
    </div>
  );
}

type Props = {
  year: number; // ค.ศ.
  ownerLabel: string;
  dayPillarLabel: string;
  months: ManVsDayMonth[];
};

/** รายงานปฏิทินส่วนตัวรายปี — แสดงเฉพาะตอนพิมพ์ (reuse .pair-print-report). */
export function ManVsDayYearPrint({ year, ownerLabel, dayPillarLabel, months }: Props) {
  return (
    <div className="pair-print-report mvd-print">
      <div className="pair-print__header">
        <h1>ปฏิทินส่วนตัว (ดวงกับวัน) · พ.ศ. {year + 543}</h1>
        <div className="pair-print__date">
          {ownerLabel} · หลักวัน {dayPillarLabel} — วันดีวันเสียเฉพาะดวงคุณตลอดทั้งปี
        </div>
      </div>
      <div className="mvd-print__legend">
        <span><i style={{ background: "#86efac" }} /> วันดีมาก ≥66%</span>
        <span><i style={{ background: "#d9f99d" }} /> ดี 50–65%</span>
        <span><i style={{ background: "#fed7aa" }} /> ปานกลาง 33–49%</span>
        <span><i style={{ background: "#fecaca" }} /> ควรระวัง &lt;33%</span>
        <span>ตัวเลข = คะแนนความเหมาะของวันนั้นกับดวงคุณ (%)</span>
      </div>
      <div className="mvd-print__year">
        {months.map((m) => <MonthGrid key={m.month} month={m} />)}
      </div>
    </div>
  );
}

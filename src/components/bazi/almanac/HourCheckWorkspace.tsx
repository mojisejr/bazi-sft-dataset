"use client";

import { useState } from "react";

type HourQuality = {
  date: string; hour: number; dayPillar: string; hourBranch: string;
  range: string; god: string; meaning: string; score: number; good: boolean;
};

export function HourCheckWorkspace() {
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

  return (
    <section className="almanac-workspace">
      <div className="almanac-monthbar">
        <h2 className="almanac-title">ตรวจยาม (จับยาม)</h2>
        <p className="almanac-monthmeta">
          <span>วิชาแยกออกมา — เลือกวัน + เวลา (0–23) แล้วกด “ตรวจยาม” เพื่อดูคุณภาพยาม (黃道) ของชั่วโมงนั้น</span>
        </p>
      </div>

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
    </section>
  );
}

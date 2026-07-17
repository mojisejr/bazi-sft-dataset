"use client";

import { useEffect, useMemo, useRef } from "react";

import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";

type Props = {
  /** ก้านวัน (ดิถี) เช่น "庚" — ใช้คำนวณเชี่ยงแซต่อปีจร */
  dayMaster?: string;
  /** ปีเกิด (ค.ศ.) — ถ้ามีจะโชว์อายุจีนต่อปี */
  birthYear?: number;
};

/**
 * ตารางปีจร (流年) แบบ "สไลด์ดูอย่างเดียว" — วางเหนือกล่องบท "จุดเปลี่ยน/วัยจร"
 * เลื่อนดูกะจื่อ/เชี่ยงแซแต่ละปีได้ ไฮไลต์ปีปัจจุบันเป็นจุดอ้างอิง (screen-only ไม่พิมพ์ลง PDF)
 */
export function AnnualPillarPicker({ dayMaster, birthYear }: Props) {
  const nowRef = useRef<HTMLDivElement | null>(null);

  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => {
    const first = birthYear ? Math.max(birthYear, nowYear - 3) : nowYear - 3;
    const last = nowYear + 57;
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [birthYear, nowYear]);

  // เลื่อนการ์ดปีปัจจุบันให้อยู่กลางจอตอนแรก
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  return (
    <div className="annual-picker no-print">
      <p className="annual-picker__hint">ปีจร (流年) — เลื่อน ← → เพื่อดูกะจื่อ/เชี่ยงแซแต่ละปี</p>
      <div className="annual-picker__strip">
        {years.map((y) => {
          const { stem, branch } = annualGanzhi(y);
          const qi = dayMaster ? resolveDisplayTwelveQiStage(dayMaster, branch) : "";
          const isNow = y === nowYear;
          return (
            <div
              key={y}
              ref={isNow ? nowRef : undefined}
              className={`annual-picker__cell${isNow ? " is-active" : ""}`}
            >
              <span className="annual-picker__yr">
                {y} <span className="annual-picker__be">พ.ศ. {y + 543}</span>
              </span>
              <span className="annual-picker__gz">
                {stem}
                {branch}
              </span>
              {qi ? <span className="annual-picker__qi">{qi}</span> : null}
              {birthYear ? <span className="annual-picker__age">อายุ {y - birthYear + 1} ปี</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

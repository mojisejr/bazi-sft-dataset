"use client";

import { useEffect, useMemo, useRef } from "react";

import { glyphElementStyle } from "@/components/bazi/reading/ChartPillarTable";
import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import {
  resolveDisplayStemPairStage,
  resolveDisplayTwelveQiStage,
} from "@/lib/bazi/pillar-display";

type Props = {
  /** ก้านวัน (ดิถี) เช่น "庚" — ใช้คำนวณเชี่ยงแซต่อปีจร */
  dayMaster?: string;
  /** ปีเกิด (ค.ศ.) — ถ้ามีจะโชว์อายุจีนต่อปี */
  birthYear?: number;
};

/**
 * ตารางปีจร (流年) แบบ "สไลด์ดูอย่างเดียว" — ซินแสสั่งให้ย้ายขึ้นไปไว้เหนือบทที่ 1
 * (คู่กับตารางวัยจรในพื้นดวง) และให้การ์ดเป็น "แนวตั้งเหมือนผังดวง":
 * ราศีบน + เชี่ยงแซของราศีบน / ราศีล่าง + เชี่ยงแซของราศีล่าง · สีอักษรตามธาตุ
 * ไฮไลต์ปีปัจจุบันเป็นจุดอ้างอิง (screen-only ไม่พิมพ์ลง PDF)
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
          const stemQi = dayMaster ? resolveDisplayStemPairStage(dayMaster, stem) : "";
          const branchQi = dayMaster ? resolveDisplayTwelveQiStage(dayMaster, branch) : "";
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
              <span
                className="destiny-glyph destiny-glyph--compact"
                style={glyphElementStyle(stem, "stem")}
              >
                {stem}
              </span>
              {stemQi ? <span className="annual-picker__qi">{stemQi}</span> : null}
              <span
                className="destiny-glyph destiny-glyph--compact"
                style={glyphElementStyle(branch, "branch")}
              >
                {branch}
              </span>
              {branchQi ? <span className="annual-picker__qi">{branchQi}</span> : null}
              {birthYear ? <span className="annual-picker__age">อายุ {y - birthYear + 1} ปี</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

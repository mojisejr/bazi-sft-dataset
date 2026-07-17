"use client";

import { useEffect, useMemo, useRef } from "react";

import { annualGanzhi } from "@/lib/bazi/annual-ganzhi";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";

type Props = {
  /** ก้านวัน (ดิถี) เช่น "庚" — ใช้คำนวณเชี่ยงแซต่อปีจร */
  dayMaster?: string;
  /** ปีเกิด (ค.ศ.) — ถ้ามีจะโชว์อายุจีนต่อปี */
  birthYear?: number;
  /** ปีจรที่เลือกอยู่ (ค.ศ.) */
  selectedYear: number;
  /** กำลังโหลดคำทำนายปีใหม่ → ปิดปุ่มชั่วคราว */
  busy?: boolean;
  onSelect: (year: number) => void;
};

/**
 * ตารางปีจร (流年) แบบ "สไลด์แนวนอน" คลิกเลือกได้ — วางเหนือกล่องบท "จุดเปลี่ยน/วัยจร"
 * คลิกการ์ดปี → บทปีจรทำนายใหม่โดยยึดปีนั้นเป็น "ปีปัจจุบัน" (screen-only, ไม่พิมพ์ลง PDF)
 */
export function AnnualPillarPicker({ dayMaster, birthYear, selectedYear, busy, onSelect }: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // ช่วงปีที่ให้เลื่อนดู: ย้อน 3 ปี → หน้าอีก ~57 ปี (ครอบคลุมวัยจรที่เหลือ)
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const years = useMemo(() => {
    const first = birthYear ? Math.max(birthYear, nowYear - 3) : nowYear - 3;
    const last = nowYear + 57;
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [birthYear, nowYear]);

  // เลื่อนการ์ดปีที่เลือกให้อยู่กลางจอเมื่อเปลี่ยนปี
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedYear]);

  return (
    <div className="annual-picker no-print">
      <p className="annual-picker__hint">
        {busy
          ? "กำลังทำนายปีจรใหม่…"
          : "เลื่อน ← → แล้วแตะปีจรที่ต้องการ · บท “จุดเปลี่ยน/วัยจร” จะทำนายใหม่ตามปีที่เลือก"}
      </p>
      <div className="annual-picker__strip" ref={stripRef}>
        {years.map((y) => {
          const { stem, branch } = annualGanzhi(y);
          const qi = dayMaster ? resolveDisplayTwelveQiStage(dayMaster, branch) : "";
          const active = y === selectedYear;
          return (
            <button
              key={y}
              ref={active ? activeRef : undefined}
              type="button"
              className={`annual-picker__cell${active ? " is-active" : ""}`}
              disabled={busy}
              aria-pressed={active}
              onClick={() => onSelect(y)}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

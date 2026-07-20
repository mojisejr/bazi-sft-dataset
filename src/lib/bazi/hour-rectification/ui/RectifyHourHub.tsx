"use client";

// Hour Rectification — unified hub (#hour-rectification-engine). รวม 3 โหมดสอบยามไว้หน้าเดียว
// (/rectify-hour) สลับด้วยแท็บ แทนลิงก์แยก 3 หน้าเดิมที่กระจัดกระจาย:
//   1. สอบจากคำทำนาย (v3, default — ทดสอบเคสจริงแล้วแม่นสุด)
//   2. สอบจากเหตุการณ์ชีวิต (v2)
//   3. แบบคำถามบุคลิก (v1, legacy)
// หน้า /rectify-hour/events และ /rectify-hour/reading ยังอยู่ (deep link) — hub แค่ mount
// experience เดิมทั้งสามตัว ไม่แตะ logic ข้างใน
import { useState } from "react";

import { RectifyHourExperience } from "./RectifyHourExperience";
import { RectifyByEventsExperience } from "./RectifyByEventsExperience";
import { RectifyByReadingExperience } from "./RectifyByReadingExperience";

const MODES = [
  {
    id: "reading",
    label: "สอบจากคำทำนาย",
    hint: "ตอบคำถามที่สร้างจากคำทำนายจริงของดวงคุณ (บริวาร/ลูก/ความคิดเวลาอยู่คนเดียว)",
  },
  {
    id: "events",
    label: "สอบจากเหตุการณ์ชีวิต",
    hint: "รู้ปีเหตุการณ์สำคัญ เช่น แต่งงาน/เปลี่ยนงาน/มีบุตร",
  },
  {
    id: "quiz",
    label: "แบบคำถามบุคลิก (เดิม)",
    hint: "ชุดคำถามนิสัย/พฤติกรรมแบบเดิม",
  },
] as const;

type ModeId = (typeof MODES)[number]["id"];

export function RectifyHourHub({ initialMode = "reading" }: { initialMode?: ModeId }) {
  const [mode, setMode] = useState<ModeId>(initialMode);

  return (
    <div className="rectify-hub">
      <div className="rectify-hub__tabs" role="tablist" aria-label="เลือกวิธีสอบยาม">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`rectify-hub__tab${mode === m.id ? " rectify-hub__tab--active" : ""}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="rectify-hub__hint">{MODES.find((m) => m.id === mode)?.hint}</p>

      {mode === "reading" ? <RectifyByReadingExperience /> : null}
      {mode === "events" ? <RectifyByEventsExperience /> : null}
      {mode === "quiz" ? <RectifyHourExperience /> : null}
    </div>
  );
}

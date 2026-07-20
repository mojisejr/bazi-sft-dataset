"use client";

// Hour Rectification v3 — reading-diff experience (#hour-rectification-engine, สอบจากคำทำนาย).
// Self-contained client component: วันเกิด+เพศ → เลือกช่วงกว้างของวัน (gate ตามหลักอาจารย์) →
// ตอบคำถามที่สร้างจาก "คำทำนายจริง" ของดวง 12 ยามตัวเอง → shortlist 3-4 ยาม + เวลาโดยประมาณ
// คุยกับ /api/bazi/rectify-hour/reading เท่านั้น (stateless: ส่ง trail ทั้งก้อนทุก step)
// Reuse CSS ของ v2 (rectify-events__*) — ไม่เพิ่มไฟล์สไตล์ใหม่
//
// IMPORTANT (v1 barrel-bug lesson): value-imports จาก pure modules เท่านั้น; response shapes เป็น
// `import type` เพื่อไม่ให้ engine ฝั่ง server หลุดเข้า client bundle
import { useCallback, useState, type FormEvent } from "react";

import { Badge } from "@/components/bazi/primitives/Badge";
import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import { Surface } from "@/components/bazi/primitives/Surface";
import {
  BUDDHIST_ERA_YEAR_OPTIONS,
  THAI_MONTH_OPTIONS,
  buildBirthDateValue,
  createDefaultFormState,
  getBirthDayOptions,
} from "@/lib/bazi/trainer-workspace";
import type { ReadingAnswer } from "@/lib/bazi/hour-rectification/domain/reading-diff";
import type { RunReadingResult } from "@/lib/bazi/hour-rectification/run-reading";

const PROVINCE_DEFAULT = "กรุงเทพมหานคร";
const EVENTS_FALLBACK_HREF = "/rectify-hour/events";

export function RectifyByReadingExperience() {
  const defaults = createDefaultFormState();
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYearBe, setBirthYearBe] = useState("");
  const [gender, setGender] = useState<string>(defaults.gender);

  const [birthDate, setBirthDate] = useState<string | null>(null); // ล็อกไว้หลัง submit ฟอร์ม
  const [daypart, setDaypart] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ReadingAnswer[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<RunReadingResult | null>(null);

  const dayOptions = getBirthDayOptions(birthMonth, birthYearBe);
  const formReady = Boolean(
    buildBirthDateValue({ ...defaults, birthDay, birthMonth, birthYearBe }),
  );

  const callStep = useCallback(
    async (payload: {
      birthDate: string;
      daypart?: string;
      answers: ReadingAnswer[];
    }) => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/bazi/rectify-hour/reading", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, gender, province: PROVINCE_DEFAULT }),
        });
        const data = (await response.json()) as RunReadingResult & { error?: string };
        if (!response.ok) {
          setError(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
          return;
        }
        setStep(data);
      } catch {
        setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
      } finally {
        setSubmitting(false);
      }
    },
    [gender],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      const value = buildBirthDateValue({ ...defaults, birthDay, birthMonth, birthYearBe });
      if (!value) {
        setError("กรุณาเลือกวัน เดือน ปีเกิดให้ครบและถูกต้อง");
        return;
      }
      setBirthDate(value);
      await callStep({ birthDate: value, answers: [] });
    },
    [submitting, defaults, birthDay, birthMonth, birthYearBe, callStep],
  );

  const handleDaypart = useCallback(
    async (id: string) => {
      if (!birthDate || submitting) return;
      setDaypart(id);
      await callStep({ birthDate, daypart: id, answers: [] });
    },
    [birthDate, submitting, callStep],
  );

  const handleAnswer = useCallback(
    async (questionId: string, optionId: string) => {
      if (!birthDate || !daypart || submitting) return;
      const next = [...answers, { questionId, optionId }];
      setAnswers(next);
      await callStep({ birthDate, daypart, answers: next });
    },
    [birthDate, daypart, submitting, answers, callStep],
  );

  const handleRestart = useCallback(() => {
    setStep(null);
    setError(null);
    setBirthDate(null);
    setDaypart(null);
    setAnswers([]);
    setBirthDay("");
    setBirthMonth("");
    setBirthYearBe("");
    setGender(defaults.gender);
  }, [defaults.gender]);

  const betaBadge = <Badge tone="ai">beta</Badge>;

  // ── ผลสรุป ──
  if (step?.status === "result") {
    return <ReadingResultView result={step} betaBadge={betaBadge} onRestart={handleRestart} />;
  }

  // ── gate: ไม่ทราบช่วงเลย → ไม่ไปต่อ (ตามหลักอาจารย์) ──
  if (step?.status === "unknown_daypart") {
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading title="ยังสอบยามด้วยคำถามไม่ได้" titleLevel="h3" actions={betaBadge} />
          <div className="rectify-events__inconclusive" role="status">
            <p>{step.message}</p>
          </div>
          <div className="rectify-events__result-actions">
            <ActionButton tone="secondary" type="button" onClick={handleRestart}>
              เริ่มใหม่
            </ActionButton>
            <ActionButton tone="primary" type="button" onClick={() => (window.location.href = EVENTS_FALLBACK_HREF)}>
              สอบจากเหตุการณ์ชีวิต →
            </ActionButton>
          </div>
        </Surface>
      </div>
    );
  }

  // ── เลือกช่วงกว้างของวัน ──
  if (step?.status === "need_daypart") {
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading
            kicker="Hour Rectification · สอบจากคำทำนาย"
            title="พอทราบไหมว่าคุณเกิดช่วงไหนของวัน?"
            note="ถามคนในครอบครัวได้ยิ่งดี — ช่วงกว้างนี้ช่วยจำกัดยามก่อนเริ่มคำถาม"
            actions={betaBadge}
          />
          <div className="rectify-reading__choices">
            {step.dayparts.map((d) => (
              <button
                key={d.id}
                type="button"
                className="rectify-reading__choice"
                disabled={submitting}
                onClick={() => handleDaypart(d.id)}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              className="rectify-reading__choice rectify-reading__choice--muted"
              disabled={submitting}
              onClick={() => handleDaypart("unknown")}
            >
              ไม่ทราบเลย
            </button>
          </div>
          {error ? <p className="rectify-events__error" role="alert">{error}</p> : null}
        </Surface>
      </div>
    );
  }

  // ── คำถามจากคำทำนาย ──
  if (step?.status === "question") {
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading
            kicker={`คำถาม ${step.questionNumber}/${step.totalQuestions}`}
            title={step.question}
            note="เลือกข้อที่ใกล้เคียงชีวิตจริงที่สุด — ถ้าไม่มีข้อไหนตรง เลือกข้อสุดท้ายเพื่อข้ามได้"
            actions={betaBadge}
          />
          <div className="rectify-reading__choices">
            {step.options.map((o) => (
              <button
                key={o.id}
                type="button"
                className="rectify-reading__choice"
                disabled={submitting}
                onClick={() => handleAnswer(step.questionId, o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {error ? <p className="rectify-events__error" role="alert">{error}</p> : null}
        </Surface>
      </div>
    );
  }

  // ── ฟอร์มวันเกิด ──
  return (
    <div className="rectify-events">
      <Surface className="rectify-events__card" as="section">
        <SectionHeading
          kicker="Hour Rectification · สอบจากคำทำนาย"
          title="🔎 สอบยามจากคำทำนายของดวงคุณเอง"
          note="ระบบคำนวณดวงทั้ง 12 ยามของคุณ แล้วถามเฉพาะจุดที่คำทำนายต่างกันจริง (บริวาร/ลูก/ความคิดเวลาอยู่คนเดียว)"
          actions={betaBadge}
        />

        <form className="rectify-events__form" onSubmit={handleSubmit}>
          <fieldset className="rectify-events__fieldset" disabled={submitting}>
            <legend className="rectify-events__legend">วันเกิด (พ.ศ.)</legend>
            <div className="rectify-events__date-grid">
              <label className="rectify-events__field">
                <span>วัน</span>
                <select value={birthDay} onChange={(e) => setBirthDay(e.target.value)} aria-label="วันเกิด">
                  <option value="">วัน</option>
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="rectify-events__field">
                <span>เดือน</span>
                <select value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} aria-label="เดือนเกิด">
                  <option value="">เดือน</option>
                  {THAI_MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label className="rectify-events__field">
                <span>ปี (พ.ศ.)</span>
                <select value={birthYearBe} onChange={(e) => setBirthYearBe(e.target.value)} aria-label="ปีเกิด พ.ศ.">
                  <option value="">ปี</option>
                  {BUDDHIST_ERA_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rectify-events__gender">
              <span className="rectify-events__gender-label">เพศ</span>
              <label className="rectify-events__radio">
                <input type="radio" name="rectify-reading-gender" checked={gender === "male"} onChange={() => setGender("male")} />
                ชาย
              </label>
              <label className="rectify-events__radio">
                <input type="radio" name="rectify-reading-gender" checked={gender === "female"} onChange={() => setGender("female")} />
                หญิง
              </label>
            </div>
          </fieldset>

          {error ? <p className="rectify-events__error" role="alert">{error}</p> : null}

          <div className="rectify-events__form-actions">
            <ActionButton tone="primary" type="submit" disabled={!formReady || submitting}>
              {submitting ? "กำลังคำนวณดวง 12 ยาม…" : "เริ่มสอบยาม →"}
            </ActionButton>
          </div>

          <p className="rectify-events__fallback">
            รู้ปีเหตุการณ์สำคัญ (แต่งงาน/มีบุตร…)? <a href={EVENTS_FALLBACK_HREF}>สอบจากเหตุการณ์ชีวิต</a>
          </p>

          <details className="rectify-events__tester-note">
            <summary>ℹ️ สำหรับผู้ทดสอบ</summary>
            <p>
              โหมดนี้สร้างคำถามจาก &quot;คำทำนายจริง&quot; ของดวง 12 ยามของผู้ตอบ (คลังเดียวกับหน้าอ่าน 15 บท)
              เฉพาะจุดที่เสายามคุม: บริวาร · ภพลูก · ความคิดเวลาอยู่คนเดียว — ไม่มีคำถามเรื่องเพศ
              และเป้าหมายคือเหลือ 3-4 ยามอย่างซื่อสัตย์ ไม่ฟันธง 1 ยามถ้าหลักฐานไม่พอ
            </p>
          </details>
        </form>
      </Surface>
    </div>
  );
}

function ReadingResultView({
  result,
  betaBadge,
  onRestart,
}: {
  result: Extract<RunReadingResult, { status: "result" }>;
  betaBadge: React.ReactNode;
  onRestart: () => void;
}) {
  const { shortlist, timeEstimate, answeredCount, totalQuestions, daypartLabel, daypartOnly } = result;
  return (
    <div className="rectify-events">
      <Surface className="rectify-events__card" as="section">
        <SectionHeading title="ผลการสอบยาม" titleLevel="h3" actions={betaBadge} />

        {daypartOnly ? (
          <div className="rectify-events__inconclusive" role="status">
            <p>
              {totalQuestions === 0
                ? `คำทำนายของยามในช่วง${daypartLabel} ไม่ต่างกันพอจะตั้งคำถามแยกได้ — ระบบจึงบอกได้แค่ระดับช่วงของวัน`
                : `คุณข้ามคำถามทั้งหมด — ระบบจึงบอกได้แค่ระดับช่วงของวัน (${daypartLabel}) ยังจำกัดเป็นรายยามไม่ได้`}
            </p>
          </div>
        ) : timeEstimate ? (
          <div className="rectify-events__time">
            <span className="rectify-events__time-lead">เวลาเกิดโดยประมาณของคุณ</span>
            <span className="rectify-events__time-point">🕗 ~ {timeEstimate.point} น.</span>
            <span className="rectify-events__time-range">
              (ช่วง {timeEstimate.rangeStart} – {timeEstimate.rangeEnd} น.)
              {timeEstimate.spansAdjacent ? " · คาบเกี่ยว 2 ยาม" : ""}
            </span>
          </div>
        ) : null}

        <div className="rectify-events__reasons">
          <h4 className="rectify-events__reasons-title">
            ยามที่เข้าเค้าที่สุด ({shortlist.length} จาก 12) · ช่วง{daypartLabel} · ตอบจริง {answeredCount}/{totalQuestions} ข้อ
          </h4>
          <ul>
            {shortlist.map((s, index) => (
              <li key={s.hourBranch}>
                #{index + 1} ยาม{s.hourBranch} ({s.hourLabel}) — {s.window.start}–{s.window.end} น.
                {s.score > 0 ? ` · คะแนน ${s.score}` : ""}
              </li>
            ))}
          </ul>
        </div>

        <p className="rectify-events__beta-warning">
          ⚠ ค่าประมาณ (beta) · ความละเอียดสูงสุดคือช่วง 2 ชั่วโมง — ใช้ประกอบการพิจารณา ไม่ใช่คำตอบสุดท้าย
        </p>

        <div className="rectify-events__result-actions">
          <ActionButton tone="secondary" type="button" onClick={onRestart}>
            สอบใหม่
          </ActionButton>
        </div>
      </Surface>
    </div>
  );
}

"use client";

// Hour Rectification — combined experience (#hour-rectification-engine, unified lane).
// flow เดียวถามต่อเนื่อง (ตามซินแส: "ไม่ใช่แยกถาม"):
//   ฟอร์มวันเกิด → ช่วงของวัน → เหตุการณ์ชีวิต (0-4, ข้ามได้) → คำถามจากคำทำนาย → ผลรวมคะแนน
// สองขั้นแรกเก็บฝั่ง client (ไม่ยิง API) — ยิง /api/bazi/rectify-hour/combined ตั้งแต่ขั้นคำถาม
// โดยส่ง trail ทั้งก้อน (daypart + events + answers) ทุก step แบบ stateless
import { useCallback, useRef, useState, type FormEvent } from "react";

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
import {
  EVENT_LABELS_TH,
  EVENT_TYPES,
  MAX_EVENTS,
  type EventType,
  type LifeEvent,
} from "@/lib/bazi/hour-rectification/domain/events";
import { DAYPARTS } from "@/lib/bazi/hour-rectification/domain/reading-diff";
import type { ReadingAnswer } from "@/lib/bazi/hour-rectification/domain/reading-diff";
import type { RunCombinedResult } from "@/lib/bazi/hour-rectification/run-combined";

const PROVINCE_DEFAULT = "กรุงเทพมหานคร";
const BE_OFFSET = 543;

type EventRow = { id: number; type: EventType | ""; yearBe: string };
type Phase = "form" | "daypart" | "events" | "server";

export function RectifyCombinedExperience() {
  const defaults = createDefaultFormState();
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYearBe, setBirthYearBe] = useState("");
  const [gender, setGender] = useState<string>(defaults.gender);

  const [phase, setPhase] = useState<Phase>("form");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [daypart, setDaypart] = useState<string | null>(null);
  const rowId = useRef(1);
  const [rows, setRows] = useState<EventRow[]>([{ id: 0, type: "", yearBe: "" }]);
  const [answers, setAnswers] = useState<ReadingAnswer[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<RunCombinedResult | null>(null);

  const dayOptions = getBirthDayOptions(birthMonth, birthYearBe);
  const formReady = Boolean(
    buildBirthDateValue({ ...defaults, birthDay, birthMonth, birthYearBe }),
  );

  const filledEvents = (): LifeEvent[] =>
    rows
      .filter((r) => r.type && r.yearBe)
      .map((r) => ({ type: r.type as EventType, year: Number.parseInt(r.yearBe, 10) - BE_OFFSET }));

  const callStep = useCallback(
    async (payload: { daypart: string; events: LifeEvent[]; answers: ReadingAnswer[] }) => {
      if (!birthDate) return;
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/bazi/rectify-hour/combined", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, birthDate, gender, province: PROVINCE_DEFAULT }),
        });
        const data = (await response.json()) as RunCombinedResult & { error?: string };
        if (!response.ok) {
          setError(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
          return;
        }
        setStep(data);
        setPhase("server");
      } catch {
        setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
      } finally {
        setSubmitting(false);
      }
    },
    [birthDate, gender],
  );

  const handleFormSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const value = buildBirthDateValue({ ...defaults, birthDay, birthMonth, birthYearBe });
      if (!value) {
        setError("กรุณาเลือกวัน เดือน ปีเกิดให้ครบและถูกต้อง");
        return;
      }
      setError(null);
      setBirthDate(value);
      setPhase("daypart");
    },
    [defaults, birthDay, birthMonth, birthYearBe],
  );

  const handleDaypart = useCallback((id: string) => {
    setDaypart(id);
    setError(null);
    setPhase("events");
  }, []);

  const handleEventsDone = useCallback(async () => {
    if (!daypart) return;
    await callStep({ daypart, events: filledEvents(), answers: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daypart, rows, callStep]);

  const handleAnswer = useCallback(
    async (questionId: string, optionId: string) => {
      if (!daypart || submitting) return;
      const next = [...answers, { questionId, optionId }];
      setAnswers(next);
      await callStep({ daypart, events: filledEvents(), answers: next });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [daypart, submitting, answers, rows, callStep],
  );

  const handleRestart = useCallback(() => {
    setPhase("form");
    setStep(null);
    setError(null);
    setBirthDate(null);
    setDaypart(null);
    setAnswers([]);
    setRows([{ id: rowId.current++, type: "", yearBe: "" }]);
    setBirthDay("");
    setBirthMonth("");
    setBirthYearBe("");
    setGender(defaults.gender);
  }, [defaults.gender]);

  const addRow = useCallback(() => {
    setRows((prev) =>
      prev.length >= MAX_EVENTS ? prev : [...prev, { id: rowId.current++, type: "", yearBe: "" }],
    );
  }, []);
  const removeRow = useCallback((id: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);
  const updateRow = useCallback((id: number, patch: Partial<EventRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const betaBadge = <Badge tone="ai">beta</Badge>;

  // ── ผลสรุป ──
  if (phase === "server" && step?.status === "result") {
    return <CombinedResultView result={step} betaBadge={betaBadge} onRestart={handleRestart} />;
  }

  // ── gate: สัญญาณไม่พอ ──
  if (phase === "server" && step?.status === "need_more_signal") {
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading title="ข้อมูลยังไม่พอสอบยาม" titleLevel="h3" actions={betaBadge} />
          <div className="rectify-events__inconclusive" role="status">
            <p>{step.message}</p>
          </div>
          <div className="rectify-events__result-actions">
            <ActionButton tone="secondary" type="button" onClick={() => setPhase("events")}>
              ← เพิ่มเหตุการณ์
            </ActionButton>
            <ActionButton tone="primary" type="button" onClick={handleRestart}>
              เริ่มใหม่
            </ActionButton>
          </div>
        </Surface>
      </div>
    );
  }

  // ── คำถามจากคำทำนาย (ต่อเนื่องจาก events ไม่มีสะดุด) ──
  if (phase === "server" && step?.status === "question") {
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading
            kicker={`ขั้นที่ 3 · คำถาม ${step.questionNumber}/${step.totalQuestions}`}
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

  // ── ขั้นที่ 2: เหตุการณ์ชีวิต (ข้ามได้) ──
  if (phase === "events") {
    const filled = filledEvents().length;
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading
            kicker="ขั้นที่ 2 · เหตุการณ์ชีวิต"
            title="มีเหตุการณ์สำคัญที่จำปีได้ไหม?"
            note="แต่งงาน/มีบุตร/เปลี่ยนงาน… ยิ่งระบุมากยิ่งแม่น — ไม่มีก็ข้ามได้"
            actions={betaBadge}
          />
          <div className="rectify-events__events">
            {rows.map((row) => (
              <div key={row.id} className="rectify-events__event-row">
                <select
                  className="rectify-events__event-type"
                  value={row.type}
                  onChange={(e) => updateRow(row.id, { type: e.target.value as EventType })}
                  aria-label="ประเภทเหตุการณ์"
                >
                  <option value="">— เลือกเหตุการณ์ —</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_LABELS_TH[t].emoji} {EVENT_LABELS_TH[t].label}
                    </option>
                  ))}
                </select>
                <select
                  className="rectify-events__event-year"
                  value={row.yearBe}
                  onChange={(e) => updateRow(row.id, { yearBe: e.target.value })}
                  aria-label="ปีที่เกิดเหตุการณ์"
                >
                  <option value="">ปี พ.ศ.</option>
                  {BUDDHIST_ERA_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rectify-events__event-remove"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  aria-label="ลบเหตุการณ์"
                >
                  ✕
                </button>
              </div>
            ))}
            {rows.length < MAX_EVENTS ? (
              <button type="button" className="rectify-events__add" onClick={addRow}>
                + เพิ่มเหตุการณ์
              </button>
            ) : null}
          </div>
          {error ? <p className="rectify-events__error" role="alert">{error}</p> : null}
          <div className="rectify-events__result-actions">
            <ActionButton tone="secondary" type="button" disabled={submitting} onClick={handleEventsDone}>
              {filled > 0 ? "ไปคำถามถัดไป →" : "ไม่มี/จำไม่ได้ — ข้ามไปคำถาม →"}
            </ActionButton>
          </div>
        </Surface>
      </div>
    );
  }

  // ── ขั้นที่ 1.5: ช่วงของวัน ──
  if (phase === "daypart") {
    return (
      <div className="rectify-events">
        <Surface className="rectify-events__card" as="section">
          <SectionHeading
            kicker="ขั้นที่ 1 · ช่วงของวัน"
            title="พอทราบไหมว่าคุณเกิดช่วงไหนของวัน?"
            note="ถามคนในครอบครัวได้ยิ่งดี — ช่วงกว้างนี้ช่วยจำกัดยามก่อนเริ่มคำถาม"
            actions={betaBadge}
          />
          <div className="rectify-reading__choices">
            {DAYPARTS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="rectify-reading__choice"
                onClick={() => handleDaypart(d.id)}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              className="rectify-reading__choice rectify-reading__choice--muted"
              onClick={() => handleDaypart("unknown")}
            >
              ไม่ทราบเลย (ต้องมีเหตุการณ์ ≥2 อย่างแทน)
            </button>
          </div>
        </Surface>
      </div>
    );
  }

  // ── ฟอร์มวันเกิด ──
  return (
    <div className="rectify-events">
      <Surface className="rectify-events__card" as="section">
        <SectionHeading
          kicker="Hour Rectification"
          title="🕰️ สอบยาม — หาเวลาเกิดโดยประมาณ"
          note="ตอบต่อเนื่องในชุดเดียว: ช่วงของวัน → เหตุการณ์ชีวิต → คำถามจากคำทำนายจริงของดวงคุณ"
          actions={betaBadge}
        />

        <form className="rectify-events__form" onSubmit={handleFormSubmit}>
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
                <input type="radio" name="rectify-combined-gender" checked={gender === "male"} onChange={() => setGender("male")} />
                ชาย
              </label>
              <label className="rectify-events__radio">
                <input type="radio" name="rectify-combined-gender" checked={gender === "female"} onChange={() => setGender("female")} />
                หญิง
              </label>
            </div>
          </fieldset>

          {error ? <p className="rectify-events__error" role="alert">{error}</p> : null}

          <div className="rectify-events__form-actions">
            <ActionButton tone="primary" type="submit" disabled={!formReady || submitting}>
              เริ่มสอบยาม →
            </ActionButton>
          </div>

          <details className="rectify-events__tester-note">
            <summary>ℹ️ สำหรับผู้ทดสอบ</summary>
            <p>
              flow เดียวรวมทุกชั้น: ช่วงของวันจำกัดเหลือ 3 ยาม → เหตุการณ์ชีวิต (ถ้ามี) ให้คะแนนตามกฎดวงจร/ปีจร
              → คำถามที่สร้างจากคำทำนายจริงของดวง 12 ยามผู้ตอบ (บริวาร/ภพลูก/ความคิดเวลาอยู่คนเดียว —
              ไม่มีคำถามเรื่องเพศ) แล้วรวมคะแนนทุกชั้นเป็นคำตอบเดียว ผลเป็นค่าประมาณ (beta)
            </p>
          </details>
        </form>
      </Surface>
    </div>
  );
}

function CombinedResultView({
  result,
  betaBadge,
  onRestart,
}: {
  result: Extract<RunCombinedResult, { status: "result" }>;
  betaBadge: React.ReactNode;
  onRestart: () => void;
}) {
  const {
    shortlist,
    timeEstimate,
    answeredCount,
    totalQuestions,
    eventsUsed,
    daypartLabel,
    daypartOnly,
  } = result;
  return (
    <div className="rectify-events">
      <Surface className="rectify-events__card" as="section">
        <SectionHeading title="ผลการสอบยาม" titleLevel="h3" actions={betaBadge} />

        {daypartOnly ? (
          <div className="rectify-events__inconclusive" role="status">
            <p>
              ไม่มีทั้งเหตุการณ์และคำตอบที่ชี้ยามได้ — ระบบจึงบอกได้แค่ระดับช่วงของวัน ({daypartLabel})
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
            ยามที่เข้าเค้าที่สุด · ช่วง{daypartLabel} · เหตุการณ์ {eventsUsed} อย่าง · ตอบจริง {answeredCount}/{totalQuestions} ข้อ
          </h4>
          <ul>
            {shortlist.map((s, index) => (
              <li key={s.hourBranch}>
                #{index + 1} ยาม{s.hourBranch} ({s.hourLabel}) — {s.window.start}–{s.window.end} น.
                {s.total > 0
                  ? ` · คะแนนรวม ${s.total}` +
                    (s.eventsScore !== 0 || s.readingScore !== 0
                      ? ` (คำทำนาย ${s.readingScore} + เหตุการณ์ ${s.eventsScore})`
                      : "")
                  : ""}
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

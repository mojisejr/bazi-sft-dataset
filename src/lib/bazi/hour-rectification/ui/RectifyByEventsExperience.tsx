"use client";

// Hour Rectification v2 — event-based experience (#hour-rectification-engine). Self-contained client
// component: a form of DOB + 2-4 dated life events → a time estimate. Talks only to the DB-free,
// LLM-free /api/bazi/rectify-hour/events sub-route. Standalone from the v1 quiz (links to it as a
// fallback). Deleting this file + the events page + the CSS block restores the repo.
//
// IMPORTANT (v1 barrel-bug lesson): value-imports come ONLY from pure modules (domain/events,
// trainer-workspace, primitives). Response shapes are `import type` (erased at build) so the
// server-only engine never leaks into this client bundle.
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";

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
  MIN_EVENTS,
  type EventType,
} from "@/lib/bazi/hour-rectification/domain/events";
import type { RunEventsResult } from "@/lib/bazi/hour-rectification/run-events";

const PROVINCE_DEFAULT = "กรุงเทพมหานคร";
const QUIZ_FALLBACK_HREF = "/rectify-hour";
const BE_OFFSET = 543;

type EventRow = { id: number; type: EventType | ""; yearBe: string };

function beToCe(yearBe: string): number {
  return Number.parseInt(yearBe, 10) - BE_OFFSET;
}
function ceToBe(yearCe: number): number {
  return yearCe + BE_OFFSET;
}

export function RectifyByEventsExperience() {
  const defaults = createDefaultFormState();
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYearBe, setBirthYearBe] = useState("");
  const [gender, setGender] = useState<string>(defaults.gender);

  const rowId = useRef(2);
  const [rows, setRows] = useState<EventRow[]>([
    { id: 0, type: "", yearBe: "" },
    { id: 1, type: "", yearBe: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunEventsResult | null>(null);

  const dayOptions = getBirthDayOptions(birthMonth, birthYearBe);

  const filledRows = rows.filter((r) => r.type && r.yearBe);
  const formReady =
    Boolean(buildBirthDateValue({ ...defaults, birthDay, birthMonth, birthYearBe })) &&
    filledRows.length >= MIN_EVENTS;

  const addRow = useCallback(() => {
    setRows((prev) =>
      prev.length >= MAX_EVENTS ? prev : [...prev, { id: rowId.current++, type: "", yearBe: "" }],
    );
  }, []);
  const removeRow = useCallback((id: number) => {
    setRows((prev) => (prev.length <= MIN_EVENTS ? prev : prev.filter((r) => r.id !== id)));
  }, []);
  const updateRow = useCallback((id: number, patch: Partial<EventRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (submitting) return;
      const birthDate = buildBirthDateValue({ ...defaults, birthDay, birthMonth, birthYearBe });
      if (!birthDate) {
        setError("กรุณาเลือกวัน เดือน ปีเกิดให้ครบและถูกต้อง");
        return;
      }
      const events = rows
        .filter((r) => r.type && r.yearBe)
        .map((r) => ({ type: r.type as EventType, year: beToCe(r.yearBe) }));
      if (events.length < MIN_EVENTS) {
        setError(`กรุณาระบุเหตุการณ์อย่างน้อย ${MIN_EVENTS} อย่าง (พร้อมปี)`);
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/bazi/rectify-hour/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ birthDate, gender, province: PROVINCE_DEFAULT, events }),
        });
        const data = (await response.json()) as RunEventsResult & { error?: string };
        if (!response.ok) {
          setError(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
          return;
        }
        setResult(data);
      } catch {
        setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, defaults, birthDay, birthMonth, birthYearBe, gender, rows],
  );

  const handleRestart = useCallback(() => {
    setResult(null);
    setError(null);
    setBirthDay("");
    setBirthMonth("");
    setBirthYearBe("");
    setGender(defaults.gender);
    setRows([
      { id: rowId.current++, type: "", yearBe: "" },
      { id: rowId.current++, type: "", yearBe: "" },
    ]);
  }, [defaults.gender]);

  const betaBadge = <Badge tone="ai">beta</Badge>;

  if (result && result.status === "result") {
    return (
      <ResultView result={result} betaBadge={betaBadge} onRestart={handleRestart} />
    );
  }

  return (
    <div className="rectify-events">
      <Surface className="rectify-events__card" as="section">
        <SectionHeading
          kicker="Hour Rectification · จากเหตุการณ์ชีวิต"
          title="🕰️ สอบยามจากเหตุการณ์ชีวิต"
          note="ระบุวันเกิด + เหตุการณ์สำคัญ 2–4 อย่าง (พร้อมปี) — ระบบจะประเมินเวลาเกิดโดยประมาณ"
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
                <input type="radio" name="rectify-events-gender" checked={gender === "male"} onChange={() => setGender("male")} />
                ชาย
              </label>
              <label className="rectify-events__radio">
                <input type="radio" name="rectify-events-gender" checked={gender === "female"} onChange={() => setGender("female")} />
                หญิง
              </label>
            </div>

            <div className="rectify-events__events">
              <span className="rectify-events__events-label">
                เหตุการณ์สำคัญ ({MIN_EVENTS}–{MAX_EVENTS} · ยิ่งระบุมากยิ่งแม่น)
              </span>
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
                    disabled={rows.length <= MIN_EVENTS}
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
          </fieldset>

          {/* result-status is handled by the early ResultView return above, so any `result` here
              is need_events / inconclusive. */}
          {result ? <InconclusiveNote result={result} /> : null}
          {error ? <p className="rectify-events__error" role="alert">{error}</p> : null}

          <div className="rectify-events__form-actions">
            <ActionButton tone="primary" type="submit" disabled={!formReady || submitting}>
              {submitting ? "กำลังสอบยาม…" : "สอบยาม →"}
            </ActionButton>
          </div>

          <p className="rectify-events__fallback">
            จำปีไม่ได้? <a href={QUIZ_FALLBACK_HREF}>ลองแบบตอบคำถาม (quiz)</a>
          </p>

          <details className="rectify-events__tester-note">
            <summary>ℹ️ สำหรับผู้ทดสอบ</summary>
            <p>
              โหมดนี้ใช้เหตุการณ์ชีวิต แยกจากแบบตอบคำถาม (quiz) เดิม — อนาคตจะรวมสองวิธีเข้าด้วยกันได้
              ผลลัพธ์เป็นค่าประมาณ (beta) ความละเอียดสูงสุดคือช่วง 2 ชั่วโมง (1 ยาม)
            </p>
          </details>
        </form>
      </Surface>
    </div>
  );
}

function InconclusiveNote({ result }: { result: RunEventsResult }) {
  if (result.status === "result") return null;
  const rough =
    result.status === "inconclusive"
      ? result.rankedYams.map((r) => `${r.hourBranch}(${r.label}) ${r.score}`).join(" · ")
      : null;
  return (
    <div className="rectify-events__inconclusive" role="status">
      <p>{result.reason}</p>
      {rough ? <p className="rectify-events__rough">อันดับคร่าว: {rough}</p> : null}
    </div>
  );
}

function ResultView({
  result,
  betaBadge,
  onRestart,
}: {
  result: Extract<RunEventsResult, { status: "result" }>;
  betaBadge: React.ReactNode;
  onRestart: () => void;
}) {
  const { timeEstimate, rankedYams, trace } = result;
  const reasons = useMemo(
    () => trace.steps.filter((s) => !s.startsWith("สรุป")),
    [trace.steps],
  );
  return (
    <div className="rectify-events">
      <Surface className="rectify-events__card" as="section">
        <SectionHeading title="ผลการสอบยาม" titleLevel="h3" actions={betaBadge} />

        <div className="rectify-events__time">
          <span className="rectify-events__time-lead">เวลาเกิดโดยประมาณของคุณ</span>
          <span className="rectify-events__time-point">🕗 ~ {timeEstimate.point} น.</span>
          <span className="rectify-events__time-range">
            (ช่วง {timeEstimate.rangeStart} – {timeEstimate.rangeEnd} น.)
            {timeEstimate.spansAdjacent ? " · คาบเกี่ยว 2 ยาม" : ""}
          </span>
        </div>

        <div className="rectify-events__reasons">
          <h4 className="rectify-events__reasons-title">ประเมินจาก</h4>
          <ul>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
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
          <ActionButton tone="primary" type="button" disabled title="เชื่อมต่อเครื่องคำนวณดวงเต็ม — เร็ว ๆ นี้">
            ดูดวงเต็มด้วยเวลานี้
          </ActionButton>
        </div>

        <details className="rectify-events__expert">
          <summary>รายละเอียดเชิงเทคนิค (สำหรับซินแส)</summary>
          <div className="rectify-events__expert-body">
            {rankedYams.map((yam, index) => (
              <div key={yam.hourBranch} className="rectify-events__expert-yam">
                <div className="rectify-events__expert-yam-head">
                  #{index + 1} ยาม{yam.hourBranch} ({yam.label}) — คะแนน {yam.score}
                </div>
                <ul>
                  {yam.firedRules.map((rule, i) => (
                    <li key={i}>
                      {rule.ruleId} ({rule.weight > 0 ? "+" : ""}
                      {rule.weight}
                      {rule.weak ? " · weak" : ""}): {rule.because}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </Surface>
    </div>
  );
}

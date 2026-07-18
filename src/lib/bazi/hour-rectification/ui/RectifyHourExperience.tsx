"use client";

// Hour Rectification (สอบยาม) — internal "let a ซินแส try it" experience (#hour-rectification-engine).
// Self-contained client component: FORM → QUIZ → RESULT, all in one file. Talks only to the already-
// merged, DB-free /api/bazi/rectify-hour endpoint. Deleting this ui/ folder + the route + the CSS
// restores the repo exactly (spec's self-contained requirement).
//
// The backend is STATELESS: it holds no session — the client resends the whole answer trail on every
// step and the server replays it deterministically. So the UI owns the session, and we persist it to
// sessionStorage: a mid-quiz refresh re-POSTs the saved trail and lands the ซินแส right back where
// they were (the spec + ตู๋'s explicit requirement).

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

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
// Import the constant straight from the pure domain module, NOT the package barrel — the barrel
// re-exports run-step → chart-profile-adapter → the symbolic engine (which uses node:module), and
// pulling that into this "use client" bundle breaks the build. domain/traverse is dependency-free.
import { MAX_QUESTIONS_TO_ASK } from "@/lib/bazi/hour-rectification/domain/traverse";

// The 12 double-hour windows, keyed by branch. These are the STANDARD windows whose MIDPOINTS the
// engine's HOUR_BRANCH_MID_TIME uses to compute each candidate chart (寅's midpoint 04:00 sits inside
// 03:00–05:00), and whose boundaries fall on odd hours exactly as the engine documents. Shown to the
// ซินแส so the result reads as a real time range, not just a character.
const HOUR_RANGE_TH: Record<string, string> = {
  子: "23:00–01:00",
  丑: "01:00–03:00",
  寅: "03:00–05:00",
  卯: "05:00–07:00",
  辰: "07:00–09:00",
  巳: "09:00–11:00",
  午: "11:00–13:00",
  未: "13:00–15:00",
  申: "15:00–17:00",
  酉: "17:00–19:00",
  戌: "19:00–21:00",
  亥: "21:00–23:00",
};

const SESSION_STORAGE_KEY = "rectify-hour-session-v1";
const PROVINCE_DEFAULT = "กรุงเทพมหานคร"; // spec: hard-default, no field

type AnsweredStep = { questionId: string; optionId: string };

type Session = {
  birthDate: string;
  gender: string;
  province: string;
  answeredSteps: AnsweredStep[];
};

type QuestionView = {
  status: "question";
  questionId: string;
  question: string;
  options: { id: string; label: string }[];
  questionNumber: number;
};

type ResultView = {
  status: "result";
  hourBranch: string;
  hourLabel: string;
  trace: { steps: string[] };
  confidence: string;
};

type StepResponse = QuestionView | ResultView | { status: "error"; reason?: string };

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.birthDate || !Array.isArray(parsed.answeredSteps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // sessionStorage can throw in private-mode/quota edge cases — non-fatal, the in-memory session
    // still drives the current tab; we just lose refresh-persistence.
  }
}

export function RectifyHourExperience() {
  const defaults = createDefaultFormState();
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYearBe, setBirthYearBe] = useState("");
  const [gender, setGender] = useState<string>(defaults.gender);

  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<QuestionView | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards a double-submit / rapid double-tap on an option: while a request is in flight we ignore
  // further step requests (the buttons are also disabled, this is the belt to that suspenders).
  const inFlight = useRef(false);

  const phase: "form" | "quiz" | "result" = result ? "result" : question ? "quiz" : "form";

  // Core: POST the full session trail, route the response into the right view. Pure of any "which
  // button" knowledge — every transition (start, answer, back, resume) funnels through here so the
  // response×state handling lives in exactly one place.
  const postStep = useCallback(
    async (next: Session, opts: { silentErrorReset?: boolean } = {}): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch("/api/bazi/rectify-hour", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = (await response.json()) as StepResponse & { error?: string };

        if (!response.ok || data.status === "error") {
          const reason =
            data.error ||
            (data.status === "error" ? data.reason : undefined) ||
            "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
          // A stale trail (e.g. the bank changed under a resumed session) comes back as a 400. On a
          // silent resume we don't want to scare the ซินแส with an error — just drop the stale
          // session and fall back to the empty form.
          if (opts.silentErrorReset) {
            writeStoredSession(null);
            setSession(null);
            setQuestion(null);
            setResult(null);
            return false;
          }
          setError(reason);
          return false;
        }

        setSession(next);
        writeStoredSession(next);
        if (data.status === "question") {
          setResult(null);
          setQuestion(data);
        } else if (data.status === "result") {
          setQuestion(null);
          setResult(data);
        }
        return true;
      } catch {
        if (!opts.silentErrorReset) {
          setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
        }
        return false;
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [],
  );

  // Resume a saved session once, on mount: re-POST the stored trail and land back on the same
  // question/result. A stale/invalid stored session resets quietly to the form.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const stored = readStoredSession();
    if (stored) {
      void postStep(stored, { silentErrorReset: true });
    }
  }, [postStep]);

  const dayOptions = getBirthDayOptions(birthMonth, birthYearBe);

  const handleStart = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const birthDate = buildBirthDateValue({
        ...defaults,
        birthDay,
        birthMonth,
        birthYearBe,
      });
      if (!birthDate) {
        setError("กรุณาเลือกวัน เดือน ปีเกิดให้ครบและถูกต้อง");
        return;
      }
      void postStep({ birthDate, gender, province: PROVINCE_DEFAULT, answeredSteps: [] });
    },
    [birthDay, birthMonth, birthYearBe, gender, defaults, postStep],
  );

  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!session || !question || submitting) return;
      const next: Session = {
        ...session,
        answeredSteps: [...session.answeredSteps, { questionId: question.questionId, optionId }],
      };
      void postStep(next);
    },
    [session, question, submitting, postStep],
  );

  const handleBack = useCallback(() => {
    if (!session || submitting || session.answeredSteps.length === 0) return;
    const next: Session = {
      ...session,
      answeredSteps: session.answeredSteps.slice(0, -1),
    };
    void postStep(next);
  }, [session, submitting, postStep]);

  const handleRestart = useCallback(() => {
    writeStoredSession(null);
    setSession(null);
    setQuestion(null);
    setResult(null);
    setError(null);
    setBirthDay("");
    setBirthMonth("");
    setBirthYearBe("");
    setGender(defaults.gender);
  }, [defaults.gender]);

  const betaBadge = <Badge tone="ai">beta</Badge>;

  return (
    <div className="rectify-hour">
      {phase === "form" ? (
        <Surface className="rectify-hour__card" as="section">
          <SectionHeading
            kicker="Hour Rectification"
            title="สอบยาม"
            note="หาเวลาเกิดโดยประมาณจากการตอบคำถามชีวิตจริง — ไม่ต้องรู้เวลาเกิด"
            actions={betaBadge}
          />
          <form className="rectify-hour__form" onSubmit={handleStart}>
            <fieldset className="rectify-hour__fieldset" disabled={submitting}>
              <legend className="rectify-hour__legend">วันเกิด (พ.ศ.)</legend>
              <div className="rectify-hour__date-grid">
                <label className="rectify-hour__field">
                  <span>วัน</span>
                  <select
                    value={birthDay}
                    onChange={(event) => setBirthDay(event.target.value)}
                    aria-label="วันเกิด"
                  >
                    <option value="">วัน</option>
                    {dayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rectify-hour__field">
                  <span>เดือน</span>
                  <select
                    value={birthMonth}
                    onChange={(event) => setBirthMonth(event.target.value)}
                    aria-label="เดือนเกิด"
                  >
                    <option value="">เดือน</option>
                    {THAI_MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rectify-hour__field">
                  <span>ปี (พ.ศ.)</span>
                  <select
                    value={birthYearBe}
                    onChange={(event) => setBirthYearBe(event.target.value)}
                    aria-label="ปีเกิด พ.ศ."
                  >
                    <option value="">ปี</option>
                    {BUDDHIST_ERA_YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rectify-hour__gender">
                <span className="rectify-hour__gender-label">เพศ</span>
                <label className="rectify-hour__radio">
                  <input
                    type="radio"
                    name="rectify-gender"
                    value="male"
                    checked={gender === "male"}
                    onChange={() => setGender("male")}
                  />
                  ชาย
                </label>
                <label className="rectify-hour__radio">
                  <input
                    type="radio"
                    name="rectify-gender"
                    value="female"
                    checked={gender === "female"}
                    onChange={() => setGender("female")}
                  />
                  หญิง
                </label>
              </div>

              <p className="rectify-hour__info">
                ℹ ไม่ต้องใส่เวลาเกิด — ระบบจะช่วยหายามให้จากคำตอบ 5–8 ข้อ
              </p>
            </fieldset>

            {error ? <p className="rectify-hour__error" role="alert">{error}</p> : null}

            <div className="rectify-hour__form-actions">
              <ActionButton tone="primary" type="submit" disabled={submitting}>
                {submitting ? "กำลังเริ่ม…" : "เริ่มสอบยาม →"}
              </ActionButton>
            </div>
          </form>
        </Surface>
      ) : null}

      {phase === "quiz" && question ? (
        <Surface className="rectify-hour__card" as="section">
          <div className="rectify-hour__quiz-head">
            <span className="rectify-hour__progress-label">
              คำถามที่ {question.questionNumber} / ~{MAX_QUESTIONS_TO_ASK}
            </span>
            {betaBadge}
          </div>
          <div
            className="rectify-hour__progress"
            role="progressbar"
            aria-valuenow={question.questionNumber}
            aria-valuemin={1}
            aria-valuemax={MAX_QUESTIONS_TO_ASK}
          >
            <span
              className="rectify-hour__progress-fill"
              style={{
                width: `${Math.min(100, (question.questionNumber / MAX_QUESTIONS_TO_ASK) * 100)}%`,
              }}
            />
          </div>

          <p className="rectify-hour__question">{question.question}</p>

          <div className="rectify-hour__options">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="rectify-hour__option"
                disabled={submitting}
                onClick={() => handleAnswer(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {error ? <p className="rectify-hour__error" role="alert">{error}</p> : null}

          <div className="rectify-hour__quiz-foot">
            <button
              type="button"
              className="rectify-hour__back"
              disabled={submitting || (session?.answeredSteps.length ?? 0) === 0}
              onClick={handleBack}
            >
              ← ย้อนกลับ (แก้คำตอบข้อก่อน)
            </button>
          </div>
        </Surface>
      ) : null}

      {phase === "result" && result ? (
        <Surface className="rectify-hour__card" as="section">
          <SectionHeading title="ผลการสอบยาม" titleLevel="h3" actions={betaBadge} />

          <div className="rectify-hour__result-hour">
            <span className="rectify-hour__hour-char">{result.hourBranch}</span>
            <span className="rectify-hour__hour-label">ยาม{result.hourLabel}</span>
            <span className="rectify-hour__hour-time">
              {HOUR_RANGE_TH[result.hourBranch] ?? ""}
            </span>
          </div>

          <div className="rectify-hour__reason">
            <h4 className="rectify-hour__reason-title">เหตุผล</h4>
            <ul className="rectify-hour__reason-list">
              {result.trace.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>

          <p className="rectify-hour__beta-warning">
            ⚠ นี่คือค่าประมาณ (beta) — ใช้ประกอบการพิจารณา ไม่ใช่คำตอบสุดท้าย
          </p>

          {error ? <p className="rectify-hour__error" role="alert">{error}</p> : null}

          <div className="rectify-hour__result-actions">
            <ActionButton tone="secondary" type="button" onClick={handleRestart}>
              สอบใหม่
            </ActionButton>
            {/* future hook → calculator; hidden/disabled for the internal round (spec) */}
            <ActionButton
              tone="primary"
              type="button"
              disabled
              title="เชื่อมต่อกับเครื่องคำนวณดวงเต็ม — เร็ว ๆ นี้"
            >
              ดูดวงเต็มด้วยยามนี้
            </ActionButton>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}

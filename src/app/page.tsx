"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import {
  CalculatedStateSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";

const pillarColumns = [
  { key: "year", label: "ปี" },
  { key: "month", label: "เดือน" },
  { key: "day", label: "วัน" },
  { key: "hour", label: "เวลา" },
] as const;

const tenGodRows = [
  { key: "yearStem", label: "ก้านปี" },
  { key: "monthStem", label: "ก้านเดือน" },
  { key: "dayStem", label: "ก้านวัน" },
  { key: "hourStem", label: "ก้านเวลา" },
  { key: "yearBranch", label: "กิ่งปี" },
  { key: "monthBranch", label: "กิ่งเดือน" },
  { key: "dayBranch", label: "กิ่งวัน" },
  { key: "hourBranch", label: "กิ่งเวลา" },
] as const;

const twelveQiRows = [
  { key: "yearBranch", label: "ปี" },
  { key: "monthBranch", label: "เดือน" },
  { key: "dayBranch", label: "วัน" },
  { key: "hourBranch", label: "เวลา" },
] as const;

const workflowSteps = [
  "ตั้งข้อมูลเกิดให้ครบถ้วน",
  "กดคำนวณเพื่อดึงภาพรวมดวงจีน",
  "อ่านผล 4 เสาและภาพรวมก่อนเข้าสู่การวิเคราะห์เชิงลึก",
] as const;

export type FormState = {
  birthDate: string;
  birthTime: string;
  gender: string;
  province: string;
  calendarSystem: "solar" | "lunar";
  timezone: string;
};

type SubmissionState = "idle" | "submitting" | "ready" | "error";

type BaziTrainerWorkspaceProps = {
  initialFormState?: FormState;
  initialSubmittedInput?: RawInputValue | null;
  initialCalculatedState?: CalculatedStateValue | null;
  initialSubmissionState?: SubmissionState;
};

export function createDefaultFormState(): FormState {
  return {
    birthDate: "",
    birthTime: "",
    gender: "female",
    province: "",
    calendarSystem: "solar",
    timezone: "Asia/Bangkok",
  };
}

function getStatusCopy(status: SubmissionState, hasResult: boolean) {
  if (status === "submitting") {
    return {
      tone: "busy",
      label: "กำลังคำนวณ",
      detail: "ระบบกำลังจัดโครงสร้างดวงและภาพรวมหลักให้คุณ",
    };
  }

  if (status === "error") {
    return {
      tone: "error",
      label: "ต้องลองอีกครั้ง",
      detail: "ยังปิดผลครั้งนี้ไม่สำเร็จ ตรวจข้อมูลตั้งต้นอีกครั้งแล้วคำนวณใหม่ได้ทันที",
    };
  }

  if (status === "ready" && hasResult) {
    return {
      tone: "ready",
      label: "ภาพรวมพร้อมอ่าน",
      detail: "ผลผูกดวงถูกเติมลงฝั่งซ้ายแล้ว สามารถไล่อ่านตามลำดับได้ทันที",
    };
  }

  return {
    tone: "idle",
    label: "พร้อมเริ่มงาน",
    detail: "ตั้งข้อมูลเกิดแล้วคำนวณเพื่อเปิด workspace ฝั่งภาพรวมดวงจีน",
  };
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function formatBirthMoment(rawInput: RawInputValue | null) {
  if (!rawInput) {
    return "รอข้อมูลตั้งต้น";
  }

  return `${rawInput.birthDate} • ${rawInput.birthTime}`;
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "ยังไม่สามารถคำนวณดวงได้ในตอนนี้";
}

function buildPayload(formState: FormState): RawInputValue {
  return {
    birthDate: formState.birthDate,
    birthTime: formState.birthTime,
    gender: formState.gender,
    province: formState.province,
    calendarSystem: formState.calendarSystem,
    timezone: formState.timezone,
  };
}

export function BaziTrainerWorkspace({
  initialFormState,
  initialSubmittedInput = null,
  initialCalculatedState = null,
  initialSubmissionState = "idle",
}: BaziTrainerWorkspaceProps) {
  const [formState, setFormState] = useState<FormState>(
    initialFormState ?? createDefaultFormState(),
  );
  const [submittedInput, setSubmittedInput] = useState<RawInputValue | null>(
    initialSubmittedInput,
  );
  const [calculatedState, setCalculatedState] = useState<CalculatedStateValue | null>(
    initialCalculatedState,
  );
  const [submissionState, setSubmissionState] = useState<SubmissionState>(
    initialSubmissionState,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusCopy = getStatusCopy(submissionState, Boolean(calculatedState));

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildPayload(formState);

    setSubmissionState("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/bazi/calculate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        calculatedState?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "ยังไม่สามารถคำนวณดวงได้ในตอนนี้");
      }

      const parsedState = CalculatedStateSchema.parse(body.calculatedState);

      setCalculatedState(parsedState);
      setSubmittedInput(payload);
      setSubmissionState("ready");
    } catch (error) {
      setSubmissionState("error");
      setErrorMessage(normalizeErrorMessage(error));
    }
  }

  return (
    <main className="trainer-page">
      <section className="surface trainer-header">
        <div className="brand-lockup">
          <p className="brand-mark">Bazi Trainer</p>
          <h1>Bazi Trainer that makes ซินแส ซินแส !</h1>
          <p className="brand-story">
            พื้นที่ทำงานที่พาเรื่องยากให้ไหลลื่น ตั้งข้อมูลให้ชัด คำนวณให้ตรง แล้วอ่านภาพรวมได้ทันที
            แบบเรียบง่ายแต่มั่นคง
          </p>
        </div>

        <div className="status-stack">
          <div className={`status-chip status-chip--${statusCopy.tone}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusCopy.label}
          </div>
          <p className="status-detail">{statusCopy.detail}</p>
        </div>
      </section>

      <section className="trainer-grid">
        <article className="surface engine-column">
          <div className="section-heading">
            <div>
              <p className="section-kicker">ภาพรวมดวงจีน</p>
              <h2>โครงสร้างที่ระบบคำนวณให้</h2>
            </div>
            <p className="section-note">อ่านจากบนลงล่างเพื่อเห็นภาพรวมก่อนเข้าสู่การวิเคราะห์เชิงลึก</p>
          </div>

          <div className="identity-strip">
            <div>
              <span className="identity-label">เวลาเกิด</span>
              <strong>{formatBirthMoment(submittedInput)}</strong>
            </div>
            <div>
              <span className="identity-label">เพศ</span>
              <strong>{submittedInput?.gender ?? "รอข้อมูล"}</strong>
            </div>
            <div>
              <span className="identity-label">จังหวัด</span>
              <strong>{submittedInput?.province ?? "รอข้อมูล"}</strong>
            </div>
            <div>
              <span className="identity-label">เขตเวลา</span>
              <strong>{submittedInput?.timezone ?? "Asia/Bangkok"}</strong>
            </div>
          </div>

          {calculatedState ? (
            <div className="engine-stack">
              <section className="surface inset-card">
                <div className="section-heading section-heading--compact">
                  <div>
                    <p className="section-kicker">4 เสา</p>
                    <h3>Four Pillars</h3>
                  </div>
                </div>

                <div className="pillar-table" role="table" aria-label="Four pillars overview">
                  <div className="pillar-row pillar-row--header" role="row">
                    <span className="pillar-label" />
                    {pillarColumns.map((column) => (
                      <span key={column.key} className="pillar-cell pillar-cell--header" role="columnheader">
                        {column.label}
                      </span>
                    ))}
                  </div>

                  <div className="pillar-row" role="row">
                    <span className="pillar-label">ก้านฟ้า</span>
                    {pillarColumns.map((column) => (
                      <span key={column.key} className="pillar-cell" role="cell">
                        {calculatedState.fourPillars[column.key].stem}
                      </span>
                    ))}
                  </div>

                  <div className="pillar-row" role="row">
                    <span className="pillar-label">กิ่งดิน</span>
                    {pillarColumns.map((column) => (
                      <span key={column.key} className="pillar-cell" role="cell">
                        {calculatedState.fourPillars[column.key].branch}
                      </span>
                    ))}
                  </div>

                  <div className="pillar-row" role="row">
                    <span className="pillar-label">ซ่อนธาตุ</span>
                    {pillarColumns.map((column) => (
                      <span key={column.key} className="pillar-cell pillar-cell--stacked" role="cell">
                        {calculatedState.fourPillars[column.key].hiddenStems?.join(" · ") ?? "-"}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              <section className="spotlight-grid">
                <div className="surface inset-card highlight-card">
                  <p className="section-kicker">หัวใจดวง</p>
                  <h3>{calculatedState.dayMaster}</h3>
                  <p className="metric-copy">Day Master</p>
                </div>

                <div className="surface inset-card highlight-card">
                  <p className="section-kicker">คะแนนพลัง</p>
                  <h3>{formatScore(calculatedState.strengthScore)}</h3>
                  <p className="metric-copy">Strength Score</p>
                </div>

                <div className="surface inset-card highlight-card highlight-card--wide">
                  <p className="section-kicker">60 Jiazi Core Persona</p>
                  <h3>{calculatedState.sixtyJiaziCorePersona?.code ?? "ยังไม่มี narrative เฉพาะ"}</h3>
                  <p className="metric-copy">
                    {calculatedState.sixtyJiaziCorePersona?.narrative ??
                      "ผลรอบนี้ยังไม่มีคำบรรยายเพิ่มเติมจากคลัง canonical"}
                  </p>
                </div>
              </section>

              <section className="detail-grid">
                <div className="surface inset-card">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">10 เทพ</p>
                      <h3>Ten Gods</h3>
                    </div>
                  </div>

                  <dl className="detail-list">
                    {tenGodRows.map((item) => (
                      <div key={item.key} className="detail-list-row">
                        <dt>{item.label}</dt>
                        <dd>{calculatedState.tenGods[item.key] ?? "-"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="surface inset-card">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="section-kicker">12 Qi</p>
                      <h3>Twelve Qi</h3>
                    </div>
                  </div>

                  <dl className="detail-list">
                    {twelveQiRows.map((item) => (
                      <div key={item.key} className="detail-list-row">
                        <dt>{item.label}</dt>
                        <dd>{calculatedState.twelveQi[item.key] ?? "-"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <section className="surface inset-card">
                <div className="section-heading section-heading--compact">
                  <div>
                    <p className="section-kicker">คำเปรียบเปรยธาตุ</p>
                    <h3>Element Metaphors</h3>
                  </div>
                </div>

                <div className="metaphor-list">
                  {calculatedState.elementMetaphors.map((item) => (
                    <article key={`${item.element}-${item.metaphor}`} className="metaphor-card">
                      <strong>{item.element}</strong>
                      <p>{item.metaphor}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <section className="surface inset-card empty-state">
              <p className="section-kicker">พร้อมเริ่ม</p>
              <h3>ตั้งข้อมูลเพื่อดูภาพรวมดวง</h3>
              <p>
                เมื่อกดคำนวณแล้ว ฝั่งนี้จะเติม 4 เสา, 10 เทพ, 12 Qi, core persona และคำเปรียบเปรยธาตุให้อ่านทันที
              </p>
            </section>
          )}
        </article>

        <aside className="surface intake-column">
          <div className="section-heading">
            <div>
              <p className="section-kicker">เริ่มต้นงาน</p>
              <h2>ตั้งข้อมูลก่อนอ่านดวง</h2>
            </div>
            <p className="section-note">ลำดับการทำงานถูกย่อให้สั้นและชัด เพื่อให้ใช้ได้คล่องโดยไม่ต้องคิดเยอะ</p>
          </div>

          <ol className="workflow-list">
            {workflowSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <form className="input-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>วันเกิด</span>
              <input
                name="birthDate"
                type="date"
                value={formState.birthDate}
                onChange={handleFieldChange}
                required
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>เวลาเกิด</span>
                <input
                  name="birthTime"
                  type="time"
                  value={formState.birthTime}
                  onChange={handleFieldChange}
                  required
                />
              </label>

              <label className="field">
                <span>เพศ</span>
                <select name="gender" value={formState.gender} onChange={handleFieldChange}>
                  <option value="female">หญิง</option>
                  <option value="male">ชาย</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>จังหวัดหรือเมืองเกิด</span>
              <input
                name="province"
                type="text"
                placeholder="เช่น กรุงเทพมหานคร"
                value={formState.province}
                onChange={handleFieldChange}
                required
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>ระบบปฏิทิน</span>
                <select
                  name="calendarSystem"
                  value={formState.calendarSystem}
                  onChange={handleFieldChange}
                >
                  <option value="solar">สุริยคติ</option>
                  <option value="lunar">จันทรคติ</option>
                </select>
              </label>

              <label className="field">
                <span>เขตเวลา</span>
                <select name="timezone" value={formState.timezone} onChange={handleFieldChange}>
                  <option value="Asia/Bangkok">Asia/Bangkok</option>
                  <option value="Asia/Hong_Kong">Asia/Hong_Kong</option>
                </select>
              </label>
            </div>

            <button className="primary-action" type="submit" disabled={submissionState === "submitting"}>
              {submissionState === "submitting" ? "กำลังคำนวณ..." : "คำนวณภาพรวมดวง"}
            </button>

            <p className="form-footnote">
              ข้อมูลตั้งต้นจะถูกใช้เพื่ออ่านโครงสร้างดวงจีนก่อน จากนั้นพื้นที่วิเคราะห์เชิงลึกจะต่อยอดจากผลชุดนี้
            </p>
          </form>

          <div className="surface inset-card message-card" aria-live="polite">
            <p className="section-kicker">สัญญาณจากระบบ</p>
            <h3>{statusCopy.label}</h3>
            <p>{errorMessage ?? statusCopy.detail}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default function HomePage() {
  return <BaziTrainerWorkspace />;
}
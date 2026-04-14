"use client";

import type { ChangeEvent, FormEvent } from "react";

import {
  BIRTH_HOUR_OPTIONS,
  BIRTH_MINUTE_OPTIONS,
  BUDDHIST_ERA_YEAR_OPTIONS,
  THAI_PROVINCE_OPTIONS,
  THAI_MONTH_OPTIONS,
  getBirthDayOptions,
  workflowSteps,
  type FormState,
  type ResetActionCopy,
  type SubmissionState,
} from "@/lib/bazi/trainer-workspace";

type BirthFormProps = {
  formState: FormState;
  isSessionLocked: boolean;
  submissionState: SubmissionState;
  resetActionCopy: ResetActionCopy;
  onFieldChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onReset: () => void;
};

export function BirthForm({
  formState,
  isSessionLocked,
  submissionState,
  resetActionCopy,
  onFieldChange,
  onSubmit,
  onReset,
}: BirthFormProps) {
  const dayOptions = getBirthDayOptions(formState.birthMonth, formState.birthYearBe);

  return (
    <>
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

      <form className="input-form" onSubmit={onSubmit}>
        <fieldset
          className="input-form-shell"
          disabled={isSessionLocked}
          data-form-locked={isSessionLocked ? "true" : "false"}
        >
          <div className="field">
            <span>วันเกิด</span>
            <div className="field-grid field-grid--triple">
              <label className="field field--compact">
                <span>วัน</span>
                <select name="birthDay" value={formState.birthDay} onChange={onFieldChange} required>
                  <option value="">เลือกวัน</option>
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field--compact">
                <span>เดือน</span>
                <select
                  name="birthMonth"
                  value={formState.birthMonth}
                  onChange={onFieldChange}
                  required
                >
                  <option value="">เลือกเดือน</option>
                  {THAI_MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field--compact">
                <span>ปี พ.ศ.</span>
                <select
                  name="birthYearBe"
                  value={formState.birthYearBe}
                  onChange={onFieldChange}
                  required
                >
                  <option value="">เลือกปี พ.ศ.</option>
                  {BUDDHIST_ERA_YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>เวลาเกิด</span>
              <div className="field-grid">
                <label className="field field--compact">
                  <span>ชั่วโมง</span>
                  <select
                    name="birthHour"
                    value={formState.birthHour}
                    onChange={onFieldChange}
                    required
                  >
                    <option value="">00-23</option>
                    {BIRTH_HOUR_OPTIONS.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field field--compact">
                  <span>นาที</span>
                  <select
                    name="birthMinute"
                    value={formState.birthMinute}
                    onChange={onFieldChange}
                    required
                  >
                    <option value="">00-59</option>
                    {BIRTH_MINUTE_OPTIONS.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="field-hint">ใช้เวลาแบบ 24 ชั่วโมง เช่น 14:05</p>
            </label>

            <label className="field">
              <span>เพศ</span>
              <select name="gender" value={formState.gender} onChange={onFieldChange}>
                <option value="female">หญิง</option>
                <option value="male">ชาย</option>
                <option value="other">อื่นๆ</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>จังหวัดเกิด</span>
            <input
              name="province"
              type="text"
              list="thai-province-options"
              placeholder="พิมพ์ชื่อจังหวัด เช่น กรุงเทพมหานคร"
              value={formState.province}
              onChange={onFieldChange}
              required
            />
            <datalist id="thai-province-options">
              {THAI_PROVINCE_OPTIONS.map((province) => (
                <option key={province} value={province} />
              ))}
            </datalist>
            <p className="field-hint">
              รองรับจังหวัดในประเทศไทยก่อน พิมพ์ไม่กี่ตัวแล้วเลือกจากรายการได้ทันที
            </p>
          </label>
        </fieldset>

        <div className="form-actions">
          {isSessionLocked ? (
            <button
              className={
                resetActionCopy.tone === "primary"
                  ? "primary-action"
                  : "secondary-action secondary-action--warning"
              }
              type="button"
              onClick={onReset}
            >
              {resetActionCopy.label}
            </button>
          ) : (
            <button
              className="primary-action"
              type="submit"
              disabled={submissionState === "submitting"}
            >
              {submissionState === "submitting" ? "กำลังคำนวณ..." : "คำนวณภาพรวมดวง"}
            </button>
          )}
        </div>

        <p className="form-footnote">
          ข้อมูลวันเกิดจะเลือกเป็น พ.ศ. เพื่อให้กรอกง่ายขึ้น เวลาเกิดใช้ระบบ 24 ชั่วโมง และระบบจะคำนวณด้วยเวลาประเทศไทยร่วมกับปฏิทินสุริยคติแบบไทยให้อัตโนมัติ
        </p>

        {isSessionLocked ? (
          <p className="form-lock-note" aria-live="polite">
            {resetActionCopy.detail}
          </p>
        ) : null}
      </form>
    </>
  );
}
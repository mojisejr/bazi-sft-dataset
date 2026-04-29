"use client";

import type { ChangeEvent, FormEvent } from "react";

import { ActionButton } from "@/components/bazi/primitives/Action";
import { SectionHeading } from "@/components/bazi/primitives/SectionHeading";
import {
  BIRTH_HOUR_OPTIONS,
  BIRTH_MINUTE_OPTIONS,
  BUDDHIST_ERA_YEAR_OPTIONS,
  formatThaiBirthMoment,
  THAI_PROVINCE_OPTIONS,
  THAI_MONTH_OPTIONS,
  getBirthDayOptions,
  workflowSteps,
  type FormState,
  type ResetActionCopy,
  type SubmissionState,
} from "@/lib/bazi/trainer-workspace";
import type { RawInputValue } from "@/lib/bazi/schema-types";

type BirthFormProps = {
  formState: FormState;
  submittedInput: RawInputValue | null;
  isSessionLocked: boolean;
  submissionState: SubmissionState;
  resetActionCopy: ResetActionCopy;
  onFieldChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onReset: () => void;
};

export function BirthForm({
  formState,
  submittedInput,
  isSessionLocked,
  submissionState,
  resetActionCopy,
  onFieldChange,
  onSubmit,
  onReset,
}: BirthFormProps) {
  const dayOptions = getBirthDayOptions(formState.birthMonth, formState.birthYearBe);

  function getGenderCopy(value: string | undefined) {
    if (value === "female") {
      return "หญิง";
    }

    if (value === "male") {
      return "ชาย";
    }

    if (value === "other") {
      return "อื่นๆ";
    }

    return "รอข้อมูล";
  }

  if (isSessionLocked) {
    return (
      <section className="case-rail" aria-label="case rail" data-case-rail="true">
        <div className="case-rail__header">
          <div>
            <p className="section-kicker">เคสนี้</p>
            <h2>พร้อมอ่านดวง</h2>
          </div>
          <p className="section-note">ข้อมูลตั้งต้นถูกล็อกไว้เพื่อกัน record ปนกันระหว่างการอ่านและเขียนคำพยากรณ์</p>
        </div>

        <dl className="case-rail__list">
          <div className="case-rail__row">
            <dt>วันเวลาเกิด</dt>
            <dd>{formatThaiBirthMoment(submittedInput)}</dd>
          </div>
          <div className="case-rail__row">
            <dt>เพศ</dt>
            <dd>{getGenderCopy(submittedInput?.gender)}</dd>
          </div>
          <div className="case-rail__row">
            <dt>จังหวัด</dt>
            <dd>{submittedInput?.province ?? "รอข้อมูล"}</dd>
          </div>
        </dl>

        <div className="case-rail__actions">
          <ActionButton
            tone={resetActionCopy.tone === "primary" ? "primary" : "secondary"}
            warning={resetActionCopy.tone !== "primary"}
            type="button"
            onClick={onReset}
          >
            {resetActionCopy.label}
          </ActionButton>
        </div>

        <p className="form-lock-note case-rail__note" aria-live="polite">
          {resetActionCopy.detail}
        </p>
      </section>
    );
  }

  return (
    <>
      <SectionHeading
        kicker="เริ่มต้นงาน"
        title="ตั้งข้อมูลก่อนอ่านดวง"
        titleLevel="h2"
        note="ลำดับการทำงานถูกย่อให้สั้นและชัด เพื่อให้ใช้ได้คล่องโดยไม่ต้องคิดเยอะ"
      />

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
          <ActionButton
            tone="primary"
            type="submit"
            disabled={submissionState === "submitting"}
          >
            {submissionState === "submitting" ? "กำลังคำนวณ..." : "คำนวณภาพรวมดวง"}
          </ActionButton>
        </div>

        <p className="form-footnote">
          ข้อมูลวันเกิดจะเลือกเป็น พ.ศ. เพื่อให้กรอกง่ายขึ้น เวลาเกิดใช้ระบบ 24 ชั่วโมง และระบบจะคำนวณด้วยเวลาประเทศไทยร่วมกับปฏิทินสุริยคติแบบไทยให้อัตโนมัติ
        </p>
      </form>
    </>
  );
}
"use client";

import type { ChangeEvent } from "react";

import {
  BIRTH_HOUR_OPTIONS,
  BIRTH_MINUTE_OPTIONS,
  BUDDHIST_ERA_YEAR_OPTIONS,
  getBirthDayOptions,
  THAI_MONTH_OPTIONS,
  type FormState,
} from "@/lib/bazi/trainer-workspace";

/** กล่องกรอกวันเกิดของหนึ่งคน (ใช้ร่วมหน้าคู่รัก + หน้างาน). */
export function PersonInputs({
  label,
  form,
  onChange,
  onRemove,
}: {
  label: string;
  form: FormState;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onRemove?: () => void;
}) {
  const dayOptions = getBirthDayOptions(form.birthMonth, form.birthYearBe);
  return (
    <div className="pair-person">
      <div className="pair-person__head">
        <p className="pair-person__title">{label}</p>
        {onRemove ? (
          <button type="button" className="pair-person__remove" onClick={onRemove}>
            ลบ
          </button>
        ) : null}
      </div>
      <div className="field">
        <span>วันเกิด</span>
        <div className="field-grid field-grid--triple">
          <label className="field field--compact">
            <span>วัน</span>
            <select name="birthDay" value={form.birthDay} onChange={onChange} required>
              <option value="">วัน</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field field--compact">
            <span>เดือน</span>
            <select name="birthMonth" value={form.birthMonth} onChange={onChange} required>
              <option value="">เดือน</option>
              {THAI_MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="field field--compact">
            <span>ปี พ.ศ.</span>
            <select name="birthYearBe" value={form.birthYearBe} onChange={onChange} required>
              <option value="">ปี</option>
              {BUDDHIST_ERA_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="field-grid">
        <div className="field">
          <span>เวลาเกิด</span>
          <div className="field-grid">
            <label className="field field--compact">
              <span>ชั่วโมง</span>
              <select name="birthHour" value={form.birthHour} onChange={onChange} required>
                <option value="">00-23</option>
                {BIRTH_HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
            <label className="field field--compact">
              <span>นาที</span>
              <select name="birthMinute" value={form.birthMinute} onChange={onChange} required>
                <option value="">00-59</option>
                {BIRTH_MINUTE_OPTIONS.map((mn) => (
                  <option key={mn} value={mn}>{mn}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <label className="field">
          <span>เพศ</span>
          <select name="gender" value={form.gender} onChange={onChange}>
            <option value="female">หญิง</option>
            <option value="male">ชาย</option>
            <option value="other">อื่นๆ</option>
          </select>
        </label>
      </div>
    </div>
  );
}

// tests/profile-birth-change.test.ts — 2026-09-20 (เอ็มพบ): แก้ "เวลาเกิด" อย่างเดียวเดิมไม่ถูกนับเป็น
// "แก้วันเกิด" → ไม่กินสิทธิ์ฟรี/ไม่หัก QI. didBirthChange ต้องนับ วัน+เวลา+ไม่ทราบเวลา ที่เปลี่ยนจากเดิม.
import { describe, expect, it } from "vitest";

import { didBirthChange } from "@/lib/bazi/profile/birth-change";

const base = { birthDate: "1993-11-24", birthTime: "15:12", timeUnknown: false };

describe("didBirthChange — นับการแก้วันเกิด (คิดโควตา/หัก QI)", () => {
  it("แก้เวลาเกิดอย่างเดียว (วันเดิม) = แก้จริง ← บั๊กที่เจอ", () => {
    expect(didBirthChange(base, { birth: "1993-11-24", birthTime: "16:00", timeUnknown: false })).toBe(true);
  });

  it("แก้วันเกิด = แก้จริง", () => {
    expect(didBirthChange(base, { birth: "1993-11-25", birthTime: "15:12", timeUnknown: false })).toBe(true);
  });

  it("สลับเป็น 'ไม่ทราบเวลา' = แก้จริง", () => {
    expect(didBirthChange(base, { birth: "1993-11-24", birthTime: null, timeUnknown: true })).toBe(true);
  });

  it("บันทึกซ้ำโดยไม่เปลี่ยนอะไร = ไม่ใช่การแก้ (ไม่หัก QI)", () => {
    expect(didBirthChange(base, { birth: "1993-11-24", birthTime: "15:12", timeUnknown: false })).toBe(false);
  });

  it("เวลาต่างแค่ format (มี/ไม่มีวินาที) = ไม่นับว่าเปลี่ยน", () => {
    expect(didBirthChange({ ...base, birthTime: "15:12:00" }, { birth: "1993-11-24", birthTime: "15:12", timeUnknown: false })).toBe(false);
  });

  it("timeUnknown อยู่แล้ว → แก้ค่าเวลา (ที่ถูกเมิน) ไม่นับว่าเปลี่ยน", () => {
    expect(didBirthChange({ ...base, timeUnknown: true, birthTime: null }, { birth: "1993-11-24", birthTime: "10:00", timeUnknown: true })).toBe(false);
  });

  it("กรอกครั้งแรก (ยังไม่มีวันเกิด) = ไม่ใช่การแก้", () => {
    expect(didBirthChange({ birthDate: null, birthTime: null, timeUnknown: false }, { birth: "1993-11-24", birthTime: "15:12", timeUnknown: false })).toBe(false);
  });
});

// src/lib/bazi/profile/birth-change.ts
// เอ็มพบ 2026-09-20: /api/profile PATCH เดิมตัดสินว่า "แก้วันเกิด" จาก birthDate + timeUnknown===true เท่านั้น
// → "แก้เวลาเกิดอย่างเดียว" (วันเดิม) ไม่ถูกนับ → ไม่กินสิทธิ์ฟรี/ไม่หัก QI ทั้งที่เวลาเกิดเปลี่ยน = ดวงเปลี่ยนทั้งดวง.
// แยกออกมาเป็น pure function ให้เทสต์ได้: "แก้จริง" = วันเกิด/เวลาเกิด/สถานะไม่ทราบเวลา อย่างใดเปลี่ยนจากเดิม.

export type ExistingBirth = {
  birthDate: string | null;
  birthTime: string | null;
  timeUnknown: boolean | null;
};

export type BirthPatch = {
  birth?: string;
  birthTime?: string | null;
  timeUnknown?: boolean;
};

const normTime = (t: string | null | undefined): string | null =>
  typeof t === "string" && t ? t.slice(0, 5) : null;

/**
 * true = ถือเป็น "การแก้วันเกิด" ที่ต้องคิดโควตา/หัก QI. false = กรอกครั้งแรก (ยังไม่มีวันเกิด) หรือไม่มีอะไรเปลี่ยน.
 * เทียบ วัน + เวลา + สถานะไม่ทราบเวลา กับของเดิม (any changed = แก้จริง).
 */
export function didBirthChange(existing: ExistingBirth, body: BirthPatch): boolean {
  // กรอกครั้งแรก (ยังไม่มีวันเกิดในระบบ) ไม่ใช่การ "แก้"
  if (existing.birthDate == null) return false;

  const dateChanged = body.birth !== undefined && body.birth !== existing.birthDate;
  const timeUnknownChanged =
    body.timeUnknown !== undefined && body.timeUnknown !== (existing.timeUnknown ?? false);
  const effectiveTimeUnknown = body.timeUnknown ?? existing.timeUnknown ?? false;
  const timeValueChanged =
    !effectiveTimeUnknown && body.birthTime !== undefined && normTime(body.birthTime) !== normTime(existing.birthTime);

  return dateChanged || timeUnknownChanged || timeValueChanged;
}

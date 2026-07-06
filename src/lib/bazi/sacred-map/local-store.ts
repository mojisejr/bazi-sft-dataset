"use client";

/**
 * สถานะส่วนตัวฝั่งผู้ใช้ของ Sacred Map เก็บใน localStorage (ยังไม่ผูก LINE login):
 *   - saved: สถานที่ที่กด Save
 *   - checkedIn: สถานที่ที่เคยเช็คอิน
 *   - reminders: id → วันที่ตั้งเตือน (YYYY-MM-DD)
 * ต่อยอดเป็น LINE push ผ่าน bazi_alerts ได้ภายหลังเมื่อเปิด LIFF จริง.
 */
const SAVED_KEY = "sacred-map:saved";
const CHECKIN_KEY = "sacred-map:checkedin";
const REMINDER_KEY = "sacred-map:reminders";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* โควตาเต็ม/ปิด storage — เงียบไว้ */
  }
}

export function getSavedIds(): Set<string> {
  return readSet(SAVED_KEY);
}

export function toggleSaved(id: string): boolean {
  const set = readSet(SAVED_KEY);
  const next = !set.has(id);
  if (next) set.add(id);
  else set.delete(id);
  writeSet(SAVED_KEY, set);
  return next;
}

export function getCheckedInIds(): Set<string> {
  return readSet(CHECKIN_KEY);
}

export function markCheckedIn(id: string): void {
  const set = readSet(CHECKIN_KEY);
  set.add(id);
  writeSet(CHECKIN_KEY, set);
}

export function getReminders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMINDER_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setReminder(id: string, date: string | null): void {
  if (typeof window === "undefined") return;
  const map = getReminders();
  if (date) map[id] = date;
  else delete map[id];
  try {
    window.localStorage.setItem(REMINDER_KEY, JSON.stringify(map));
  } catch {
    /* เงียบไว้ */
  }
}

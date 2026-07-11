/**
 * โหมดจับคู่สไตล์ Tinder ("จับคู่สมพงษ์") — types + helpers ที่ client กับ server ใช้ร่วมกัน.
 *
 * แนวคิด: นำ "ดวงสมพงษ์" (ตาราง 60×60 ของ pair-matching) มานำเสนอแบบปัดการ์ด
 * ผู้ใช้เลือก "ตัวเรา" 1 คน แล้วปัดซ้าย/ขวาดูผู้สมัครทีละคน โดยการ์ดโชว์ "เกรดสมพงษ์"
 * (A+/A/…/F) + คำทำนายด้านหลัก ก่อนตัดสินใจ — ถ้าปัดขวา (ชอบ) และอีกฝ่าย "ชอบกลับ"
 * (เกรดสมพงษ์ถึงเกณฑ์) จะเกิด "แมตช์".
 *
 * ไฟล์นี้ไม่ import โมดูลฝั่ง server (DB/engine) เพื่อให้ component ฝั่ง client import ได้.
 */
import type { RelationshipType } from "@/lib/bazi/pair-types";

/** เกณฑ์ %สมพงษ์ที่อีกฝ่ายจะ "ชอบกลับ" (เกรด B- ขึ้นไป) → เกิดแมตช์. */
export const MATCH_THRESHOLD = 55;

/** ระดับความร้อนแรงของการ์ด (ใช้เลือกโทนสี). */
export type MatchTone = "hot" | "warm" | "mild" | "cool" | "cold";

export function toneOfPercent(percent: number | null): MatchTone {
  if (percent == null) return "cold";
  if (percent >= 75) return "hot";
  if (percent >= 60) return "warm";
  if (percent >= 45) return "mild";
  if (percent >= 30) return "cool";
  return "cold";
}

/** ป้ายสรุปสั้น ๆ ตาม %สมพงษ์ (มิเรอร์ pair verdictLabel แต่ client-safe). */
export function verdictOfPercent(percent: number | null): string {
  if (percent == null) return "ไม่พบข้อมูลสมพงษ์";
  if (percent >= 83) return "เนื้อคู่ตัวจริง";
  if (percent >= 66) return "เข้ากันดีมาก";
  if (percent >= 50) return "ไปกันได้";
  if (percent >= 33) return "ต้องปรับเข้าหากัน";
  return "ท้าทาย ควรระวัง";
}

/** เพศตรงข้าม (ไว้เป็นค่าเริ่มต้นของ "อยากดูเพศไหน"). */
export function oppositeGender(gender: string): GenderFilter {
  const g = gender.trim().toLowerCase();
  if (g === "male" || g === "ชาย") return "female";
  if (g === "female" || g === "หญิง") return "male";
  return "all";
}

export function genderLabelTh(gender: string): string {
  const g = gender.trim().toLowerCase();
  if (g === "male" || g === "ชาย") return "ชาย";
  if (g === "female" || g === "หญิง") return "หญิง";
  return "ไม่ระบุ";
}

export type GenderFilter = "male" | "female" | "all";

/** ข้อมูลย่อของคน 1 คนในระบบ (ผู้สมัคร หรือ "ตัวเรา"). */
export type PersonCard = {
  /** saved-chart UUID หรือ "sample:<key>" สำหรับดวงตัวอย่าง. */
  id: string;
  name: string;
  gender: string;
  source: "saved" | "sample";
  /** หลักวัน เช่น "甲子" (null ถ้าคำนวณไม่ได้). */
  dayPillar: string | null;
  elementTh: string | null;
  stageTh: string;
  /** อายุปีปัจจุบัน (null ถ้าวันเกิดผิดรูป). */
  age: number | null;
  /** วันเกิดอ่านง่าย เช่น "15 มี.ค. 2537". */
  birthLabel: string;
  /** ไบโอ/แท็ก (มีเฉพาะดวงตัวอย่าง). */
  bio?: string;
  tags?: string[];
};

/** 1 แท่งกราฟความเข้ากันรายมิติ. */
export type FacetBar = {
  key: string;
  label: string;
  pairingLabel: string;
  percent: number | null;
  grade: string;
  emoji: string | null;
  found: boolean;
  isMain: boolean;
};

/** การ์ด 1 ใบในเด็ค — ผู้สมัคร + ผลสมพงษ์เทียบกับ "ตัวเรา". */
export type DeckCard = {
  person: PersonCard;
  nisai: string[];
  headline: {
    facetKey: string;
    label: string;
    pairingLabel: string;
    percent: number | null;
    grade: string;
    emoji: string | null;
    verdict: string;
    ratingText: string;
    tone: MatchTone;
  };
  facets: FacetBar[];
  elementSummary: string;
  sising: { nameTh: string; nameCn: string; short: string } | null;
  /** อีกฝ่ายจะ "ชอบกลับ" ไหม (คำนวณจากเกณฑ์ MATCH_THRESHOLD) — เปิดเผยหลังปัดขวา. */
  likesBack: boolean;
};

export type RosterResponse = { people: PersonCard[]; unavailable?: boolean };

export type DeckResponse = {
  self: PersonCard;
  deck: DeckCard[];
  relationship: RelationshipType;
  matchThreshold: number;
  unavailable?: boolean;
};

/** ทิศทางปัด. */
export type SwipeDir = "like" | "pass";

/** รายการแมตช์ที่เก็บฝั่ง client (localStorage). */
export type MatchRecord = {
  personId: string;
  name: string;
  dayPillar: string | null;
  percent: number | null;
  grade: string;
  verdict: string;
  headlineLabel: string;
  at: number;
};

const THAI_MONTHS_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "1994-03-15" → "15 มี.ค. 2537" (ปี พ.ศ.). คืน birthDate เดิมถ้ารูปแบบผิด. */
export function birthLabelTh(birthDate: string): string {
  const [y, m, d] = birthDate.split("-").map((n) => Number(n));
  if (!y || !m || !d || m < 1 || m > 12) return birthDate;
  return `${d} ${THAI_MONTHS_ABBR[m - 1]} ${y + 543}`;
}

/** อายุปีปัจจุบันจาก birthDate เทียบ "วันนี้" (ส่ง now เข้ามาเพื่อให้ pure/ทดสอบได้). */
export function ageFromBirthDate(birthDate: string, now: Date): number | null {
  const [y, m, d] = birthDate.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  let age = now.getFullYear() - y;
  const beforeBirthday =
    now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

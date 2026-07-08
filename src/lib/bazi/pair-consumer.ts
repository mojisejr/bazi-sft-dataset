/**
 * Helpers ร่วมของฟีเจอร์ "ดวงสมพงษ์" ฝั่ง consumer (wizard UI ใหม่):
 * ใช้ทั้งใน POST /api/bazi/pair-match และหน้า report สำหรับพิมพ์ /pair-match/report.
 */

import type { RelationshipType } from "@/lib/bazi/pair-types";

/** ความสัมพันธ์ที่ wizard ส่งได้ = ของ engine + "family" (alias love). */
export type RelationshipInput = "love" | "partner" | "boss" | "subordinate" | "family";

export const RELATIONSHIP_INPUT_VALUES: readonly RelationshipInput[] = [
  "love",
  "partner",
  "boss",
  "subordinate",
  "family",
];

/** map ความสัมพันธ์จาก wizard → RelationshipType ของ engine. */
export function toEngineRelationship(input: RelationshipInput): RelationshipType {
  return input === "family" ? "love" : input;
}

/** ⚠️ ครอบครัวยังใช้ตารางความรักชั่วคราว จนกว่าซินแสจะเคาะสเปกเฉพาะ. */
export function relationshipNoteOf(input: RelationshipInput): string | null {
  return input === "family"
    ? "ครอบครัวใช้เกณฑ์เดียวกับตารางความรัก (รอสเปกเฉพาะจากซินแส)"
    : null;
}

export function relationshipLabelOverride(input: RelationshipInput): string | null {
  return input === "family" ? "ครอบครัว" : null;
}

/** ป้ายเกรดแบบสั้นใต้วงกลมคะแนน (จอ pair-match-result). */
export function gradeLabelOf(percent: number | null): string {
  if (percent == null) return "ไม่พบข้อมูลคู่นี้";
  if (percent >= 75) return "เข้ากันมาก";
  if (percent >= 55) return "เข้ากันดี";
  if (percent >= 40) return "ต้องปรับเข้าหากัน";
  if (percent >= 25) return "ค่อนข้างเหนื่อยใจ";
  return "ไม่ค่อยส่งเสริมกัน";
}

/** จำนวนหัวใจ 0-5 สำหรับแถบหัวใจใต้คะแนนรวม. */
export function heartsOf(percent: number | null): number {
  if (percent == null) return 0;
  return Math.min(5, Math.max(1, Math.round(percent / 20)));
}

export const PAIR_MATCH_DEFAULT_BIRTH_TIME = "12:00";
export const PAIR_MATCH_DEFAULT_PROVINCE = "กรุงเทพมหานคร";

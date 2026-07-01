/**
 * ประกอบ "ข้อความคำทำนาย Matching" จาก DB overlay ทับ JSON เดิม (reference.json + sising.json)
 * ช่องที่ DB ไม่มี → คงค่า JSON เดิม. คืน object ใหม่ (ไม่ mutate ค่า import global → กัน race บน serverless)
 */
import referenceJson from "@/lib/bazi/data/pair/reference.json";
import sisingJson from "@/lib/bazi/data/pair/sising.json";
import {
  ROLE_FIELD_BY_GROUP,
  SISING_ASPECT_BY_GROUP,
} from "@/lib/bazi/matching-groups";
import type { MatchingMap } from "@/lib/bazi/matching-repository";
import type { ReferenceData, SisingStar } from "@/lib/bazi/pair-types";

export type MatchingText = { reference: ReferenceData; sising: SisingStar[] };

const BASE_REFERENCE = referenceJson as ReferenceData;
const BASE_SISING = sisingJson as SisingStar[];

/** ค่าเริ่มต้น = JSON เดิม (ใช้เป็น default param ใน pair-matching) */
export const DEFAULT_MATCHING_TEXT: MatchingText = {
  reference: BASE_REFERENCE,
  sising: BASE_SISING,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** overlay DB map → { reference, sising } (ช่องว่าง = ค่า JSON เดิม) */
export function applyMatchingOverrides(map: MatchingMap | null | undefined): MatchingText {
  if (!map || Object.keys(map).length === 0) return DEFAULT_MATCHING_TEXT;

  const reference = clone(BASE_REFERENCE);
  const sising = clone(BASE_SISING);
  const text = (v: { text?: string } | undefined) => (v?.text ?? "").trim();

  // นิสัยหลักวัน
  for (const [k, v] of Object.entries(map.nisai_stem ?? {})) {
    const t = text(v);
    if (t) reference.nisai.byStem[k] = t;
  }
  for (const [k, v] of Object.entries(map.nisai_branch ?? {})) {
    const t = text(v);
    if (t) reference.nisai.byBranch[k] = t;
  }
  for (const [k, v] of Object.entries(map.nisai_stage ?? {})) {
    const t = text(v);
    if (t) reference.nisai.byStage[k] = t;
  }

  // บทบาทความสัมพันธ์ — ทับ narrative ของ stage แรกที่ code ตรง (ตรงกับ ROLE_MAP first-occurrence)
  for (const [group, field] of Object.entries(ROLE_FIELD_BY_GROUP)) {
    const overrides = map[group];
    if (!overrides) continue;
    const stages = reference[field];
    for (const [code, v] of Object.entries(overrides)) {
      const t = text(v);
      if (!t) continue;
      const stage = stages.find((s) => s.code === code);
      if (stage) stage.narrative = t;
    }
  }

  // สี่ซิ้ง — short/long/summary + aspects
  const sisingByCode = new Map(sising.map((s) => [s.code, s]));
  const applySising = (group: string, apply: (s: SisingStar, t: string) => void) => {
    for (const [code, v] of Object.entries(map[group] ?? {})) {
      const t = text(v);
      if (!t) continue;
      const s = sisingByCode.get(code);
      if (s) apply(s, t);
    }
  };
  applySising("sising_short", (s, t) => (s.short = t));
  applySising("sising_long", (s, t) => (s.long = t));
  applySising("sising_summary", (s, t) => (s.summary = t));
  for (const [group, aspect] of Object.entries(SISING_ASPECT_BY_GROUP)) {
    applySising(group, (s, t) => (s.aspects[aspect] = t));
  }

  return { reference, sising };
}

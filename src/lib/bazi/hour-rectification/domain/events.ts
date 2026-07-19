// Hour Rectification v2 — life-event domain types (#hour-rectification-engine, event-based lane).
//
// v2 is a SEPARATE lane from v1's personality quiz: instead of asking behavioural questions, it
// takes 2-4 dated life events and scores each of the 12 ยาม by how well its 大運/流年 timeline
// explains those events (deterministic rule-scorer, no LLM at runtime). This file is the pure input
// vocabulary — no engine/LLM/file dependency.

// The six event categories the rule table (rules.ts) is written against. Each maps to a classical
// "palace" the event most strongly touches (spouse/children/career/health/parents/travel), which is
// why a dated event is a much stronger hour signal than a personality answer.
export const EVENT_TYPES = [
  "marriage",
  "career_change",
  "serious_illness",
  "major_loss",
  "childbirth",
  "relocation",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

// A single dated life event. `year` is a GREGORIAN (CE) year — the domain works entirely in CE;
// the UI/adapter converts the พ.ศ. the user picks (−543) before it reaches here, so the annual
// ganzhi maths never has to know about the Buddhist era.
export type LifeEvent = {
  type: EventType;
  year: number;
};

// Thai labels + emoji for the UI's event dropdown. Kept in the domain so the label a rule's
// `because` template refers to and the label the user picked are the single same source of truth.
export const EVENT_LABELS_TH: Record<EventType, { label: string; emoji: string }> = {
  marriage: { label: "แต่งงาน", emoji: "💍" },
  career_change: { label: "เปลี่ยนงานใหญ่", emoji: "💼" },
  serious_illness: { label: "เจ็บป่วยหนัก", emoji: "🏥" },
  major_loss: { label: "สูญเสียคนสำคัญ", emoji: "🕯️" },
  childbirth: { label: "มีบุตร", emoji: "👶" },
  relocation: { label: "ย้ายถิ่น/ย้ายบ้านไกล", emoji: "✈️" },
};

// Events must number 2-4 (spec): fewer than 2 is under-determined → the API answers "need_events".
export const MIN_EVENTS = 2;
export const MAX_EVENTS = 4;

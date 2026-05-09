export const SCHOOL_LEXICON_RELATION: Record<string, string> = {
  "same": "คู่ธาตุ",
  "generate": "ถ่ายเท",
  "generated": "ส่งเสริม",
  "control": "พิฆาต",
  "controlled": "พิฆาต",
  "friend": "คู่ธาตุ",
  "resource": "ส่งเสริม",
  "output": "ถ่ายเท",
  "wealth": "โชคลาภ",
  "power": "พิฆาต",
};

export function getSchoolLexiconRelation(systemRelation: string): string {
  return SCHOOL_LEXICON_RELATION[systemRelation] ?? systemRelation;
}

export const SCHOOL_LEXICON_INTERACTION: Record<string, string> = {
  "combination": "ภาคีราศีบน",
  "branch-combination": "ฮะราศีล่าง",
  "clash": "ชง",
  "punishment": "เฮ้ง",
  "destruction": "ผั่ว",
  "harm": "ไห่",
  "generate": "เซียงแซ",
  "control": "พิฆาต",
};

export function getSchoolLexiconInteraction(interactionType: string): string {
  return SCHOOL_LEXICON_INTERACTION[interactionType] ?? interactionType;
}

export const SCHOOL_LEXICON_FAMILY_KEY: Record<string, string> = {
  "heavenly-stem-he": "ภาคีราศีบน",
  "heavenly-stem-clash": "ชงราศีบน",
  "earthly-branch-liu-he": "ฮะราศีล่าง",
  "earthly-branch-san-he": "ฮะบริบูรณ์",
  "earthly-branch-ban-san-he": "ฮะครึ่ง",
  "earthly-branch-san-hui": "ฮุ้ยราศีล่าง",
  "earthly-branch-fang-ju": "ฝางกุ้ย",
  "earthly-branch-clash": "ชงราศีล่าง",
  "earthly-branch-harm": "ไห่ราศีล่าง",
  "earthly-branch-destruction": "ผั่วราศีล่าง",
  "earthly-branch-punishment": "เฮ้งราศีล่าง",
  "element-generate": "เซียงแซ",
  "element-control": "พิฆาต",
};

export function getSchoolLexiconFamilyKey(familyKey: string): string {
  return SCHOOL_LEXICON_FAMILY_KEY[familyKey] ?? `[engine: ${familyKey}]`;
}

export const PRIORITY_MAP: Record<string, string> = {
  "primary": "หลัก",
  "secondary": "รอง",
  "tertiary": "เสริม",
  "neutralized": "ถูกล้าง",
};

export function translatePriority(priority: string): string {
  return PRIORITY_MAP[priority] ?? `[engine: ${priority}]`;
}

export const OUTCOME_STATUS_MAP: Record<string, string> = {
  "detected": "ตรวจพบ",
  "supported": "มีแรงหนุน",
  "transformed": "แปรสภาพ",
  "blocked": "ถูกบัง",
  "transit-broken": "สายขาด",
  "active": "ทำงาน",
  "supplementary": "เสริม",
  "neutralized": "ถูกล้าง",
};

export function translateOutcomeStatus(status: string): string {
  return OUTCOME_STATUS_MAP[status] ?? `[engine: ${status}]`;
}

export const DAY_MASTER_EFFECT_MAP: Record<string, string> = {
  "beneficial": "เป็นผลดี",
  "harmful": "เป็นผลร้าย",
  "neutral": "เป็นกลาง",
};

export function translateDayMasterEffect(effect: string): string {
  return DAY_MASTER_EFFECT_MAP[effect] ?? `[engine: ${effect}]`;
}

export const FLOW_CYCLE_MAP: Record<string, string> = {
  "generating": "เซียงแซ",
  "controlling": "พิฆาต",
  "neutral": "เป็นกลาง",
};

export const FLOW_DIRECTION_MAP: Record<string, string> = {
  "outward": "ส่งออก",
  "inward": "รับเข้า",
  "none": "ไม่มีทิศทาง",
  "both": "สองทิศทาง",
};

export const BADGE_FAMILY_MAP: Record<string, string> = {
  "route": "เส้นทาง",
  "role": "บทบาทต่อดิถี",
  "interaction": "ปฏิกิริยา",
  "marker": "ดาวประกอบ",
};

export const PILLAR_CONTEXT_SHORT: Record<string, string> = {
  year: "ลูกค้า/ตลาด",
  month: "ธุรกิจ/ผู้บังคับบัญชา",
  day: "ดิถี/คู่ครอง",
  time: "ลูกหลาน/ผลงาน",
};

export const PILLAR_LABEL_MAP: Record<string, string> = {
  year: "เสาปี",
  month: "เสาเดือน",
  day: "เสาวัน",
  time: "เสาชั่วโมง",
};

export const PARTICIPANT_ROLE_MAP: Record<string, string> = {
  "ผู้กระทำ": "ผู้กระทำ",
  "ถูกกระทำ": "ถูกกระทำ",
};

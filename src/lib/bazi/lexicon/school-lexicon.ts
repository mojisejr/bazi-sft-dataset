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

export const CANONICAL_FIVE_PHASE_RELATION_LABELS: Record<string, string> = {
  same: "คู่ธาตุ",
  resource: "ธาตุส่งเสริม",
  output: "ธาตุถ่ายเท",
  power: "ธาตุพิฆาต",
  wealth: "พิฆาตธาตุ",
};

export function getCanonicalFivePhaseRelationLabel(relationKey: string): string {
  return CANONICAL_FIVE_PHASE_RELATION_LABELS[relationKey] ?? `[engine: ${relationKey}]`;
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

export const OUTCOME_DETAIL_MAP: Record<string, string> = {
  "supported": "สำเร็จสมบูรณ์",
  "resisted": "ถูกขัดขวาง/ต้านทาน",
  "weak": "กำลังอ่อนแอ",
  "dormant": "แฝงเร้น",
  "water": "หลอมรวมเป็นธาตุน้ำ",
  "wood": "หลอมรวมเป็นธาตุไม้",
  "fire": "หลอมรวมเป็นธาตุไฟ",
  "earth": "หลอมรวมเป็นธาตุดิน",
  "metal": "หลอมรวมเป็นธาตุทอง",
  "generating": "ก่อเกิด/ส่งเสริม",
  "controlling": "พิฆาต/ควบคุม",
};

export function translateOutcomeDetail(val: string): string {
  return OUTCOME_DETAIL_MAP[val.toLowerCase()] ?? `[engine: ${val}]`;
}

export const REVIEW_STATE_MAP: Record<string, string> = {
  "active": "ปกติ",
  "stale": "ต้องตรวจซ้ำ",
  "needs-reproof": "ต้องตรวจซ้ำใหม่",
  "superseded": "ถูกแทนแล้ว",
};

export function translateReviewState(state: string): string {
  return REVIEW_STATE_MAP[state] ?? `[engine: ${state}]`;
}

export const ANNOTATOR_BADGE_MAP: Record<string, string> = {
  "AI Generated": "AI สร้าง",
  "Draft Record": "ร่าง",
};

export const CHAMBER_RELATION_TYPE_MAP: Record<string, string> = {
  "ten-god-flow": "กระแสสิบเทพ",
  "day-master-role": "บทบาทต่อดิถี",
  "interaction": "ปฏิกิริยา",
  "element-interaction": "ปฏิกิริยาธาตุ",
  "overlay": "ชั้นทับซ้อน",
};

export function translateRelationType(type: string): string {
  return CHAMBER_RELATION_TYPE_MAP[type] ?? `[engine: ${type}]`;
}

export const BUNDLE_DIRECTION_MAP: Record<string, string> = {
  "outward": "ส่งออก",
  "inward": "รับเข้า",
  "mutual": "สองทิศ",
  "none": "ไม่มีทิศ",
};

export function translateBundleDirection(dir: string): string {
  return BUNDLE_DIRECTION_MAP[dir] ?? `[engine: ${dir}]`;
}

export const INTERACTION_NARRATIVE_MAP: Record<string, string> = {
  "heavenly-stem-he": "รวมกันเป็นธาตุใหม่",
  "heavenly-stem-clash": "ปะทะ แตกหัก เปลี่ยนแปลง",
  "earthly-branch-liu-he": "ร่วมมือ สนับสนุน หนุนเนื่อง",
  "earthly-branch-san-he": "รวมพลังสามธาตุ เป็นกรอบใหญ่",
  "earthly-branch-ban-san-he": "รวมบางส่วน มีแรงแต่ไม่เต็มภาค",
  "earthly-branch-san-hui": "รวมกลุ่มตามทิศ พลังทิศา",
  "earthly-branch-fang-ju": "รวมกลุ่มตามทิศ แน่นหนา",
  "earthly-branch-clash": "ปะทะ แตกหัก เปลี่ยนแปลง",
  "earthly-branch-harm": "ทำร้าย เบียดเบียน ลำบาก",
  "earthly-branch-destruction": "ทำลาย สูญเสีย ขัดแย้ง",
  "earthly-branch-punishment": "ลงโทษ ติดขัด ทรมาน",
  "element-generate": "ก่อเกิด ส่งเสริม เลี้ยงดู",
  "element-control": "ควบคุม พิฆาต กดขี่",
};

export const UI_KICKER_MAP: Record<string, string> = {
  "ground-truth-check": "ตรวจสอบค่าจริง",
  "quick-truth-anchors": "ค่าหลักที่ถือไว้",
  "decision-dock": "ช่องตัดสินใจ",
  "proof-note": "บันทึกของซินแส",
  "draft-queue": "คิวร่าง",
  "case-preview": "ตัวอย่างเคส",
  "engine-truth": "ข้อมูลจากระบบ",
  "role-map": "ผังบทบาทธาตุ",
  "operator-access": "เข้าถึงระบบ",
  "secure-operator-access": "สิทธิ์เข้าถึงระบบ",
  "proof-queue-workspace": "พื้นที่งานคิวตรวจ",
  "expanded-case-context": "ข้อมูลเคสแบบเต็ม",
  "proof-calculation-drawer": "แผงคำนวณสำหรับงานตรวจ",
  "phase-4": "เฟส 4",
  "phase-5": "เฟส 5",
};

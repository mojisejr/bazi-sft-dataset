/**
 * แคตตาล็อกกลุ่มคำทำนาย Matching (จับคู่/สมพงษ์) — metadata ขับหน้าแอดมิน
 * ทุกกลุ่มคือข้อความที่ overlay ทับ reference.json / sising.json (ดู matching-overlay.ts)
 *   คะแนน %/เกรด ไม่อยู่ที่นี่ (คำนวณจาก pair-matrix.json)
 */
export type MatchingKeyKind =
  | "stem" // ก้าน 甲..癸
  | "branch" // ราศี 子..亥
  | "stage" // เชี่ยงแซ (ชื่อไทย)
  | "code"; // โค้ดระยะ A1..A12 / สี่ซิ้ง B1..B12

export type MatchingGroup = {
  key: string;
  label: string;
  description: string;
  keyKind: MatchingKeyKind;
  /** field ปลายทางใน reference/sising ที่กลุ่มนี้ทับ (ใช้โดย matching-overlay + seed) */
  sourceFile: string;
};

export const MATCHING_GROUPS: readonly MatchingGroup[] = [
  // ── นิสัยหลักวัน (reference.nisai) ──
  {
    key: "nisai_stem",
    label: "นิสัย · ตามก้านวัน (10 ก้าน)",
    description: "คำอ่านนิสัยตามราศีบนหลักวัน (甲..癸) — ใช้ในบล็อก 'นิสัยของแต่ละคน' หน้าจับคู่",
    keyKind: "stem",
    sourceFile: "reference.json → nisai.byStem",
  },
  {
    key: "nisai_branch",
    label: "นิสัย · ตามราศีวัน (12 ราศี)",
    description: "คำอ่านนิสัยตามราศีล่างหลักวัน (子..亥)",
    keyKind: "branch",
    sourceFile: "reference.json → nisai.byBranch",
  },
  {
    key: "nisai_stage",
    label: "นิสัย · ตามเชี่ยงแซ (12 ระยะ)",
    description: "คำอ่านนิสัยตามระยะเชี่ยงแซของหลักวัน (หมกยก..หมอ)",
    keyKind: "stage",
    sourceFile: "reference.json → nisai.byStage",
  },
  // ── บทบาทความสัมพันธ์ (reference.role* / loveShengxia) — คีย์ = โค้ด A1..A12 (ก้าน/กิ่ง) + B1..B12 (สี่ซิ้ง) ──
  {
    key: "role_partner",
    label: "คำทำนายรายแท่ง · หุ้นส่วน",
    description: "คำทำนายก้าน/กิ่ง (A1..A12) + สี่ซิ้ง (B1..B12) มุม 'หุ้นส่วน'",
    keyKind: "code",
    sourceFile: "reference.json → rolePartner[].narrative",
  },
  {
    key: "role_boss",
    label: "คำทำนายรายแท่ง · เจ้านาย",
    description: "คำทำนายก้าน/กิ่ง (A1..A12) + สี่ซิ้ง (B1..B12) มุม 'เจ้านาย'",
    keyKind: "code",
    sourceFile: "reference.json → roleBoss[].narrative",
  },
  {
    key: "role_subordinate",
    label: "คำทำนายรายแท่ง · ลูกน้อง",
    description: "คำทำนายก้าน/กิ่ง (A1..A12) + สี่ซิ้ง (B1..B12) มุม 'ลูกน้อง'",
    keyKind: "code",
    sourceFile: "reference.json → roleSubordinate[].narrative",
  },
  {
    key: "role_love",
    label: "คำทำนายรายแท่ง · คู่รัก",
    description: "คำทำนายก้าน/กิ่ง (A1..A12) + สี่ซิ้ง (B1..B12) มุม 'คู่รัก'",
    keyKind: "code",
    sourceFile: "reference.json → loveShengxia[].narrative",
  },
  // ── สี่ซิ้ง 12 ดวง (sising.json) — คีย์ = B1..B12 ──
  {
    key: "sising_short",
    label: "สี่ซิ้ง · คำอธิบายสั้น",
    description: "คำอธิบายสั้นของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → short",
  },
  {
    key: "sising_long",
    label: "สี่ซิ้ง · คำอธิบายยาว",
    description: "คำอธิบายยาวของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → long",
  },
  {
    key: "sising_summary",
    label: "สี่ซิ้ง · สรุป",
    description: "สรุปของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → summary",
  },
  {
    key: "sising_work",
    label: "สี่ซิ้ง · ด้านการงาน",
    description: "แง่มุมการงานของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → aspects.work",
  },
  {
    key: "sising_money",
    label: "สี่ซิ้ง · ด้านการเงิน",
    description: "แง่มุมการเงินของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → aspects.money",
  },
  {
    key: "sising_love",
    label: "สี่ซิ้ง · ด้านความรัก",
    description: "แง่มุมความรักของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → aspects.love",
  },
  {
    key: "sising_family",
    label: "สี่ซิ้ง · ด้านครอบครัว",
    description: "แง่มุมครอบครัวของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → aspects.family",
  },
  {
    key: "sising_business",
    label: "สี่ซิ้ง · ด้านธุรกิจ",
    description: "แง่มุมธุรกิจของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → aspects.business",
  },
  {
    key: "sising_health",
    label: "สี่ซิ้ง · ด้านสุขภาพ",
    description: "แง่มุมสุขภาพของสี่ซิ้ง 12 ดวง (B1..B12)",
    keyKind: "code",
    sourceFile: "sising.json → aspects.health",
  },
] as const;

/** aspect key ของ sising ต่อกลุ่ม (ใช้โดย overlay + seed) */
export const SISING_ASPECT_BY_GROUP: Record<string, "work" | "money" | "love" | "family" | "business" | "health"> = {
  sising_work: "work",
  sising_money: "money",
  sising_love: "love",
  sising_family: "family",
  sising_business: "business",
  sising_health: "health",
};

/** role group → field ใน ReferenceData (ใช้โดย overlay + seed) */
export const ROLE_FIELD_BY_GROUP: Record<string, "rolePartner" | "roleBoss" | "roleSubordinate" | "loveShengxia"> = {
  role_partner: "rolePartner",
  role_boss: "roleBoss",
  role_subordinate: "roleSubordinate",
  role_love: "loveShengxia",
};

/**
 * นิยามภารกิจ (จอ mission-board `missions — all` 55399:6923) — อยู่ในโค้ดเพื่อแก้ง่าย ยังไม่ต้องมี admin UI.
 * ความคืบหน้าอยู่ใน bazi_mission_progress · จ่ายรางวัลอัตโนมัติเมื่อครบเป้า (ครั้งเดียวต่อรอบ, เป็น QI).
 * period: "daily" รีเซ็ตทุกวัน (periodKey = วันไทย) · "once" ทำครั้งเดียว (periodKey = "all")
 * category: จัดกลุ่มบนจอ (daily=ทำได้ทุกวัน · once=ทำครั้งเดียวจบ · longterm=เป้าหมายระยะยาว)
 * actionHref: ปุ่ม "ทำเลย" พาไปทำ (เว้นว่าง = ภารกิจที่เสร็จเองจากที่อื่น เช่นเช็คอิน)
 *
 * ⚠️ เส้นที่มี earn-line อยู่แล้ว (เช็คอินรายวัน=daily_login, แชร์=share) ไม่ทำเป็น mission ที่จ่ายซ้ำ —
 *    จอ board ฝั่ง FE โชว์เช็คอินเป็นแถวลิงก์ไป /v2/qi/checkin (รางวัลมาจาก earn ไม่ใช่ mission).
 */

export type MissionPeriod = "daily" | "once";
// guide = "เส้นทางมือใหม่" (ไกด์สอนเล่นบนหน้าหลัก FE) — ไม่โชว์บน mission-board (FE กรองตาม category อยู่แล้ว)
export type MissionCategory = "daily" | "once" | "longterm" | "guide";

export type MissionDef = {
  id: string;
  title: string;
  description: string;
  period: MissionPeriod;
  /** กลุ่มบนจอ mission-board */
  category: MissionCategory;
  /** จำนวนครั้งที่ต้องทำต่อรอบ */
  target: number;
  /** รางวัล QI (ชื่อ field เดิม rewardCoins คงไว้เพื่อ FE compat — เข้า qi ledger จริงแล้ว) */
  rewardCoins: number;
  rewardXp: number;
  /** ปุ่ม "ทำเลย" → เส้นทางในแอป (เว้นว่าง = เสร็จเองจากที่อื่น) */
  actionHref?: string;
};

/** รางวัลเส้นทางมือใหม่ (QI) — ต่อขั้น / โบนัสจบครบ (เปลี่ยนตัวเลขที่นี่ที่เดียว) */
export const GUIDE_STEP_QI = 10;
export const GUIDE_COMPLETE_QI = 50;
/** ภารกิจขั้นของเส้นทางมือใหม่ (ไม่รวม guide_complete) — ต้องรับครบก่อนจ่ายโบนัสจบ */
export const GUIDE_STEP_IDS = ["guide_destiny", "guide_calendar", "guide_chat", "guide_fortune", "guide_compat", "guide_qi"] as const;

export const MISSION_DEFS: readonly MissionDef[] = [
  // ── ทำได้ทุกวัน (reset เที่ยงคืนไทย) ──────────────────────────────────────
  {
    id: "read_fortune",
    title: "อ่านดวงวันนี้",
    description: "เปิดอ่านคำทำนายประจำวันให้จบ",
    period: "daily",
    category: "daily",
    target: 1,
    rewardCoins: 5,
    rewardXp: 10,
    actionHref: "/v2/destiny",
  },
  {
    id: "share_fortune",
    title: "แชร์ดวงวันนี้",
    description: "การ์ดมีโค้ดชวนฝังอยู่ · แชร์ได้วันละ 1 ครั้ง",
    period: "daily",
    category: "daily",
    target: 1,
    rewardCoins: 10,
    rewardXp: 15,
    actionHref: "/v2/qi/referral",
  },
  // ── ทำครั้งเดียวจบ ───────────────────────────────────────────────────────
  {
    id: "first_reading",
    title: "ดูดวงครั้งแรก",
    description: "ลองใช้บริการดูดวงสักอย่าง",
    period: "once",
    category: "once",
    target: 1,
    rewardCoins: 60,
    rewardXp: 30,
    actionHref: "/v2",
  },
  {
    id: "connect_line",
    title: "เชื่อมบัญชี LINE",
    description: "รับแจ้งเตือนดวงรายวันทาง LINE",
    period: "once",
    category: "once",
    target: 1,
    rewardCoins: 20,
    rewardXp: 15,
    actionHref: "/v2/settings/connected",
  },
  {
    id: "enable_notif",
    title: "เปิดการแจ้งเตือน",
    description: "กันลืมเช็คอินจนสถิติขาด",
    period: "once",
    category: "once",
    target: 1,
    rewardCoins: 10,
    rewardXp: 10,
    actionHref: "/v2/settings/notifications",
  },
  // ── เส้นทางมือใหม่ (เอ็ม 2026-10-13): ไกด์สอนเล่น 6 ขั้น — FE ยิงเมื่อผู้ใช้ทำตามปุ่มที่ไกด์พากด ──
  {
    id: "guide_destiny",
    title: "มือใหม่: รู้จักดวงของฉัน",
    description: "ดูจุดแข็ง-จุดอ่อน 5 ด้านในหน้าดวง",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_STEP_QI,
    rewardXp: 5,
    actionHref: "/v2/destiny",
  },
  {
    id: "guide_calendar",
    title: "มือใหม่: เช็กวันดีในปฏิทิน",
    description: "แตะดูวันในปฏิทินส่วนตัว",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_STEP_QI,
    rewardXp: 5,
    actionHref: "/v2/calendar",
  },
  {
    id: "guide_chat",
    title: "มือใหม่: ถามเสี่ยวมู่/เสี่ยวมี่",
    description: "เปิดช่องแชทแล้วถามคำถามแรก",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_STEP_QI,
    rewardXp: 5,
    actionHref: "/v2/chat",
  },
  {
    id: "guide_fortune",
    title: "มือใหม่: ลองเสี่ยงเซียมซี",
    description: "พิมพ์คำถามแล้วเสี่ยงทาย",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_STEP_QI,
    rewardXp: 5,
    actionHref: "/v2/fortune/sage",
  },
  {
    id: "guide_compat",
    title: "มือใหม่: ดูดวงสมพงศ์",
    description: "เลือกคนที่จะดูความเข้ากัน",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_STEP_QI,
    rewardXp: 5,
    actionHref: "/v2/service/compatibility/love",
  },
  {
    id: "guide_qi",
    title: "มือใหม่: รู้จักพลังชี่",
    description: "เช็คอินรับ QI",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_STEP_QI,
    rewardXp: 5,
    actionHref: "/v2/qi",
  },
  {
    id: "guide_complete",
    title: "จบเส้นทางมือใหม่",
    description: "ทำภารกิจมือใหม่ครบทั้ง 6 ขั้น",
    period: "once",
    category: "guide",
    target: 1,
    rewardCoins: GUIDE_COMPLETE_QI,
    rewardXp: 30,
    actionHref: "/v2",
  },
  // ── เป้าหมายระยะยาว (รางวัลก้อนใหญ่) ─────────────────────────────────────
  {
    id: "streak_7",
    title: "เช็คอิน 7 วันติด",
    description: "นับใหม่ทุกสัปดาห์",
    period: "once",
    category: "longterm",
    target: 7,
    rewardCoins: 30,
    rewardXp: 40,
  },
] as const;

export const MISSION_BY_ID: ReadonlyMap<string, MissionDef> = new Map(
  MISSION_DEFS.map((m) => [m.id, m]),
);

/** 5 ธาตุตามลำดับจอ Figma (ไม้ ทอง ไฟ ดิน น้ำ) — key ตรงกับ elementOfBirthDate */
export const ELEMENT_ORDER = ["wood", "metal", "fire", "earth", "water"] as const;
export type ElementKey = (typeof ELEMENT_ORDER)[number];

// ธาตุจาก "ปีเกิด" (year stem) — 10 stems → 5 ธาตุ (2 ปี/ธาตุ):
//   甲乙=ไม้ · 丙丁=ไฟ · 戊己=ดิน · 庚辛=ทอง · 壬癸=น้ำ  (ปฏิทินจีน: ปี ค.ศ. mod 10)
const YEAR_STEM_ELEMENT: ElementKey[] = [
  "metal", "metal", "water", "water", "wood", "wood", "fire", "fire", "earth", "earth",
];

/** ธาตุประจำปีเกิดจากปี ค.ศ. (เช่น 1984 → ไม้) */
export function elementOfYear(year: number): ElementKey {
  return YEAR_STEM_ELEMENT[((year % 10) + 10) % 10];
}

/** ธาตุจากวันเกิด 'YYYY-MM-DD' (คิดจากปี) — null ถ้าไม่มี/ผิดรูป */
export function elementOfBirthDate(birthDate: string | null | undefined): ElementKey | null {
  if (!birthDate) return null;
  const year = Number(birthDate.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? elementOfYear(year) : null;
}

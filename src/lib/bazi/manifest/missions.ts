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
export type MissionCategory = "daily" | "once" | "longterm";

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
    actionHref: "/v2",
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

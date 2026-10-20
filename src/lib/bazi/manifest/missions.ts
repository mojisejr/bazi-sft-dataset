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

/** รางวัลเส้นทางมือใหม่ (QI) — ต่อภารกิจ / จบแต่ละบท / จบทุกบท (เปลี่ยนตัวเลขที่นี่ที่เดียว · FE โชว์ตาม quests.ts) */
export const GUIDE_STEP_QI = 1; // เอ็ม 2026-10-20: รางวัลไกด์เยอะเกิน → รวม ~305 เหลือ ~55 (เดิม 5/20/50, ทัวร์ 10)
export const GUIDE_CHAPTER_QI = 3;
export const GUIDE_COMPLETE_QI = 10;
/** ทัวร์แนะนำแอป 8 ขั้น (FE OnboardingTour) — กด "เริ่มต้นใช้งาน" จบทัวร์ = รับครั้งเดียว · กด "ไว้คราวหลัง" ไม่ได้รางวัล */
export const TOUR_MISSION_ID = "guide_tour";
export const TOUR_QI = 2;

/** เส้นทางมือใหม่ 6 บท (เอ็ม 2026-10-13 "ทำเลยตามที่เสนอ") — ต้องตรงกับ FE features/v2-guide/quests.ts */
export const GUIDE_CHAPTERS: readonly { id: string; title: string; steps: readonly { id: string; title: string; href: string }[] }[] = [
  { id: "ch1", title: "มือใหม่", steps: [{ id: "guide_destiny", title: "รู้จักดวงของฉัน", href: "/v2/destiny" }, { id: "guide_calendar", title: "เช็กวันดีในปฏิทิน", href: "/v2/calendar" }, { id: "guide_chat", title: "ถามเสี่ยวมู่/เสี่ยวมี่", href: "/v2/chat" }, { id: "guide_fortune", title: "ลองเสี่ยงเซียมซี", href: "/v2/fortune/sage" }, { id: "guide_compat", title: "ดูดวงสมพงศ์", href: "/v2/service/compatibility/love" }, { id: "guide_qi", title: "รู้จักพลังชี่", href: "/v2/qi" }] },
  { id: "ch2", title: "รู้จักตัวเองลึกขึ้น", steps: [{ id: "guide_lifepath", title: "เส้นทางชีวิต", href: "/v2/destiny" }, { id: "guide_home_fortune", title: "ดวงวันนี้หน้าหลัก", href: "/v2" }, { id: "guide_element_finder", title: "หาธาตุแท้ + wallpaper", href: "/v2/element-finder" }, { id: "guide_notif", title: "ตั้งค่าแจ้งเตือนดวง", href: "/v2/settings/notifications" }] },
  { id: "ch3", title: "โหมดเซียน", steps: [{ id: "guide_oracle", title: "ไพ่ออราเคิลเคี้ยงคุง", href: "/v2/fortune/oracle" }, { id: "guide_divine", title: "ไพ่จิตวิญญาณแดนสวรรค์", href: "/v2/fortune/divine" }, { id: "guide_colleague", title: "ดวงเพื่อนร่วมงาน", href: "/v2/service/compatibility/colleague" }, { id: "guide_chat_place", title: "ถามแชทเรื่องสถานที่", href: "/v2/chat" }] },
  { id: "ch4", title: "เสริมดวง", steps: [{ id: "guide_manifest", title: "สมุดแมนิเฟสต์", href: "/v2/service/manifest" }, { id: "guide_sacred_map", title: "แผนที่ศักดิ์สิทธิ์", href: "/v2/service/sacred-map" }, { id: "guide_phone", title: "ดูดวงเบอร์มือถือ", href: "/v2/service/phone-number" }, { id: "guide_special_day", title: "วันมงคลในปฏิทิน", href: "/v2/calendar" }] },
  { id: "ch5", title: "ชุมชนและรางวัล", steps: [{ id: "guide_share", title: "แชร์ผลทำนาย", href: "/v2/destiny" }, { id: "guide_referral", title: "ชวนเพื่อนด้วยโค้ดเชิญ", href: "/v2/qi/referral" }, { id: "guide_missions", title: "ภารกิจรายวัน", href: "/v2/qi/missions" }, { id: "guide_connect_line", title: "เชื่อมบัญชี LINE", href: "/v2/settings/connected" }] },
  { id: "ch6", title: "บริการพิเศษ", steps: [{ id: "guide_one_book", title: "หนังสือเล่มเดียวในโลก", href: "/v2/service/one-book" }, { id: "guide_sinsae", title: "ดูดวงส่วนตัวกับซินแส", href: "/v2/service/sinsae" }, { id: "guide_shop", title: "แพ็กเกจสมาชิก", href: "/v2/shop" }] },
];
/** ภารกิจขั้นทั้งหมด (ไม่รวมโบนัสบท/โบนัสจบ) */
export const GUIDE_STEP_IDS: readonly string[] = GUIDE_CHAPTERS.flatMap((c) => c.steps.map((s) => s.id));
/** โบนัสจบบท = guide_<chapterId> · จ่ายเมื่อรับครบทุกขั้นในบท */
export const GUIDE_CHAPTER_BONUS: ReadonlyMap<string, readonly string[]> = new Map(
  GUIDE_CHAPTERS.map((c) => [`guide_${c.id}`, c.steps.map((s) => s.id)]),
);

const guideMission = (id: string, title: string, description: string, rewardCoins: number, actionHref: string): MissionDef => ({
  id,
  title,
  description,
  period: "once",
  category: "guide",
  target: 1,
  rewardCoins,
  rewardXp: Math.round(rewardCoins / 2),
  actionHref,
});

const GUIDE_MISSIONS: MissionDef[] = [
  ...GUIDE_CHAPTERS.flatMap((c) => c.steps.map((s) => guideMission(s.id, `มือใหม่: ${s.title}`, `เส้นทางมือใหม่ บท${c.title}`, GUIDE_STEP_QI, s.href))),
  ...GUIDE_CHAPTERS.map((c) => guideMission(`guide_${c.id}`, `จบบท ${c.title}`, `ทำภารกิจบท${c.title}ครบทุกข้อ`, GUIDE_CHAPTER_QI, "/v2")),
  guideMission("guide_complete", "จบเส้นทางมือใหม่", "ทำครบทุกบท — ศิษย์เอกเสี่ยวมู่", GUIDE_COMPLETE_QI, "/v2"),
  guideMission(TOUR_MISSION_ID, "จบทัวร์แนะนำแอป", "ดูทัวร์แนะนำ 8 ขั้นกับเสี่ยวมู่จนจบ", TOUR_QI, "/v2"),
];

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
  ...GUIDE_MISSIONS,
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

/**
 * นิยามเหรียญตรา (จอ manifest-achievement "เหรียญรางวัล") — เงื่อนไขคิดจากสถิติจริง
 * แล้ว auto-unlock ใน GET /api/achievements. การปลดล็อกเก็บใน bazi_achievement.
 */

export type AchievementStats = {
  /** จำนวนเป้าหมาย manifest ที่เคยสร้าง */
  goalsCreated: number;
  /** สตรีคบันทึกยาวสุด (วัน) */
  bestStreak: number;
  /** จำนวนวันที่มีบันทึก (ทั้งหมด) */
  journalDays: number;
  /** จำนวนเพื่อนที่ใช้โค้ดเรา */
  friendsInvited: number;
  /** Level ปัจจุบัน (จาก XP) */
  level: number;
};

export type BadgeDef = {
  id: string;
  title: string;
  description: string;
  /** รางวัลตอนปลดล็อก (เข้า ledger ครั้งเดียว) */
  rewardCoins: number;
  rewardXp: number;
  check: (s: AchievementStats) => boolean;
};

export const BADGE_DEFS: readonly BadgeDef[] = [
  {
    id: "first_manifest",
    title: "แมนิเฟสต์แรก",
    description: "สร้างเป้าหมายแรกของคุณ",
    rewardCoins: 50,
    rewardXp: 50,
    check: (s) => s.goalsCreated >= 1,
  },
  {
    id: "streak_7",
    title: "ความเพียร 7 วัน",
    description: "บันทึกต่อเนื่อง 7 วัน",
    rewardCoins: 100,
    rewardXp: 100,
    check: (s) => s.bestStreak >= 7,
  },
  {
    id: "streak_28",
    title: "ประจำการมู",
    description: "บันทึกต่อเนื่อง 28 วัน",
    rewardCoins: 300,
    rewardXp: 300,
    check: (s) => s.bestStreak >= 28,
  },
  {
    id: "journal_50",
    title: "สมาธิขั้นสูง",
    description: "มีบันทึกครบ 50 วัน",
    rewardCoins: 200,
    rewardXp: 200,
    check: (s) => s.journalDays >= 50,
  },
  {
    id: "inviter_5",
    title: "นักเชื่อมพลังใจ",
    description: "ชวนเพื่อนเข้าร่วม 5 คน",
    rewardCoins: 300,
    rewardXp: 150,
    check: (s) => s.friendsInvited >= 5,
  },
  {
    id: "level_5",
    title: "ผู้สำรวจจักรวาล",
    description: "เลื่อนถึง Level 5",
    rewardCoins: 250,
    rewardXp: 0,
    check: (s) => s.level >= 5,
  },
] as const;

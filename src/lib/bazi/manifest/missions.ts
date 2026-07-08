/**
 * นิยามภารกิจ (จอ mission-board) — อยู่ในโค้ดเพื่อแก้ง่าย ยังไม่ต้องมี admin UI.
 * ความคืบหน้าอยู่ใน bazi_mission_progress · จ่ายรางวัลอัตโนมัติเมื่อครบเป้า (ครั้งเดียวต่อรอบ).
 * period: "daily" รีเซ็ตทุกวัน (periodKey = วันไทย) · "once" ทำครั้งเดียว (periodKey = "all")
 */

export type MissionPeriod = "daily" | "once";

export type MissionDef = {
  id: string;
  title: string;
  description: string;
  period: MissionPeriod;
  /** จำนวนครั้งที่ต้องทำต่อรอบ */
  target: number;
  rewardCoins: number;
  rewardXp: number;
};

export const MISSION_DEFS: readonly MissionDef[] = [
  {
    id: "checkin_mu",
    title: "ภารกิจเช็คอินมู",
    description: "เช็คอินสถานที่มงคลตามคำแนะนำประจำวัน",
    period: "daily",
    target: 1,
    rewardCoins: 50,
    rewardXp: 20,
  },
  {
    id: "send_energy",
    title: "ส่งพลังใจให้เพื่อน",
    description: "แบ่งปันพลังงานบวกให้เพื่อน 5 คน",
    period: "daily",
    target: 5,
    rewardCoins: 120,
    rewardXp: 40,
  },
  {
    id: "write_wish",
    title: "บันทึกคำอธิษฐาน",
    description: "จดบันทึกเป้าหมายที่ต้องการใน Manifest วันนี้",
    period: "daily",
    target: 1,
    rewardCoins: 30,
    rewardXp: 15,
  },
  {
    id: "streak_7",
    title: "สายมู 7 วัน",
    description: "เข้าใช้งานแอป Mumate ติดต่อกัน 7 วัน",
    period: "once",
    target: 7,
    rewardCoins: 500,
    rewardXp: 200,
  },
] as const;

export const MISSION_BY_ID: ReadonlyMap<string, MissionDef> = new Map(
  MISSION_DEFS.map((m) => [m.id, m]),
);

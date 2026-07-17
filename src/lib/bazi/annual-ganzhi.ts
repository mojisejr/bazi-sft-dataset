/**
 * ปีจร (annual pillar / 流年) — กะจื่อของปี ค.ศ. + ตาราง 60 กะจื่อ
 *
 * pure + client-safe (ไม่พึ่ง server / ไม่มี dependency) — ใช้ร่วมกันทั้งฝั่ง engine
 * (newdata-lookup, life-timeline) และฝั่ง UI ตารางปีจรที่คลิกเลือกปีได้
 */
export const ANNUAL_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const ANNUAL_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

/** กะจื่อปีจรของปี ค.ศ. (base 1984 = 甲子) */
export function annualGanzhi(year: number): { stem: string; branch: string } {
  const d = year - 1984;
  const stem = ANNUAL_STEMS[((d % 10) + 10) % 10];
  const branch = ANNUAL_BRANCHES[((d % 12) + 12) % 12];
  return { stem, branch };
}

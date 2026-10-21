// bdash — ภาพรวมธุรกิจสำหรับทีม business (mumate-business-metrics-001).
// รูปของ payload ที่ /api/cron/bdash-snapshot เก็บลง bdash_snapshot ทุกคืน และหน้า /bdash อ่านไปแสดง.
// ตัวเลขทั้งหมดเป็นจำนวนรวม — ไม่มี id หรือข้อมูลรายคนใน payload.

/** นับ "กลับมาใช้" จากคนที่สมัครตั้งแต่วันนี้ — ก่อนหน้านี้ระบบยังไม่บันทึกกิจกรรมรายคน (owner 2026-10-13) */
export const BDASH_RETENTION_FROM = "2026-09-14";

export type BdashCohort = {
  /** วันจันทร์ของสัปดาห์ที่สมัคร (YYYY-MM-DD, วันไทย) */
  week: string;
  signups: number;
  /** จำนวนคนที่กลับมาทำกิจกรรม — null = กลุ่มนี้ยังไม่ถึงช่วงนั้นครบทุกคน */
  d1: number | null;
  d7: number | null;
  d30: number | null;
  /** จ่ายสำเร็จครั้งแรกภายใน 35 วันหลังสมัคร (นับถึง as_of) */
  paid35: number;
  /** ทุกคนในกลุ่มผ่าน 35 วันแล้ว — false = ตัวเลขยังขึ้นได้อีก */
  paid35Complete: boolean;
  /** ค่ากลางของจำนวนวันจากสมัครถึงจ่ายครั้งแรก (เฉพาะคนที่จ่ายภายใน 35 วัน) */
  medianDaysToPay: number | null;
};

export type BdashPaymentRow = {
  method: string;
  gateway: string;
  created: number;
  approved: number;
  /** ธนาคาร/บัตรปฏิเสธ หรือไม่สำเร็จด้วยเหตุอื่น */
  rejected: number;
  /** QR/ลิงก์หมดเวลาก่อนจ่าย */
  expired: number;
  /** ยังรอผลอยู่ */
  waiting: number;
  /** failure_code ที่เจอบ่อยสุดในรายการที่ไม่สำเร็จ (null = ไม่มีรายการไม่สำเร็จ) */
  topFailure: string | null;
};

/**
 * คนหนึ่งคนในรายชื่อคนจ่าย (mumate-bdash-v2-001 slice 3) — ชื่ออย่างเดียว ไม่มี id อีเมล หรือเบอร์
 * (owner 2026-10-21). ตัวเลขทุกช่องเป็นของช่วงที่เลือก ยกเว้นวันหมดสมาชิก.
 */
export type BdashPayer = {
  name: string;
  times: number;
  baht: number;
  lastDay: string;
  lastPackage: string;
  /** วันหมดสมาชิก (YYYY-MM-DD) จาก member_payment — null = ไม่มีแถวสมาชิก (เช่นซื้อแค่ชี่) */
  memberEnd: string | null;
};

/** ใครจ่ายเงิน และกลับมาซื้ออีกไหม — ของช่วงที่เลือก */
export type BdashPayerSummary = {
  payers: number;
  payments: number;
  once: number;
  /** จ่ายในช่วงนี้ และจ่ายสำเร็จมาแล้วอย่างน้อยสองวัน (นับถึงวันสุดท้ายของช่วง) — จ่ายสองครั้งวันเดียวกันไม่นับ */
  again: number;
  /** วันเฉลี่ยระหว่างการซื้อแต่ละครั้งของคนที่ซื้ออีก — null = ยังไม่มีใครซื้ออีก */
  avgGapDays: number | null;
  /** จำนวนครั้งที่จ่ายเป็นสมาชิกรายปีในช่วงนี้ (ต่ออายุเห็นหลังครบปี) */
  yearly: number;
};

export type BdashQiDay = {
  day: string;
  buy: number;
  missions: number;
  daily: number;
  referral: number;
  /** ทีมแจก/ดึงคืนเอง (สุทธิ) */
  team: number;
  other: number;
  /** QI ที่ถูกใช้ (ค่าบวก) */
  spend: number;
};

export type BdashAiFeature = {
  feature: string;
  calls: number;
  tokens: number;
  thb: number;
};

export type BdashSnapshot = {
  version: 1;
  asOf: string;
  retentionFrom: string;
  cohorts: BdashCohort[];
  /** 30 วันล่าสุดถึง as_of */
  payments: BdashPaymentRow[];
  /** 28 วันล่าสุดถึง as_of — มีครบทุกวัน (วันที่ไม่มีรายการ = 0) */
  qiDaily: BdashQiDay[];
  qiBalance: { holders: number; median: number; p90: number };
  /** 30 วันล่าสุดถึง as_of — ไม่รวมการเรียกที่ใช้คีย์ของผู้ใช้เอง */
  ai: { features: BdashAiFeature[]; totalThb: number; activeMembers: number };
};

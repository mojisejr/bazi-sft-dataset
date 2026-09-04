/**
 * Qi Point System — Activity Catalog (แต่ละ "เส้น" ของระบบกิจกรรม)
 * source of truth เดียวของทุกเส้นได้แต้ม/ใช้แต้ม — อยู่ในโค้ดเพื่อแก้ง่าย (เหมือน missions.ts)
 * ทุกเส้นมี `note` ไทยกำกับว่าเส้นนี้คืออะไร. ตัวเลขอ้างอิงเอกสาร MuMate Qi Point System.
 *
 * เพดาน (limit):
 *   once         = ทำได้ครั้งเดียวตลอดชีพ (periodKey = "all")
 *   daily        = วันละครั้ง (periodKey = วันไทย)
 *   per_referral = นับต่อผู้ถูกชวน 1 คน (periodKey = anonId ผู้ถูกชวน)
 *   none         = ไม่จำกัด (ระบบภายในเรียกเอง)
 */

export type QiLimitPeriod = "once" | "daily" | "per_referral" | "none";

export type QiEarnLine = {
  code: string;
  kind: "earn";
  qi: number;
  limit: QiLimitPeriod;
  title: string;
  note: string;
};

/** สิทธิ์ที่มอบให้เมื่อแลกแต้ม */
export type EntitlementGrant =
  /** เพิ่มโควตาแบบนับครั้ง (การ์ด/คำถาม/slot) */
  | { type: "credit"; kind: "card_use" | "chat_question" | "matching_slot"; credits: number }
  /** เป็นเจ้าของสินค้าถาวร (คอร์ส/หนังสือ) */
  | { type: "owned"; kind: "course" | "book"; sku: string }
  /** อัปเกรด tier ชั่วคราว (นับวัน) */
  | { type: "tier"; sku: "plus" | "pro"; durationDays: number };

export type QiSpendLine = {
  code: string;
  kind: "spend";
  /** ราคา (จำนวนบวก) — หักออกจากยอด */
  qi: number;
  grant: EntitlementGrant;
  title: string;
  note: string;
};

/** ── เส้นได้แต้ม (EARN) ───────────────────────────────────────────────── */
export const QI_EARN_LINES: readonly QiEarnLine[] = [
  {
    code: "signup",
    kind: "earn",
    qi: 50,
    limit: "once",
    title: "สมัครใหม่",
    note: "โบนัสตั้งต้นครั้งแรกที่สมัครบัญชี — ได้ครั้งเดียวตลอดชีพ",
  },
  {
    code: "daily_login",
    kind: "earn",
    qi: 5,
    limit: "daily",
    title: "เข้าใช้งานรายวัน",
    note: "ล็อกอิน/เปิดแอปในแต่ละวัน — รับได้วันละ 1 ครั้ง",
  },
  {
    code: "share",
    kind: "earn",
    qi: 10,
    limit: "daily",
    title: "แชร์คอนเทนต์",
    note: "แชร์เนื้อหาออกโซเชียล — เพดานวันละ 1 ครั้ง",
  },
  {
    code: "referral_free",
    kind: "earn",
    qi: 50,
    limit: "per_referral",
    title: "ชวนเพื่อนสมัครฟรี",
    note: "ผู้ถูกชวนสมัครบัญชีฟรีสำเร็จ — ผู้ชวนได้ 50 Qi ต่อ 1 คน",
  },
  {
    code: "referral_plus",
    kind: "earn",
    qi: 500,
    limit: "per_referral",
    title: "ชวนเพื่อนอัปเกรด PLUS",
    note: "ผู้ถูกชวนอัปเกรดแพ็กเกจ PLUS (790.-) — ผู้ชวนได้ 500 Qi ต่อ 1 คน (รอ flow อัปเกรดจริงยิง trigger)",
  },
  {
    code: "referral_pro",
    kind: "earn",
    qi: 1000,
    limit: "per_referral",
    title: "ชวนเพื่อนอัปเกรด PRO",
    note: "ผู้ถูกชวนอัปเกรดแพ็กเกจ PRO (1,590.-) — ผู้ชวนได้ 1,000 Qi ต่อ 1 คน (รอ flow อัปเกรดจริงยิง trigger)",
  },
  {
    code: "wuxing_matrix",
    kind: "earn",
    qi: 1000,
    limit: "once",
    title: "แคมเปญ Wu-Xing Matrix",
    note: "แจ็กพอตแคมเปญเมื่อสะสมครบ 5 ธาตุ — ได้ครั้งเดียว",
  },
  {
    code: "first_buy_bonus",
    kind: "earn",
    qi: 30,
    limit: "once",
    title: "โบนัสซื้อชี่ครั้งแรก",
    note: "โบนัส +30 ชี่ เมื่อซื้อแพ็กชี่ครั้งแรก (เติมครั้งแรกโบนัส +30 ตามจอร้านค้า) — ได้ครั้งเดียว, ระบบซื้อยิงเอง",
  },
] as const;

/** ── เส้นใช้แต้ม (SPEND / REDEEM) ─────────────────────────────────────── */
export const QI_SPEND_LINES: readonly QiSpendLine[] = [
  {
    code: "card_use",
    kind: "spend",
    qi: 10,
    grant: { type: "credit", kind: "card_use", credits: 1 },
    title: "เปิดการ์ด/เสี่ยงทาย +1 ครั้ง",
    note: "แลกสิทธิ์เปิดไพ่/เสี่ยงทายเพิ่ม 1 ครั้ง (divine/oracle/fortune-sage)",
  },
  {
    code: "chat_question",
    kind: "spend",
    qi: 30,
    grant: { type: "credit", kind: "chat_question", credits: 1 },
    title: "ถาม AI +1 คำถาม",
    note: "แลกสิทธิ์ถามแชท AI เพิ่ม 1 คำถาม",
  },
  {
    code: "matching_slot",
    kind: "spend",
    qi: 150,
    grant: { type: "credit", kind: "matching_slot", credits: 1 },
    title: "+1 ช่องจับคู่สมพงษ์ (ถาวร)",
    note: "เพิ่มช่องบันทึกดวงสำหรับจับคู่/สมพงษ์อย่างถาวร 1 ช่อง",
  },
  {
    code: "birth_edit",
    kind: "spend",
    qi: 100,
    grant: { type: "credit", kind: "card_use", credits: 0 },
    title: "แก้วันเกิด (ครั้งถัดไป)",
    note: "สิทธิ์ฟรี 1 ครั้งตลอดชีพหมดแล้ว — แก้วันเกิดครั้งถัดไปใช้ 100 ชี่ (ดวงเปลี่ยนทั้งหมดจึงมีราคา)",
  },
  {
    code: "streak_restore",
    kind: "spend",
    qi: 20,
    // grant เป็น no-op (credits 0) — การกู้คืนเกิดจากแถวหักแต้มเองที่ถือ ref=วันที่กู้ (ดู /api/qi/streak-restore)
    grant: { type: "credit", kind: "card_use", credits: 0 },
    title: "กู้คืนสตรีคเช็คอิน",
    note: "ต่อสตรีคที่ขาดไป 1 วันให้เชื่อมต่อ (จำกัดสัปดาห์ละ 1 ครั้ง)",
  },
  {
    code: "course_destiny",
    kind: "spend",
    qi: 500,
    grant: { type: "owned", kind: "course", sku: "destiny" },
    title: "คอร์สลิขิตชีวิต",
    note: "แลกสิทธิ์เข้าคอร์สลิขิตชีวิต (มูลค่า ฿499)",
  },
  {
    code: "plus_month",
    kind: "spend",
    qi: 1000,
    grant: { type: "tier", sku: "plus", durationDays: 30 },
    title: "แพ็กเกจ PLUS ฟรี 1 เดือน",
    note: "อัปเกรด tier เป็น PLUS 30 วัน (โควตาฟรีการ์ด/แชท/ช่องจับคู่มากขึ้น)",
  },
  {
    code: "book_lifecode",
    kind: "spend",
    qi: 3000,
    grant: { type: "owned", kind: "book", sku: "lifecode" },
    title: "หนังสือ Life Code",
    note: "แลกสิทธิ์หนังสือดิจิทัล Life Code (มูลค่า ฿1,890)",
  },
] as const;

export const QI_EARN_BY_CODE: ReadonlyMap<string, QiEarnLine> = new Map(
  QI_EARN_LINES.map((l) => [l.code, l]),
);
export const QI_SPEND_BY_CODE: ReadonlyMap<string, QiSpendLine> = new Map(
  QI_SPEND_LINES.map((l) => [l.code, l]),
);

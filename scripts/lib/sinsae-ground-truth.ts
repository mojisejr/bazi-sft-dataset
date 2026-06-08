/**
 * Ground truth "ซินแส" สำหรับ R5 diagnostic — band + useful-god (อิงบทอาชีพ chapter 2)
 * ที่มา: gptCase output (example/gptCase/_txt/<odd>.txt บท 2) + your-life-code 6 charts (tests/real-case-yourlifecode)
 * useful = ธาตุที่ซินแส "ส่งเสริมอาชีพ" เรียง best→ (career-based ใช้เทียบกับ resolveUsefulElements ตรง ๆ)
 *
 * sinsaeBand แมปเป็น 5-band ของ engine เพื่อคำนวณ bandDelta:
 *   very-weak | weak | balanced | strong | very-strong
 * หมายเหตุ: ซินแส "แทบไม่เคย" ใช้คำ very-weak (อ่อนเกินไป) — ส่วนใหญ่พูดแค่ "อ่อน/เกือบสมดุล/อ่อนแอ" = weak
 */
export type ThElement = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";
export type SinsaeBand = "very-weak" | "weak" | "balanced" | "strong" | "very-strong";

export type SinsaeChart = {
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  gender: "male" | "female";
  /** คำที่ซินแสใช้ (ดิบ) */
  sinsaeLabelRaw: string;
  sinsaeBand: SinsaeBand;
  /** ธาตุส่งเสริมอาชีพ (best→) จากบท 2 */
  sinsaeUseful: ThElement[];
  sinsaeAvoid: ThElement | null;
  /** ที่มา + ความเชื่อมั่น */
  source: "gptCase" | "ylc";
  note?: string;
};

export const SINSAE_GROUND_TRUTH: SinsaeChart[] = [
  // ───────── gptCase (8 ไฟล์ → 6 ดวงไม่ซ้ำ; ประภา/วรรัตน์ มี 2 regen) ─────────
  {
    name: "A (癸)", birthDate: "2001-07-29", birthTime: "21:35", gender: "female",
    sinsaeLabelRaw: "ดิถีน้ำกุ่ย (อ่อน)", sinsaeBand: "weak",
    sinsaeUseful: ["น้ำ", "ไฟ"], sinsaeAvoid: "ดิน", source: "gptCase",
  },
  {
    name: "B (庚)", birthDate: "1999-06-17", birthTime: "15:25", gender: "female",
    sinsaeLabelRaw: "ดวงดิถีอ่อน", sinsaeBand: "weak",
    sinsaeUseful: ["ดิน", "ทอง", "น้ำ"], sinsaeAvoid: "ไฟ", source: "gptCase",
  },
  {
    name: "กัญญารัตน์ (甲)", birthDate: "2002-12-02", birthTime: "11:30", gender: "female",
    sinsaeLabelRaw: "ดิถีอ่อน", sinsaeBand: "weak",
    sinsaeUseful: ["ไม้", "น้ำ"], sinsaeAvoid: "ทอง", source: "gptCase",
  },
  {
    name: "วรรัตน์ (甲, 1988)", birthDate: "1988-06-08", birthTime: "12:08", gender: "female",
    sinsaeLabelRaw: "ดิถีอ่อน (ตัวถ่ายเทไม่แข็งแรง แต่โชคลาภแข็งแรง)", sinsaeBand: "weak",
    sinsaeUseful: ["น้ำ", "ไม้"], sinsaeAvoid: "ทอง", source: "gptCase",
    note: "engine = very-weak (อ่อนเกินไป) → bandDelta คาดว่า -1 [[strength-1988-divergence]]",
  },
  {
    name: "ประภาวรินท์ (癸, 1986)", birthDate: "1986-09-16", birthTime: "14:23", gender: "female",
    sinsaeLabelRaw: "ดิถีกำลังอ่อนแต่ไม่มาก (เกือบสมดุล)", sinsaeBand: "weak",
    sinsaeUseful: ["ไฟ", "ทอง"], sinsaeAvoid: "ดิน", source: "gptCase",
    note: "autumn — ไม่มี climate extreme → 扶抑 ตรง engine ได้",
  },
  {
    name: "ภวรัญชน์ (壬)", birthDate: "2000-02-14", birthTime: "09:53", gender: "male",
    sinsaeLabelRaw: "ดิถีอ่อนแอ ตัวถ่ายเทมาก โชคลาภไม่แข็ง", sinsaeBand: "weak",
    sinsaeUseful: ["น้ำ", "ทอง", "ไฟ"], sinsaeAvoid: "ดิน", source: "gptCase",
    note: "winter — ซินแสมีไฟ (调候 ให้อุ่น)",
  },
  // ───────── your-life-code (เพิ่มเฉพาะดวงที่ไม่ซ้ำ gptCase) ─────────
  {
    name: "เกศสรินทร์ (甲)", birthDate: "1995-01-23", birthTime: "02:10", gender: "female",
    sinsaeLabelRaw: "สมดุล", sinsaeBand: "balanced",
    sinsaeUseful: ["ไม้", "ไฟ"], sinsaeAvoid: null, source: "ylc",
  },
  {
    name: "สิริกัญญา (壬)", birthDate: "1980-06-28", birthTime: "18:00", gender: "female",
    sinsaeLabelRaw: "ดวงแข็ง/แข็งมาก", sinsaeBand: "very-strong",
    sinsaeUseful: ["ไม้", "ไฟ"], sinsaeAvoid: null, source: "ylc",
  },
  {
    name: "ชัยธรณ์ (壬)", birthDate: "1981-03-15", birthTime: "12:00", gender: "male",
    sinsaeLabelRaw: "ดวงอ่อน", sinsaeBand: "weak",
    sinsaeUseful: [], sinsaeAvoid: null, source: "ylc",
    note: "useful ยังไม่ยืนยันจากเอกสาร — เทียบเฉพาะ band",
  },
  // ───────── DNA 4 charts (tests/real-case-dna-4-charts) — useful จากเอกสาร DNA ─────────
  // band: เอกสารระบุชัดเฉพาะ case3 (丙 "แข็ง"); ที่เหลืออนุมานจาก useful pattern → เทียบ "useful" เป็นหลัก
  {
    name: "DNA1 (辛, 食傷制杀)", birthDate: "1966-09-29", birthTime: "11:44", gender: "female",
    sinsaeLabelRaw: "辛 ไฟล้อม (食傷制杀)", sinsaeBand: "weak",
    sinsaeUseful: ["ดิน", "น้ำ"], sinsaeAvoid: null, source: "ylc",
    note: "band อนุมาน (เอกสารเน้น useful)",
  },
  {
    name: "DNA2 (己)", birthDate: "1981-03-12", birthTime: "05:59", gender: "male",
    sinsaeLabelRaw: "己", sinsaeBand: "weak",
    sinsaeUseful: ["ดิน", "ไฟ"], sinsaeAvoid: null, source: "ylc",
    note: "band อนุมาน (เอกสารเน้น useful)",
  },
  {
    name: "DNA3 (丙, แข็ง)", birthDate: "1949-06-25", birthTime: "12:00", gender: "female",
    sinsaeLabelRaw: "丙 แข็ง", sinsaeBand: "strong",
    sinsaeUseful: ["ดิน", "ทอง"], sinsaeAvoid: null, source: "ylc",
    note: "เอกสารระบุ 'แข็ง' (summer 丙) — ทดสอบ guard 2a (strong→ไม่เติมน้ำ)",
  },
  {
    name: "DNA4 (戊)", birthDate: "1977-11-27", birthTime: "00:26", gender: "female",
    sinsaeLabelRaw: "戊 (ฤดูหนาว)", sinsaeBand: "weak",
    sinsaeUseful: ["ดิน", "ไฟ"], sinsaeAvoid: null, source: "ylc",
    note: "band อนุมาน (เอกสารเน้น useful)",
  },
  {
    // ซินแสยืนยันด้วยวาจา (2026-06-08): "น้ำเยอะ ดินอ่อน เสริมไฟ, เทพเจ้าเตาไฟ, ทิศไฟ"
    // → ยืนยัน R5.2b: 己 score 0.25 = "ดวงอ่อน" (weak) ไม่ใช่ very-weak · useful = ไฟ(印) นำ ดิน(比) ตาม
    name: "M (己, 1993)", birthDate: "1993-11-24", birthTime: "15:09", gender: "male",
    sinsaeLabelRaw: "น้ำเยอะ ดินอ่อน เสริมไฟ", sinsaeBand: "weak",
    sinsaeUseful: ["ไฟ", "ดิน"], sinsaeAvoid: "น้ำ", source: "ylc",
    note: "财多身弱 (น้ำ=财 ล้น, 己 อ่อน) → 用神 = ไฟ(印) เสริมตัว · เทพเตาไฟ/ทิศใต้ = สายไฟ",
  },
];

/** ลำดับ band สำหรับคำนวณ bandDelta (engineIdx - sinsaeIdx; ลบ = engine กดแรงกว่า) */
export const BAND_ORDER: SinsaeBand[] = ["very-weak", "weak", "balanced", "strong", "very-strong"];

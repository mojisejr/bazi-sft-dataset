// ทำนายฝัน (ซินแสนุ้ย/เอ็ม 2026-09-23) — engine ถอด "สัญลักษณ์ในฝัน" จากข้อความผู้ใช้ แล้วดึงความหมาย
// + เลขนำโชค จากคลังกลาง (data/dream/dream-symbols.json). วิชานี้เป็น "ตำราฝันไทยพื้นบ้าน" (folklore
// สาธารณะ) ไม่ใช่ปาจื่อ — deterministic ล้วน (ไม่เรียก LLM). ในแชท route.ts จะเอาผลถอดนี้แนบให้ LLM
// เรียบเรียงเป็นคำทำนายอบอุ่น + ปิดท้ายด้วยเลขนำโชค (พร้อม disclaimer "เพื่อความบันเทิง").
//
// การจับสัญลักษณ์: ค้นแบบ substring บนข้อความที่ตัดช่องว่างแล้ว โดยไล่จาก "คำที่ยาว/เฉพาะเจาะจงก่อน"
// (พญานาค มาก่อน นาค) แล้วลบคำที่เจอออกจากข้อความ กัน sub-symbol ชนกันเอง. เก็บสูงสุด 4 สัญลักษณ์.
import symbolsData from "@/lib/bazi/data/dream/dream-symbols.json";

export type DreamSymbol = {
  /** คำหลักของสัญลักษณ์ (canonical) เช่น "งู" */
  symbol: string;
  /** คำพ้อง/รูปแบบอื่นที่ผู้ใช้อาจพิมพ์ */
  aliases?: string[];
  /** ความหมายรวม (ต้องมีเสมอ) */
  general: string;
  love?: string;
  work?: string;
  money?: string;
  /** ข้อควรระวัง (ถ้ามี) */
  warn?: string;
  /** เลขนำโชคตามตำราฝัน (เพื่อความบันเทิง) */
  luckyNumbers: string[];
};

export type DreamReading = {
  /** ข้อความฝันดิบที่ผู้ใช้เล่ามา */
  query: string;
  /** สัญลักษณ์ที่พบในคลัง (อาจว่างถ้าเป็นฝันนอกคลัง → LLM ตีความจากหลักตำราทั่วไป) */
  matched: DreamSymbol[];
  /** เลขนำโชครวม (unique) จากทุกสัญลักษณ์ที่พบ */
  luckyNumbers: string[];
};

const SYMBOLS = symbolsData as DreamSymbol[];

// จัดลำดับค้นหา: คำที่ยาวสุดของแต่ละสัญลักษณ์มาก่อน (เฉพาะเจาะจงก่อนกว้าง) — พญานาค > นาค, งูเห่า > งู
const SEARCH_ORDER: { entry: DreamSymbol; terms: string[] }[] = SYMBOLS
  .map((entry) => ({
    entry,
    terms: [entry.symbol, ...(entry.aliases ?? [])].map((t) => t.replace(/\s+/g, "")).filter(Boolean),
  }))
  .sort((a, b) => Math.max(...b.terms.map((t) => t.length)) - Math.max(...a.terms.map((t) => t.length)));

const MAX_MATCHES = 4;

/** ถอดฝัน → สัญลักษณ์ที่พบ + เลขนำโชค. ไม่พบเลย → matched ว่าง (route จะให้ LLM ตีความจากตำราทั่วไป). */
export function readDream(text: string): DreamReading {
  const query = (text ?? "").trim();
  let hay = query.replace(/\s+/g, "");
  const matched: DreamSymbol[] = [];
  for (const { entry, terms } of SEARCH_ORDER) {
    if (matched.length >= MAX_MATCHES) break;
    const hit = terms.find((t) => t.length > 0 && hay.includes(t));
    if (hit) {
      matched.push(entry);
      // ลบทุก term ของสัญลักษณ์นี้ออกจากข้อความ กันสัญลักษณ์ย่อย (เช่น "นาค" ใน "พญานาค") ถูกจับซ้ำ
      for (const t of terms) hay = hay.split(t).join(" ");
    }
  }
  const luckyNumbers = Array.from(new Set(matched.flatMap((m) => m.luckyNumbers))).slice(0, 6);
  return { query, matched, luckyNumbers };
}

/** จำนวนสัญลักษณ์ในคลัง (ไว้ทดสอบ/ตรวจ) */
export function dreamSymbolCount(): number {
  return SYMBOLS.length;
}

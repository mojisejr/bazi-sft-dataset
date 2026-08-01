/**
 * ตาข่ายกัน "ภาพหาย" + "DB พัง" สำหรับ import mascot v2 ขึ้น prod (REFRAME-3, ฟีมกำชับ)
 * PURE + testable — สคริปต์ import เรียกใช้; ทดสอบได้โดยไม่ต้องต่อ prod.
 */
import { createHash } from "node:crypto";

/** ปลายทางที่อนุญาตให้เขียน (ฟีมสั่ง) — เขียนที่อื่น = throw */
export const REQUIRED_BUCKET = "mootech-v2";
export const REQUIRED_PROJECT_REF = "soxsccdlsycaevusndro";

/**
 * ตาข่าย 1 — กันยิงผิดที่ (ภาพหาย/ทับระบบอื่น). throw ก่อนอัปโหลดใดๆ ถ้า:
 *  - bucket ไม่ใช่ mootech-v2 (กัน default mascot-60 หรือ mootech ของระบบอื่น)
 *  - SUPABASE_URL ไม่ชี้โปรเจกต์ prod soxsccdlsycaevusndro (กันยิงผิดโปรเจกต์)
 */
export function assertProdTargets(bucket: string, supabaseUrl: string | undefined | null): void {
  const b = (bucket ?? "").trim();
  const url = (supabaseUrl ?? "").trim();
  if (b !== REQUIRED_BUCKET) {
    throw new Error(
      `ตาข่าย1: bucket ต้องเป็น "${REQUIRED_BUCKET}" แต่ได้ "${b || "(ว่าง)"}" — ` +
        `ตั้ง SUPABASE_MASCOT_BUCKET=${REQUIRED_BUCKET} (กันเผลอ mascot-60 default / mootech ของระบบอื่น)`,
    );
  }
  if (!url.includes(REQUIRED_PROJECT_REF)) {
    const ref = url.replace(/^https?:\/\//, "").split(".")[0] || "(ว่าง)";
    throw new Error(
      `ตาข่าย1: SUPABASE_URL ต้องชี้โปรเจกต์ prod "${REQUIRED_PROJECT_REF}" แต่ชี้ "${ref}" — กันยิงผิดโปรเจกต์`,
    );
  }
}

/** true/false เวอร์ชันไม่ throw — ใช้แสดงสถานะใน dry-run */
export function checkProdTargets(
  bucket: string,
  supabaseUrl: string | undefined | null,
): { ok: boolean; reason?: string } {
  try {
    assertProdTargets(bucket, supabaseUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/**
 * ตาข่าย 2 — ลายนิ้วมือคอลัมน์ image_url (ของเก่า ห้ามเปลี่ยน).
 * recipe = md5( image_url ทุกแถว · เรียงตาม ganzhi (codepoint) · คั่นด้วย '\n' )
 *   เทียบเท่า SQL: md5(string_agg(image_url, E'\n' ORDER BY ganzhi))
 * ⇒ reproducible; ใช้เทียบ before/after (การรัน import ต้องไม่ขยับ image_url สักแถว)
 */
export function imageUrlColumnDigest(rows: ReadonlyArray<{ ganzhi: string; imageUrl: string | null }>): string {
  const joined = rows
    .slice()
    // codepoint sort (ไม่ใช่ locale) ให้ตรง SQL ORDER BY ganzhi ที่ใช้คำนวณ baseline
    .sort((a, b) => (a.ganzhi < b.ganzhi ? -1 : a.ganzhi > b.ganzhi ? 1 : 0))
    .map((r) => r.imageUrl ?? "")
    .join("\n");
  return createHash("md5").update(joined).digest("hex");
}

/**
 * ตาข่าย 2 (เสริม) — จำนวนแถวต้องเป็น expected (60) ทั้งก่อนและหลัง.
 * กันเคสแถวเกิน/ขาด (insert/delete หลุด) ที่ digest ก็จับได้ แต่ count ชี้ชัดกว่า (บองขอเพิ่ม).
 */
export function assertImageUrlRowCount(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`ตาข่าย2: จำนวนแถว bazi_mascot_image = ${actual} (คาด ${expected}) — แถวเกิน/ขาด หยุด`);
  }
}

/**
 * baseline image_url บน prod ก่อนแตะอะไร — คำนวณจาก csv สำรองจริงของบอง
 * (~/mascot-backup-2026-08-02/bazi_mascot_image.before.csv, dev==prod ยืนยันแล้ว) ด้วย recipe ข้างบน.
 * override ได้ด้วย EXPECTED_IMAGE_URL_MD5.
 *
 * recipe ที่ใช้ = md5(string_agg(image_url, E'\n' ORDER BY ganzhi))  → c3e72e…  (ตัวนี้ที่ guard ยึด)
 * ทางเลือก (สูตรบอง, บองรัน prod ยืนยันแล้ว) = md5(string_agg(ganzhi || '|' || image_url, E'\n' ORDER BY ganzhi))
 *   → b76051348086aada420f8aeab9f1e652  (กินเพิ่มเคส ganzhi เองถูกแก้; แต่ ganzhi เป็น key + count guard จับได้อยู่แล้ว
 *   ⇒ บองตัดสินใช้ c3e72e ต่อ ไม่ต้องสลับ — 2026-08-02)
 */
export const PROD_IMAGE_URL_BASELINE_MD5 = "c3e72e3ac8b3894cd172a7c29b063ccb";

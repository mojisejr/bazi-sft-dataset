/**
 * mascot v2 (ชุดตัวละคร UI v2) — แปลง "เสาวัน 60 กะจื่อ (ganzhi)" → ชื่อไฟล์ไทย
 *
 * ชุด v2 = mootech-fe/public/images/v2/characters/  (60 ไฟล์ = 12 นักษัตร × 5 ธาตุ)
 *   รูปแบบชื่อ:  `${NN}_${นักษัตร}-${ธาตุ}`   เช่น "01_ชวด-ไม้"
 *     NN      = ลำดับนักษัตร 01..12 (子=01 … 亥=12)  — จาก "กิ่ง" (地支) ของ ganzhi
 *     นักษัตร = ชวด..กุน                              — จาก "กิ่ง" (地支)
 *     ธาตุ    = ไม้/ไฟ/ดิน/ทอง/น้ำ                    — จาก "ก้าน" (天干) ของ ganzhi
 *   ตัวอย่างที่แผน FROZEN ระบุ:  甲子 → (ก้าน 甲=ไม้) + (กิ่ง 子=ชวด, ลำดับ 01) → "01_ชวด-ไม้"
 *
 * ⚠️ ธาตุมาจาก "ก้าน" ไม่ใช่ "กิ่ง" — BRANCH_TO_ELEMENT[子]=water จะให้ "น้ำ" ซึ่งผิด.
 *    ใช้ STEM_TO_ELEMENT เท่านั้น (ยืนยันด้วยตัวอย่าง 甲子 → ไม้ ในแผน).
 *
 * PURE (ไม่มี side-effect, ไม่แตะ DB/FS) — unit-test ได้ตรงๆ (tests/mascot-v2.test.ts).
 * ครบ 60 หรือ throw — ganzhi ที่ก้าน/กิ่งไม่รู้จัก = โยน error ดังๆ ห้าม fallback เงียบ.
 */
import { MASCOT_60 } from "@/lib/bazi/mascot/mascot-60";
import {
  BRANCH_LABELS_TH,
  ELEMENT_LABELS_TH,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

// ลำดับกิ่ง (地支) — index+1 = ลำดับนักษัตร NN. ดึงจาก BRANCH_LABELS_TH เพื่อไม่ให้มี
// source-of-truth ซ้ำ (แผงกิ่ง 12 ตัวคงที่ตลอด; ลำดับ object literal = ลำดับนักษัตร).
const BRANCH_ORDER = Object.keys(BRANCH_LABELS_TH) as (keyof typeof BRANCH_LABELS_TH)[];
if (BRANCH_ORDER.length !== 12) {
  throw new Error(`mascot-v2: BRANCH_LABELS_TH ต้องมี 12 กิ่ง (พบ ${BRANCH_ORDER.length})`);
}

// แยก ganzhi → { ก้าน, กิ่ง }. มิเรอร์ splitGanZhi ใน symbolic-engine.birth.ts แต่ inline
// ไว้ที่นี่เพื่อไม่ลาก birth engine (lunar/timezone) เข้าโมดูล pure ตัวนี้และ test.
function splitGanZhi(ganzhi: string): { stem: string; branch: string } {
  const [stem = "", branch = ""] = Array.from(ganzhi.trim());
  if (!stem || !branch || Array.from(ganzhi.trim()).length !== 2) {
    throw new Error(`mascot-v2: ganzhi ไม่ถูกต้อง "${ganzhi}" (ต้องเป็นก้าน+กิ่ง 2 อักษร)`);
  }
  return { stem, branch };
}

export type MascotV2Parts = {
  order: string; // "01".."12"
  nakkasat: string; // ชวด..กุน (จากกิ่ง)
  elementTh: string; // ไม้/ไฟ/ดิน/ทอง/น้ำ (จากก้าน)
  elementEn: "wood" | "fire" | "earth" | "metal" | "water";
};

/**
 * ganzhi (เสาวัน เช่น "甲子") → ชิ้นส่วนที่ประกอบชื่อไฟล์.
 * โยน error ถ้าก้านหรือกิ่งไม่รู้จัก (ครบ 60 หรือล้ม — ห้าม skip เงียบ).
 */
export function ganzhiToV2Parts(ganzhi: string): MascotV2Parts {
  const { stem, branch } = splitGanZhi(ganzhi);

  const elementEn = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
  if (!elementEn) {
    throw new Error(`mascot-v2: ก้าน "${stem}" ไม่รู้จัก (ganzhi "${ganzhi}")`);
  }
  const elementTh = ELEMENT_LABELS_TH[elementEn];

  const nakkasat = BRANCH_LABELS_TH[branch as keyof typeof BRANCH_LABELS_TH];
  if (!nakkasat) {
    throw new Error(`mascot-v2: กิ่ง "${branch}" ไม่รู้จัก (ganzhi "${ganzhi}")`);
  }
  const idx = BRANCH_ORDER.indexOf(branch as keyof typeof BRANCH_LABELS_TH);
  const order = String(idx + 1).padStart(2, "0"); // "01".."12"

  return { order, nakkasat, elementTh, elementEn };
}

/**
 * ganzhi → ชื่อไฟล์ v2 ไทย (ไม่รวม .png) เช่น "01_ชวด-ไม้" — ตรงชื่อไฟล์ต้นทางในโฟลเดอร์ fe.
 */
export function ganzhiToV2Filename(ganzhi: string): string {
  const { order, nakkasat, elementTh } = ganzhiToV2Parts(ganzhi);
  return `${order}_${nakkasat}-${elementTh}`;
}

/**
 * ganzhi → object key แบบ ascii สำหรับ Supabase Storage เช่น "01_wood" — ไม่ user-facing,
 * ใช้เป็น path บน Storage (เลี่ยงคีย์ไทยเพื่อความเข้ากันได้ ตามแบบ uploader อื่นในเรพ).
 * unique 60 (order 12 × ธาตุ 5).
 */
export function ganzhiToV2StorageKey(ganzhi: string): string {
  const { order, elementEn } = ganzhiToV2Parts(ganzhi);
  return `${order}_${elementEn}`;
}

export type MascotV2Entry = {
  /** เสาวัน 60 กะจื่อ เช่น "甲子" (PK ตาราง bazi_mascot_image) */
  ganzhi: string;
  /** ชื่อไฟล์ต้นทาง v2 (ไม่รวม .png) เช่น "01_ชวด-ไม้" — อ่านจากดิสก์ด้วยชื่อนี้ */
  filename: string;
  /** object key ascii บน Storage เช่น "01_wood" — ปลายทาง mascot-v2/<storageKey>.png */
  storageKey: string;
  /** ชื่อไทย/อังกฤษเดิม (จาก MASCOT_60) — แสดงใน dry-run เท่านั้น; import ไม่เขียนทับชื่อ */
  nameTh: string;
  nameEn: string;
};

/**
 * ตารางครบ 60 แถว — map ทุก ganzhi ใน MASCOT_60 → ชื่อไฟล์ + storage key.
 * โยน error ถ้าตัวใดตัวหนึ่งแปลงไม่ได้ (ครบ 60 หรือล้ม).
 */
export function buildMascotV2Table(): MascotV2Entry[] {
  return MASCOT_60.map((m) => ({
    ganzhi: m.ganzhi,
    filename: ganzhiToV2Filename(m.ganzhi),
    storageKey: ganzhiToV2StorageKey(m.ganzhi),
    nameTh: m.nameTh,
    nameEn: m.nameEn,
  }));
}

/**
 * จานสีตัวอักษรสำหรับรายงาน YLC — แหล่งเดียว (single source) ใช้ร่วมกันทั้ง
 * ChapterEditor (dropdown), reading-inline (tokenizer), PDF (renderInline), docx (markdownRuns)
 *
 * reuse สีธาตุจาก symbolic-engine.constants (ELEMENT_COLORS_TH) + สี theme ของ ylc-pdf.css
 * token ใน markdown ใช้ `key` (เช่น [[c=fire]]…[[/c]]) — เปลี่ยน hex ภายหลังได้โดยไม่กระทบเอกสารเก่า
 */

export type ReadingColor = { key: string; label: string; hex: string };

/** จานสี (key เป็น latin คงที่ใช้ใน token, label ไทยโชว์บน UI, hex มี `#`) */
export const READING_COLORS: ReadingColor[] = [
  { key: "warn", label: "แดงเตือน", hex: "#c0392b" },
  { key: "fire", label: "ไฟ (แดง)", hex: "#CB2C2A" },
  { key: "wood", label: "ไม้ (เขียว)", hex: "#388659" },
  { key: "earth", label: "ดิน (ส้ม)", hex: "#F19953" },
  { key: "metal", label: "ทอง (เทา)", hex: "#5A5A5A" },
  { key: "water", label: "น้ำ (น้ำเงิน)", hex: "#1455A4" },
  { key: "teal", label: "เทอร์คอยซ์", hex: "#1f8497" },
  { key: "ink", label: "หมึก (เทาเข้ม)", hex: "#3d4548" },
  { key: "gray", label: "เทา", hex: "#6b7478" },
];

const KEY_TO_HEX = new Map(READING_COLORS.map((c) => [c.key, c.hex.toLowerCase()]));
const HEX_TO_KEY = new Map(READING_COLORS.map((c) => [c.hex.toLowerCase(), c.key]));

const HEX6 = /^#?([0-9a-fA-F]{6})$/;

/**
 * แปลง token สี (`key` ใน palette หรือ 6-hex) → css color `#rrggbb`
 * คืน null ถ้า token ไม่ถูกต้อง (renderer จะถือว่าไม่มีสี)
 */
export function resolveColor(token: string): string | null {
  const t = token.trim().toLowerCase();
  const fromKey = KEY_TO_HEX.get(t);
  if (fromKey) return fromKey;
  const m = t.match(HEX6);
  if (m) return `#${m[1]}`;
  return null;
}

/**
 * แปลง css hex (`#rrggbb`) → token สั้นสำหรับ serialize: คืน `key` ถ้าอยู่ใน palette
 * ไม่งั้นคืน hex 6 หลักไม่มี `#` (เผื่อสี custom นอก palette)
 */
export function colorToToken(hex: string): string {
  const h = hex.trim().toLowerCase();
  const key = HEX_TO_KEY.get(h);
  if (key) return key;
  const m = h.match(HEX6);
  if (m) return m[1];
  return h.replace(/^#/, "");
}

/** hex สำหรับ docx (ไม่มี `#`, ตัวพิมพ์ใหญ่ตามสไตล์ docx) */
export function hexForDocx(hex: string): string {
  return hex.replace(/^#/, "").toUpperCase();
}

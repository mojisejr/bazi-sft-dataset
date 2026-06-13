/**
 * Tokenizer กลางสำหรับ inline markdown ย่อ — แหล่งเดียวที่ทั้ง 3 ฝั่งเรียกใช้ กัน "ตีความไม่ตรงกัน":
 *  - PDF (renderInline ใน ReadingPrintDocument)
 *  - Word (markdownRuns ใน reading-docx)
 *  - editor converter (parseInline ใน reading-markdown)
 *
 * ไวยากรณ์ inline:
 *  - `**ตัวหนา**`          → bold
 *  - `***เน้นแดง***`       → red (legacy: หนา + สีแดงเตือน) — ต้องมาก่อน **
 *  - `[[c=KEY]]...[[/c]]`  → สี (KEY = key ใน palette หรือ 6-hex) ; ภายในรองรับ **ตัวหนา**
 *  - `[[s=PT]]...[[/s]]`   → ขนาดตัวอักษร (PT = พอยต์) ; ภายในรองรับ [[c=..]]/**ตัวหนา**
 *
 * กติกา: แยกด้วย span ขนาด (s) ชั้นนอกสุดก่อน → ในแต่ละช่วงค่อยแยกสี (c) → แล้วแยกตัวหนา/แดง
 * ภายใน span สี: เครื่องหมายสามดอกจันยุบเป็นหนา (สียังคงเป็นสีของ span)
 */

import { resolveColor } from "@/lib/bazi/reading-colors";

export type InlineRun = {
  text: string;
  bold: boolean;
  /** legacy `***` — หนา + แดงเตือน (renderer แต่ละฝั่ง map สีแดงของตัวเอง) */
  red: boolean;
  /** css color `#rrggbb` จาก [[c=..]] (null = ไม่มีสี) */
  color: string | null;
  /** css font-size เช่น "18pt" จาก [[s=..]] (ไม่มีฟิลด์ = ขนาดปกติ) */
  fontSize?: string;
};

const COLOR_RE = /\[\[c=([^\]]+)\]\]([\s\S]*?)\[\[\/c\]\]/g;
const SIZE_RE = /\[\[s=([^\]]+)\]\]([\s\S]*?)\[\[\/s\]\]/g;
const BOLD_RED_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*/g;

/** แปลง token ขนาด (พอยต์) → css size `"${n}pt"` ; คืน null ถ้านอกช่วง 6–72 */
export function resolveSize(token: string): string | null {
  const n = parseFloat(token.trim());
  if (Number.isFinite(n) && n >= 6 && n <= 72) return `${n}pt`;
  return null;
}

/** แยกตัวหนา/แดงในช่วงข้อความ (ไม่มีสี) — callback ได้ {text, bold, red} */
function splitBoldRed(text: string, emit: (text: string, bold: boolean, red: boolean) => void): void {
  let last = 0;
  let m: RegExpExecArray | null;
  BOLD_RED_RE.lastIndex = 0;
  while ((m = BOLD_RED_RE.exec(text)) !== null) {
    if (m.index > last) emit(text.slice(last, m.index), false, false);
    if (m[1] !== undefined) emit(m[1], true, true); // ***  → red (หนา+แดง)
    else emit(m[2], true, false); // ** → หนา
    last = m.index + m[0].length;
  }
  if (last < text.length) emit(text.slice(last), false, false);
}

function pushRun(
  runs: InlineRun[],
  text: string,
  bold: boolean,
  red: boolean,
  color: string | null,
  fontSize: string | null,
): void {
  if (!text) return;
  const run: InlineRun = { text, bold, red, color };
  // ใส่ fontSize เฉพาะตอนมีค่า — ไม่งั้น run ปกติมีคีย์เกินจาก snapshot/เทสต์เดิม
  if (fontSize) run.fontSize = fontSize;
  runs.push(run);
}

/** แยกสี [[c=..]] + ตัวหนา/แดง ในช่วงที่ขนาดคงที่ (fontSize) แล้ว push runs */
function tokenizeColorAndBold(text: string, fontSize: string | null, runs: InlineRun[]): void {
  let last = 0;
  let m: RegExpExecArray | null;
  COLOR_RE.lastIndex = 0;
  while ((m = COLOR_RE.exec(text)) !== null) {
    // ข้อความก่อนหน้า span สี → แยก ***/** ปกติ
    if (m.index > last) {
      splitBoldRed(text.slice(last, m.index), (t, bold, red) => pushRun(runs, t, bold, red, null, fontSize));
    }
    const hex = resolveColor(m[1]);
    const inner = m[2];
    if (hex) {
      // ภายใน span สี: *** ยุบเป็นหนา, สีคงที่
      splitBoldRed(inner, (t, bold, red) => pushRun(runs, t, bold || red, false, hex, fontSize));
    } else {
      // token สีไม่ถูกต้อง → ถือว่าไม่มีสี (แยก ***/** ตามปกติ)
      splitBoldRed(inner, (t, bold, red) => pushRun(runs, t, bold, red, null, fontSize));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    splitBoldRed(text.slice(last), (t, bold, red) => pushRun(runs, t, bold, red, null, fontSize));
  }
}

/** แปลง inline string → InlineRun[] (ข้ามรันว่าง) — สแกน span ขนาด (s) ชั้นนอกสุดก่อน */
export function tokenizeInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SIZE_RE.lastIndex = 0;
  while ((m = SIZE_RE.exec(text)) !== null) {
    if (m.index > last) tokenizeColorAndBold(text.slice(last, m.index), null, runs);
    tokenizeColorAndBold(m[2], resolveSize(m[1]), runs);
    last = m.index + m[0].length;
  }
  if (last < text.length) tokenizeColorAndBold(text.slice(last), null, runs);
  return runs;
}

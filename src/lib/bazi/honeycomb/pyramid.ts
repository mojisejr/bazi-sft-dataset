/**
 * เบอร์รังผึ้ง (เบอร์ปิรามิด / Pascal Pyramid) — ซินแสนุ้ย
 *
 * วิธีคำนวณ (ยืนยันจากภาพต้นฉบับ):
 *  1. Normalize เบอร์ → 11 หลัก (รวมรหัสประเทศ 66): ตัดอักขระไม่ใช่ตัวเลข,
 *     เก็บ 9 หลักสำคัญ แล้วเติม "66" ข้างหน้า → ได้ปิรามิด 11 ชั้นพอดี.
 *  2. แถวบนสุด = 11 หลัก. แต่ละแถวถัดลง: cell = reduceToSingleDigit(left + right)
 *     เช่น 6+6=12→3, 9+9=18→9 (ผลบวกสูงสุด 18 → รวมรอบเดียวพอ).
 *  3. ไล่ลงจนเหลือ 1 หลัก (ยอดปิรามิด) → รวม 11 แถว.
 *  4. เลขชั้นนับจากยอด: แถว 1 หลัก = ชั้น1 … แถว 11 หลัก = ชั้น11.
 *  5. ตีความแต่ละชั้นเป็น "คู่เลขติดกัน" (overlapping pairs) โดยใช้ความหมายคู่เลข
 *     เดิมจาก phone-pair-meanings.json (ชั้น 1 หลัก → ใช้ความหมายเลขเดี่ยว).
 *
 * โซน (ตามหลักการ): ชั้น 1-4 = ตัวเรา, ชั้น 5-6 = สิ่งแวดล้อมใกล้ตัว,
 *                    ชั้น 7-11 = สิ่งแวดล้อมห่างตัว.
 */
import pairJson from "@/lib/bazi/data/phone/phone-pair-meanings.json";
import digitJson from "@/lib/bazi/data/phone/phone-digit-meanings.json";
import type { PairMeaning, DigitInfo } from "@/lib/bazi/phone-number";

const PAIR_MEANINGS = pairJson as Record<string, PairMeaning>;
const DIGIT_MEANINGS = digitJson as Record<string, DigitInfo>;

const SIGNIFICANT_DIGITS = 9;
const TARGET_DIGITS = SIGNIFICANT_DIGITS + 2; // 11 (รวม 66)

export class HoneycombNumberError extends Error {}

export type HoneycombZone = "self" | "near" | "far";

export type HoneycombPair = {
  /** คู่เลขตามที่ปรากฏในชั้น เช่น "15" */
  pair: string;
  /** คีย์ canonical (เรียงน้อย→มาก) ที่ใช้ lookup เช่น "15" */
  key: string;
  a: number;
  b: number;
  meaning: PairMeaning;
};

export type HoneycombLayer = {
  /** เลขชั้น นับจากยอด (1 = ยอดปิรามิด) */
  layerNo: number;
  digits: number[];
  /** เลขชั้นต่อกันเป็นสตริง เช่น "155" */
  digitString: string;
  zone: HoneycombZone;
  /** คู่เลขติดกันในชั้น (ชั้น 1 หลักจะว่าง) */
  pairs: HoneycombPair[];
  /** ความหมายเลขเดี่ยว — เฉพาะยอดปิรามิด (ชั้น 1 หลัก) */
  digitMeaning?: DigitInfo;
};

export type HoneycombReading = {
  /** ข้อความดิบที่ผู้ใช้กรอก */
  input: string;
  /** 11 หลักหลัง normalize (รวม 66) */
  normalized: string;
  /** ทุกแถวของปิรามิด บนสุด→ล่างสุด (แถวแรก 11 หลัก, แถวสุดท้าย 1 หลัก) */
  rows: number[][];
  /** ชั้นเรียงจากยอด (ชั้น1) ขึ้นไปถึงชั้น11 */
  layers: HoneycombLayer[];
};

/** รวมเลขให้เหลือหลักเดียว (ผลบวกคู่เลข 0–18 → รวมรอบเดียวพอ แต่วนเผื่อไว้) */
export function reduceToSingleDigit(n: number): number {
  let value = Math.abs(Math.trunc(n));
  while (value > 9) {
    value = String(value)
      .split("")
      .reduce((sum, c) => sum + Number(c), 0);
  }
  return value;
}

/** คีย์ canonical สองหลัก (เรียงน้อย→มาก) เช่น 61 → "16", 45 → "45" */
function canonicalKey(a: number, b: number): string {
  return a <= b ? `${a}${b}` : `${b}${a}`;
}

/**
 * Normalize เบอร์ → 11 หลัก (66 + 9 หลักสำคัญ).
 * รองรับรูปในประเทศ (0XXXXXXXXX), สากล (66XXXXXXXXX) และ 9 หลักล้วน.
 * throw HoneycombNumberError ถ้าไม่ได้ 9 หลักสำคัญ.
 */
export function normalizeHoneycombNumber(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  let significant = digits;
  if (digits.startsWith("66") && digits.length === TARGET_DIGITS) {
    significant = digits.slice(2);
  } else if (digits.startsWith("0")) {
    significant = digits.slice(1);
  }
  if (significant.length !== SIGNIFICANT_DIGITS) {
    throw new HoneycombNumberError(
      `กรุณากรอกเบอร์มือถือ 10 หลัก (เช่น 0812345678) — พบ ${significant.length || 0} หลักสำคัญหลังตัดรหัสประเทศ`,
    );
  }
  return `66${significant}`;
}

/** สร้างปิรามิด: แถวบน→ล่าง โดยแต่ละแถวล่าง = ผลบวกคู่เลขติดกันแล้วรวมเป็นหลักเดียว */
export function buildPyramid(digits: number[]): number[][] {
  const rows: number[][] = [digits.slice()];
  let current = digits;
  while (current.length > 1) {
    const next: number[] = [];
    for (let i = 0; i < current.length - 1; i++) {
      next.push(reduceToSingleDigit(current[i] + current[i + 1]));
    }
    rows.push(next);
    current = next;
  }
  return rows;
}

function pairMeaning(key: string): PairMeaning {
  return (
    PAIR_MEANINGS[key] ?? {
      pair: key,
      feeling: "",
      work: "",
      money: "",
      love: "",
      analysis: "",
    }
  );
}

function digitInfo(d: number): DigitInfo {
  return DIGIT_MEANINGS[String(d)] ?? { digit: d, planet: "-", element: "-", keyword: "-" };
}

function zoneForLayer(layerNo: number): HoneycombZone {
  if (layerNo <= 4) return "self";
  if (layerNo <= 6) return "near";
  return "far";
}

function buildLayer(digits: number[], layerNo: number): HoneycombLayer {
  const pairs: HoneycombPair[] = [];
  for (let i = 0; i < digits.length - 1; i++) {
    const a = digits[i];
    const b = digits[i + 1];
    const key = canonicalKey(a, b);
    pairs.push({ pair: `${a}${b}`, key, a, b, meaning: pairMeaning(key) });
  }
  return {
    layerNo,
    digits: digits.slice(),
    digitString: digits.join(""),
    zone: zoneForLayer(layerNo),
    pairs,
    digitMeaning: digits.length === 1 ? digitInfo(digits[0]) : undefined,
  };
}

/**
 * อ่าน "เลขสั้น" ทั่วไป (เช่น เลขทะเบียนรถ 1-4 หลัก) ด้วยตารางเดียวกับเบอร์โทร:
 * คู่เลขติดกันทุกคู่ + เลขผลรวมยุบเหลือหลักเดียว. ไม่บังคับความยาว 10 หลัก.
 */
export function readShortNumber(raw: string): {
  digits: string;
  pairs: HoneycombPair[];
  sum: number;
  sumMeaning: DigitInfo;
} | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 1 || digits.length > 6) return null;
  const nums = digits.split("").map((c) => Number(c));
  const pairs: HoneycombPair[] = [];
  for (let i = 0; i < nums.length - 1; i++) {
    const key = canonicalKey(nums[i], nums[i + 1]);
    pairs.push({ pair: `${nums[i]}${nums[i + 1]}`, key, a: nums[i], b: nums[i + 1], meaning: pairMeaning(key) });
  }
  const sum = reduceToSingleDigit(nums.reduce((acc, n) => acc + n, 0));
  return { digits, pairs, sum, sumMeaning: digitInfo(sum) };
}

/** คำนวณคำอ่านเบอร์รังผึ้งเต็มรูปแบบ (deterministic). throw HoneycombNumberError ถ้า input ไม่ถูกต้อง */
export function readHoneycomb(raw: string): HoneycombReading {
  const normalized = normalizeHoneycombNumber(raw);
  const digits = normalized.split("").map((c) => Number(c));
  const rows = buildPyramid(digits);

  // rows[0] = แถวกว้างสุด (11 หลัก) … rows[last] = ยอด (1 หลัก)
  // เลขชั้นนับจากยอด → ชั้น = rows.length - rowIndex
  const layers: HoneycombLayer[] = rows
    .map((row, rowIndex) => buildLayer(row, rows.length - rowIndex))
    .sort((a, b) => a.layerNo - b.layerNo);

  return { input: raw, normalized, rows, layers };
}

/**
 * เลขพยากรณ์ — phone-number life-reading engine.
 *
 * Deterministic lookups over the distilled book content
 * (src/lib/bazi/data/phone/*.json) from "ทำนายชีวิตด้วยเบอร์มือถือ" โดย ครูเอก.
 *
 * Method (per the book, ch.3):
 *  1. Strip the leading country code (0 / 66) → keep the 9 significant digits.
 *  2. Read consecutive overlapping digit PAIRS (9 digits → 8 pairs).
 *  3. Swapped pairs share one meaning (45 = 54) → 55 canonical pairs 00–99.
 *  4. The closing pair (last two digits) carries the most weight; weight
 *     decreases toward the front of the number.
 *  5. Front half = "รู้หน้า" (outward expression) · back half = "รู้ใจ" (inner self).
 */
import pairJson from "@/lib/bazi/data/phone/phone-pair-meanings.json";
import digitJson from "@/lib/bazi/data/phone/phone-digit-meanings.json";

export type PairMeaning = {
  pair: string;
  feeling: string;
  work: string;
  money: string;
  love: string;
  analysis: string;
};

export type PhoneZone = "front" | "back";

export type PhonePairReading = {
  /** the two digits as they appear on the number, e.g. "45" */
  pair: string;
  /** canonical key used for the lookup (sorted), e.g. "45" */
  key: string;
  a: number;
  b: number;
  /** 1-based position of this pair within the number (1 = front-most) */
  position: number;
  zone: PhoneZone;
  /** relative influence 0–1 (closing pair = highest) */
  weight: number;
  meaning: PairMeaning;
};

export type DigitInfo = {
  digit: number;
  planet: string;
  element: string;
  keyword: string;
};

export type DigitTally = DigitInfo & { count: number };

export type PhoneReading = {
  /** raw user input */
  input: string;
  /** 9 significant digits after stripping the country code */
  normalized: string;
  pairs: PhonePairReading[];
  /** the most influential pair (closing two digits) */
  closing: PhonePairReading;
  /** digit frequency with planet/element, most frequent first */
  digitTally: DigitTally[];
};

const PAIR_MEANINGS = pairJson as Record<string, PairMeaning>;
const DIGIT_MEANINGS = digitJson as Record<string, DigitInfo>;

const SIGNIFICANT_DIGITS = 9;

export class PhoneNumberError extends Error {}

/** sorted two-digit canonical key, e.g. 61 → "16", 45 → "45" */
function canonicalKey(a: number, b: number): string {
  return a <= b ? `${a}${b}` : `${b}${a}`;
}

/**
 * Keep only digits, then drop the country code:
 *  - a leading "66" (international +66 form), or
 *  - a single leading "0" (domestic form).
 * Must leave exactly 9 significant digits.
 */
export function normalizePhoneNumber(raw: string): string {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length === SIGNIFICANT_DIGITS + 2) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== SIGNIFICANT_DIGITS) {
    throw new PhoneNumberError(
      `กรุณากรอกเบอร์มือถือ 10 หลัก (เช่น 0812345678) — พบ ${digits.length || 0} หลักหลังตัดรหัสประเทศ`,
    );
  }
  return digits;
}

function digitInfo(d: number): DigitInfo {
  return (
    DIGIT_MEANINGS[String(d)] ?? {
      digit: d,
      planet: "-",
      element: "-",
      keyword: "-",
    }
  );
}

/**
 * Compute the full reading for a phone number.
 * Throws PhoneNumberError on malformed input.
 */
export function readPhoneNumber(raw: string): PhoneReading {
  const normalized = normalizePhoneNumber(raw);
  const ds = normalized.split("").map((c) => Number(c));

  const total = ds.length - 1; // number of overlapping pairs (8)
  const pairs: PhonePairReading[] = [];
  for (let i = 0; i < total; i++) {
    const a = ds[i];
    const b = ds[i + 1];
    const key = canonicalKey(a, b);
    const meaning =
      PAIR_MEANINGS[key] ??
      ({ pair: key, feeling: "", work: "", money: "", love: "", analysis: "" } as PairMeaning);
    const position = i + 1;
    // weight ramps up toward the closing pair (last = 1.0)
    const weight = Math.round(((position / total) * 0.7 + 0.3) * 100) / 100;
    // front half of the number = outward "รู้หน้า"; back half = inner "รู้ใจ"
    const zone: PhoneZone = i < Math.floor(total / 2) ? "front" : "back";
    pairs.push({ pair: `${a}${b}`, key, a, b, position, zone, weight, meaning });
  }

  const closing = pairs[pairs.length - 1];

  const counts = new Map<number, number>();
  for (const d of ds) counts.set(d, (counts.get(d) ?? 0) + 1);
  const digitTally: DigitTally[] = Array.from(counts.entries())
    .map(([digit, count]) => ({ ...digitInfo(digit), count }))
    .sort((x, y) => y.count - x.count || x.digit - y.digit);

  return { input: raw, normalized, pairs, closing, digitTally };
}

// ── บ้านเลขที่/เลขสั้น (เลขศาสตร์ผลรวม) ────────────────────────────────────────────
// วิธี: บวกทุกหลัก → ถ้าได้ 2 หลัก (10–99) ใช้ความหมาย "คู่เลข" (รวย/งาน/รัก) เหมือนเบอร์; ยุบเป็นเลขเดี่ยว
// (digital root) เพื่ออ่านความหมายเลขหลักเดียว (ดาว/ธาตุ/คีย์เวิร์ด). ใช้ data ชุดเดียวกับเบอร์ — ไม่แต่งตำราใหม่.
export type HouseNumberReading = {
  input: string;
  digits: string;
  /** ผลบวกทุกหลัก (เช่น 135 → 9) */
  sum: number;
  /** ยุบเป็นเลขหลักเดียว (digital root) */
  root: number;
  rootMeaning: DigitInfo;
  /** ความหมายคู่เลขของผลรวม (เฉพาะเมื่อ sum อยู่ 10–99) */
  pairMeaning?: PairMeaning;
};

export function readHouseNumber(raw: string): HouseNumberReading {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) throw new PhoneNumberError("กรุณากรอกเลขที่ (ตัวเลข) เช่น 135");
  const sum = digits.split("").reduce((a, c) => a + Number(c), 0);
  let root = sum;
  while (root > 9) root = String(root).split("").reduce((a, c) => a + Number(c), 0);
  const pairMeaning =
    sum >= 10 && sum <= 99 ? PAIR_MEANINGS[canonicalKey(Math.floor(sum / 10), sum % 10)] : undefined;
  return { input: raw, digits, sum, root, rootMeaning: digitInfo(root), pairMeaning };
}

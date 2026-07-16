/**
 * Pyramid-Number Engine — "ถอดรหัสพลังงานปิรามิดเบอร์โทรศัพท์" (สไตล์ครูเอก เลขพยากรณ์).
 *
 * แกะจากตัวอย่างจริง (เบอร์ 092-669-2465, ฐาน 66926692465):
 *   เอาเลขฐานมาบวกคู่ที่ติดกัน แล้ว "ยุบเป็นเลขหลักเดียว" (digital root) ทีละแถว
 *   จนเหลือยอด 1 ตัว → ได้ปิรามิดแบบพาสคาล
 *
 * engine ล้วน: ไม่มี LLM / ไม่มี DB / ไม่มี network — ไว้ทดสอบสูตรก่อนต่อยอดเป็นฟีเจอร์
 *
 * กติกาการวางเบอร์: จากภาพเครื่องจริง ช่องกรอก (66926692465) = แถวฐาน (66926692465)
 * เป๊ะ ๆ — เครื่องไม่แปลงอะไร เอา "สิ่งที่พิมพ์" มาเป็นแถวฐานตรง ๆ. ที่เป็น 11 หลัก
 * เพราะคน "วางเบอร์ตามชะตา" ป้อนเอง ไม่ใช่แปลงจากเบอร์ดิบ 10 หลักอัตโนมัติ.
 * normalizeBase จึงเป็น identity (คืนหลักที่พิมพ์ตรง ๆ) = ตรงกับพฤติกรรมเครื่องจริง.
 */

/**
 * ยุบเลขให้เหลือหลักเดียวแบบรากดิจิทัล (digital root):
 *   12 → 3, 15 → 6, 17 → 8, 18 → 9 (9 คงเป็น 9), 0 → 0
 * ใช้กับ "ผลบวกของสองช่องด้านบน" ในการสร้างปิรามิด
 */
export function digitalRoot(n: number): number {
  let x = Math.abs(Math.trunc(n));
  while (x > 9) {
    let sum = 0;
    while (x > 0) {
      sum += x % 10;
      x = Math.trunc(x / 10);
    }
    x = sum;
  }
  return x;
}

/** แปลงสตริงเบอร์เป็น array ของหลัก (ตัดอักขระที่ไม่ใช่ตัวเลขทิ้ง เช่น "-", ช่องว่าง) */
export function digitsOf(input: string): number[] {
  return Array.from(input).filter((c) => c >= "0" && c <= "9").map(Number);
}

/**
 * กติกาการวางเบอร์ (placeholder) — แปลงเบอร์ดิบให้เป็น "แถวฐาน" ก่อนสร้างปิรามิด.
 *
 * ตอนนี้ยังไม่รู้กติกาจริงของครูเอก (10 หลัก → 11 หลัก) จึงคืนหลักตรง ๆ ไปก่อน
 * พอได้กติกาจริงแล้วค่อยแก้เฉพาะฟังก์ชันนี้ ส่วน buildPyramid ไม่ต้องแตะ
 */
export function normalizeBase(rawPhone: string): number[] {
  return digitsOf(rawPhone);
}

/**
 * สร้างปิรามิดจากแถวฐาน: แต่ละช่อง = digitalRoot(บวกสองช่องด้านบนที่ติดกัน)
 * คืนค่าเป็น array ของแถว โดย index 0 = ฐาน (กว้างสุด) … index สุดท้าย = ยอด (1 ตัว)
 */
export function buildPyramid(base: number[]): number[][] {
  if (base.length === 0) return [];
  const rows: number[][] = [base.slice()];
  let current = base;
  while (current.length > 1) {
    const next: number[] = [];
    for (let i = 0; i < current.length - 1; i++) {
      next.push(digitalRoot(current[i] + current[i + 1]));
    }
    rows.push(next);
    current = next;
  }
  return rows;
}

/** ยอดปิรามิด (เลขแห่งตัวตน) — แถวสุดท้ายที่มี 1 ตัว */
export function apexOf(rows: number[][]): number | null {
  const top = rows[rows.length - 1];
  return top && top.length === 1 ? top[0] : null;
}

// ---------------------------------------------------------------------------
// พจนานุกรมความหมาย
//
// ⚠️ ค่าด้านล่างถอดจาก "ตัวอย่างเดียว" ของครูเอกเท่านั้น — เติมเฉพาะเลขที่ตัวอย่างพูดถึง
//    (2,3,5,6,8,9 และคู่ 66/69/24/46/65) ส่วนที่เหลือปล่อยว่างไว้ให้เติมเมื่อได้ตารางเต็ม
// ---------------------------------------------------------------------------

/** ความหมายเลขเดี่ยว 0–9 ("" = ยังไม่มีข้อมูลจากตัวอย่าง) */
export const DIGIT_MEANINGS: Record<number, string> = {
  0: "",
  1: "",
  2: "อ่อนหวาน นุ่มนวล เมตตา เข้าอกเข้าใจคนอื่น",
  3: "ความขยัน พลังขับเคลื่อน กระตือรือร้น ไม่นิ่งเฉย",
  4: "",
  5: "ปัญญา ความมั่นคง มีสติมีเหตุผล ได้รับการเอ็นดูจากผู้ใหญ่",
  6: "เสน่ห์ การเงิน ความสุข รักสวยรักงาม",
  7: "",
  8: "ใจใหญ่ กล้าคิดกล้าทำ ไหวพริบเอาตัวรอด ดึงดูดทรัพย์ก้อนใหญ่",
  9: "สิ่งศักดิ์สิทธิ์คุ้มครอง โชคลาภไม่คาดฝัน ครีเอทีฟ ลางสังหรณ์แม่น",
};

/** ความหมายคู่เลข (normalize เป็น "เล็ก-ใหญ่" เพื่อรวม 24=42, 46=64, 65=56) */
export const PAIR_MEANINGS: Record<string, string> = {
  "6-6": "เมตตามหานิยม เงินไหลมาเทมา มีคนอุปถัมภ์ค้ำชู",
  "6-9": "เมตตามหานิยม เงินไหลมาเทมา รสนิยมดี มีสไตล์",
  "2-4": "มหาเสน่ห์ พูดจาไพเราะ คนฟังแล้วคล้อยตามง่าย เหมาะประสานงาน/ขายของ",
  "4-6": "วาจาเรียกทรัพย์ พูดแล้วได้เงินได้ทอง",
  "5-6": "คู่ทรัพย์คู่ปัญญา การเงินรั่วไหลยาก มีสติบริหารเงิน โชคดีเรื่องผู้อุปถัมภ์",
};

/** ชื่อ "ชั้น" ของยอดปิรามิด นับจากยอด (1 ตัว) ขึ้นไป */
export const LAYER_NAMES: Record<number, string> = {
  1: "เลขแห่งตัวตน",
  2: "พลังงานแฝง",
  3: "ตัวควบคุมพลังงานทั้งหมด",
  4: "บทสรุปความเป็นตัวเรา",
};

export type PyramidLayer = {
  /** จำนวนช่องในชั้นนี้ (1 = ยอด) — ตรงกับ "ชั้นที่ N" */
  level: number;
  name: string;
  digits: number[];
  /** ความหมายของเลขแต่ละตัวในชั้น */
  meanings: { digit: number; meaning: string }[];
};

/** ดึง "ชั้น" ของยอดปิรามิด (default 4 ชั้นบนสุด ตามตัวอย่างครูเอก) */
export function readLayers(rows: number[][], topN = 4): PyramidLayer[] {
  const layers: PyramidLayer[] = [];
  // แถวจากยอดขึ้นไป: rows[last] = ชั้น 1, rows[last-1] = ชั้น 2, ...
  for (let level = 1; level <= topN && level <= rows.length; level++) {
    const digits = rows[rows.length - level];
    layers.push({
      level,
      name: LAYER_NAMES[level] ?? `ชั้นที่ ${level}`,
      digits: digits.slice(),
      meanings: digits.map((d) => ({ digit: d, meaning: DIGIT_MEANINGS[d] ?? "" })),
    });
  }
  return layers;
}

export type PairHit = {
  /** คู่ที่พบในเบอร์ เช่น "66", "24" (ตามลำดับที่ปรากฏจริง) */
  pair: string;
  meaning: string;
};

/** สแกนคู่เลขที่ติดกันในแถวฐาน แล้ว map กับ PAIR_MEANINGS (คู่ที่ไม่มีความหมายถูกข้าม) */
export function scanPairs(base: number[]): PairHit[] {
  const hits: PairHit[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    const a = base[i];
    const b = base[i + 1];
    const key = a <= b ? `${a}-${b}` : `${b}-${a}`;
    const meaning = PAIR_MEANINGS[key];
    if (meaning) hits.push({ pair: `${a}${b}`, meaning });
  }
  return hits;
}

export type PyramidReading = {
  /** เบอร์ดิบที่ป้อนเข้ามา */
  rawPhone: string;
  /** แถวฐานหลัง normalize */
  base: number[];
  /** ทุกแถวของปิรามิด (index 0 = ฐาน, สุดท้าย = ยอด) */
  rows: number[][];
  /** เลขแห่งตัวตน (ยอด) */
  apex: number | null;
  /** ชั้นบนสุด (default 4 ชั้น) พร้อมความหมาย */
  layers: PyramidLayer[];
  /** คู่เลขเด่นในเบอร์ */
  pairs: PairHit[];
};

/** เอนทรีพอยต์: เบอร์ดิบ → ผลอ่านปิรามิดครบชุด (engine ล้วน) */
export function readPyramidNumber(rawPhone: string, topLayers = 4): PyramidReading {
  const base = normalizeBase(rawPhone);
  const rows = buildPyramid(base);
  return {
    rawPhone,
    base,
    rows,
    apex: apexOf(rows),
    layers: readLayers(rows, topLayers),
    pairs: scanPairs(base),
  };
}

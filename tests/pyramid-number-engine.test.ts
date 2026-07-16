import { describe, expect, test } from "vitest";

import {
  apexOf,
  buildPyramid,
  digitalRoot,
  digitsOf,
  readLayers,
  readPyramidNumber,
  scanPairs,
} from "@/lib/bazi/pyramid-number/engine";

/**
 * ตัวอย่างจริงจากครูเอก (เบอร์ 092-669-2465, ฐาน 66926692465):
 * ปิรามิดเต็มตามภาพ — ใช้เป็น golden fixture ยืนยันสูตร
 */
const KRUAKE_BASE = digitsOf("66926692465");
const KRUAKE_PYRAMID: number[][] = [
  [6, 6, 9, 2, 6, 6, 9, 2, 4, 6, 5],
  [3, 6, 2, 8, 3, 6, 2, 6, 1, 2],
  [9, 8, 1, 2, 9, 8, 8, 7, 3],
  [8, 9, 3, 2, 8, 7, 6, 1],
  [8, 3, 5, 1, 6, 4, 7],
  [2, 8, 6, 7, 1, 2],
  [1, 5, 4, 8, 3],
  [6, 9, 3, 2],
  [6, 3, 5],
  [9, 8],
  [8],
];

describe("digitalRoot", () => {
  test.each([
    [12, 3],
    [15, 6],
    [17, 8],
    [18, 9],
    [9, 9],
    [0, 0],
    [10, 1],
    [5, 5],
  ])("dr(%i) = %i", (input, expected) => {
    expect(digitalRoot(input)).toBe(expected);
  });
});

describe("buildPyramid — golden fixture ครูเอก", () => {
  const rows = buildPyramid(KRUAKE_BASE);

  test("จำนวนแถว = ความยาวฐาน (11)", () => {
    expect(rows).toHaveLength(11);
  });

  test("ทุกแถวตรงกับปิรามิดจริงในภาพ", () => {
    expect(rows).toEqual(KRUAKE_PYRAMID);
  });

  test("ยอด (เลขแห่งตัวตน) = 8", () => {
    expect(apexOf(rows)).toBe(8);
  });
});

describe("readLayers", () => {
  const rows = buildPyramid(KRUAKE_BASE);
  const layers = readLayers(rows, 4);

  test("ได้ 4 ชั้นบนสุดพร้อมชื่อ", () => {
    expect(layers.map((l) => [l.level, l.name, l.digits])).toEqual([
      [1, "เลขแห่งตัวตน", [8]],
      [2, "พลังงานแฝง", [9, 8]],
      [3, "ตัวควบคุมพลังงานทั้งหมด", [6, 3, 5]],
      [4, "บทสรุปความเป็นตัวเรา", [6, 9, 3, 2]],
    ]);
  });

  test("แต่ละเลขในชั้นมีความหมายกำกับ", () => {
    const controller = layers.find((l) => l.level === 3)!;
    expect(controller.meanings.map((m) => m.digit)).toEqual([6, 3, 5]);
    expect(controller.meanings.every((m) => m.meaning.length > 0)).toBe(true);
  });
});

describe("scanPairs", () => {
  test("จับคู่เลขเด่นในเบอร์ (66, 69, 24, 46, 65)", () => {
    const pairs = scanPairs(KRUAKE_BASE).map((p) => p.pair);
    expect(pairs).toContain("66");
    expect(pairs).toContain("69");
    expect(pairs).toContain("24");
    expect(pairs).toContain("46");
    expect(pairs).toContain("65");
  });

  test("คู่ที่ไม่มีความหมายในตารางถูกข้าม", () => {
    // 3-3 ไม่มีใน PAIR_MEANINGS → ต้องไม่โผล่
    const pairs = scanPairs([3, 3, 1, 1]);
    expect(pairs).toHaveLength(0);
  });
});

describe("readPyramidNumber — เอนทรีพอยต์รวม", () => {
  test("รับเบอร์แบบมีขีดคั่นแล้วตัดอักขระที่ไม่ใช่เลขทิ้ง", () => {
    const r = readPyramidNumber("66-926-692465");
    expect(r.base).toEqual(KRUAKE_BASE);
    expect(r.apex).toBe(8);
    expect(r.rows).toEqual(KRUAKE_PYRAMID);
    expect(r.layers).toHaveLength(4);
    expect(r.pairs.length).toBeGreaterThan(0);
  });
});

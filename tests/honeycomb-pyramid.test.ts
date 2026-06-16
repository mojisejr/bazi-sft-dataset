import { describe, expect, test } from "vitest";

import {
  reduceToSingleDigit,
  normalizeHoneycombNumber,
  buildPyramid,
  readHoneycomb,
  HoneycombNumberError,
} from "@/lib/bazi/honeycomb/pyramid";

describe("reduceToSingleDigit", () => {
  test("เลขหลักเดียวคงเดิม", () => {
    for (let i = 0; i <= 9; i++) expect(reduceToSingleDigit(i)).toBe(i);
  });

  test("รวมเลขสองหลักให้เหลือหลักเดียว (เคสในรูป)", () => {
    expect(reduceToSingleDigit(12)).toBe(3); // 6+6
    expect(reduceToSingleDigit(15)).toBe(6); // 6+9
    expect(reduceToSingleDigit(11)).toBe(2); // 9+2
    expect(reduceToSingleDigit(18)).toBe(9); // 9+9
    expect(reduceToSingleDigit(13)).toBe(4); // 9+4
  });
});

describe("normalizeHoneycombNumber", () => {
  test("รูปในประเทศ (0 นำหน้า) → 66 + 9 หลัก", () => {
    expect(normalizeHoneycombNumber("0929949294")).toBe("66929949294");
  });

  test("รูปสากล (66 นำหน้า, 11 หลัก) คงเดิม", () => {
    expect(normalizeHoneycombNumber("66929949294")).toBe("66929949294");
  });

  test("9 หลักล้วน → เติม 66", () => {
    expect(normalizeHoneycombNumber("929949294")).toBe("66929949294");
  });

  test("ตัดอักขระไม่ใช่ตัวเลข", () => {
    expect(normalizeHoneycombNumber("092-994-9294")).toBe("66929949294");
  });

  test("เบอร์ผิดความยาว → โยน error", () => {
    expect(() => normalizeHoneycombNumber("0812")).toThrow(HoneycombNumberError);
  });
});

describe("buildPyramid", () => {
  test("แถวที่สองของ 66929949294 ต้องได้ 3 6 2 2 9 4 4 2 2 4 (ตรงรูป)", () => {
    const digits = "66929949294".split("").map(Number);
    const rows = buildPyramid(digits);
    expect(rows[0]).toEqual(digits);
    expect(rows[1]).toEqual([3, 6, 2, 2, 9, 4, 4, 2, 2, 4]);
  });

  test("จำนวนแถว = จำนวนหลักเริ่มต้น และแถวสุดท้าย 1 หลัก", () => {
    const rows = buildPyramid("66929949294".split("").map(Number));
    expect(rows.length).toBe(11);
    expect(rows[rows.length - 1].length).toBe(1);
  });
});

describe("readHoneycomb", () => {
  test("ได้ 11 ชั้น, ยอด (ชั้น1) 1 หลัก, ฐาน (ชั้น11) 11 หลัก", () => {
    const reading = readHoneycomb("0929949294");
    expect(reading.normalized).toBe("66929949294");
    expect(reading.layers.length).toBe(11);

    const apex = reading.layers.find((l) => l.layerNo === 1)!;
    expect(apex.digits.length).toBe(1);
    expect(apex.pairs.length).toBe(0);
    expect(apex.digitMeaning).toBeDefined();
    expect(apex.zone).toBe("self");

    const base = reading.layers.find((l) => l.layerNo === 11)!;
    expect(base.digits.length).toBe(11);
    expect(base.digitString).toBe("66929949294");
    expect(base.pairs.length).toBe(10);
    expect(base.zone).toBe("far");
  });

  test("โซนถูกต้องตามเลขชั้น", () => {
    const reading = readHoneycomb("0929949294");
    const zoneOf = (no: number) => reading.layers.find((l) => l.layerNo === no)!.zone;
    expect(zoneOf(4)).toBe("self");
    expect(zoneOf(5)).toBe("near");
    expect(zoneOf(6)).toBe("near");
    expect(zoneOf(7)).toBe("far");
  });
});

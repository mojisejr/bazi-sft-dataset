import { describe, expect, test } from "vitest";

import {
  drawRandom,
  getAllSticks,
  getStickByNo,
  TOPICS,
} from "@/lib/bazi/fortune-sage/deck";

describe("fortune-sage deck", () => {
  test("โหลดหัวเซี่ยงแซครบ 64 หัว เลขไม่ซ้ำ และมีเนื้อหาครบทุก field", () => {
    const sticks = getAllSticks();
    expect(sticks).toHaveLength(64);
    const nos = new Set(sticks.map((s) => s.no));
    expect(nos.size).toBe(64);
    for (const s of sticks) {
      expect(s.pillar.length).toBeGreaterThan(0);
      expect(s.nayin.length).toBeGreaterThan(0);
      expect(s.personality.length).toBeGreaterThan(0);
      expect(s.deity.length).toBeGreaterThan(0);
      for (const { key } of TOPICS) {
        expect(s.topics[key].length).toBeGreaterThan(0);
      }
      // ทุกหัวต้องมี field imageUrl (เป็น public URL หรือ null ถ้ายังไม่อัปโหลด)
      expect("imageUrl" in s).toBe(true);
      expect(s.imageUrl === null || typeof s.imageUrl === "string").toBe(true);
    }
  });

  test("ข้อความไม่มีแท็บค้างท้าย (trim แล้ว)", () => {
    for (const s of getAllSticks()) {
      expect(s.personality).toBe(s.personality.trim());
      expect(s.personality).not.toContain("\t");
    }
  });

  test("getStickByNo คืนหัวถูกตัว และ undefined เมื่อไม่มี", () => {
    expect(getStickByNo(1)?.no).toBe(1);
    expect(getStickByNo(999)).toBeUndefined();
  });

  test("drawRandom(seed) deterministic และอยู่ในสำรับ", () => {
    const a = drawRandom(12345);
    const b = drawRandom(12345);
    expect(a.no).toBe(b.no);
    expect(getStickByNo(a.no)).toBeDefined();
  });

  test("drawRandom seed ต่างกันให้ผลต่างกัน", () => {
    expect(drawRandom(1).no).not.toBe(drawRandom(2).no);
  });
});

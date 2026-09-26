// tests/fortune-seed.test.ts — seedFromQuestion: คำถามเดิม→seed เดิม, คำถามต่าง→seed ต่าง (2026-09-21)
import { describe, expect, it } from "vitest";

import { seedFromQuestion, seedForDraw } from "@/lib/bazi/seed";

describe("seedFromQuestion", () => {
  it("เสถียร: คำถามเดิม → seed เดิม (+ trim)", () => {
    expect(seedFromQuestion("งานจะได้ไหม")).toBe(seedFromQuestion("งานจะได้ไหม"));
    expect(seedFromQuestion("  งานจะได้ไหม  ")).toBe(seedFromQuestion("งานจะได้ไหม"));
  });
  it("คำถามต่าง → seed ต่าง", () => {
    expect(seedFromQuestion("งานจะได้ไหม")).not.toBe(seedFromQuestion("เงินจะดีไหม"));
  });
  it("คืน uint32 (เหมาะเป็น seed ของ mulberry32)", () => {
    const s = seedFromQuestion("x");
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });
});

// seedForDraw — จั่วจริง: คนละคน/คนละครั้ง ต้องได้ seed ต่างกัน (เอ็ม 2026-09-26 แก้ไพ่ชนข้ามคน)
describe("seedForDraw", () => {
  const Q = "เว็บไซต์ ai ดูหุ้น ใช้ได้จริงไหม";
  it("คนละคน (anonId ต่าง) คำถามเดียวกัน → seed ต่าง", () => {
    expect(seedForDraw(Q, "userA")).not.toBe(seedForDraw(Q, "userB"));
  });
  it("คนเดิม จั่วซ้ำคำถามเดิม → seed ต่าง (nonce ต่อครั้ง = จั่วใหม่ทุกครั้ง)", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) seen.add(seedForDraw(Q, "userA"));
    expect(seen.size).toBeGreaterThan(1); // ไม่ล็อกซ้ำ
  });
  it("คืน uint32 เสมอ แม้ไม่มีคำถาม/ผู้ใช้", () => {
    const s = seedForDraw(undefined, null);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });
});

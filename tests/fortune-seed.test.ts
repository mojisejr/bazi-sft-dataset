// tests/fortune-seed.test.ts — seedFromQuestion: คำถามเดิม→seed เดิม, คำถามต่าง→seed ต่าง (2026-09-21)
import { describe, expect, it } from "vitest";

import { seedFromQuestion } from "@/lib/bazi/seed";

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

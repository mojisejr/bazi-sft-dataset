// tests/cards-reading-engine.test.ts — engineProse ต้องเป็น 3 ย่อหน้า (ต่อไพ่) เสมอ และไม่ prepend
// "คำถามที่ถาม:" (เดิม prepend ทำให้ FE map ย่อหน้า→ใบเลื่อน 1) — 2026-09-21
import { describe, expect, it } from "vitest";

import { drawRandom as drawOracle, type OracleDraw } from "@/lib/bazi/oracle-cards/deck";
import { buildOracleReading } from "@/lib/bazi/oracle-cards/reading-engine";
import { drawRandom as drawDivine, type DivineDraw } from "@/lib/bazi/divine-cards/deck";
import { buildDivineReading } from "@/lib/bazi/divine-cards/reading-engine";

describe("reading-engine: engineProse 3 ย่อหน้า ไม่ prepend คำถาม", () => {
  it("oracle: มีคำถาม → 3 ย่อหน้า ไม่มี 'คำถามที่ถาม:'", () => {
    const d = drawOracle(3, 1);
    const cards: OracleDraw = [d[0], d[1], d[2]];
    const r = buildOracleReading(cards, "งานที่สมัครไว้จะได้ไหม");
    expect(r.engineProse.split("\n\n").filter(Boolean).length).toBe(3);
    expect(r.engineProse).not.toContain("คำถามที่ถาม:");
  });
  it("divine: มีคำถาม → 3 ย่อหน้า ไม่มี 'คำถามที่ถาม:'", () => {
    const d = drawDivine(3, 1);
    const cards: DivineDraw = [d[0], d[1], d[2]];
    const r = buildDivineReading(cards, "เดือนนี้การเงินเป็นอย่างไร");
    expect(r.engineProse.split("\n\n").filter(Boolean).length).toBe(3);
    expect(r.engineProse).not.toContain("คำถามที่ถาม:");
  });
});

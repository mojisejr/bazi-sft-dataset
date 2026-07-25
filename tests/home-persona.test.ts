// ANCHOR: home-persona-complete — the Home "ธาตุของคุณ" line binds { elementTh, strengthLabel }.
// Both fields must be DERIVED from the day-master state (never hardcoded, never silently dropped),
// and the strength label must be the engine's REAL vocabulary — NOT the Figma copy "แข็งแรง".
// buildHomePersona is pure, so this pins the /api/home persona contract without a DB.
import { describe, expect, test } from "vitest";
import { buildHomePersona } from "@/lib/bazi/home-persona";

const REAL_VOCAB = ["ดิถีอ่อนเกินไป", "ดิถีอ่อน", "ดิถีสมดุล", "ดิถีแข็ง", "ดิถีแข็งเกินไป"];

describe("home-persona (ANCHOR: home-persona-complete)", () => {
  test("complete: dayMaster + strengthScore → BOTH fields populated (no silent omission)", () => {
    const p = buildHomePersona({ dayMaster: "甲", strengthScore: 6.0 });
    for (const k of ["elementTh", "strengthLabel"] as const) {
      expect(p[k], `missing field: ${k}`).toBeTruthy();
    }
    expect(p).toEqual({ elementTh: "ไม้", strengthLabel: "ดิถีแข็ง" });
  });

  test("element: each day-master stem → its Thai element (same vocab as public-calc)", () => {
    expect(buildHomePersona({ dayMaster: "乙", strengthScore: 5 }).elementTh).toBe("ไม้");
    expect(buildHomePersona({ dayMaster: "丙", strengthScore: 5 }).elementTh).toBe("ไฟ");
    expect(buildHomePersona({ dayMaster: "己", strengthScore: 5 }).elementTh).toBe("ดิน");
    expect(buildHomePersona({ dayMaster: "庚", strengthScore: 5 }).elementTh).toBe("ทอง");
    expect(buildHomePersona({ dayMaster: "癸", strengthScore: 5 }).elementTh).toBe("น้ำ");
  });

  test("strength: REAL engine vocab across all 5 bands — NOT mapped to 'แข็งแรง'", () => {
    const s = (score: number) => buildHomePersona({ dayMaster: "甲", strengthScore: score }).strengthLabel;
    expect(s(1.0)).toBe("ดิถีอ่อนเกินไป");
    expect(s(3.0)).toBe("ดิถีอ่อน");
    expect(s(5.0)).toBe("ดิถีสมดุล");
    expect(s(6.0)).toBe("ดิถีแข็ง");
    expect(s(8.0)).toBe("ดิถีแข็งเกินไป");
    // Copy guard: ฟีมเคาะ ground-truth vocab. If someone maps to the Figma word, this fails.
    expect(REAL_VOCAB).not.toContain("แข็งแรง");
  });

  test("NaN score throws → the route guards it to a null persona (never a bad label)", () => {
    expect(() => buildHomePersona({ dayMaster: "甲", strengthScore: NaN })).toThrow();
  });

  test("unmapped symbol → elementTh '' (degrade, never crash)", () => {
    expect(buildHomePersona({ dayMaster: "?", strengthScore: 5 }).elementTh).toBe("");
  });
});

// ANCHOR: home-persona-complete — the Home "ธาตุของคุณ" line binds { elementTh, strengthLabel }.
// Both fields must be DERIVED from the day-master state (never hardcoded, never silently dropped),
// and the strength label must be the engine's REAL vocabulary — NOT the Figma copy "แข็งแรง".
// buildHomePersona is pure, so this pins the /api/home persona contract without a DB.
import { describe, expect, test } from "vitest";
import { buildHomePersona } from "@/lib/bazi/home-persona";
// Import the REAL config (source of truth) — NOT a local copy — so the copy-guard actually tests the
// engine vocabulary (too's find: asserting against an array declared in this test proves nothing).
import { OPERATOR_STRENGTH_CLASS_BANDS } from "@/lib/bazi/constants/operator-strength";

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

  test("strength: buildHomePersona maps each band to its REAL engine label (across all 5)", () => {
    const s = (score: number) => buildHomePersona({ dayMaster: "甲", strengthScore: score }).strengthLabel;
    expect(s(1.0)).toBe("ดิถีอ่อนเกินไป");
    expect(s(3.0)).toBe("ดิถีอ่อน");
    expect(s(5.0)).toBe("ดิถีสมดุล");
    expect(s(6.0)).toBe("ดิถีแข็ง");
    expect(s(8.0)).toBe("ดิถีแข็งเกินไป");
  });

  test("copy guard tests the ENGINE config itself: no band is the Figma word 'แข็งแรง'", () => {
    // Reads operator-strength.ts (source of truth). If someone edits a band's displayLabel to the
    // Figma copy, THIS fails — unlike a local-array assertion. ฟีมเคาะ ground-truth vocab.
    const engineLabels = OPERATOR_STRENGTH_CLASS_BANDS.map((b) => b.displayLabel);
    expect(engineLabels).not.toContain("แข็งแรง");
    // …and every buildHomePersona output is drawn from that real config, never a synthesized string.
    for (const score of [1, 3, 5, 6, 8]) {
      expect(engineLabels).toContain(buildHomePersona({ dayMaster: "甲", strengthScore: score }).strengthLabel);
    }
  });

  test("NaN score throws → the route guards it to a null persona (never a bad label)", () => {
    expect(() => buildHomePersona({ dayMaster: "甲", strengthScore: NaN })).toThrow();
  });

  test("unmapped symbol → elementTh '' (degrade, never crash)", () => {
    expect(buildHomePersona({ dayMaster: "?", strengthScore: 5 }).elementTh).toBe("");
  });
});

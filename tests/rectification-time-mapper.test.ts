// Hour Rectification v2 — time-mapper tests (#hour-rectification-engine, event-based lane, TIER 1).
// A ยาม is a 2-hour window; the mapper reports the MIDPOINT as a readable point + the honest range,
// and widens the range across a boundary only when the top two ยาม are ADJACENT and CLOSE. All maths
// is fixed by the HOUR_BRANCH_MID_TIME table, so these are exact-value assertions.
import { describe, expect, test } from "vitest";

import {
  areAdjacent,
  buildTimeEstimate,
  yamWindow,
} from "@/lib/bazi/hour-rectification/domain/time-mapper";

describe("yamWindow — the 2-hour window (mid ± 60 min) per ยาม", () => {
  test("辰 → 07:00–09:00, midpoint 08:00", () => {
    expect(yamWindow("辰")).toEqual({ start: "07:00", end: "09:00", mid: "08:00" });
  });

  test("卯 → 05:00–07:00, midpoint 06:00", () => {
    expect(yamWindow("卯")).toEqual({ start: "05:00", end: "07:00", mid: "06:00" });
  });

  test("子 wraps midnight → 23:00–01:00, midpoint 00:00", () => {
    expect(yamWindow("子")).toEqual({ start: "23:00", end: "01:00", mid: "00:00" });
  });
});

describe("areAdjacent — cyclic ยาม neighbours", () => {
  test("辰 & 卯 are adjacent (卯 immediately precedes 辰)", () => {
    expect(areAdjacent("辰", "卯")).toBe(true);
    expect(areAdjacent("卯", "辰")).toBe(true);
  });

  test("辰 & 午 are NOT adjacent (巳 sits between them)", () => {
    expect(areAdjacent("辰", "午")).toBe(false);
  });

  test("子 & 亥 wrap-adjacent across midnight", () => {
    expect(areAdjacent("子", "亥")).toBe(true);
  });
});

describe("buildTimeEstimate — point + honest range, widened only on an adjacent near-tie", () => {
  test("clear winner (辰 8, non-adjacent runner 午 3) → 辰's own window, spansAdjacent false", () => {
    const est = buildTimeEstimate([
      { hourBranch: "辰", score: 8 },
      { hourBranch: "午", score: 3 },
    ]);
    expect(est).toEqual({
      hourBranch: "辰",
      point: "08:00",
      rangeStart: "07:00",
      rangeEnd: "09:00",
      spansAdjacent: false,
    });
  });

  test("adjacent but NOT close (辰 8 vs 卯 3, margin 1) → no widening, spansAdjacent false", () => {
    const est = buildTimeEstimate([
      { hourBranch: "辰", score: 8 },
      { hourBranch: "卯", score: 3 },
    ]);
    expect(est?.spansAdjacent).toBe(false);
    expect(est?.rangeStart).toBe("07:00");
    expect(est?.rangeEnd).toBe("09:00");
  });

  test("adjacent near-tie, EARLIER runner (辰 8, 卯 8) → widen back to 卯's mid: 06:00–09:00", () => {
    const est = buildTimeEstimate([
      { hourBranch: "辰", score: 8 },
      { hourBranch: "卯", score: 8 },
    ]);
    expect(est).toEqual({
      hourBranch: "辰", // winner (canonical point) is still 辰
      point: "08:00",
      rangeStart: "06:00", // 卯's midpoint — "late 卯 into 辰"
      rangeEnd: "09:00", // 辰's window end
      spansAdjacent: true,
    });
  });

  test("adjacent near-tie, LATER runner (卯 8, 辰 8) → widen forward to 辰's mid: 05:00–08:00", () => {
    const est = buildTimeEstimate([
      { hourBranch: "卯", score: 8 },
      { hourBranch: "辰", score: 8 },
    ]);
    expect(est).toEqual({
      hourBranch: "卯",
      point: "06:00",
      rangeStart: "05:00", // 卯's window start
      rangeEnd: "08:00", // 辰's midpoint
      spansAdjacent: true,
    });
  });

  test("single candidate → its own window, spansAdjacent false", () => {
    const est = buildTimeEstimate([{ hourBranch: "辰", score: 8 }]);
    expect(est).toEqual({
      hourBranch: "辰",
      point: "08:00",
      rangeStart: "07:00",
      rangeEnd: "09:00",
      spansAdjacent: false,
    });
  });

  test("empty ranked list → null", () => {
    expect(buildTimeEstimate([])).toBeNull();
  });
});

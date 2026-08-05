// B-6/R1 (ตู๋ #19) — lock the 3-mode grade wiring THROUGH THE REAL HANDLER (createManVsDayHandler), not by
// importing enrichMonth directly. The enrich unit tests can't catch "the route stopped CALLING enrich" — the
// mapper still works, just isn't wired. Here we mock the engine + builders (no DB) and let the REAL enrich run,
// so if a mode's enrich call is removed from the route, its grade disappears from the response and this goes RED.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/bazi-math/bazi-engine-adapter", () => ({
  calculateBaziStateFromRawInput: vi.fn(async () => ({
    fourPillars: {
      hour: { stem: "甲", branch: "子" },
      day: { stem: "乙", branch: "丑" },
      month: { stem: "丙", branch: "寅" },
      year: { stem: "丁", branch: "卯" },
    },
  })),
}));
vi.mock("@/lib/bazi/matching.server", () => ({ getMatchingMap: vi.fn(async () => ({})) }));
vi.mock("@/lib/bazi/matching-overlay", () => ({ applyMatchingOverrides: (x: unknown) => x }));
vi.mock("@/lib/bazi/manvsday", () => ({
  // builders return raw days WITHOUT grade — grade must come from the route's enrich* call (the real one).
  buildManVsDay: () => ({ date: "2026-08-05", dayGanzhi: "辛亥", overallPercent: 40.83 }),
  buildManVsDayMonth: () => ({
    year: 2026,
    month: 8,
    days: [
      { date: "2026-08-01", overallPercent: 61.67 },
      { date: "2026-08-02", overallPercent: 88.34 },
      { date: "2026-08-05", overallPercent: null },
    ],
  }),
  buildManVsDayYear: () => ({
    year: 2026,
    months: [{ year: 2026, month: 8, days: [{ date: "2026-08-01", overallPercent: 61.67 }] }],
  }),
}));

import { createManVsDayHandler } from "@/app/api/bazi/man-vs-day/route";

const handler = createManVsDayHandler({ repository: {} as never });
const post = (body: unknown) =>
  handler(
    new Request("http://x/api/bazi/man-vs-day", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const person = { birthDate: "1990-05-15", birthTime: "12:00", gender: "male", province: "Bangkok" };

describe("man-vs-day handler — grade wired in every mode (B-6/R1, real handler)", () => {
  it("รายวัน — response มี grade ระดับบนสุด", async () => {
    const j = await (await post({ person, date: "2026-08-05" })).json();
    expect(j.grade).toBe("C-"); // gradeForPercent(40.83)
    expect(j.dayGanzhi).toBe("辛亥"); // คีย์เดิมยังอยู่
  });
  it("รายเดือน — ทุกวันใน days[] มี grade (route ต้องเรียก enrichMonth)", async () => {
    const j = await (await post({ person, month: "2026-08" })).json();
    expect(j.days.map((d: { grade: string | null }) => d.grade)).toEqual(["B", "A", null]);
    expect(j.days.every((d: object) => "grade" in d)).toBe(true);
  });
  it("รายปี — ทุกวันในทุกเดือน months[].days[] มี grade (route ต้องเรียก enrichYear)", async () => {
    const j = await (await post({ person, year: 2026 })).json();
    const allDays = j.months.flatMap((m: { days: object[] }) => m.days);
    expect(allDays.every((d: object) => "grade" in d)).toBe(true);
    expect(allDays.map((d: { grade: string | null }) => d.grade)).toEqual(["B"]);
  });
});

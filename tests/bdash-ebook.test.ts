// bdash ขาย E-Book (mumate-manychat-ebook-001 slice 4) — the parts that need no database: funnel drop and worst step,
// page shape, and the menu's own range buttons. The SQL runs against Postgres in tests/bdash-ebook-pg.test.ts.
import { describe, expect, it } from "vitest";

import { EBOOK_FROM, shapeEbook, shapeFunnel } from "@/lib/bdash/ebook";
import { EBOOK_DEFAULT, EBOOK_PRESETS, parseRange } from "@/lib/bdash/range";

const today = "2026-11-17";
const ebookRange = (p: Record<string, string>) => parseRange(p, today, { presets: EBOOK_PRESETS, def: EBOOK_DEFAULT });

describe("ebook range buttons", () => {
  it("defaults to 7 days and accepts today, 14 and 28", () => {
    expect(ebookRange({})).toMatchObject({ key: "7", from: "2026-11-11", to: today, note: null });
    expect(ebookRange({ range: "1" })).toMatchObject({ key: "1", from: today, to: today, days: 1 });
    expect(ebookRange({ range: "14" })).toMatchObject({ from: "2026-11-04", days: 14 });
    expect(ebookRange({ range: "28" })).toMatchObject({ days: 28, bucket: "day" });
  });
  it("still reads another menu's 30 or 90 from a link, and falls back to 7 days on a bad value", () => {
    expect(ebookRange({ range: "90" })).toMatchObject({ days: 90, bucket: "week", note: null });
    expect(ebookRange({ range: "5" })).toMatchObject({ key: "7", note: "ช่วงที่เลือกไม่มีในรายการ จึงแสดง 7 วันล่าสุดแทน" });
  });
  it("leaves the other menus as they were", () => {
    expect(parseRange({}, today)).toMatchObject({ key: "30" });
    expect(parseRange({ range: "14" }, today)).toMatchObject({ key: "30", note: "ช่วงที่เลือกไม่มีในรายการ จึงแสดง 30 วันล่าสุดแทน" });
    expect(parseRange({ from: "x", to: "y" }, today).note).toBe("วันที่ที่เลือกอ่านไม่ออก จึงแสดง 30 วันล่าสุดแทน");
  });
});

describe("funnel", () => {
  it("marks the step that loses the most people", () => {
    const f = shapeFunnel([
      { key: "buy", label: "กดสั่งซื้อ", hint: "", people: 140 },
      { key: "slip", label: "ส่งสลิป", hint: "", people: 52 },
      { key: "paid", label: "ธนาคารยืนยัน", hint: "", people: 50 },
      { key: "delivered", label: "ได้ของ", hint: "", people: 50 },
    ]);
    expect(f.map((s) => s.worst)).toEqual([false, true, false, false]);
    expect(f[0].drop).toBeNull();
    expect(f[1].drop).toBeCloseTo(1 - 52 / 140);
    expect(f[3].drop).toBe(0);
  });
  it("does not count a later step above an earlier one as a drop, and marks nothing when nobody drops", () => {
    const f = shapeFunnel([
      { key: "buy", label: "", hint: "", people: 0 },
      { key: "slip", label: "", hint: "", people: 2 },
      { key: "paid", label: "", hint: "", people: 2 },
    ]);
    expect(f.map((s) => s.drop)).toEqual([null, null, 0]);
    expect(f.some((s) => s.worst)).toBe(false);
  });
});

describe("page shape", () => {
  const range = ebookRange({ range: "7" });
  const totals = { buyers: "10", samplers: "4", asked: "6", answered: "3", slip_people: "5", paid_people: "4", delivered_people: "4",
    sold: "4", baht: "380.00", rejected: "1", to_admin: "0" };
  it("fills every day and hour, translates choices, and reads the coupon", () => {
    const c = shapeEbook(range, totals, [{ value: "not_now", people: "2" }, { value: "zzz", people: "1" }], [{ value: "file", people: "3" }],
      [{ day: "2026-11-15", sold: "3", baht: "285", buyers: "6" }], [{ hour: 9, buys: "5", sold: "2" }], { found: "1", redeemed: "2" });
    expect(c).toMatchObject({ sold: 4, baht: 380, buyers: 10, slipPeople: 5, payRate: 0.5, rejected: 1, partial: false });
    expect(c.reasons).toEqual([{ label: "ยังไม่สะดวกโอนตอนนี้", people: 2 }, { label: "zzz", people: 1 }]);
    expect(c.faq).toEqual([{ label: "ไฟล์แบบไหน", people: 3 }]);
    expect(c.days).toHaveLength(7);
    expect(c.days.find((d) => d.day === "2026-11-15")).toEqual({ day: "2026-11-15", sold: 3, baht: 285, buyers: 6 });
    expect(c.hours).toHaveLength(24);
    expect(c.hours[9]).toEqual({ hour: 9, buys: 5, sold: 2, quiet: false });
    expect(c.hours[23].quiet && c.hours[6].quiet && !c.hours[7].quiet).toBe(true);
    expect(c.coupon).toEqual({ sent: 4, redeemed: 2 });
  });
  it("says when the coupon is missing and when the range starts before the bot opened", () => {
    const early = ebookRange({ from: "2026-11-01", to: "2026-11-12" });
    const c = shapeEbook(early, totals, [], [], [], [], { found: "0", redeemed: "0" });
    expect(c.coupon.redeemed).toBeNull();
    expect(early.from < EBOOK_FROM && c.partial).toBe(true);
  });
});

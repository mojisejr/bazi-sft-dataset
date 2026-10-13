// bdash (mumate-business-metrics-001) — the parts that need no database: cohort windows, QI days, AI pricing, KPIs.
import { describe, expect, it } from "vitest";

import { addDays, fillQiDays, priceAi, shapeCohorts, shapePayments } from "@/lib/bdash/shape";
import type { BdashSnapshot } from "@/lib/bdash/types";
import { failureTh, kpis, points, thDate } from "@/lib/bdash/view";
import { priceCall, usdToThb } from "@/lib/llm-usage/pricing";

const row = (week: string, over: Partial<Record<string, unknown>> = {}) => ({
  week,
  signups: "10",
  d1: "4",
  d7: "2",
  d30: "1",
  paid35: "1",
  median_days: "3",
  ...over,
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-09-28", 6)).toBe("2026-10-04");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("shapeCohorts", () => {
  it("shows a window only once the week's last signup day has passed all of it", () => {
    // week of Mon 2026-09-14: last signup 09-20 → day-1 by 09-21, week 2 by 10-03, month by 10-26, paid35 by 10-25
    const [c] = shapeCohorts([row("2026-09-14")], "2026-10-03");
    expect(c).toMatchObject({ signups: 10, d1: 4, d7: 2, d30: null, paid35: 1, paid35Complete: false, medianDaysToPay: 3 });
    const [early] = shapeCohorts([row("2026-09-14")], "2026-10-02");
    expect(early.d7).toBeNull();
    const [late] = shapeCohorts([row("2026-09-14")], "2026-10-26");
    expect(late).toMatchObject({ d30: 1, paid35Complete: true });
  });

  it("leaves the current week's day-1 empty until the day after its Sunday", () => {
    const [c] = shapeCohorts([row("2026-10-12")], "2026-10-12");
    expect(c.d1).toBeNull();
  });

  it("has no median when nobody paid", () => {
    const [c] = shapeCohorts([row("2026-09-14", { paid35: "0", median_days: null })], "2026-10-30");
    expect(c.medianDaysToPay).toBeNull();
  });
});

describe("shapePayments", () => {
  it("turns counts into numbers and orders by how often people pressed pay", () => {
    const out = shapePayments([
      { method: "card", gateway: "omise", created: "2", approved: "1", rejected: "1", expired: "0", waiting: "0", top_failure: "payment_rejected" },
      { method: "promptpay", gateway: "beam", created: "9", approved: "6", rejected: "0", expired: "3", waiting: "0", top_failure: "gateway_expired" },
    ]);
    expect(out.map((p) => p.created)).toEqual([9, 2]);
    expect(out[0]).toMatchObject({ method: "promptpay", approved: 6, expired: 3, topFailure: "gateway_expired" });
  });
});

describe("fillQiDays", () => {
  it("returns every day up to as_of, zeros where nothing happened", () => {
    const days = fillQiDays([{ day: "2026-10-12", buy: "5", missions: "20", daily: 0, referral: 0, team: "-100", other: 0, spend: "7" }], "2026-10-12", 3);
    expect(days.map((d) => d.day)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(days[0]).toMatchObject({ buy: 0, missions: 0, spend: 0 });
    expect(days[2]).toMatchObject({ buy: 5, missions: 20, team: -100, spend: 7 });
  });
});

describe("priceAi", () => {
  it("prices each model with bazi's own table and adds a feature's models together", () => {
    const rows = [
      { feature: "แชต", provider: "gemini", model: "gemini-3.1-flash-lite", calls: "10", tin: "1000000", tout: "100000" },
      { feature: "แชต", provider: "gemini", model: "gemini-2.5-flash-lite", calls: "5", tin: "0", tout: "0" },
      { feature: "ไพ่เทวะ", provider: "gemini", model: "gemini-3.1-flash-lite", calls: "0", tin: "0", tout: "0" },
    ];
    const { features, totalThb } = priceAi(rows);
    const expected = usdToThb(priceCall({ provider: "gemini", model: "gemini-3.1-flash-lite", inTokens: 1_000_000, outTokens: 100_000 }));
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ feature: "แชต", calls: 15, tokens: 1_100_000 });
    expect(features[0].thb).toBeCloseTo(expected, 2);
    expect(totalThb).toBeCloseTo(expected, 2);
  });
});

const snap = (over: Partial<BdashSnapshot> = {}): BdashSnapshot => ({
  version: 1,
  asOf: "2026-10-12",
  retentionFrom: "2026-09-14",
  cohorts: [
    { week: "2026-09-14", signups: 50, d1: 10, d7: 5, d30: null, paid35: 1, paid35Complete: false, medianDaysToPay: 2 },
    { week: "2026-09-21", signups: 100, d1: 20, d7: 8, d30: null, paid35: 3, paid35Complete: false, medianDaysToPay: 1 },
    { week: "2026-09-28", signups: 200, d1: 30, d7: null, d30: null, paid35: 4, paid35Complete: false, medianDaysToPay: 0 },
  ],
  payments: [
    { method: "promptpay", gateway: "beam", created: 8, approved: 6, rejected: 0, expired: 2, waiting: 0, topFailure: "gateway_expired" },
    { method: "card", gateway: "beam", created: 2, approved: 0, rejected: 2, expired: 0, waiting: 0, topFailure: "payment_rejected" },
  ],
  qiDaily: [],
  qiBalance: { holders: 0, median: 0, p90: 0 },
  ai: { features: [], totalThb: 60, activeMembers: 300 },
  ...over,
});

describe("kpis", () => {
  it("takes week 2 from the newest cohort that has it and compares with the one before", () => {
    const k = kpis(snap());
    expect(k.d7Week).toBe("2026-09-21");
    expect(k.d7Latest).toBeCloseTo(0.08);
    expect(k.d7Delta).toBeCloseTo(-0.02);
    expect(k.paySuccess).toBeCloseTo(0.6);
    expect(k.expiredShare).toBeCloseTo(0.2);
    expect(k.aiPerActive).toBeCloseTo(0.2);
  });

  it("has no free-to-paid figure until a cohort completes 35 days, and says when the first one will", () => {
    const k = kpis(snap());
    expect(k.conv35).toBeNull();
    expect(k.conv35FirstReady).toBe("2026-10-25");
    const done = kpis(snap({ cohorts: [{ week: "2026-09-14", signups: 50, d1: 10, d7: 5, d30: 2, paid35: 2, paid35Complete: true, medianDaysToPay: 2 }] }));
    expect(done.conv35).toBeCloseTo(0.04);
    expect(done.conv35FirstReady).toBeNull();
  });

  it("is empty, not NaN, with no payments or active members", () => {
    const k = kpis(snap({ payments: [], ai: { features: [], totalThb: 0, activeMembers: 0 }, cohorts: [] }));
    expect(k).toMatchObject({ paySuccess: null, expiredShare: null, aiPerActive: null, d7Latest: null, conv35FirstReady: null });
  });
});

describe("Thai wording", () => {
  it("formats dates, failure reasons and point changes", () => {
    expect(thDate("2026-10-12")).toBe("12 ต.ค.");
    expect(thDate("2026-01-03")).toBe("3 ม.ค.");
    expect(failureTh("gateway_expired")).toBe("QR/ลิงก์หมดเวลา");
    expect(failureTh("payment_rejected")).toBe("ธนาคาร/บัตรปฏิเสธ");
    expect(failureTh("card_declined_x")).toBe("card_declined_x");
    expect(points(0.023)).toBe("+2.3 จุด");
    expect(points(-0.01)).toBe("−1.0 จุด");
  });
});

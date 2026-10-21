// mumate-bdash-v2-001 slice 2: the range bar, card C's counts and chart series, and the guards on live reads.
// No database: SQL rows are given as the driver would return them.
import { describe, expect, it, vi } from "vitest";

import { labelIndexes } from "@/app/bdash/_ui/charts";
import { cohortsIn } from "@/app/bdash/stay/page";
import { PEOPLE_FROM, peopleQueryFrom, RULE_CHANGES, shapeFeatureCard, type AiBucketRow, type PeopleRow, type PeopleTotalRow } from "@/lib/bdash/features";
import { CACHE_MS, cached, clearBdashCache, RangeTooHeavyError } from "@/lib/bdash/live";
import { bucketEnd, buckets, parseRange, weekOf, withRange } from "@/lib/bdash/range";
import { shapeCohorts } from "@/lib/bdash/shape";
import { paymentToWatch, qiByWeek, thRange } from "@/lib/bdash/view";

const TODAY = "2026-10-21";

describe("parseRange", () => {
  it("defaults to the last 30 days, today included", () => {
    expect(parseRange({}, TODAY)).toMatchObject({ key: "30", from: "2026-09-22", to: TODAY, days: 30, bucket: "day", query: "range=30", note: null });
  });

  it("reads the presets, and 90 days is weekly", () => {
    expect(parseRange({ range: "7" }, TODAY)).toMatchObject({ from: "2026-10-15", days: 7, bucket: "day" });
    expect(parseRange({ range: "90" }, TODAY)).toMatchObject({ from: "2026-07-24", days: 90, bucket: "week", query: "range=90" });
  });

  it("reads a custom range and keeps it in the link", () => {
    const r = parseRange({ from: "2026-10-01", to: "2026-10-10" }, TODAY);
    expect(r).toMatchObject({ key: "custom", from: "2026-10-01", to: "2026-10-10", days: 10, bucket: "day", query: "from=2026-10-01&to=2026-10-10" });
    expect(withRange("/bdash/money", r)).toBe("/bdash/money?from=2026-10-01&to=2026-10-10");
  });

  it("swaps a reversed range, stops at today and at the first payment day", () => {
    expect(parseRange({ from: "2026-10-10", to: "2026-10-01" }, TODAY)).toMatchObject({ from: "2026-10-01", to: "2026-10-10" });
    expect(parseRange({ from: "2026-10-10", to: "2027-01-01" }, TODAY)).toMatchObject({ from: "2026-10-10", to: TODAY });
    expect(parseRange({ from: "2026-01-01", to: "2026-09-01" }, TODAY)).toMatchObject({ from: "2026-08-25", to: "2026-09-01", bucket: "day" });
  });

  it("falls back to 30 days, and says so, for anything it cannot use", () => {
    for (const p of [{ range: "45" }, { from: "2026-02-30", to: "2026-03-01" }, { from: "x", to: TODAY }, { from: TODAY }]) {
      const r = parseRange(p, TODAY);
      expect(r).toMatchObject({ key: "30", days: 30 });
      expect(r.note).toBeTruthy();
    }
  });

  it("refuses a custom range longer than a year", () => {
    expect(parseRange({ from: "2026-08-25", to: "2027-09-01" }, "2027-09-01")).toMatchObject({ key: "30" });
  });
});

describe("buckets", () => {
  it("has one slot per day, or one per Monday week", () => {
    expect(buckets({ from: "2026-10-19", to: "2026-10-21", bucket: "day" })).toEqual(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(weekOf("2026-10-21")).toBe("2026-10-19");
    expect(weekOf("2026-10-19")).toBe("2026-10-19");
    expect(weekOf("2026-10-25")).toBe("2026-10-19");
    expect(buckets({ from: "2026-10-01", to: "2026-10-21", bucket: "week" })).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(bucketEnd("2026-10-19", { to: TODAY, bucket: "week" })).toBe(TODAY);
  });

  it("reads people far enough back to smooth the first slot over 4 weeks", () => {
    expect(peopleQueryFrom({ from: "2026-10-15", bucket: "day" })).toBe("2026-09-18");
    expect(peopleQueryFrom({ from: "2026-10-01", bucket: "week" })).toBe("2026-09-07");
  });
});

const ai = (feature: string, bucket: string, over: Partial<AiBucketRow> = {}): AiBucketRow => ({
  feature,
  bucket,
  provider: "gemini",
  model: "gemini-2.5-flash",
  calls: "2",
  uses: "1",
  tin: "1000",
  tout: "500",
  ...over,
});
const person = (feature: string, bucket: string, uid: string, first_paid: string | null = null, n = "1"): PeopleRow => ({ feature, bucket, uid, n, first_paid });

describe("shapeFeatureCard", () => {
  const range = parseRange({ range: "7" }, TODAY); // 2026-10-15 .. 2026-10-21

  it("one row per feature: people, uses per person, paid share and cost; untracked features show no people", () => {
    const totals: PeopleTotalRow[] = [
      { feature: "แชต", people: "2", n: "6", paid: "1" },
      { feature: "ไพ่ออราเคิล", people: "1", n: "1", paid: "0" },
    ];
    const card = shapeFeatureCard(range, [ai("แชต", "2026-10-21", { uses: "6" }), ai("ไพ่ออราเคิล", "2026-10-21"), ai("What-if", "2026-10-20", { uses: "3" })], [], totals);
    const by = Object.fromEntries(card.rows.map((r) => [r.feature, r]));
    expect(by["แชต"]).toMatchObject({ people: 2, uses: 6, usesPerPerson: 3, paidShare: 0.5, tracked: true });
    expect(by["แชต"].rule).toMatch(/QI ต่อคำถาม/);
    expect(by["ไพ่ออราเคิล"]).toMatchObject({ people: 1, paidShare: 0, rule: expect.stringMatching(/โควตาไพ่ร่วม/) });
    expect(by["What-if"]).toMatchObject({ people: null, paidShare: null, usesPerPerson: null, tracked: false, uses: 3 });
    expect(card.rows.map((r) => r.feature)).toEqual(["แชต", "ไพ่ออราเคิล", "What-if"]);
    expect(card.totalThb).toBeCloseTo(by["แชต"].thb * 3, 1);
  });

  it("a tracked feature with cost but nobody named yet shows 0 people", () => {
    const card = shapeFeatureCard(range, [ai("เซียมซี", "2026-10-16")], [], []);
    expect(card.rows[0]).toMatchObject({ feature: "เซียมซี", people: 0, paidShare: null });
  });

  it("series: people per day, cost per day, and paid share smoothed over the 4 weeks before each day", () => {
    const people = [
      person("แชต", "2026-09-30", "a", "2026-09-01"), // inside the 28-day window of 10-15..10-27, paid long ago
      person("แชต", "2026-10-15", "b", "2026-10-20"), // pays on 10-20
      person("แชต", "2026-10-21", "c"),
    ];
    const card = shapeFeatureCard(range, [ai("แชต", "2026-10-21")], people, [{ feature: "แชต", people: "2", n: "2", paid: "1" }]);
    const s = card.series[0];
    expect(card.buckets).toHaveLength(7);
    expect(s.people).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(s.thb.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(s.thb[6]).toBeGreaterThan(0);
    expect(s.paidShare[0]).toBe(0.5); // a (paid) + b (not yet)
    expect(s.paidShare[5]).toBe(1); // 10-20: b has paid
    expect(s.paidShare[6]).toBeCloseTo(2 / 3); // + c
  });

  it("charts at most 4 features, the most used first", () => {
    const names = ["แชต", "ไพ่ออราเคิล", "ไพ่เทวะ", "เซียมซี", "ทำนายเบอร์"];
    const totals = names.map((feature, i) => ({ feature, people: String(10 - i), n: "10", paid: "0" }));
    const card = shapeFeatureCard(range, [], [], totals);
    expect(card.series.map((s) => s.feature)).toEqual(names.slice(0, 4));
  });

  it("marks rule changes inside the range and says when people counts start", () => {
    expect(shapeFeatureCard(range, [], [], []).markers).toEqual(RULE_CHANGES.filter((m) => m.day >= "2026-10-15"));
    expect(shapeFeatureCard(range, [], [], []).peoplePartial).toBe(true);
    expect(shapeFeatureCard(parseRange({ from: PEOPLE_FROM, to: TODAY }, TODAY), [], [], []).peoplePartial).toBe(false);
  });
});

describe("cached live reads", () => {
  const range = parseRange({ range: "30" }, TODAY);
  // stands in for the read-only transaction: returns a fixed value instead of running the page's queries
  const ok = (value: unknown) => vi.fn(async () => value as never);

  it("serves the same page and range from memory for 10 minutes", async () => {
    clearBdashCache();
    let now = 1_000;
    const run = ok("first");
    const a = await cached("money", range, async () => "x", { run, now: () => now });
    now += CACHE_MS - 1;
    const b = await cached("money", range, async () => "x", { run, now: () => now });
    now += 2;
    await cached("money", range, async () => "x", { run, now: () => now });
    expect(a.value).toBe("first");
    expect(b.at).toBe(a.at);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("turns a statement timeout into 'range too heavy' and does not keep the failure", async () => {
    clearBdashCache();
    const run = vi.fn(async () => {
      throw Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
    });
    await expect(cached("stay", range, async () => 1, { run })).rejects.toBeInstanceOf(RangeTooHeavyError);
    await expect(cached("stay", range, async () => 1, { run })).rejects.toBeInstanceOf(RangeTooHeavyError);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("passes other errors through", async () => {
    clearBdashCache();
    const run = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(cached("stay", range, async () => 1, { run })).rejects.toThrow("boom");
  });
});

describe("views", () => {
  it("writes the range in Thai with the Buddhist year", () => {
    expect(thRange("2026-09-22", "2026-10-21")).toBe("22 ก.ย. – 21 ต.ค. 2569");
    expect(thRange("2026-12-30", "2027-01-02")).toBe("30 ธ.ค. 2569 – 2 ม.ค. 2570");
  });

  it("names the payment method to watch: at least 5 tries, under 70% success, its main failure", () => {
    const p = (method: string, created: number, approved: number, expired: number, rejected = 0) => ({
      method,
      gateway: "beam",
      created,
      approved,
      expired,
      rejected,
      waiting: created - approved - expired - rejected,
      topFailure: null,
    });
    expect(paymentToWatch([p("promptpay", 58, 45, 0), p("card", 18, 5, 13)])).toEqual({ method: "บัตรเครดิต/เดบิต", reason: "expired", n: 13, created: 18 });
    expect(paymentToWatch([p("card", 4, 0, 4)])).toBeNull();
    expect(paymentToWatch([p("card", 10, 9, 1)])).toBeNull();
  });

  it("sums QI days into Monday weeks", () => {
    const d = (day: string, spend: number) => ({ day, buy: 0, missions: 1, daily: 0, referral: 0, team: 0, other: 0, spend });
    expect(qiByWeek([d("2026-10-18", 1), d("2026-10-19", 2), d("2026-10-21", 3)]).map((w) => [w.day, w.spend, w.missions])).toEqual([
      ["2026-10-12", 1, 1],
      ["2026-10-19", 5, 2],
    ]);
  });

  it("spaces axis labels and always labels the last slot", () => {
    expect(labelIndexes(3, 6)).toEqual([0, 1, 2]);
    expect(labelIndexes(30, 4).at(-1)).toBe(29);
    expect(labelIndexes(30, 4).length).toBeLessThanOrEqual(4);
  });

  it("shows signup weeks inside the range, newest first, at most 12", () => {
    const rows = Array.from({ length: 17 }, (_, i) => ({ week: buckets({ from: "2026-06-29", to: "2026-10-19", bucket: "week" })[i], signups: "5", d1: "1", d7: "1", d30: "0", paid35: "0", median_days: null }));
    const cohorts = shapeCohorts(rows, TODAY);
    const all = cohortsIn(cohorts, { from: "2026-06-29", to: TODAY });
    expect(all).toHaveLength(12);
    expect(all[0].week).toBe("2026-10-19");
    expect(cohortsIn(cohorts, parseRange({ range: "7" }, TODAY)).map((c) => c.week)).toEqual(["2026-10-19", "2026-10-12"]);
  });
});

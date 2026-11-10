/**
 * bdash ขาย E-Book against a real Postgres (mumate-manychat-ebook-001 slice 4). BDASH_TEST_DATABASE_URL must name a
 * disposable database: this file creates and fills its own tables there. APP_DATABASE_URL is never used.
 * Proves: counts equal what the rows say (people counted once, Bangkok days and hours, paid time from the slip),
 * development rows and rows outside the range are left out, and no subscriber id reaches the page data.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { clearBdashCache, dbRunner, loadEbook } from "@/lib/bdash/live";
import { EBOOK_DEFAULT, EBOOK_PRESETS, parseRange } from "@/lib/bdash/range";

const url = process.env.BDASH_TEST_DATABASE_URL;
const required = process.env.BDASH_REQUIRE_DB === "1";
if (required && !url) throw new Error("BDASH_TEST_DATABASE_URL is required for test:bdash-db");

const range = parseRange({ from: "2026-11-11", to: "2026-11-12" }, "2026-11-12", { presets: EBOOK_PRESETS, def: EBOOK_DEFAULT });
const quiet = () => {};
const run = () => dbRunner({ url, log: quiet });
const at = (bkk: string) => `${bkk}+07:00`;
const IDS = ["9000000001", "9000000002", "9000000003", "9000000004", "9000000099"];

describe.skipIf(!url)("bdash ebook reads on Postgres", () => {
  const db = url ? postgres(url, { ssl: "require", max: 1, onnotice: () => {} }) : null!;

  beforeAll(async () => {
    await db.unsafe(`
      DROP TABLE IF EXISTS ebook_funnel_event, ebook_order, activity_coupon_redemption, activity_coupon;
      CREATE TABLE ebook_funnel_event (id bigserial PRIMARY KEY, at timestamptz NOT NULL, env text NOT NULL, subscriber_id text NOT NULL, step text NOT NULL, value text);
      CREATE TABLE ebook_order (id bigserial PRIMARY KEY, created_at timestamptz NOT NULL, env text NOT NULL, subscriber_id text NOT NULL, status text NOT NULL,
        amount numeric(12,2), slip_at timestamptz, delivered_at timestamptz);
      CREATE TABLE activity_coupon (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL);
      CREATE TABLE activity_coupon_redemption (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid NOT NULL REFERENCES activity_coupon(id), anon_id text NOT NULL, redeemed_at timestamptz NOT NULL);`);
    const [a, b, c, d, dev] = IDS;
    const events = [
      [a, "buy", null, "2026-11-11 09:10"], [a, "buy", null, "2026-11-11 09:40"], // same person twice: one buyer, two presses
      [b, "buy", null, "2026-11-11 23:30"], [b, "reason_asked", null, "2026-11-12 00:00"], [b, "reason", "not_now", "2026-11-12 00:01"],
      [c, "buy", null, "2026-11-12 10:00"], [c, "sample", null, "2026-11-12 09:55"], [c, "faq", "menu", "2026-11-12 09:56"], [c, "faq", "file", "2026-11-12 09:57"],
      [d, "buy", null, "2026-11-10 23:59"], // the day before the range
      [dev, "buy", null, "2026-11-11 12:00"], // development row
    ] as const;
    for (const [s, step, value, when] of events) {
      const env = s === dev ? "development" : "production";
      await db`INSERT INTO ebook_funnel_event (at, env, subscriber_id, step, value) VALUES (${at(when)}, ${env}, ${s}, ${step}, ${value})`;
    }
    const orders = [
      // a paid: slip time is 10:05 on the 11th though the bot got it at 10:20
      [a, "paid", 95, "2026-11-11 10:20", "2026-11-11 10:05", "2026-11-11 10:21"],
      [b, "rejected", null, "2026-11-12 08:00", null, null],
      [b, "paid", 95, "2026-11-12 08:30", null, null], // paid, delivery failed: counted as sold, not delivered
      [c, "paid", 95, "2026-11-13 00:10", "2026-11-13 00:05", "2026-11-13 00:11"], // after the range
    ] as const;
    for (const [s, status, amount, created, slip, delivered] of orders) {
      await db`INSERT INTO ebook_order (created_at, env, subscriber_id, status, amount, slip_at, delivered_at)
               VALUES (${at(created)}, 'production', ${s}, ${status}, ${amount}, ${slip ? at(slip) : null}, ${delivered ? at(delivered) : null})`;
    }
    const [coupon] = await db`INSERT INTO activity_coupon (code) VALUES ('EBOOKPULS95') RETURNING id`;
    await db`INSERT INTO activity_coupon_redemption (coupon_id, anon_id, redeemed_at) VALUES (${coupon.id}, 'm1', ${at("2026-11-11 11:00")}), (${coupon.id}, 'm2', ${at("2026-11-14 11:00")})`;
  });

  afterAll(async () => {
    await db?.end();
  });

  test("counts people once, by Bangkok day and slip time, without development rows", async () => {
    clearBdashCache();
    const { value: c } = await loadEbook(range, { run: run() });
    expect(c).toMatchObject({ buyers: 3, samplers: 1, asked: 1, answered: 1, slipPeople: 2, paidPeople: 2, sold: 2, baht: 190, rejected: 1, toAdmin: 0 });
    expect(c.funnel.map((s) => s.people)).toEqual([3, 2, 2, 1]);
    expect(c.reasons).toEqual([{ label: "ยังไม่สะดวกโอนตอนนี้", people: 1 }]);
    expect(c.faq).toEqual([{ label: "ไฟล์แบบไหน", people: 1 }]);
    expect(c.days).toEqual([
      { day: "2026-11-11", sold: 1, baht: 95, buyers: 2 },
      { day: "2026-11-12", sold: 1, baht: 95, buyers: 1 },
    ]);
    expect(c.hours[9]).toMatchObject({ buys: 2, sold: 0 });
    expect(c.hours[10]).toMatchObject({ buys: 1, sold: 1 });
    expect(c.hours[8]).toMatchObject({ sold: 1 });
    expect(c.hours[23]).toMatchObject({ buys: 1, quiet: true });
    expect(c.coupon).toEqual({ sent: 1, redeemed: 1 });
  });

  test("no subscriber id reaches the page data", async () => {
    clearBdashCache();
    const json = JSON.stringify((await loadEbook(range, { run: run() })).value);
    for (const id of IDS) expect(json).not.toContain(id);
  });
});

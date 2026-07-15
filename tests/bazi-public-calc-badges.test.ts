// Badge signal-gating tests (#calculator-badge-mood-FROZEN-v1) — real shapes captured live
// 2026-07-15, not fabricated. Signal rule: role in {wealth, power} AND (qi in RISING_QI OR
// clash with day branch). same/resource/output never badge; ดิถี (day pillar) never badges.
import { describe, expect, test } from "vitest";
import { createPublicCalcHandler } from "@/app/api/bazi/public-calc/route";

type Badge = { point: string; role: "wealth" | "power"; element: string; qi: string; clash: boolean };
type PublicCalcBody = { badges: Badge[] };

function createRequest(body: unknown) {
  return new Request("http://localhost/api/bazi/public-calc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("public-calc badges", () => {
  test("real chart (1978-03-08) produces both a clash-driven and a rising-qi-driven pillar badge", async () => {
    const POST = createPublicCalcHandler();
    const res = await POST(
      createRequest({ birthDate: "1978-03-08", birthTime: "05:12", gender: "male", province: "x" }),
    );
    const body = (await res.json()) as PublicCalcBody;

    expect(Array.isArray(body.badges)).toBe(true);
    const ascendant = body.badges.find((b: Badge) => b.point === "pillar-ascendant");
    expect(ascendant).toMatchObject({ role: "wealth", clash: true });

    const month = body.badges.find((b: Badge) => b.point === "pillar-month");
    expect(month).toMatchObject({ role: "power", clash: false });
    expect(month?.qi).toBeTruthy();
  }, 30000);

  test("ดิถี (pillar-day) is never a badge point, across multiple real charts", async () => {
    const POST = createPublicCalcHandler();
    const samples = [
      { birthDate: "1990-05-15", birthTime: "08:30", gender: "male", province: "x" },
      { birthDate: "1985-11-02", birthTime: "23:45", gender: "female", province: "x" },
      { birthDate: "1978-03-08", birthTime: "05:12", gender: "male", province: "x" },
      { birthDate: "1966-09-19", birthTime: "16:40", gender: "female", province: "x" },
    ];
    for (const sample of samples) {
      const res = await POST(createRequest(sample));
      const body = (await res.json()) as PublicCalcBody;
      expect(body.badges.some((b: Badge) => b.point === "pillar-day")).toBe(false);
    }
  }, 30000);

  test("every badge role is wealth or power only — same/resource/output never appear", async () => {
    const POST = createPublicCalcHandler();
    const samples = [
      { birthDate: "1990-05-15", birthTime: "08:30", gender: "male", province: "x" },
      { birthDate: "1978-03-08", birthTime: "05:12", gender: "male", province: "x" },
      { birthDate: "1966-09-19", birthTime: "16:40", gender: "female", province: "x" },
      { birthDate: "1993-12-25", birthTime: "03:03", gender: "male", province: "x" },
    ];
    for (const sample of samples) {
      const res = await POST(createRequest(sample));
      const body = (await res.json()) as PublicCalcBody;
      for (const b of body.badges) {
        expect(["wealth", "power"]).toContain(b.role);
      }
    }
  }, 30000);

  test("decade badge point ids are 0-indexed and bounded (9 decades max, 18 phase rows)", async () => {
    const POST = createPublicCalcHandler();
    const res = await POST(
      createRequest({ birthDate: "1990-05-15", birthTime: "08:30", gender: "male", province: "x" }),
    );
    const body = (await res.json()) as PublicCalcBody;
    const decadeBadges = body.badges.filter((b: Badge) => b.point.startsWith("decade-"));
    for (const b of decadeBadges) {
      const idx = Number(b.point.replace("decade-", ""));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(9);
    }
  }, 30000);

  test("annual badge point id uses age (not calendar year) — matches mootech-fe's matching key", async () => {
    const POST = createPublicCalcHandler();
    const res = await POST(
      createRequest({ birthDate: "1985-11-02", birthTime: "23:45", gender: "female", province: "x" }),
    );
    const body = (await res.json()) as PublicCalcBody;
    const annualBadges = body.badges.filter((b: Badge) => b.point.startsWith("annual-"));
    expect(annualBadges.length).toBeGreaterThan(0);
    for (const b of annualBadges) {
      const age = Number(b.point.replace("annual-", ""));
      expect(age).toBeGreaterThan(0);
      expect(age).toBeLessThan(120);
    }
  }, 30000);

  test("no raw TOPIC_PATH/lens/chapter fields ever leak into the badge response", async () => {
    const POST = createPublicCalcHandler();
    const res = await POST(
      createRequest({ birthDate: "1990-05-15", birthTime: "08:30", gender: "male", province: "x" }),
    );
    const raw = await res.text();
    expect(raw).not.toMatch(/lens/i);
    expect(raw).not.toMatch(/chapter/i);
    expect(raw).not.toMatch(/topic_path|topicPath/i);
    expect(raw).not.toMatch(/stepNumber/i);
  }, 30000);
});

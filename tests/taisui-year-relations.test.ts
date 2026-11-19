import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "@/app/api/taisui/route";
import {
  branchRelations,
  elementFlow,
  pairRelation,
  strongestRelation,
  yearFacts,
} from "@/features/taisui/year-relations";

// Synthetic births only. Year pillars switch at 立春 (Lichun), not on 1 January.
const male = (birthDate: string, birthTime: string | null = "08:30") => ({ birthDate, birthTime, gender: "male" as const });

describe("relations with the Goat year 未", () => {
  test("each branch's strongest relation follows the classical tables", () => {
    const expected: Record<string, string> = {
      未: "same",
      丑: "clash",
      戌: "punish",
      子: "harm",
      午: "six",
      卯: "half3",
      巳: "season",
      // 亥未 is a bare 生+墓 pair, a weak 拱 that the engine's branchHalfSanHe does not count.
      亥: "none",
      寅: "none",
      辰: "none",
      申: "none",
      酉: "none",
    };
    for (const [branch, kind] of Object.entries(expected)) expect([branch, strongestRelation(branch, "未")]).toEqual([branch, kind]);
  });

  test("every classical name that applies is kept", () => {
    expect(branchRelations("丑", "未").map(([, n]) => n)).toEqual(["冲", "刑"]);
    expect(branchRelations("戌", "未").map(([, n]) => n)).toEqual(["刑", "破"]);
    expect(branchRelations("午", "未").map(([, n]) => n)).toEqual(["六合", "三會"]);
    expect(branchRelations("未", "未").map(([, n]) => n)).toEqual(["伏吟"]);
  });

  test("the year's fire against each element", () => {
    expect(elementFlow("fire", "fire")).toBe("same");
    expect(elementFlow("fire", "earth")).toBe("feeds");
    expect(elementFlow("fire", "metal")).toBe("controls");
    expect(elementFlow("fire", "wood")).toBe("fed-by");
    expect(elementFlow("fire", "water")).toBe("controlled-by");
  });

  test("the red-packet pair uses the same ranking", () => {
    expect(pairRelation("午", "未")).toBe("six");
    expect(pairRelation("子", "午")).toBe("clash");
  });
});

describe("yearFacts for 2027", () => {
  test("the year is 丁未, fire, starting at Lichun on 4 February 2027", () => {
    const f = yearFacts(male("1990-03-15"));
    expect(f.year).toMatchObject({ gregorian: 2027, stem: "丁", branch: "未", element: "fire" });
    expect(f.year.lichun.startsWith("2027-02-04")).toBe(true);
  });

  test("a 1990 Horse born in March: year 午 six-combines, month 卯 is half three-harmony", () => {
    const f = yearFacts(male("1990-03-15"));
    expect(f.pillars.map((p) => p.key)).toEqual(["hour", "day", "month", "year"]);
    const year = f.pillars.find((p) => p.key === "year")!;
    const month = f.pillars.find((p) => p.key === "month")!;
    expect([year.stem, year.branch, year.relation]).toEqual(["庚", "午", "six"]);
    expect(year.flow).toBe("controls"); // fire controls metal 庚
    expect([month.branch, month.relation]).toEqual(["卯", "half3"]);
    expect(f.mine).toContain("午");
  });

  test("the year animal switches at Lichun, not on 1 January", () => {
    const before = yearFacts(male("1991-02-03")).pillars.find((p) => p.key === "year")!;
    const after = yearFacts(male("1991-02-05")).pillars.find((p) => p.key === "year")!;
    expect(before.branch).toBe("午");
    expect(after.branch).toBe("未");
    expect(after.relation).toBe("same");
  });

  test("an Ox clashes, a Dog is punished, a Rat is harmed", () => {
    const y = (d: string) => yearFacts(male(d)).pillars.find((p) => p.key === "year")!;
    expect([y("1985-06-01").branch, y("1985-06-01").relation]).toEqual(["丑", "clash"]);
    expect([y("1982-07-01").branch, y("1982-07-01").relation]).toEqual(["戌", "punish"]);
    expect([y("1984-05-01").branch, y("1984-05-01").relation]).toEqual(["子", "harm"]);
  });

  test("an unknown birth time gives three pillars and no hour", () => {
    const f = yearFacts(male("1990-03-15", null));
    expect(f.chart.hasHour).toBe(false);
    expect(f.pillars.map((p) => p.key)).toEqual(["day", "month", "year"]);
  });

  test("twelve months from 寅 at Lichun to 丑 in January 2028; 丑 is the care month", () => {
    const f = yearFacts(male("1990-03-15"));
    expect(f.months.map((m) => m.branch).join("")).toBe("寅卯辰巳午未申酉戌亥子丑");
    expect(f.months[0].startsAt.startsWith("2027-02-04")).toBe(true);
    expect(f.months[11].startsAt.startsWith("2028-01")).toBe(true);
    expect(f.months[11].state).toBe("care");
    for (let i = 1; i < 12; i++) expect(f.months[i].startsAt > f.months[i - 1].startsAt).toBe(true);
  });

  test("a chart holding 卯 peaks in the 亥 month, which completes 亥卯未", () => {
    const f = yearFacts(male("1990-03-15"));
    const hai = f.months.find((m) => m.branch === "亥")!;
    expect(hai.state).toBe("peak");
    expect(hai.because).toContain("三合:亥卯未");
  });
});

describe("POST /api/taisui", () => {
  const secret = "taisui-test-client-only";
  const req = (body: unknown, withSecret = true) =>
    new Request("http://localhost/api/taisui", {
      method: "POST",
      headers: { "content-type": "application/json", ...(withSecret ? { "x-mumate-client-secret": secret } : {}) },
      body: JSON.stringify(body),
    });
  beforeEach(() => {
    vi.stubEnv("BAZI_CLIENT_ID_SECRET", secret);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("refuses a caller without the client secret", async () => {
    expect((await POST(req({ birth: male("1990-03-15") }, false))).status).toBe(403);
  });

  test("refuses malformed input", async () => {
    expect((await POST(req({ birth: { birthDate: "15/03/1990", birthTime: null, gender: "male" } }))).status).toBe(400);
    expect((await POST(req({ birth: male("1990-03-15", "25:00") }))).status).toBe(400);
  });

  test("returns the facts, and the sender's year animal against the receiver's", async () => {
    const res = await POST(req({ birth: male("1990-03-15"), partner: male("1991-06-01", null) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year.branch).toBe("未");
    expect(body.pillars).toHaveLength(4);
    expect(body.partner).toEqual({ yearBranch: "未", relation: "six" });
  });
});

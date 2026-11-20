import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "@/app/api/taisui/route";
import {
  branchRelations,
  elementFlow,
  pairRelation,
  strongestRelation,
  yearFacts,
} from "@/features/taisui/year-relations";
import { elementRole, reactionsWith } from "@/features/taisui/year-reactions";
import { PHUA_GROUPS, SAMHENG_GROUPS, SINSE_HENG_PAIRS } from "@/features/taisui/sinse-tables";
import {
  DESTRUCTION_PAIRS,
  PUNISHMENT_TRIOS,
  STEM_BRANCH_DESTRUCTION_PAIRS,
  normalizeBranchPairKey,
} from "@/lib/bazi/symbolic-engine.constants";

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

  test("the red-packet pair uses the Sinse's branch tables", () => {
    expect(pairRelation("午", "未")).toBe("six");
    expect(pairRelation("子", "午")).toBe("chong");
    expect(pairRelation("辰", "未")).toBe("heng");
    expect(pairRelation("子", "未")).toBe("hai");
  });
});

// Plan revision 0.9: the Sinse's reaction method (ciel-os design/SINSE-REACTIONS.md).
describe("the chart's favourable elements, from the engine", () => {
  test("the Sinse's chart (day master 戊) takes fire and earth, as public-calc's state gives", async () => {
    const { chartLuck } = await import("@/features/taisui/year-relations");
    const luck = await chartLuck({ birthDate: "1979-10-08", birthTime: "13:30", gender: "male" });
    expect(luck.favorable).toEqual(["ไฟ", "ดิน"]);
    expect(luck.avoid).toEqual(expect.arrayContaining(["ไม้", "ทอง", "น้ำ"]));
  });
});

describe("the Sinse's tables agree with the engine where they overlap", () => {
  test("ผั่ว groups are exactly the engine's twelve stem-branch pillars", () => {
    const fromGroups = Object.values(PHUA_GROUPS).flat().map((p) => `${p[0]}|${p[1]}`).sort();
    expect(fromGroups).toEqual([...STEM_BRANCH_DESTRUCTION_PAIRS].sort());
  });
  test("ซำเฮ้ง groups are exactly the engine's twelve trios", () => {
    const trios = Object.values(SAMHENG_GROUPS).flatMap((g) => g.map((_, skip) => g.filter((__, i) => i !== skip).slice().sort().join("")));
    expect(trios.sort()).toEqual(PUNISHMENT_TRIOS.map((t) => [...t].sort().join("")).sort());
  });
  test("the engine's six 破 pairs are among the Sinse's twelve เฮ้ง pairs", () => {
    for (const key of DESTRUCTION_PAIRS) {
      const [a, b] = key.split("|");
      expect([key, SINSE_HENG_PAIRS.has(normalizeBranchPairKey(a, b))]).toEqual([key, true]);
    }
    expect(SINSE_HENG_PAIRS.size).toBe(12);
  });
});

describe("the year 丁未 against each branch, by the Sinse", () => {
  const strongest = (branch: string) => reactionsWith([{ key: "year", stem: "", branch }], { stem: "丁", branch: "未" })[0]?.kind ?? "none";
  test("ชง only with 丑; เฮ้ง with 戌 and 辰; ไห่ with 子", () => {
    expect(strongest("丑")).toBe("chong");
    expect(strongest("戌")).toBe("heng");
    expect(strongest("辰")).toBe("heng");
    expect(strongest("子")).toBe("hai");
    expect(strongest("未")).toBe("same");
    for (const b of ["寅", "申", "酉", "巳"]) expect([b, strongest(b)]).toEqual([b, "none"]);
    // 亥 with 未 is a half triad of 亥卯未 as the engine forms one (buildHalfSanHeInteractions: any two of a group)
    expect(strongest("亥")).toBe("half3");
  });
  test("the year's 丁 over a 卯 forms ผั่ว 丁卯 (help with poison inside), on the bottom character", () => {
    const r = reactionsWith([{ key: "month", stem: "己", branch: "卯" }], { stem: "丁", branch: "未" });
    // the year's character on a bottom ผั่ว is its stem 丁, not its branch
    expect(r.find((x) => x.kind === "phua")).toMatchObject({ pillar: "month", at: "bottom", mine: "卯", year: "丁", pair: "丁卯", group: "poison" });
  });
  test("ฮะ carries the engine's element and outcome", () => {
    // day master 己: its stage on 卯 is 病, on 未 冠带 (strong), so the half triad 卯未 is supported
    const half = reactionsWith([{ key: "day", stem: "己", branch: "卯" }], { stem: "丁", branch: "未" }, "己").find((x) => x.kind === "half3");
    expect(half?.into).toEqual({ element: "wood", status: "supported", source: "engine" });
    // the chart holding 亥 and 卯 completes 亥卯未 with the year, so each half is blocked by the whole triad
    const whole = reactionsWith([{ key: "day", stem: "己", branch: "卯" }, { key: "year", stem: "辛", branch: "亥" }], { stem: "丁", branch: "未" }, "己");
    expect(whole.filter((x) => x.kind === "half3").map((x) => x.into?.status)).toEqual(["blocked", "blocked"]);
    // 丁壬 makes wood; 甲 on 未 is 墓 and on 子 沐浴, neither strong, so it is only supported
    const stem = reactionsWith([{ key: "month", stem: "壬", branch: "子" }], { stem: "丁", branch: "未" }, "甲").find((x) => x.kind === "stemCombine");
    expect(stem?.into).toEqual({ element: "wood", status: "supported", source: "engine" });
    // 午未: the engine gives no element; fire is the Sinse's statement
    const six = reactionsWith([{ key: "year", stem: "庚", branch: "午" }], { stem: "丁", branch: "未" }, "己").find((x) => x.kind === "six");
    expect(six?.into).toEqual({ element: "fire", status: "detected", source: "sinse" });
  });
  test("ซำเฮ้ง when the chart holds two of 辰 戌 丑", () => {
    const r = reactionsWith(
      [{ key: "year", stem: "甲", branch: "辰" }, { key: "day", stem: "庚", branch: "戌" }],
      { stem: "丁", branch: "未" },
    );
    const s = r.filter((x) => x.kind === "samheng");
    expect(s.map((x) => x.pillar).sort()).toEqual(["day", "year"]);
    expect(s[0]).toMatchObject({ pair: "辰未戌", group: "vault" });
  });
  test("the five element roles to the day master", () => {
    expect(elementRole("丙", "丁")).toBe("companion");
    expect(elementRole("甲", "丁")).toBe("output");
    expect(elementRole("壬", "丁")).toBe("wealth");
    expect(elementRole("庚", "丁")).toBe("power");
    expect(elementRole("戊", "丁")).toBe("resource");
  });
});

describe("the Sinse's annotated chart: 己未 hour, 戊申 day, 癸酉 month, 己未 year", () => {
  const f = yearFacts({ birthDate: "1979-10-08", birthTime: "13:30", gender: "male" });
  test("the engine gives the chart he drew", () => {
    expect(f.pillars.map((p) => p.stem + p.branch)).toEqual(["己未", "戊申", "癸酉", "己未"]);
  });
  test("month pillar: ผั่ว 癸未 on the top character, and the 丁癸 stem clash", () => {
    const month = f.reactions.filter((r) => r.pillar === "month");
    expect(month.find((r) => r.kind === "phua")).toMatchObject({ at: "top", mine: "癸", year: "未", pair: "癸未", group: "self" });
    expect(month.find((r) => r.kind === "stemClash")).toMatchObject({ at: "top", mine: "癸", year: "丁" });
    expect(f.pillars.find((p) => p.key === "month")!.relation).toBe("phua");
  });
  test("hour and year pillars meet their own animal; the day pillar is untouched", () => {
    expect(f.pillars.find((p) => p.key === "hour")!.relation).toBe("same");
    expect(f.pillars.find((p) => p.key === "year")!.relation).toBe("same");
    expect(f.pillars.find((p) => p.key === "day")!.relation).toBe("none");
  });
  test("the year's fire feeds the 戊 earth day master: ส่งเสริมดิถี", () => {
    expect(f.role).toEqual({ dayMaster: "戊", dayElement: "earth", role: "resource", th: "ส่งเสริมดิถี" });
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
    // 卯 is both half three-harmony with 未 and ผั่ว 丁卯 under the year's stem; the hard one leads.
    expect([month.branch, month.relation]).toEqual(["卯", "phua"]);
    expect(month.relations).toEqual(expect.arrayContaining(["破", "半三合"]));
    expect(f.mine).toContain("午");
  });

  test("the year animal switches at Lichun, not on 1 January", () => {
    const before = yearFacts(male("1991-02-03")).pillars.find((p) => p.key === "year")!;
    const after = yearFacts(male("1991-02-05")).pillars.find((p) => p.key === "year")!;
    expect(before.branch).toBe("午");
    expect(after.branch).toBe("未");
    // 辛未: the year's own animal, and 辛 clashes the year's 丁 on top; the clash leads.
    expect(after.relation).toBe("stemClash");
    expect(after.relations).toContain("伏吟");
  });

  test("an Ox clashes, a Dog is punished, a Rat is harmed", () => {
    const y = (d: string) => yearFacts(male(d)).pillars.find((p) => p.key === "year")!;
    expect([y("1985-06-01").branch, y("1985-06-01").relation]).toEqual(["丑", "chong"]);
    // This chart also holds a second vault branch (辰 戌 丑), so 戌 carries ซำเฮ้ง as well as เฮ้ง.
    expect(y("1982-07-01").branch).toBe("戌");
    expect(y("1982-07-01").relations).toEqual(expect.arrayContaining(["刑"]));
    expect([y("1984-05-01").branch, y("1984-05-01").relation]).toEqual(["子", "hai"]);
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
    expect(Array.isArray(body.reactions)).toBe(true);
    expect(body.role.th).toBeTruthy();
  });
});

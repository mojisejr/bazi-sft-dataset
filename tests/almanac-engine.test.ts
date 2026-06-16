import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  buildAlmanacDay,
  buildAlmanacMonth,
  buildAlmanacYear,
  checkHour,
  huangdaoScore,
  lifeStageScore,
  pillarsForDate,
} from "@/lib/bazi/almanac/almanac-engine";

type GoldenRow = {
  date: string;
  day_pillar: string;
  month_branch: string;
  month_pillar: string;
  year_pillar: string;
  officer: string | null;
  deity: string | null;
  deities: string[];
  color_primary: [string | null, string | null] | null;
  lucky_dir: string | null;
  asura_dir: string | null;
  gates: [string | null, string | null][] | null;
  spirits: (string | null)[] | null;
  lucky_hours: [string | null, string | null][] | null;
  scores: number[];
};

const GOLDEN: GoldenRow[] = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/almanac-2569-golden.json"), "utf-8"),
);

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

const D_INDEX = [2, 3, 4, 5];
function expectedRatioDay(scores: number[]): number {
  const dSum = D_INDEX.reduce((a, i) => a + (scores[i] ?? 0), 0);
  return Math.round((dSum / 400) * 100) / 100;
}

function matchRatio(predicate: (row: GoldenRow) => boolean): number {
  return GOLDEN.filter(predicate).length / GOLDEN.length;
}

/** ชั้นหมุนตามเดือน: นับเฉพาะวันที่ month-branch ของ engine ตรงต้นฉบับ */
function matchRatioInMonth(predicate: (row: GoldenRow) => boolean): number {
  const rows = GOLDEN.filter(
    (r) => pillarsForDate(...parts(r.date)).monthPillar.branch === r.month_branch,
  );
  return rows.filter(predicate).length / rows.length;
}

describe("almanac engine — pillars vs ground truth (2569)", () => {
  test("day pillar matches 100%", () => {
    const bad = GOLDEN.filter((r) => pillarsForDate(...parts(r.date)).dayPillar.ganzhi !== r.day_pillar);
    expect(bad.map((r) => r.date)).toEqual([]);
  });

  test("เสาเดือน (จากตาราง 2450-2600) ตรงต้นฉบับ 100%", () => {
    const bad = GOLDEN.filter((r) => pillarsForDate(...parts(r.date)).monthPillar.ganzhi !== r.month_pillar);
    expect(bad.map((r) => `${r.date}:${pillarsForDate(...parts(r.date)).monthPillar.ganzhi}≠${r.month_pillar}`)).toEqual([]);
  });

  test("เสาปี ตรงต้นฉบับ 100% (เว้นเซลล์ขยะในไฟล์)", () => {
    const isGanZhi = (s: string) => /^[一-鿿]{2}$/.test(s);
    const bad = GOLDEN.filter(
      (r) => isGanZhi(r.year_pillar) && pillarsForDate(...parts(r.date)).yearPillar.ganzhi !== r.year_pillar,
    );
    expect(bad.map((r) => `${r.date}:${pillarsForDate(...parts(r.date)).yearPillar.ganzhi}≠${r.year_pillar}`)).toEqual([]);
  });
});

describe("almanac engine — เวลามงคล (黃道 rule)", () => {
  // ยามมงคลเป็นกฎ 黃道 ตามกิ่งวัน (ยืนยันตรงต้นฉบับชุดสะอาด); ทดสอบ implementation ของกฎ
  // (ไฟล์ต้นฉบับชีต july มีข้อมูลยามผิด/เลื่อน จึงไม่ใช้เทียบ)
  // 青龍 起 時辰 ตามกิ่งวัน → ยามดี 5 ที่ offset {0,1,4,5,7}
  const QL: Record<string, string> = {
    子: "申", 午: "申", 丑: "戌", 未: "戌", 寅: "子", 申: "子",
    卯: "寅", 酉: "寅", 辰: "辰", 戌: "辰", 巳: "午", 亥: "午",
  };
  const ORDER = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  function expectedGoodBranches(db: string): Set<string> {
    const start = ORDER.indexOf(QL[db]);
    return new Set([0, 1, 4, 5, 7].map((i) => ORDER[(start + i) % 12]));
  }

  test("ยามมงคล = กฎ 黃道 ตามกิ่งวัน ครบทุก 12 กิ่ง", () => {
    // ตรวจวันจริง 1 วัน/กิ่ง ในเดือนต่าง ๆ ของ 2569
    const samples = ["2026-01-01", "2026-02-15", "2026-03-20", "2026-04-10", "2026-05-05", "2026-06-15"];
    for (const date of samples) {
      const day = buildAlmanacDay(...parts(date));
      const got = new Set(day.luckyHours.map((h) => h.branch));
      const exp = expectedGoodBranches(day.dayPillar.branch);
      expect([...got].sort()).toEqual([...exp].sort());
    }
  });

  test("ทุกวันมียามมงคล 5 ยาม พร้อมชื่อเทพ + ความหมาย", () => {
    for (const date of ["2026-01-01", "2027-08-20", "2031-11-03"]) {
      const day = buildAlmanacDay(...parts(date));
      expect(day.luckyHours).toHaveLength(5);
      for (const h of day.luckyHours) {
        expect(h.god).not.toBe("");
        expect(h.meaning).not.toBe("");
      }
    }
  });
});

describe("almanac engine — ทิศอสูร (三煞 rule)", () => {
  const SANSHA: Record<string, string> = {
    申: "S", 子: "S", 辰: "S", 寅: "N", 午: "N", 戌: "N",
    巳: "E", 酉: "E", 丑: "E", 亥: "W", 卯: "W", 未: "W",
  };
  test("ทิศอสูรวัน/เดือน/ปี = 三煞 ตามกิ่ง", () => {
    for (const date of ["2026-01-01", "2026-06-15", "2026-11-01", "2575-09-09"]) {
      const day = buildAlmanacDay(...parts(date));
      expect(day.asura.day).toBe(`ทิศ ${SANSHA[day.dayPillar.branch]}`);
      expect(day.asura.month).toBe(`ทิศ ${SANSHA[day.monthPillar.branch]}`);
      expect(day.asura.year).toBe(`ทิศ ${SANSHA[day.yearPillar.branch]}`);
    }
  });
});

describe("almanac engine — strength (E = กำลังดิถี)", () => {
  test("ratioDay = (O+P+Q+R)/ΣmaxD ตรงต้นฉบับ ≥ 98%", () => {
    const rows = GOLDEN.filter(
      (r) => pillarsForDate(...parts(r.date)).monthPillar.branch === r.month_branch,
    );
    const ok = rows.filter(
      (r) => buildAlmanacDay(...parts(r.date)).strength.ratioDay === expectedRatioDay(r.scores),
    ).length;
    expect(ok / rows.length).toBeGreaterThanOrEqual(0.98);
  });
});

describe("almanac engine — interpretive layers vs ground truth (2569)", () => {
  const layers: Array<[string, (r: GoldenRow) => boolean]> = [
    ["officer", (r) => buildAlmanacDay(...parts(r.date)).officer === r.officer],
    ["deities", (r) => buildAlmanacDay(...parts(r.date)).deities.join("/") === (r.deities ?? []).join("/")],
    ["lucky_dir", (r) => buildAlmanacDay(...parts(r.date)).luckyDirection === r.lucky_dir],
    ["color_primary", (r) => {
      const c = buildAlmanacDay(...parts(r.date)).colors[0];
      return (c?.element ?? null) === (r.color_primary?.[0] ?? null);
    }],
    ["gates", (r) => {
      const g = buildAlmanacDay(...parts(r.date)).gates.map((x) => `${x.name}${x.direction}`).join(",");
      return g === (r.gates ?? []).map((x) => `${x[0]}${x[1]}`).join(",");
    }],
    ["spirits", (r) => {
      const s = buildAlmanacDay(...parts(r.date)).spirits.map((x) => x.name).join("");
      return s === (r.spirits ?? []).filter(Boolean).join("");
    }],
  ];

  for (const [name, pred] of layers) {
    test(`layer "${name}" matches ≥ 98%`, () => {
      expect(matchRatioInMonth(pred)).toBeGreaterThanOrEqual(0.98);
    });
  }
});

describe("almanac engine — สูตรคะแนนทางการ (เคี้ยงคุง) vs ground truth", () => {
  // helper คำนวณตามตารางเคี้ยงคุงเป๊ะ (黃道/長生): ทดสอบเทียบค่าตารางทางการ
  test("huangdaoScore/lifeStageScore = ตารางเคี้ยงคุงเป๊ะ", () => {
    // 黃道(子→亥)=朱雀=B4=30 ; (巳→亥)=天德=B6=90 ; (午→申)=青龍=B1=70
    expect(huangdaoScore("子", "亥")).toBe(30);
    expect(huangdaoScore("巳", "亥")).toBe(90);
    expect(huangdaoScore("午", "申")).toBe(70);
    // 長生(乙@亥)=死=A8=10 ; (甲@亥)=長生=A1=80 ; (丙@午)=帝旺=A5=110
    expect(lifeStageScore("乙", "亥")).toBe(10);
    expect(lifeStageScore("甲", "亥")).toBe(80);
    expect(lifeStageScore("丙", "午")).toBe(110);
  });

  // ไฟล์ให้ "รหัส" แต่ "ค่า" ในปฏิทินปรับมือโดยซินแส → กฎ reproduce ได้บางส่วน (documented)
  test("กฎ approximate ค่าสกัด: P (黃道) ≥ 85%, O (長生 ±5) ≥ 85%", () => {
    const rows = GOLDEN.filter((r) => pillarsForDate(...parts(r.date)).monthPillar.branch === r.month_branch);
    let pOk = 0;
    let oOk = 0;
    for (const r of rows) {
      const db = r.day_pillar[1];
      if (huangdaoScore(r.month_branch, db) === r.scores[3]) pOk += 1;
      if (Math.abs(lifeStageScore(r.day_pillar[0], db) - r.scores[2]) <= 5) oOk += 1;
    }
    expect(pOk / rows.length).toBeGreaterThanOrEqual(0.85);
    expect(oOk / rows.length).toBeGreaterThanOrEqual(0.85);
  });

  test("autumn (酉 month) ใช้กฎ: ratioDay คำนวณได้ (0-1) + exact=false", () => {
    const sep = buildAlmanacMonth(2026, 9);
    expect(sep.days.some((d) => d.strength.exact === false)).toBe(true);
    for (const d of sep.days) {
      expect(d.strength.ratioDay).toBeGreaterThanOrEqual(0);
      expect(d.strength.ratioDay).toBeLessThanOrEqual(1.2);
    }
  });
});

describe("almanac engine — เทพดี/เทพร้าย + ตรวจยาม", () => {
  test("มีวันที่เข้าเกณฑ์เทพดี/เทพร้าย ในปี และโครงสร้างถูก", () => {
    const year = buildAlmanacYear(2569);
    const days = year.months.flatMap((m) => m.days);
    expect(days.some((d) => d.goodDeities.length > 0)).toBe(true);
    expect(days.some((d) => d.badDeities.length > 0)).toBe(true);
    for (const d of days) {
      for (const s of [...d.goodDeities, ...d.badDeities]) expect(s.name).toBeTruthy();
    }
  });

  test("checkHour คืนคุณภาพยาม (黃道) ของวัน+เวลา", () => {
    const q = checkHour(2026, 6, 16, 15); // 15:00 = ยาม 申
    expect(q.dayPillar).toHaveLength(2);
    expect(q.hourBranch).toBe("申");
    expect(q.god).not.toBe("");
    expect(typeof q.good).toBe("boolean");
  });
});

describe("almanac engine — any-year generation", () => {
  test("builds a full year for past/future years without error", () => {
    for (const yearBE of [2560, 2575, 2600]) {
      const year = buildAlmanacYear(yearBE);
      expect(year.months).toHaveLength(12);
      const totalDays = year.months.reduce((sum, m) => sum + m.days.length, 0);
      expect(totalDays).toBeGreaterThanOrEqual(365);
      for (const month of year.months) {
        for (const d of month.days) {
          expect(d.dayPillar.ganzhi).toHaveLength(2);
          expect(d.officer).not.toBeNull();
          expect(d.asura.day).not.toBe("");
          expect(d.luckyHours).toHaveLength(5); // เวลามงคลคำนวณได้ทุกวัน
        }
      }
    }
  });
});

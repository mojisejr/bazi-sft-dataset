import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  buildAlmanacDay,
  buildAlmanacMonth,
  buildAlmanacYear,
  pillarsForDate,
} from "@/lib/bazi/almanac/almanac-engine";

type GoldenRow = {
  date: string;
  day_pillar: string;
  month_branch: string;
  officer: string | null;
  deity: string | null;
  color_primary: [string | null, string | null] | null;
  lucky_dir: string | null;
  asura_dir: string | null;
  gates: [string | null, string | null][] | null;
  spirits: (string | null)[] | null;
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
  return Math.round((dSum / 400) * 100) / 100; // max ของ D = 4×100
}

/** ratio ของรายการที่ตรง (เทียบทุกวัน) */
function matchRatio(predicate: (row: GoldenRow) => boolean): number {
  const ok = GOLDEN.filter(predicate).length;
  return ok / GOLDEN.length;
}

/**
 * ratio สำหรับชั้นที่ "หมุนตามเดือน" — นับเฉพาะวันที่ month-branch ของ engine
 * ตรงกับต้นฉบับ (ตัดวันคาบเกี่ยวสารทออก เพราะวัดความถูกของ pillar แยกไว้แล้ว)
 */
function matchRatioInMonth(predicate: (row: GoldenRow) => boolean): number {
  const rows = GOLDEN.filter(
    (r) => pillarsForDate(...parts(r.date)).monthPillar.branch === r.month_branch,
  );
  return rows.filter(predicate).length / rows.length;
}

describe("almanac engine — pillars vs ground truth (2569)", () => {
  test("day pillar matches 100% (179+ known days)", () => {
    const mismatches = GOLDEN.filter(
      (r) => pillarsForDate(...parts(r.date)).dayPillar.ganzhi !== r.day_pillar,
    ).map((r) => `${r.date} ${pillarsForDate(...parts(r.date)).dayPillar.ganzhi}≠${r.day_pillar}`);
    expect(mismatches).toEqual([]);
  });

  test("month branch matches ≥ 98% (อนุโลมวันคาบเกี่ยวสารท)", () => {
    expect(
      matchRatio((r) => pillarsForDate(...parts(r.date)).monthPillar.branch === r.month_branch),
    ).toBeGreaterThanOrEqual(0.98);
  });
});

describe("almanac engine — strength (E = กำลังดิถี)", () => {
  test("ratioDay = (O+P+Q+R)/ΣmaxD ตรงกับต้นฉบับ ≥ 98% (เผื่อบล็อกซ้ำในต้นฉบับ)", () => {
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
  // ทุกชั้น lookup ตาม (เสาวัน × month-branch); ไฟล์ต้นฉบับมีไม่กี่วันที่ขัดกันเอง → ยอมรับ ≥ 98%
  const layers: Array<[string, (r: GoldenRow) => boolean]> = [
    ["officer", (r) => buildAlmanacDay(...parts(r.date)).officer === r.officer],
    ["deity", (r) => buildAlmanacDay(...parts(r.date)).deity === r.deity],
    ["lucky_dir", (r) => buildAlmanacDay(...parts(r.date)).luckyDirection === r.lucky_dir],
    ["color_primary", (r) => {
      const c = buildAlmanacDay(...parts(r.date)).colors[0];
      return (c?.element ?? null) === (r.color_primary?.[0] ?? null);
    }],
    // golden asura_dir มี noise (สีปนมาจาก layout เพี้ยน) → เทียบเฉพาะแถวที่เป็น "ทิศ X" จริง
    ["asura_day (三煞)", (r) =>
      typeof r.asura_dir !== "string" || !r.asura_dir.startsWith("ทิศ")
        ? true
        : buildAlmanacDay(...parts(r.date)).asura.day === r.asura_dir],
    ["gates", (r) => {
      const g = buildAlmanacDay(...parts(r.date)).gates.map((x) => `${x.name}${x.direction}`).join(",");
      const exp = (r.gates ?? []).map((x) => `${x[0]}${x[1]}`).join(",");
      return g === exp;
    }],
    ["spirits", (r) => {
      const s = buildAlmanacDay(...parts(r.date)).spirits.map((x) => x.name).join("");
      const exp = (r.spirits ?? []).filter(Boolean).join("");
      return s === exp;
    }],
  ];

  for (const [name, pred] of layers) {
    test(`layer "${name}" matches ≥ 98%`, () => {
      expect(matchRatioInMonth(pred)).toBeGreaterThanOrEqual(0.98);
    });
  }
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
        }
      }
    }
  });

  test("spirit keywords attached + autumn months flagged approximate", () => {
    const day = buildAlmanacDay(2026, 1, 1);
    expect(day.spirits.length).toBeGreaterThan(0);
    expect(day.spirits[0]?.keywords.length).toBeGreaterThan(0);
    const aug = buildAlmanacMonth(2026, 9); // เดือน 酉 (autumn) — ไม่มีในต้นฉบับ
    expect(aug.days.some((d) => d.strength.exact === false)).toBe(true);
  });
});

import { describe, expect, test } from "vitest";

import { buildAlmanacDay } from "@/lib/bazi/almanac/almanac-engine";
import {
  mergeOverrides,
  EMPTY_ALMANAC_OVERRIDES,
  type AlmanacOverrides,
} from "@/lib/bazi/almanac/almanac-override-repository";
import type { SelectBaziKnowledgeOverride } from "@/db/schema";

function row(kind: string, groupKey: string, itemKey: string, text: string): SelectBaziKnowledgeOverride {
  return {
    kind, groupKey, itemKey, value: { text }, updatedBy: null,
    createdAt: new Date(), updatedAt: new Date(),
  } as unknown as SelectBaziKnowledgeOverride;
}

describe("almanac override — mergeOverrides", () => {
  test("รวม per-day patch (generic, JSON) + rule (แก้/ลบ/เพิ่ม)", () => {
    const ov = mergeOverrides([
      row("almanac-day", "2026-01-01", "note", JSON.stringify("บันทึกวันปีใหม่")),
      row("almanac-day", "2026-01-01", "officer", JSON.stringify("ดิถีใหม่")),
      row("almanac-day", "2026-01-01", "deities", JSON.stringify(["A", "B"])),
      row("almanac-rule", "day-stars", "mor-thep", '{"id":"mor-thep","name":"หมอใหม่","polarity":"good","activity":null,"triggers":{}}'),
      row("almanac-rule", "day-stars", "mongkhon", "__deleted__"),
      row("almanac-rule", "special-days", "newfest", '{"id":"newfest","name":"เทศกาลใหม่","category":"festival-thai","rule":{"type":"gregorian","month":3,"day":3}}'),
    ]);

    expect(ov.dayPatches["2026-01-01"]).toEqual({ note: "บันทึกวันปีใหม่", officer: "ดิถีใหม่", deities: ["A", "B"] });
    // mor-thep ถูกเปลี่ยนชื่อ, mongkhon ถูกลบ
    expect(ov.dayStars.find((s) => s.id === "mor-thep")?.name).toBe("หมอใหม่");
    expect(ov.dayStars.find((s) => s.id === "mongkhon")).toBeUndefined();
    expect(ov.dayStars.find((s) => s.id === "thian-soe")).toBeTruthy(); // ฐานอื่นยังอยู่
    // special-days เพิ่มรายการใหม่ + ฐานยังอยู่
    expect(ov.specialDays.find((s) => s.id === "newfest")?.name).toBe("เทศกาลใหม่");
    expect(ov.specialDays.find((s) => s.id === "new-year")).toBeTruthy();
  });
});

describe("almanac override — buildAlmanacDay ใช้ override", () => {
  test("per-day patch: แก้ได้ทุกฟิลด์ (note/officer/deities/specialDays/colors)", () => {
    const ov: AlmanacOverrides = {
      ...EMPTY_ALMANAC_OVERRIDES,
      dayPatches: {
        "2026-01-01": {
          note: "หมายเหตุทดสอบ",
          officer: "ดิถีที่แก้",
          deities: ["เทพ ก", "เทพ ข"],
          specialDays: [{ id: "x", name: "งานพิเศษ", category: "religion" }],
          colors: [{ element: "ไฟ", colors: "แดง" }],
        },
      },
    };
    const day = buildAlmanacDay(2026, 1, 1, ov);
    expect(day.note).toBe("หมายเหตุทดสอบ");
    expect(day.officer).toBe("ดิถีที่แก้");
    expect(day.deities).toEqual(["เทพ ก", "เทพ ข"]);
    expect(day.specialDays.map((s) => s.name)).toEqual(["งานพิเศษ"]);
    expect(day.colors[0]).toEqual({ element: "ไฟ", colors: "แดง" });
  });

  test("rule override: เคลียร์ day-stars/special-days แล้วไม่มีรายการ", () => {
    const cleared: AlmanacOverrides = { ...EMPTY_ALMANAC_OVERRIDES, dayStars: [], specialDays: [] };
    const day = buildAlmanacDay(2026, 1, 1, cleared); // ปกติมีวันขึ้นปีใหม่
    expect(day.specialDays).toHaveLength(0);
    expect(day.dayStars).toHaveLength(0);
  });

  test("rule override: ดาวใหม่ที่ trigger ทุกกิ่งของเดือน 寅 ติดทุกวันในเดือนนั้น", () => {
    const allBranches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    const ov: AlmanacOverrides = {
      ...EMPTY_ALMANAC_OVERRIDES,
      dayStars: [{ id: "x", name: "ดาวทดสอบ", polarity: "good", activity: null, triggers: { 寅: allBranches } }],
    };
    // 2026-02-17 อยู่ในเสาเดือน 寅 (ก.พ.)
    const day = buildAlmanacDay(2026, 2, 17, ov);
    expect(day.monthPillar.branch).toBe("寅");
    expect(day.dayStars.map((s) => s.name)).toEqual(["ดาวทดสอบ"]);
  });

  test("ไม่ส่ง overrides = พฤติกรรมเดิม (วันขึ้นปีใหม่ยังอยู่, note=null)", () => {
    const day = buildAlmanacDay(2026, 1, 1);
    expect(day.note).toBeNull();
    expect(day.specialDays.map((s) => s.name)).toContain("วันขึ้นปีใหม่");
  });
});

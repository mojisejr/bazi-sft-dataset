import { describe, expect, test } from "vitest";

import {
  buildElementInteractionAB,
  buildFacets,
  buildPairComparison,
  buildWorkComparison,
  computePairMatch,
  computePairMatchPair,
  mainFacetOf,
  relationOf,
} from "@/lib/bazi/pair-matching";
import type { DayPillar, PillarPos } from "@/lib/bazi/pair-types";

describe("pair-matching engine (spreadsheet-exact)", () => {
  test("甲子 × 甲子 → 60% grade B, สี่ซิ้ง กิมกุ่ย (ตู้ทอง)", () => {
    const m = computePairMatch({ stem: "甲", branch: "子" }, { stem: "甲", branch: "子" }, "work");
    expect(m.percent).toBe(60);
    expect(m.grade).toBe("B");
    expect(m.components).toEqual([40, 40, 100]);
    expect(m.sising?.code).toBe("B5");
    expect(m.sising?.nameTh).toBe("ตู้ทอง");
    expect(m.found).toBe(true);
  });

  test("甲子 × 甲寅 → 46.67% grade C (ปัดจากค่าเฉลี่ย 40/100/0)", () => {
    const m = computePairMatch({ stem: "甲", branch: "子" }, { stem: "甲", branch: "寅" }, "work");
    expect(m.percent).toBe(46.67);
    expect(m.grade).toBe("C");
  });

  test("甲子 × 乙丑 → 70% grade B+, สี่ซิ้ง เทพแห่งฟ้า", () => {
    const m = computePairMatch({ stem: "甲", branch: "子" }, { stem: "乙", branch: "丑" }, "work");
    expect(m.percent).toBe(70);
    expect(m.grade).toBe("B+");
    expect(m.sising?.nameTh).toBe("เทพแห่งฟ้า");
  });

  test("love domain resolves สี่ซิ้ง name via code lookup", () => {
    const m = computePairMatch({ stem: "甲", branch: "子" }, { stem: "甲", branch: "子" }, "love");
    expect(m.percent).toBe(60);
    expect(m.sising?.nameTh).toBe("ตู้ทอง");
  });

  test("matrix covers all 60×60 keys per domain (smoke on a few combos)", () => {
    for (const [a, b] of [["庚", "申"], ["壬", "子"], ["癸", "亥"]] as const) {
      const m = computePairMatch({ stem: a, branch: b }, { stem: a, branch: b }, "work");
      expect(m.found).toBe(true);
      expect(typeof m.percent).toBe("number");
    }
  });
});

describe("five-element interaction (ปฏิกิริยาธาตุ)", () => {
  test("relationOf cycles", () => {
    expect(relationOf("water", "fire")).toBe("wealth"); // self controls other → 財
    expect(relationOf("wood", "water")).toBe("resource"); // water generates wood → 印
    expect(relationOf("wood", "fire")).toBe("output"); // wood generates fire → 食傷
    expect(relationOf("wood", "metal")).toBe("power"); // metal controls wood → 官杀
    expect(relationOf("wood", "wood")).toBe("same");
  });

  test("buildElementInteractionAB labels both directions", () => {
    const interaction = buildElementInteractionAB("壬", "丙"); // water vs fire
    expect(interaction.aElementTh).toBe("น้ำ");
    expect(interaction.bElementTh).toBe("ไฟ");
    expect(interaction.aToB.labelTh).toBe("ดิถีพิฆาต"); // water controls fire
    expect(interaction.bToA.labelTh).toBe("พิฆาตดิถี"); // fire is controlled by water
  });
});

describe("directional matrix (คู่สมพงษ์ อ่านจากมุม 'เรา')", () => {
  test("A→B ≠ B→A by design (matrix is directional)", () => {
    const fwd = computePairMatch({ stem: "甲", branch: "子" }, { stem: "乙", branch: "丑" }, "work");
    const rev = computePairMatch({ stem: "乙", branch: "丑" }, { stem: "甲", branch: "子" }, "work");
    expect(fwd.percent).toBe(70);
    expect(rev.percent).toBe(45);
    expect(fwd.percent).not.toBe(rev.percent);
  });

  test("computePairMatchPair overall is order-independent", () => {
    const ab = computePairMatchPair({ stem: "甲", branch: "子" }, { stem: "乙", branch: "丑" }, "work");
    const ba = computePairMatchPair({ stem: "乙", branch: "丑" }, { stem: "甲", branch: "子" }, "work");
    expect(ab.overallPercent).toBe(57.5); // (70 + 45) / 2
    expect(ab.overallPercent).toBe(ba.overallPercent);
    expect(ab.overallGrade).toBe(ba.overallGrade);
  });
});

describe("full comparison", () => {
  test("buildPairComparison returns both domains (forward/reverse) + nisai + reference", () => {
    const r = buildPairComparison({ stem: "甲", branch: "子" }, { stem: "乙", branch: "丑" });
    expect(r.match.work.forward.found).toBe(true);
    expect(r.match.work.reverse.found).toBe(true);
    expect(r.match.love.overallPercent).not.toBeNull();
    expect(r.personA.nisai.length).toBeGreaterThan(0);
    expect(r.sisingReference.length).toBe(12);
  });
});

describe("relationship facets (Matching.xlsx — spreadsheet-exact)", () => {
  // คู่ตัวอย่างจาก Matching.xlsx
  const sp = (stem: string, branch: string): DayPillar => ({ stem, branch });
  const M: Record<PillarPos, DayPillar> = {
    hour: sp("壬", "申"), day: sp("己", "酉"), month: sp("癸", "亥"), year: sp("癸", "酉"),
  };
  const W: Record<PillarPos, DayPillar> = {
    hour: sp("丙", "子"), day: sp("甲", "寅"), month: sp("壬", "辰"), year: sp("辛", "酉"),
  };

  test("love: 5 มิติตรงชีต + คำทำนายหลัก = วาสนาคู่ชีวิต 88.33%", () => {
    const facets = buildFacets("love", M, W);
    expect(facets.map((f) => f.percent)).toEqual([11.67, 45, 55, 88.33, 70]);
    const main = mainFacetOf(facets);
    expect(main?.key).toBe("lifePartner");
    expect(main?.percent).toBe(88.33);
    expect(main?.domain).toBe("love");
  });

  test("partner (work): main = เป็นหุ้นส่วนเรา (วัน×วัน) 45%", () => {
    const facets = buildFacets("partner", M, W);
    expect(facets.map((f) => f.percent)).toEqual([75, 45, 71.67, 38.33]);
    expect(mainFacetOf(facets)?.percent).toBe(45);
    expect(facets[0].domain).toBe("work");
  });

  test("boss (work): main = ส่งเสริมธุรกิจเจ้านาย (เดือน×เดือน) 71.67%", () => {
    const facets = buildFacets("boss", M, W);
    expect(facets.map((f) => f.percent)).toEqual([33.33, 30, 71.67, 28.33]);
    const main = mainFacetOf(facets);
    expect(main?.key).toBe("business");
    expect(main?.percent).toBe(71.67);
  });

  test("subordinate (work): main = ส่งเสริมธุรกิจเรา (เดือน×เดือน) 71.67%", () => {
    const facets = buildFacets("subordinate", M, W);
    expect(facets.map((f) => f.percent)).toEqual([75, 55, 71.67, 38.33]);
    const main = mainFacetOf(facets);
    expect(main?.key).toBe("business");
    expect(main?.percent).toBe(71.67);
  });

  test("แต่ละแท่งมีคำทำนาย 3 บรรทัด (ก้าน/กิ่ง/สี่ซิ้ง) พร้อมโค้ด + ข้อความ", () => {
    const intimacy = buildFacets("love", M, W)[0];
    expect(intimacy.lines.map((l) => l.slot)).toEqual(["ก้าน", "กิ่ง", "สี่ซิ้ง"]);
    expect(intimacy.lines.map((l) => l.code)).toEqual(["A10", "A7", "B3"]);
    for (const ln of intimacy.lines) {
      expect(ln.text.length).toBeGreaterThan(0);
      expect(ln.name.length).toBeGreaterThan(0);
    }
  });

  test("คำทำนายรายแท่งเปลี่ยนตามมุมความสัมพันธ์ (work ≠ love)", () => {
    const loveStem = buildFacets("love", M, W)[1].lines[0]; // วัน×วัน
    const bossStem = buildFacets("boss", M, W)[1].lines[0];
    // โค้ดมาจากตารางคนละ domain จึงอาจต่างกัน — แต่ที่ต่างแน่คือข้อความ (มุมมอง)
    expect(loveStem.text).not.toBe(bossStem.text);
  });

  test("มีมิติหลักเพียงหนึ่งต่อความสัมพันธ์", () => {
    for (const rel of ["love", "partner", "boss", "subordinate"] as const) {
      const mains = buildFacets(rel, M, W).filter((f) => f.isMain);
      expect(mains.length).toBe(1);
    }
  });
});

describe("work multi-candidate comparison (เรา vs ผู้ร่วมงาน)", () => {
  const self = { stem: "甲", branch: "子" };

  test("rankScore uses forward (เรา→เขา) and ranks best→worst", () => {
    // 甲子→乙丑 = 70 (forward); 甲子→甲寅 = 46.67
    const r = buildWorkComparison(self, [
      { stem: "甲", branch: "寅" }, // index 0 — lower
      { stem: "乙", branch: "丑" }, // index 1 — higher
    ]);
    expect(r.candidates[0].rankScore).toBe(46.67);
    expect(r.candidates[1].rankScore).toBe(70);
    // ranking puts the higher-forward candidate first
    expect(r.ranking).toEqual([1, 0]);
    expect(r.candidates.length).toBe(2);
  });

  test("candidates keep input order; ranking is a separate index list", () => {
    const r = buildWorkComparison(self, [
      { stem: "乙", branch: "丑" },
      { stem: "甲", branch: "寅" },
      { stem: "甲", branch: "子" },
    ]);
    expect(r.candidates.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(r.ranking.length).toBe(3);
    expect(r.self.nisai.length).toBeGreaterThan(0);
    // each candidate carries work match + element interaction + roles
    expect(r.candidates[0].match.forward.domain).toBe("work");
    expect(r.candidates[0].elementInteraction.summaryTh).toBeTruthy();
  });
});

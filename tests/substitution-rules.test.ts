import { describe, expect, test } from "vitest";

import {
  applySubstitutionRules,
  renderRulesMarkdown,
  suggestSubstitutions,
  type SubstitutionRule,
} from "@/lib/bazi/substitution-rules";

function rule(over: Partial<SubstitutionRule>): SubstitutionRule {
  return {
    id: over.id ?? "r1",
    scope: over.scope ?? "topic",
    topicId: over.topicId,
    match: over.match ?? "",
    replacement: over.replacement ?? "",
    note: over.note,
    source: over.source ?? { kind: "manual" },
    createdAt: over.createdAt ?? "2026-06-09T00:00:00.000Z",
    hitCount: over.hitCount,
  };
}

describe("applySubstitutionRules", () => {
  test("รายบท: กฎบท wealth ไม่กระทบบทอื่น", () => {
    const rules = [rule({ scope: "topic", topicId: "wealth", match: "ได้เงินแบบรายเดือน", replacement: "passive income" })];
    expect(applySubstitutionRules("wealth", "คุณจะได้เงินแบบรายเดือน", rules)).toBe("คุณจะpassive income");
    expect(applySubstitutionRules("health", "คุณจะได้เงินแบบรายเดือน", rules)).toBe("คุณจะได้เงินแบบรายเดือน");
  });

  test("global กระทบทุกบท", () => {
    const rules = [rule({ scope: "global", match: "รายเดือน", replacement: "passive income" })];
    expect(applySubstitutionRules("anything", "เงินรายเดือน", rules)).toBe("เงินpassive income");
  });

  test("replacement ว่าง = ลบวลี + เก็บกวาดช่องว่างซ้ำ", () => {
    const rules = [rule({ scope: "topic", topicId: "t", match: "ที่ไม่ต้องการ ", replacement: "" })];
    expect(applySubstitutionRules("t", "ข้อความที่ไม่ต้องการ เหลือ", rules)).toBe("ข้อความเหลือ");
  });

  test("idempotent: รันซ้ำผลเท่าเดิม", () => {
    const rules = [rule({ scope: "topic", topicId: "t", match: "A", replacement: "B" })];
    const once = applySubstitutionRules("t", "AAA", rules);
    expect(once).toBe("BBB");
    expect(applySubstitutionRules("t", once, rules)).toBe("BBB");
  });

  test("เรียง match ยาวก่อน → ไม่โดนกฎสั้นกินก่อน", () => {
    const rules = [
      rule({ id: "short", scope: "global", match: "เงิน", replacement: "X" }),
      rule({ id: "long", scope: "global", match: "เงินเดือน", replacement: "passive income" }),
    ];
    expect(applySubstitutionRules("t", "ได้เงินเดือน", rules)).toBe("ได้passive income");
  });
});

describe("suggestSubstitutions", () => {
  test("จับบรรทัดที่เปลี่ยนเป็นคู่ match→replacement และที่หายเป็น replacement ว่าง", () => {
    const original = "บรรทัดคงเดิม\nได้เงินแบบรายเดือน\nวลีที่จะลบ";
    const corrected = "บรรทัดคงเดิม\nได้เป็น passive income";
    const pairs = suggestSubstitutions(original, corrected);
    expect(pairs).toContainEqual({ match: "ได้เงินแบบรายเดือน", replacement: "ได้เป็น passive income" });
    expect(pairs).toContainEqual({ match: "วลีที่จะลบ", replacement: "" });
  });
});

describe("renderRulesMarkdown", () => {
  test("ออกตาราง markdown มีหัวตารางและแถวกฎ", () => {
    const md = renderRulesMarkdown({
      rules: [rule({ scope: "topic", topicId: "wealth", match: "รายเดือน", replacement: "passive income" })],
    });
    expect(md).toContain("| บท | คำเดิม");
    expect(md).toContain("| wealth | รายเดือน | passive income |");
  });
});

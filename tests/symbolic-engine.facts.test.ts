import { describe, expect, test, vi } from "vitest";

import {
  ENGINE_DEPENDENCIES,
  EngineFactMapSchema,
} from "@/lib/bazi/knowledge/topic-types";
import { createEngineFactShell, getEngineFactBlueprint, getEngineFactsForDependencies } from "@/lib/bazi/symbolic-engine.facts";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";

import { createTestKnowledgeRepository } from "./helpers/bazi-test-knowledge-repository";

describe("symbolic-engine fact shell", () => {
  test("creates a deterministic pending shell for every declared engine dependency", () => {
    const shell = createEngineFactShell();

    expect(Object.keys(shell)).toEqual(ENGINE_DEPENDENCIES);
    expect(EngineFactMapSchema.parse(shell)).toEqual(shell);

    for (const dependency of ENGINE_DEPENDENCIES) {
      expect(shell[dependency]).toMatchObject({
        dependency,
        resolved: false,
      });
      expect(shell[dependency].summary).toContain("Pending extractor implementation");
    }
  });

  test("returns exact deterministic payloads for the pinned reference chart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T04:00:00.000Z"));

    const chart = await calculateBaziChart(
      {
        birthDate: "1992-08-21",
        birthTime: "14:35",
        gender: "female",
        province: "Bangkok",
        calendarSystem: "solar",
        timezone: "Asia/Hong_Kong",
      },
      createTestKnowledgeRepository(),
    );

    const facts = getEngineFactsForDependencies(chart, [
      "day_master",
      "day_master_strength",
      "sixty_jiazi_persona",
      "hidden_stems",
      "element_balance",
      "useful_god",
      "favorable_elements",
      "unfavorable_elements",
      "wealth_star",
      "power_star",
      "resource_star",
      "output_star",
      "peer_star",
      "pillar_relations",
      "month_branch_relations",
      "day_branch_relations",
      "hour_branch_relations",
      "clash_matrix",
      "combination_matrix",
      "harm_matrix",
      "punishment_matrix",
      "twelve_qi_profile",
      "dayun_cycles",
      "health_signals",
    ]);
    expect(facts).toEqual([
      expect.objectContaining({ dependency: "day_master", resolved: true, summary: "己 (ดิน)" }),
      expect.objectContaining({ dependency: "day_master_strength", resolved: true, summary: "แข็งแรง/สมดุล | ดิถีสมดุล | score 4.58 | ดิถีดิน ดิถีสมดุล เพราะได้ชั้น หมกยก จากเดือนเกิด มีแรงหนุนจากฤดูและสาขาที่ส่งเสริมมากกว่าหักล้าง" }),
      expect.objectContaining({ dependency: "sixty_jiazi_persona", resolved: true, summary: "己巳 | Builds influence patiently, then turns preparation into visible results when timing opens." }),
      expect.objectContaining({ dependency: "hidden_stems", resolved: true, summary: "year=庚/壬/戊, month=庚/壬/戊, day=丙/庚/戊, hour=己/丁/乙" }),
      expect.objectContaining({ dependency: "element_balance", resolved: true, summary: "รวม ไม้: 1, ไฟ: 2, ดิน: 6, ทอง: 4, น้ำ: 3 | เด่น ดิน" }),
      expect.objectContaining({ dependency: "useful_god", resolved: true, summary: "น้ำ — ดวงสมดุลใช้ธาตุงานและผลลัพธ์เพื่อขยับพลังให้เกิดประโยชน์" }),
      expect.objectContaining({ dependency: "favorable_elements", resolved: true, summary: "ทอง, น้ำ, ไม้" }),
      expect.objectContaining({ dependency: "unfavorable_elements", resolved: true, summary: "ไฟ, ดิน" }),
      expect.objectContaining({ dependency: "wealth_star", resolved: true, summary: "yearStem=正财, yearBranch=正财, monthBranch=正财, mingGongStem=正财" }),
      expect.objectContaining({ dependency: "power_star", resolved: true, summary: "hourBranch=七杀" }),
      expect.objectContaining({ dependency: "resource_star", resolved: true, summary: "dayBranch=正印, hourBranch=偏印" }),
      expect.objectContaining({ dependency: "output_star", resolved: true, summary: "yearBranch=伤官, monthBranch=伤官, dayBranch=伤官, hourStem=食神" }),
      expect.objectContaining({ dependency: "peer_star", resolved: true, summary: "yearBranch=劫财, monthStem=劫财, monthBranch=劫财, dayBranch=劫财, hourBranch=比肩" }),
      expect.objectContaining({ dependency: "pillar_relations", resolved: true, summary: "壬戊 [heavenly-stem-clash], 巳申 [earthly-branch-liu-he], 巳申 [earthly-branch-liu-he], 寅巳申 [earthly-branch-punishment], 巳申亥 [earthly-branch-punishment], 壬x巳 [element-control], 申->壬 [element-generate], 戊x壬 [element-control], 戊->申 [element-generate], 戊->申 [element-generate], 戊->辛 [element-generate], 申->壬 [element-generate], 己x壬 [element-control], 己->申 [element-generate], 己->申 [element-generate], 己->辛 [element-generate], 巳x申 [element-control], 巳->戊 [element-generate], 巳x申 [element-control], 巳->己 [element-generate], 巳x辛 [element-control], 巳->未 [element-generate], 辛->壬 [element-generate], 未x壬 [element-control], 未->申 [element-generate], 未->申 [element-generate], 未->辛 [element-generate]" }),
      expect.objectContaining({ dependency: "month_branch_relations", resolved: true, summary: "巳申 [earthly-branch-liu-he], 寅巳申 [earthly-branch-punishment], 巳申亥 [earthly-branch-punishment], 戊->申 [element-generate], 申->壬 [element-generate], 己->申 [element-generate], 巳x申 [element-control], 未->申 [element-generate]" }),
      expect.objectContaining({ dependency: "day_branch_relations", resolved: true, summary: "巳申 [earthly-branch-liu-he], 巳申 [earthly-branch-liu-he], 寅巳申 [earthly-branch-punishment], 巳申亥 [earthly-branch-punishment], 壬x巳 [element-control], 巳x申 [element-control], 巳->戊 [element-generate], 巳x申 [element-control], 巳->己 [element-generate], 巳x辛 [element-control], 巳->未 [element-generate]" }),
      expect.objectContaining({ dependency: "hour_branch_relations", resolved: true, summary: "巳->未 [element-generate], 未x壬 [element-control], 未->申 [element-generate], 未->申 [element-generate], 未->辛 [element-generate]" }),
      expect.objectContaining({ dependency: "clash_matrix", resolved: true, summary: "壬戊 (detected/primary)" }),
      expect.objectContaining({ dependency: "combination_matrix", resolved: true, summary: "巳申 (detected/primary), 巳申 (detected/primary)" }),
      expect.objectContaining({ dependency: "harm_matrix", resolved: true, summary: "ไม่พบ harm matrix จาก interactionState" }),
      expect.objectContaining({ dependency: "punishment_matrix", resolved: true, summary: "寅巳申 (detected/tertiary), 巳申亥 (detected/tertiary)" }),
      expect.objectContaining({ dependency: "twelve_qi_profile", resolved: true, summary: "yearBranch: หมกยก, monthBranch: หมกยก, dayBranch: ตี้อ๋วง, hourBranch: กวงตั่ว, mingGongBranch: ซี่, currentDaYunBranch: ตี้อ๋วง, currentLiuNianBranch: ลิ่มกัว" }),
      expect.objectContaining({ dependency: "dayun_cycles", resolved: true, summary: "4-13:丁未, 14-23:丙午, 24-33:乙巳(current), 34-43:甲辰, 44-53:癸卯, 54-63:壬寅, 64-73:辛丑, 74-83:庚子, 84-93:己亥" }),
      expect.objectContaining({ dependency: "health_signals", resolved: true, summary: "shen sha ขุนนาง/อุปถัมภ์ (天乙贵人), ขุนนาง/อุปถัมภ์ (天乙贵人), ดอกท้อ (桃花)" }),
    ]);
  });

  test("exposes source-path blueprints for future extractor implementation", () => {
    expect(getEngineFactBlueprint("day_master")).toMatchObject({
      dependency: "day_master",
      label: "Day Master",
      sourcePaths: ["calculatedState.dayMaster"],
    });
    expect(getEngineFactBlueprint("useful_god")).toMatchObject({
      dependency: "useful_god",
      label: "Useful God",
      sourcePaths: [],
    });
  });
});